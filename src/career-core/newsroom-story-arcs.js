import { CAREER_EVENT_TYPES, careerEvents } from './event-ledger.js';

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

export function buildStoryArcs(career, options = {}) {
  const events = careerEvents(career, options.filter || {});
  const clubCodes = new Set(options.clubCodes || []);
  for (const event of events) {
    for (const code of event.entities?.clubCodes || []) clubCodes.add(code);
  }
  const arcs = [];
  for (const clubCode of clubCodes) {
    for (const arc of [streakArc(events, clubCode), scorerFormArc(events, clubCode), injuryArc(events, clubCode), transferArc(events, clubCode)]) {
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
