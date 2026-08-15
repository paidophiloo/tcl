import { PLAYER_BY_ID } from './career-core.js';
import { CAREER_EVENT_TYPES, appendCareerEvent } from './event-ledger.js';
import {
  MILESTONE_KINDS,
  NEWSROOM_PERFORMANCE_EVENT_TYPES,
  PERFORMANCE_KINDS,
  SEASON_GOAL_MILESTONES
} from './newsroom-performance-types.js';

function compact(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function sortedResults(career) {
  return Object.values(career?.results || {})
    .filter(result => result?.fixtureId && result?.date)
    .sort((left, right) => left.date.localeCompare(right.date) || String(left.fixtureId).localeCompare(String(right.fixtureId)));
}

function clubForSide(result, side) {
  return side === 'home' ? result.home : side === 'away' ? result.away : null;
}

function opponentFor(result, clubCode) {
  if (result.home === clubCode) return result.away;
  if (result.away === clubCode) return result.home;
  return null;
}

function matchPlayerStats(result) {
  const rows = new Map();
  const ensure = (playerId, clubCode) => {
    if (!playerId || !clubCode) return null;
    const key = String(playerId);
    if (!rows.has(key)) rows.set(key, { playerId: key, clubCode, goals: 0, assists: 0 });
    return rows.get(key);
  };

  for (const incident of result.events || []) {
    if (incident?.type !== 'goal') continue;
    const clubCode = clubForSide(result, incident.side);
    const scorer = ensure(incident.playerId, clubCode);
    if (scorer) scorer.goals += 1;
    const assister = ensure(incident.assistPlayerId, clubCode);
    if (assister) assister.assists += 1;
  }
  return rows;
}

function performanceKinds(row) {
  const kinds = [];
  if (row.goals >= 4) kinds.push(PERFORMANCE_KINDS.FOUR_PLUS_GOALS);
  else if (row.goals === 3) kinds.push(PERFORMANCE_KINDS.HAT_TRICK);
  else if (row.goals === 2) kinds.push(PERFORMANCE_KINDS.BRACE);
  if (row.assists >= 2) kinds.push(PERFORMANCE_KINDS.ASSIST_DOUBLE);
  return kinds;
}

function arrivalRecorded(career, playerId, clubCode, gameDate) {
  return (career?.eventLedger?.events || []).some(event =>
    [CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type) &&
    event.gameDate <= gameDate &&
    String(event.facts?.playerId || event.entities?.playerIds?.[0] || '') === String(playerId) &&
    String(event.facts?.toClubCode || '') === String(clubCode)
  );
}

function milestonesReached(beforeSeason, afterSeason, beforeClub, afterClub, allowFirstClubGoal) {
  const milestones = [];
  if (allowFirstClubGoal && beforeClub === 0 && afterClub > 0) {
    milestones.push({ kind: MILESTONE_KINDS.FIRST_CLUB_GOAL, value: 1 });
  }
  const crossed = SEASON_GOAL_MILESTONES.filter(value => beforeSeason < value && afterSeason >= value);
  if (crossed.length) milestones.push({ kind: MILESTONE_KINDS.SEASON_GOALS, value: crossed.at(-1) });
  return milestones;
}

function eventBase(result, playerId, clubCode) {
  return {
    gameDate: result.date,
    source: 'career-performance-derivation',
    scope: 'match',
    visibility: 'public',
    entities: {
      clubCodes: compact([clubCode, opponentFor(result, clubCode)]),
      playerIds: compact([playerId])
    },
    context: {
      homeCode: result.home,
      awayCode: result.away,
      finalScore: { homeGoals: result.homeGoals, awayGoals: result.awayGoals }
    },
    links: { fixtureId: result.fixtureId }
  };
}

function performanceEvent(result, row, seasonGoalsAfter, clubGoalsAfter, milestones) {
  const kinds = performanceKinds(row);
  if (!kinds.length) return null;
  return {
    ...eventBase(result, row.playerId, row.clubCode),
    id: `evt-player-performance-${result.fixtureId}-${row.playerId}`,
    type: NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE,
    facts: {
      fixtureId: result.fixtureId,
      playerId: row.playerId,
      clubCode: row.clubCode,
      opponentCode: opponentFor(result, row.clubCode),
      performanceTypes: kinds,
      goals: row.goals,
      assists: row.assists,
      seasonGoalsAfter,
      clubGoalsAfter,
      milestonesReached: milestones
    }
  };
}

function milestoneEvent(result, row, seasonGoalsAfter, clubGoalsAfter, milestones) {
  if (!milestones.length) return null;
  return {
    ...eventBase(result, row.playerId, row.clubCode),
    id: `evt-player-milestone-${result.fixtureId}-${row.playerId}`,
    type: NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE,
    facts: {
      fixtureId: result.fixtureId,
      playerId: row.playerId,
      clubCode: row.clubCode,
      opponentCode: opponentFor(result, row.clubCode),
      matchGoals: row.goals,
      seasonGoalsAfter,
      clubGoalsAfter,
      milestones
    }
  };
}

function starterShutoutEvent(career, result, side) {
  const clubCode = side === 'home' ? result.home : result.away;
  const conceded = side === 'home' ? Number(result.awayGoals) : Number(result.homeGoals);
  if (conceded !== 0) return null;
  const lineup = result.lineups?.[side] || [];
  const goalkeeper = lineup.map(id => PLAYER_BY_ID.get(id)).find(player => player?.group === 'GK');
  if (!goalkeeper) return null;
  return {
    ...eventBase(result, goalkeeper.id, clubCode),
    id: `evt-player-performance-${result.fixtureId}-${goalkeeper.id}-starter-shutout`,
    type: NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE,
    visibility: clubCode === career.clubCode ? 'public' : 'internal',
    facts: {
      fixtureId: result.fixtureId,
      playerId: goalkeeper.id,
      clubCode,
      opponentCode: opponentFor(result, clubCode),
      performanceTypes: [PERFORMANCE_KINDS.STARTER_SHUTOUT],
      goals: 0,
      assists: 0,
      teamGoalsConceded: 0,
      starter: true,
      officialIndividualCleanSheet: false,
      milestonesReached: []
    }
  };
}

export function derivePerformanceEvents(career) {
  const seasonGoals = new Map();
  const clubGoals = new Map();
  const events = [];

  for (const result of sortedResults(career)) {
    const rows = matchPlayerStats(result);
    for (const row of [...rows.values()].sort((left, right) => left.playerId.localeCompare(right.playerId))) {
      const beforeSeason = seasonGoals.get(row.playerId) || 0;
      const clubKey = `${row.playerId}:${row.clubCode}`;
      const beforeClub = clubGoals.get(clubKey) || 0;
      const afterSeason = beforeSeason + row.goals;
      const afterClub = beforeClub + row.goals;
      const firstClubGoalIsKnown = arrivalRecorded(career, row.playerId, row.clubCode, result.date);
      const milestones = milestonesReached(beforeSeason, afterSeason, beforeClub, afterClub, firstClubGoalIsKnown);

      const performance = performanceEvent(result, row, afterSeason, afterClub, milestones);
      if (performance) events.push(performance);
      const milestone = milestoneEvent(result, row, afterSeason, afterClub, milestones);
      if (milestone) events.push(milestone);

      seasonGoals.set(row.playerId, afterSeason);
      clubGoals.set(clubKey, afterClub);
    }

    for (const side of ['home', 'away']) {
      const shutout = starterShutoutEvent(career, result, side);
      if (shutout) events.push(shutout);
    }
  }
  return events;
}

export function reconcilePerformanceNewsEvents(career) {
  if (!career || typeof career !== 'object') return [];
  const projected = [];
  for (const event of derivePerformanceEvents(career)) {
    const appended = appendCareerEvent(career, event, { gameDate: event.gameDate, source: event.source });
    if (appended?.id === event.id) projected.push(appended);
  }
  return projected;
}

export const NEWSROOM_PERFORMANCE_BRIDGE_META = Object.freeze({
  source: 'canonical career.results + recorded transfer arrivals',
  derived: Object.freeze(['brace', 'hat-trick', 'four-plus-goals', 'two-plus-assists', 'first-goal-after-recorded-club-arrival', 'season-goal-milestones', 'starter-in-team-shutout']),
  invariant: 'performance headlines are deterministic derivatives of canonical results; first-club-goal requires a recorded arrival and no subjective rating or untracked clean-sheet award is invented'
});
