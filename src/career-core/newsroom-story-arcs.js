import { CAREER_EVENT_TYPES, careerEvents } from './event-ledger.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES } from './newsroom-governance-types.js';

const ARC_SCHEMA_VERSION = 1;
const RECENT_WINDOW = 6;

export const NEWSROOM_STORY_ARC_SCHEMA_VERSION = ARC_SCHEMA_VERSION;

function clubResult(event, clubCode) {
  const facts = event?.facts || {};
  const homeCode = facts.homeCode;
  const awayCode = facts.awayCode;
  const homeGoals = Number(facts.homeGoals);
  const awayGoals = Number(facts.awayGoals);
  if (!clubCode || !Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;
  if (homeCode !== clubCode && awayCode !== clubCode) return null;
  const scored = homeCode === clubCode ? homeGoals : awayGoals;
  const conceded = homeCode === clubCode ? awayGoals : homeGoals;
  return scored === conceded ? 'D' : scored > conceded ? 'W' : 'L';
}

function recentClubResults(events, clubCode, limit = RECENT_WINDOW) {
  return events
    .filter(event => event.type === CAREER_EVENT_TYPES.MATCH_PLAYED)
    .map(event => ({ event, result: clubResult(event, clubCode) }))
    .filter(item => item.result)
    .sort((left, right) => left.event.gameDate.localeCompare(right.event.gameDate) || left.event.id.localeCompare(right.event.id))
    .slice(-limit);
}

function streakArc(events, clubCode) {
  const recent = recentClubResults(events, clubCode);
  if (recent.length < 3) return null;
  const latest = recent.at(-1)?.result;
  if (!latest || latest === 'D') return null;
  let length = 0;
  for (let index = recent.length - 1; index >= 0 && recent[index].result === latest; index -= 1) length += 1;
  if (length < 3) return null;
  const supporting = recent.slice(-length).map(item => item.event.id);
  return {
    schemaVersion: ARC_SCHEMA_VERSION,
    id: `arc-form-${clubCode}-${latest.toLowerCase()}`,
    type: latest === 'W' ? 'form.winning-streak' : 'form.losing-streak',
    subject: { clubCode },
    status: 'active',
    startedOn: recent.at(-length).event.gameDate,
    updatedOn: recent.at(-1).event.gameDate,
    strength: Math.min(100, 45 + length * 12),
    facts: { streak: length, result: latest },
    eventIds: supporting
  };
}

function scorerFormArc(events, clubCode) {
  const recentMatches = events
    .filter(event => event.type === CAREER_EVENT_TYPES.MATCH_PLAYED && event.entities?.clubCodes?.includes(clubCode))
    .sort((left, right) => left.gameDate.localeCompare(right.gameDate) || left.id.localeCompare(right.id))
    .slice(-5);
  if (recentMatches.length < 2) return null;
  const fixtureIds = new Set(recentMatches.map(event => String(event.facts?.fixtureId || event.links?.fixtureId || '')).filter(Boolean));
  const rows = new Map();
  for (const event of events) {
    if (event.type !== CAREER_EVENT_TYPES.GOAL || event.facts?.clubCode !== clubCode) continue;
    const fixtureId = String(event.facts?.fixtureId || event.links?.fixtureId || '');
    if (!fixtureIds.has(fixtureId) || !event.facts?.playerId) continue;
    const playerId = String(event.facts.playerId);
    const row = rows.get(playerId) || { playerId, goals: 0, fixtures: new Set(), goalEvents: [], latestDate: event.gameDate };
    row.goals += 1;
    row.fixtures.add(fixtureId);
    row.goalEvents.push(event);
    if (event.gameDate > row.latestDate) row.latestDate = event.gameDate;
    rows.set(playerId, row);
  }
  const best = [...rows.values()]
    .filter(row => row.goals >= 4 && row.fixtures.size >= 2)
    .sort((left, right) => right.goals - left.goals || right.fixtures.size - left.fixtures.size || right.latestDate.localeCompare(left.latestDate) || left.playerId.localeCompare(right.playerId))[0];
  if (!best) return null;
  const supportingMatches = recentMatches.filter(event => best.fixtures.has(String(event.facts?.fixtureId || event.links?.fixtureId || '')));
  return {
    schemaVersion: ARC_SCHEMA_VERSION,
    id: `arc-scorer-${clubCode}-${best.playerId}`,
    type: 'player.scoring-form',
    subject: { clubCode, playerId: best.playerId },
    status: 'active',
    startedOn: [...best.goalEvents].sort((a, b) => a.gameDate.localeCompare(b.gameDate))[0].gameDate,
    updatedOn: best.latestDate,
    strength: Math.min(100, 40 + best.goals * 8 + best.fixtures.size * 4),
    facts: { playerId: best.playerId, goals: best.goals, matchesScoredIn: best.fixtures.size, windowMatches: recentMatches.length },
    eventIds: [...supportingMatches.map(event => event.id), ...best.goalEvents.map(event => event.id)]
  };
}

function injuryArc(events, clubCode) {
  const injuries = events.filter(event =>
    event.type === CAREER_EVENT_TYPES.INJURY && event.entities?.clubCodes?.includes(clubCode)
  );
  if (!injuries.length) return null;
  const latestByPlayer = new Map();
  for (const event of events) {
    for (const playerId of event.entities?.playerIds || []) {
      if (event.type === CAREER_EVENT_TYPES.INJURY) latestByPlayer.set(playerId, event);
      if (event.type === CAREER_EVENT_TYPES.PLAYER_RETURNED) latestByPlayer.delete(playerId);
    }
  }
  const active = [...latestByPlayer.entries()]
    .filter(([, event]) => event.entities?.clubCodes?.includes(clubCode))
    .map(([playerId, event]) => ({ playerId, event }));
  if (!active.length) return null;
  const daysOut = active.reduce((sum, item) => sum + Math.max(0, Number(item.event.facts?.daysOut) || 0), 0);
  return {
    schemaVersion: ARC_SCHEMA_VERSION,
    id: `arc-injuries-${clubCode}`,
    type: 'squad.injury-pressure',
    subject: { clubCode },
    status: 'active',
    startedOn: active.map(item => item.event.gameDate).sort()[0],
    updatedOn: active.map(item => item.event.gameDate).sort().at(-1),
    strength: Math.min(100, 35 + active.length * 15 + Math.min(25, daysOut / 4)),
    facts: { activeInjuries: active.length, combinedDaysOut: daysOut, playerIds: active.map(item => item.playerId) },
    eventIds: active.map(item => item.event.id)
  };
}

function transferArc(events, clubCode) {
  const transferEvents = events.filter(event =>
    event.entities?.clubCodes?.includes(clubCode) &&
    [CAREER_EVENT_TYPES.TRANSFER_LISTED, CAREER_EVENT_TYPES.TRANSFER_OFFERED, CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)
  );
  if (!transferEvents.length) return null;
  const recent = transferEvents.slice(-8);
  const completed = recent.filter(event =>
    [CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)
  );
  return {
    schemaVersion: ARC_SCHEMA_VERSION,
    id: `arc-market-${clubCode}`,
    type: 'club.transfer-activity',
    subject: { clubCode },
    status: 'active',
    startedOn: recent[0].gameDate,
    updatedOn: recent.at(-1).gameDate,
    strength: Math.min(100, 30 + recent.length * 7 + completed.length * 9),
    facts: { activity: recent.length, completed: completed.length },
    eventIds: recent.map(event => event.id)
  };
}

const MANAGER_TYPES = new Set([
  NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_SACKED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_HIRED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_POACHED
]);

function managerRoleForClub(event, clubCode) {
  if (!MANAGER_TYPES.has(event.type)) return null;
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_POACHED && event.facts?.fromClubCode === clubCode) return 'departed';
  if (event.facts?.clubCode !== clubCode) return null;
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE) return 'pressure';
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_SACKED) return 'departed';
  return 'arrived';
}

