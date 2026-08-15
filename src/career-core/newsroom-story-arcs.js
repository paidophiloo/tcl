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
    for (const arc of [streakArc(events, clubCode), injuryArc(events, clubCode), transferArc(events, clubCode)]) {
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
