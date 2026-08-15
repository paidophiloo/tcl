import { appendCareerEvent } from './event-ledger.js';
import { NEWSROOM_PERFORMANCE_EVENT_TYPES, SEASON_RECORD_KINDS } from './newsroom-performance-types.js';

function sortedResults(career) {
  return Object.values(career?.results || {})
    .filter(result => result?.fixtureId && result?.date)
    .sort((left, right) => left.date.localeCompare(right.date) || String(left.fixtureId).localeCompare(String(right.fixtureId)));
}

function clubForSide(result, side) {
  return side === 'home' ? result.home : side === 'away' ? result.away : null;
}

function resultFacts(result) {
  return {
    fixtureId: result.fixtureId,
    homeCode: result.home,
    awayCode: result.away,
    homeGoals: Number(result.homeGoals) || 0,
    awayGoals: Number(result.awayGoals) || 0
  };
}

function eventBase(result, recordKind, suffix) {
  return {
    id: `evt-season-record-${recordKind}-${suffix}`,
    type: NEWSROOM_PERFORMANCE_EVENT_TYPES.SEASON_RECORD,
    gameDate: result.date,
    source: 'career-season-record-derivation',
    scope: 'competition',
    visibility: 'public',
    links: { fixtureId: result.fixtureId }
  };
}

function biggestWinEvent(result, margin, previousMargin) {
  if (margin < 3 || margin <= previousMargin) return null;
  const winnerCode = Number(result.homeGoals) > Number(result.awayGoals) ? result.home : result.away;
  return {
    ...eventBase(result, SEASON_RECORD_KINDS.BIGGEST_WIN_SO_FAR, result.fixtureId),
    entities: { clubCodes: [result.home, result.away], playerIds: [] },
    facts: {
      recordKind: SEASON_RECORD_KINDS.BIGGEST_WIN_SO_FAR,
      ...resultFacts(result),
      winnerCode,
      margin,
      previousMargin
    }
  };
}

function highestScoringEvent(result, totalGoals, previousTotalGoals) {
  if (totalGoals < 5 || totalGoals <= previousTotalGoals) return null;
  return {
    ...eventBase(result, SEASON_RECORD_KINDS.HIGHEST_SCORING_MATCH_SO_FAR, result.fixtureId),
    entities: { clubCodes: [result.home, result.away], playerIds: [] },
    facts: {
      recordKind: SEASON_RECORD_KINDS.HIGHEST_SCORING_MATCH_SO_FAR,
      ...resultFacts(result),
      totalGoals,
      previousTotalGoals
    }
  };
}

function uniqueTopScorer(goalTotals) {
  const rows = [...goalTotals.entries()]
    .map(([playerId, row]) => ({ playerId, goals: row.goals, clubCode: row.clubCode }))
    .sort((left, right) => right.goals - left.goals || left.playerId.localeCompare(right.playerId));
  if (!rows.length || rows[0].goals < 3) return null;
  if (rows[1] && rows[1].goals === rows[0].goals) return null;
  return rows[0];
}

function topScorerEvent(result, leader, previousLeaderId) {
  if (!leader || leader.playerId === previousLeaderId) return null;
  return {
    ...eventBase(result, SEASON_RECORD_KINDS.TOP_SCORER_LEAD, `${result.fixtureId}-${leader.playerId}`),
    entities: { clubCodes: [leader.clubCode], playerIds: [leader.playerId] },
    facts: {
      recordKind: SEASON_RECORD_KINDS.TOP_SCORER_LEAD,
      fixtureId: result.fixtureId,
      playerId: leader.playerId,
      clubCode: leader.clubCode,
      goals: leader.goals,
      previousLeaderId: previousLeaderId || null
    }
  };
}

export function deriveSeasonRecordEvents(career) {
  const events = [];
  const goalTotals = new Map();
  let bestWinningMargin = 0;
  let highestMatchGoals = 0;
  let uniqueLeaderId = null;

  for (const result of sortedResults(career)) {
    const margin = Math.abs((Number(result.homeGoals) || 0) - (Number(result.awayGoals) || 0));
    const totalGoals = (Number(result.homeGoals) || 0) + (Number(result.awayGoals) || 0);

    const biggestWin = biggestWinEvent(result, margin, bestWinningMargin);
    if (biggestWin) events.push(biggestWin);
    bestWinningMargin = Math.max(bestWinningMargin, margin);

    const highestScoring = highestScoringEvent(result, totalGoals, highestMatchGoals);
    if (highestScoring) events.push(highestScoring);
    highestMatchGoals = Math.max(highestMatchGoals, totalGoals);

    for (const incident of result.events || []) {
      if (incident?.type !== 'goal' || !incident.playerId) continue;
      const playerId = String(incident.playerId);
      const clubCode = clubForSide(result, incident.side);
      if (!clubCode) continue;
      const row = goalTotals.get(playerId) || { goals: 0, clubCode };
      row.goals += 1;
      row.clubCode = clubCode;
      goalTotals.set(playerId, row);
    }

    const leader = uniqueTopScorer(goalTotals);
    const leaderEvent = topScorerEvent(result, leader, uniqueLeaderId);
    if (leaderEvent) events.push(leaderEvent);
    uniqueLeaderId = leader?.playerId || null;
  }
  return events;
}

export function reconcileSeasonRecordNewsEvents(career) {
  if (!career || typeof career !== 'object') return [];
  const projected = [];
  for (const event of deriveSeasonRecordEvents(career)) {
    const appended = appendCareerEvent(career, event, { gameDate: event.gameDate, source: event.source });
    if (appended?.id === event.id) projected.push(appended);
  }
  return projected;
}

export const NEWSROOM_RECORDS_BRIDGE_META = Object.freeze({
  source: 'canonical career.results',
  records: Object.freeze(['unique-season-top-scorer-lead', 'biggest-win-of-season-so-far', 'highest-scoring-match-of-season-so-far']),
  invariant: 'records describe only the current simulated season and never imply an all-time club or competition record without historical data'
});
