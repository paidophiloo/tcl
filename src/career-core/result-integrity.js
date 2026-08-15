import { PLAYER_BY_ID } from './career-core.js';
import { FIXTURES } from './season-2026-27-live.js';

const FIXTURE_BY_ID = new Map(FIXTURES.map(fixture => [fixture.id, fixture]));
const SUPPORTED_MATCH_EVENT_TYPES = new Set(['goal', 'yellow-card', 'red-card', 'injury']);

function uniquePlayerIds(ids) {
  const seen = new Set();
  const output = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!PLAYER_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    output.push(id);
  }
  return output;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
}

function canonicalMinute(value) {
  return Math.max(1, Math.min(120, nonNegativeInteger(value) || 1));
}

function sideForEvent(event) {
  if (event?.side === 'home') return 'home';
  if (event?.side === 'away') return 'away';
  return null;
}

function ensureLineupPlayer(lineups, side, playerId) {
  if (!lineups[side].includes(playerId)) lineups[side].push(playerId);
}

function canonicalGoalEvent(event, lineups) {
  const side = sideForEvent(event);
  if (!side) return null;
  const scorer = PLAYER_BY_ID.get(event.playerId);
  if (!scorer) return null;

  const isPenalty = event.isPenalty === true || event.penalty === true || event.goalType === 'penalty';
  const assist = !isPenalty ? PLAYER_BY_ID.get(event.assistPlayerId) : null;
  const validAssist = assist && assist.id !== scorer.id ? assist : null;
  ensureLineupPlayer(lineups, side, scorer.id);
  if (validAssist) ensureLineupPlayer(lineups, side, validAssist.id);

  return {
    ...event,
    type: 'goal',
    side,
    minute: canonicalMinute(event.minute),
    playerId: scorer.id,
    playerName: scorer.name,
    assistPlayerId: validAssist?.id || null,
    assistName: validAssist?.name || null,
    isPenalty,
    goalType: isPenalty ? 'penalty' : 'open-play'
  };
}

function canonicalDisciplineEvent(event, lineups) {
  const side = sideForEvent(event);
  if (!side || !['yellow-card', 'red-card'].includes(event?.type)) return null;
  const player = PLAYER_BY_ID.get(event.playerId);
  if (!player) return null;
  ensureLineupPlayer(lineups, side, player.id);
  return {
    ...event,
    type: event.type,
    side,
    minute: canonicalMinute(event.minute),
    playerId: player.id,
    playerName: player.name,
    reason: event.reason || event.cardReason || null
  };
}

function canonicalInjuryEvent(event, lineups) {
  const side = sideForEvent(event);
  if (!side || event?.type !== 'injury') return null;
  const player = PLAYER_BY_ID.get(event.playerId);
  if (!player) return null;
  ensureLineupPlayer(lineups, side, player.id);
  const durationDays = Number(event.durationDays);
  return {
    ...event,
    type: 'injury',
    side,
    minute: canonicalMinute(event.minute),
    playerId: player.id,
    playerName: player.name,
    injuryType: event.injuryType || event.typeName || 'injury',
    durationDays: Number.isFinite(durationDays) && durationDays > 0 ? Math.round(durationDays) : null
  };
}

function canonicalMatchEvent(event, lineups) {
  if (!event || !SUPPORTED_MATCH_EVENT_TYPES.has(event.type)) return null;
  if (event.type === 'goal') return canonicalGoalEvent(event, lineups);
  if (event.type === 'injury') return canonicalInjuryEvent(event, lineups);
  return canonicalDisciplineEvent(event, lineups);
}

export function canonicalizeResult(result) {
  const fixture = FIXTURE_BY_ID.get(result?.fixtureId);
  if (!fixture) return null;

  // Historical lineups are authoritative. We deliberately do not compare a player's
  // static catalog clubCode here because transfers can make that value stale for a
  // later fixture while the saved match lineup remains the factual source of truth.
  const lineups = {
    home: uniquePlayerIds(result?.lineups?.home),
    away: uniquePlayerIds(result?.lineups?.away)
  };
  const events = (Array.isArray(result?.events) ? result.events : [])
    .map(event => canonicalMatchEvent(event, lineups))
    .filter(Boolean)
    .sort((left, right) => left.minute - right.minute || left.type.localeCompare(right.type));
  const goalEvents = events.filter(event => event.type === 'goal');
  const homeGoals = goalEvents.filter(event => event.side === 'home').length;
  const awayGoals = goalEvents.filter(event => event.side === 'away').length;

  return {
    ...result,
    fixtureId: fixture.id,
    matchweek: fixture.matchweek,
    date: fixture.date,
    time: fixture.time,
    home: fixture.home,
    away: fixture.away,
    homeGoals,
    awayGoals,
    lineups,
    events
  };
}

export function canonicalResults(career) {
  const output = {};
  for (const result of Object.values(career?.results || {})) {
    const canonical = canonicalizeResult(result);
    if (canonical && !output[canonical.fixtureId]) output[canonical.fixtureId] = canonical;
  }
  return output;
}

export function playerStatsFromResults(careerOrResults) {
  const results = careerOrResults?.results
    ? canonicalResults(careerOrResults)
    : canonicalResults({ results: careerOrResults || {} });
  const stats = {};
  const ensure = id => (stats[id] ||= { appearances: 0, goals: 0, assists: 0, penaltyGoals: 0 });

  for (const result of Object.values(results)) {
    for (const id of new Set([...(result.lineups?.home || []), ...(result.lineups?.away || [])])) {
      ensure(id).appearances += 1;
    }
    for (const event of result.events || []) {
      if (event.type !== 'goal') continue;
      ensure(event.playerId).goals += 1;
      if (event.isPenalty) ensure(event.playerId).penaltyGoals += 1;
      if (event.assistPlayerId) ensure(event.assistPlayerId).assists += 1;
    }
  }
  return stats;
}

export function reconcileCareerData(career) {
  if (!career || typeof career !== 'object') return career;
  career.results = canonicalResults(career);
  career.playerStats = playerStatsFromResults(career.results);
  return career;
}

export function auditCareerData(career) {
  const results = canonicalResults(career);
  const stats = playerStatsFromResults(results);
  const rows = Object.values(results);
  const allEvents = rows.flatMap(result => result.events || []);
  const goalEvents = allEvents.filter(event => event.type === 'goal');
  const homeGoals = rows.reduce((sum, result) => sum + result.homeGoals, 0);
  const awayGoals = rows.reduce((sum, result) => sum + result.awayGoals, 0);
  const playerGoals = Object.values(stats).reduce((sum, row) => sum + row.goals, 0);
  const assists = Object.values(stats).reduce((sum, row) => sum + row.assists, 0);
  const assistedEvents = goalEvents.filter(event => event.assistPlayerId).length;
  const penaltyGoals = Object.values(stats).reduce((sum, row) => sum + row.penaltyGoals, 0);
  const penaltyEvents = goalEvents.filter(event => event.isPenalty).length;

  return {
    ok:
      rows.length === Object.keys(career?.results || {}).length &&
      homeGoals + awayGoals === goalEvents.length &&
      playerGoals === goalEvents.length &&
      assists === assistedEvents &&
      penaltyGoals === penaltyEvents,
    results: rows.length,
    goals: goalEvents.length,
    incidents: allEvents.length,
    redCards: allEvents.filter(event => event.type === 'red-card').length,
    injuries: allEvents.filter(event => event.type === 'injury').length,
    assists,
    penaltyGoals,
    playerStats: stats
  };
}