function matchesAfter(events, clubCode, date) {
  return events.filter(event => event.type === CAREER_EVENT_TYPES.MATCH_PLAYED
    && event.gameDate > date
    && event.entities?.clubCodes?.includes(clubCode));
}

function managerArc(events, clubCode) {
  const relevant = events
    .map(event => ({ event, role: managerRoleForClub(event, clubCode) }))
    .filter(row => row.role)
    .sort((left, right) => left.event.gameDate.localeCompare(right.event.gameDate) || left.event.id.localeCompare(right.event.id));
  if (!relevant.length) return null;
  const latest = relevant.at(-1);
  const event = latest.event;

  if (latest.role === 'pressure') {
    const critical = event.facts?.band === 'critical';
    const supporting = relevant.filter(row => row.role === 'pressure').slice(-3).map(row => row.event.id);
    return {
      schemaVersion: ARC_SCHEMA_VERSION,
      id: `arc-manager-pressure-${clubCode}`,
      type: 'club.manager-pressure',
      subject: { clubCode },
      status: 'active',
      startedOn: relevant.filter(row => row.role === 'pressure')[0].event.gameDate,
      updatedOn: event.gameDate,
      strength: critical ? 100 : 86,
      facts: {
        managerName: event.facts?.managerName || 'Treinador',
        confidence: Number(event.facts?.confidence) || 0,
        band: event.facts?.band || 'pressure',
        ppg: event.facts?.ppg ?? null,
        expectedPpg: event.facts?.expectedPpg ?? null,
        sampleMatches: Number(event.facts?.sampleMatches) || 0
      },
      eventIds: supporting
    };
  }

  if (latest.role === 'departed') {
    const pressure = relevant.filter(row => row.role === 'pressure' && row.event.gameDate <= event.gameDate).slice(-2).map(row => row.event.id);
    return {
      schemaVersion: ARC_SCHEMA_VERSION,
      id: `arc-manager-vacancy-${clubCode}`,
      type: 'club.manager-vacancy',
      subject: { clubCode },
      status: 'active',
      startedOn: event.gameDate,
      updatedOn: event.gameDate,
      strength: 94,
      facts: {
        formerManagerName: event.facts?.managerName || 'Treinador',
        departureType: event.type,
        fromClubCode: event.facts?.fromClubCode || null
      },
      eventIds: [...pressure, event.id]
    };
  }

  const played = matchesAfter(events, clubCode, event.gameDate);
  if (played.length >= 5) return null;
  const priorDeparture = [...relevant].reverse().find(row => row.role === 'departed' && row.event.gameDate <= event.gameDate);
  return {
    schemaVersion: ARC_SCHEMA_VERSION,
    id: `arc-manager-transition-${clubCode}-${event.facts?.managerId || event.id}`,
    type: 'club.manager-transition',
    subject: { clubCode },
    status: 'active',
    startedOn: event.gameDate,
    updatedOn: played.at(-1)?.gameDate || event.gameDate,
    strength: Math.max(60, 92 - played.length * 7),
    facts: {
      managerId: event.facts?.managerId || null,
      managerName: event.facts?.managerName || 'Treinador',
      tacticalStyle: event.facts?.tacticalStyle || null,
      fromClubCode: event.facts?.fromClubCode || null,
      matchesUnderManager: played.length
    },
    eventIds: [priorDeparture?.event.id, event.id, ...played.map(match => match.id)].filter(Boolean)
  };
}

const CONTRACT_ARC_TYPES = new Set([
  CAREER_EVENT_TYPES.CONTRACT_RENEWED,
  CAREER_EVENT_TYPES.TRANSFER_COMPLETED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_EXPIRED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED
]);

function contractEventTouchesClub(event, clubCode) {
  if (!CONTRACT_ARC_TYPES.has(event.type)) return false;
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED || event.type === CAREER_EVENT_TYPES.CONTRACT_RENEWED || event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_EXPIRED) {
    return event.facts?.clubCode === clubCode;
  }
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED) {
    return event.facts?.fromClubCode === clubCode || event.facts?.toClubCode === clubCode;
  }
  return Boolean(event.facts?.bosman) && (event.facts?.fromClubCode === clubCode || event.facts?.toClubCode === clubCode);
}

function contractSagaArc(events, clubCode) {
  const byPlayer = new Map();
  for (const event of events) {
    if (!contractEventTouchesClub(event, clubCode)) continue;
    const playerId = event.facts?.playerId || event.entities?.playerIds?.[0];
    if (!playerId) continue;
    const rows = byPlayer.get(playerId) || [];
    rows.push(event);
    byPlayer.set(playerId, rows);
  }

  const candidates = [];
  for (const [playerId, rows] of byPlayer) {
    rows.sort((left, right) => left.gameDate.localeCompare(right.gameDate) || left.id.localeCompare(right.id));
    const latest = rows.at(-1);
    if (latest.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED && latest.facts?.clubCode === clubCode) {
      const daysRemaining = Math.max(0, Number(latest.facts?.daysRemaining) || 0);
      candidates.push({
        schemaVersion: ARC_SCHEMA_VERSION,
        id: `arc-contract-risk-${clubCode}-${playerId}`,
        type: 'player.contract-risk',
        subject: { clubCode, playerId },
        status: 'active',
        startedOn: rows[0].gameDate,
        updatedOn: latest.gameDate,
        strength: Math.min(92, 60 + (daysRemaining <= 180 ? 24 : daysRemaining <= 365 ? 15 : 7)),
        facts: { playerId, daysRemaining, reason: latest.facts?.reason || null },
        eventIds: rows.slice(-3).map(event => event.id)
      });
    }
    if (latest.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED) {
      const direction = latest.facts?.fromClubCode === clubCode ? 'departure' : 'arrival';
      candidates.push({
        schemaVersion: ARC_SCHEMA_VERSION,
        id: `arc-bosman-${clubCode}-${playerId}`,
        type: 'player.bosman-agreement',
        subject: { clubCode, playerId },
        status: 'active',
        startedOn: latest.gameDate,
        updatedOn: latest.gameDate,
        strength: direction === 'departure' ? 88 : 78,
        facts: {
          playerId,
          direction,
          fromClubCode: latest.facts?.fromClubCode || null,
          toClubCode: latest.facts?.toClubCode || null,
          startsAt: latest.facts?.startsAt || null
        },
        eventIds: rows.slice(-3).map(event => event.id)
      });
    }
  }
  return candidates.sort((left, right) => right.strength - left.strength || right.updatedOn.localeCompare(left.updatedOn))[0] || null;
}

export function buildStoryArcs(career, options = {}) {
  const events = careerEvents(career, options.filter || {});
  const clubCodes = new Set(options.clubCodes || []);
  for (const event of events) {
    for (const code of event.entities?.clubCodes || []) clubCodes.add(code);
  }
  const arcs = [];
  for (const clubCode of clubCodes) {
    for (const arc of [managerArc(events, clubCode), streakArc(events, clubCode), scorerFormArc(events, clubCode), injuryArc(events, clubCode), transferArc(events, clubCode), contractSagaArc(events, clubCode)]) {
      if (arc) arcs.push(arc);
    }
  }
  return arcs.sort((a, b) => b.strength - a.strength || b.updatedOn.localeCompare(a.updatedOn));
}

export function storyArcsForClub(career, clubCode) {
  return buildStoryArcs(career, { clubCodes: [clubCode] }).filter(arc => arc.subject.clubCode === clubCode);
}

export function strongestStoryArc(career, clubCode = null) {
  const arcs = clubCode ? storyArcsForClub(career, clubCode) : buildStoryArcs(career);
  return arcs[0] || null;
}
