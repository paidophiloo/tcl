import { CAREER_EVENT_TYPES } from './event-ledger.js';
import { NEWSROOM_PERFORMANCE_EVENT_TYPES, PERFORMANCE_KINDS, MILESTONE_KINDS, SEASON_RECORD_KINDS } from './newsroom-performance-types.js';

const REQUIRED_FACTS = Object.freeze({
  [CAREER_EVENT_TYPES.MATCH_PLAYED]: ['fixtureId', 'homeCode', 'awayCode', 'homeGoals', 'awayGoals'],
  [CAREER_EVENT_TYPES.GOAL]: ['fixtureId', 'playerId', 'clubCode', 'minute'],
  [CAREER_EVENT_TYPES.RED_CARD]: ['fixtureId', 'playerId', 'clubCode', 'minute'],
  [CAREER_EVENT_TYPES.INJURY]: ['daysOut'],
  [CAREER_EVENT_TYPES.TRANSFER_COMPLETED]: ['playerId', 'toClubCode'],
  [CAREER_EVENT_TYPES.LOAN_COMPLETED]: ['playerId', 'fromClubCode', 'toClubCode'],
  [NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE]: ['fixtureId', 'playerId', 'clubCode', 'performanceTypes'],
  [NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE]: ['fixtureId', 'playerId', 'clubCode', 'milestones'],
  [NEWSROOM_PERFORMANCE_EVENT_TYPES.SEASON_RECORD]: ['fixtureId', 'recordKind']
});

function finiteScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function missingFacts(event) {
  return (REQUIRED_FACTS[event?.type] || []).filter(key => event?.facts?.[key] == null || event.facts[key] === '');
}

function matchScore(event, context) {
  const facts = event.facts || {};
  const homeGoals = finiteScore(facts.homeGoals);
  const awayGoals = finiteScore(facts.awayGoals);
  const margin = Math.abs(homeGoals - awayGoals);
  const totalGoals = homeGoals + awayGoals;
  const userClub = context.userClubCode;
  const involvesUser = event.entities?.clubCodes?.includes(userClub);
  const rivalry = Boolean(facts.rivalry || event.context?.rivalry);
  const knockout = Boolean(facts.knockout || event.context?.knockout);
  const titleRace = Boolean(event.context?.titleRace);
  const relegation = Boolean(event.context?.relegationBattle);
  const upsetGap = Math.max(0, finiteScore(event.context?.eloUpsetGap));
  return 24 + margin * 5 + Math.min(16, totalGoals * 2) + (involvesUser ? 18 : 0) +
    (rivalry ? 14 : 0) + (knockout ? 18 : 0) + (titleRace ? 10 : 0) +
    (relegation ? 8 : 0) + Math.min(12, upsetGap / 25);
}

function injuryScore(event, context) {
  const daysOut = Math.max(0, finiteScore(event.facts?.daysOut));
  const importance = Math.max(0, Math.min(1, finiteScore(event.context?.playerImportance)));
  const userClub = event.entities?.clubCodes?.includes(context.userClubCode);
  return 14 + Math.min(30, daysOut / 2) + importance * 22 + (userClub ? 14 : 0);
}

function transferScore(event, context) {
  const fee = Math.max(0, finiteScore(event.facts?.fee));
  const rating = Math.max(0, finiteScore(event.context?.playerRating));
  const userClub = event.entities?.clubCodes?.includes(context.userClubCode);
  const completion = [CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type);
  return 18 + (completion ? 18 : 4) + Math.min(26, fee / 5_000_000) + Math.max(0, rating - 72) * 1.2 + (userClub ? 16 : 0);
}

function performanceScore(event, context) {
  const kinds = Array.isArray(event.facts?.performanceTypes) ? event.facts.performanceTypes : [];
  let score = 24;
  if (kinds.includes(PERFORMANCE_KINDS.FOUR_PLUS_GOALS)) score = Math.max(score, 84);
  if (kinds.includes(PERFORMANCE_KINDS.HAT_TRICK)) score = Math.max(score, 74);
  if (kinds.includes(PERFORMANCE_KINDS.BRACE)) score = Math.max(score, 54);
  if (kinds.includes(PERFORMANCE_KINDS.ASSIST_DOUBLE)) score = Math.max(score, 50 + Math.min(10, Math.max(0, finiteScore(event.facts?.assists) - 2) * 4));
  if (kinds.includes(PERFORMANCE_KINDS.STARTER_SHUTOUT)) score = Math.max(score, 28);
  const milestone = (event.facts?.milestonesReached || []).find(item => item?.kind === MILESTONE_KINDS.SEASON_GOALS);
  if (milestone) score += Math.min(12, Math.max(0, finiteScore(milestone.value)) / 3);
  if (event.entities?.clubCodes?.includes(context.userClubCode)) score += 10;
  if (event.context?.rivalry) score += 5;
  return score;
}

function milestoneScore(event, context) {
  const milestones = Array.isArray(event.facts?.milestones) ? event.facts.milestones : [];
  let score = 36;
  if (milestones.some(item => item?.kind === MILESTONE_KINDS.FIRST_CLUB_GOAL)) score = Math.max(score, 44);
  const season = milestones.find(item => item?.kind === MILESTONE_KINDS.SEASON_GOALS);
  if (season) score = Math.max(score, 44 + Math.min(38, Math.max(0, finiteScore(season.value)) * 1.5));
  if (event.entities?.clubCodes?.includes(context.userClubCode)) score += 10;
  return score;
}

function seasonRecordScore(event, context) {
  const facts = event.facts || {};
  const involvesUser = event.entities?.clubCodes?.includes(context.userClubCode);
  let score = 42;
  if (facts.recordKind === SEASON_RECORD_KINDS.TOP_SCORER_LEAD) {
    score = 46 + Math.min(34, Math.max(0, finiteScore(facts.goals)) * 2.2);
  } else if (facts.recordKind === SEASON_RECORD_KINDS.BIGGEST_WIN_SO_FAR) {
    score = 46 + Math.min(30, Math.max(0, finiteScore(facts.margin)) * 5);
  } else if (facts.recordKind === SEASON_RECORD_KINDS.HIGHEST_SCORING_MATCH_SO_FAR) {
    score = 44 + Math.min(30, Math.max(0, finiteScore(facts.totalGoals)) * 3.5);
  }
  return score + (involvesUser ? 8 : 0);
}

function validPerformanceArrays(event, errors) {
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE) {
    if (!Array.isArray(event.facts?.performanceTypes) || !event.facts.performanceTypes.length) errors.push('performance-types-invalid');
  }
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE) {
    if (!Array.isArray(event.facts?.milestones) || !event.facts.milestones.length) errors.push('milestones-invalid');
  }
}

function validateSeasonRecord(event, errors) {
  if (event.type !== NEWSROOM_PERFORMANCE_EVENT_TYPES.SEASON_RECORD) return;
  const facts = event.facts || {};
  if (!Object.values(SEASON_RECORD_KINDS).includes(facts.recordKind)) errors.push('season-record-kind-invalid');
  if (facts.recordKind === SEASON_RECORD_KINDS.TOP_SCORER_LEAD) {
    if (!facts.playerId) errors.push('fact-missing:playerId');
    if (!facts.clubCode) errors.push('fact-missing:clubCode');
    if (finiteScore(facts.goals) < 3) errors.push('record-goals-invalid');
  }
  if (facts.recordKind === SEASON_RECORD_KINDS.BIGGEST_WIN_SO_FAR) {
    if (!facts.homeCode || !facts.awayCode || !facts.winnerCode) errors.push('record-match-facts-missing');
    if (finiteScore(facts.margin) < 3) errors.push('record-margin-invalid');
  }
  if (facts.recordKind === SEASON_RECORD_KINDS.HIGHEST_SCORING_MATCH_SO_FAR) {
    if (!facts.homeCode || !facts.awayCode) errors.push('record-match-facts-missing');
    if (finiteScore(facts.totalGoals) < 5) errors.push('record-total-goals-invalid');
  }
}

export function validateNewsFact(event) {
  const errors = [];
  if (!event || typeof event !== 'object') return { valid: false, errors: ['event-missing'] };
  if (!event.id) errors.push('id-missing');
  if (!event.type) errors.push('type-missing');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event.gameDate || ''))) errors.push('game-date-invalid');
  if (!event.source) errors.push('source-missing');
  for (const key of missingFacts(event)) errors.push(`fact-missing:${key}`);

  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) {
    const homeGoals = Number(event.facts?.homeGoals);
    const awayGoals = Number(event.facts?.awayGoals);
    if (!Number.isInteger(homeGoals) || homeGoals < 0) errors.push('home-goals-invalid');
    if (!Number.isInteger(awayGoals) || awayGoals < 0) errors.push('away-goals-invalid');
    if (event.facts?.homeCode === event.facts?.awayCode) errors.push('same-club-match');
  }
  if (event.type === CAREER_EVENT_TYPES.INJURY && finiteScore(event.facts?.daysOut) < 0) errors.push('days-out-invalid');
  if ([CAREER_EVENT_TYPES.GOAL, CAREER_EVENT_TYPES.RED_CARD].includes(event.type)) {
    const minute = finiteScore(event.facts?.minute);
    if (minute < 1 || minute > 130) errors.push('match-minute-invalid');
  }
  if (event.type === CAREER_EVENT_TYPES.TRANSFER_COMPLETED && !event.facts?.freeAgent && !event.facts?.fromClubCode) {
    errors.push('fact-missing:fromClubCode');
  }
  validPerformanceArrays(event, errors);
  validateSeasonRecord(event, errors);

  return { valid: errors.length === 0, errors };
}

export function scoreNewsworthiness(event, context = {}) {
  const validation = validateNewsFact(event);
  if (!validation.valid) return { score: 0, tier: 'reject', validation };

  let score = 10;
  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) score = matchScore(event, context);
  else if (event.type === CAREER_EVENT_TYPES.INJURY) score = injuryScore(event, context);
  else if ([CAREER_EVENT_TYPES.TRANSFER_LISTED, CAREER_EVENT_TYPES.TRANSFER_OFFERED, CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) score = transferScore(event, context);
  else if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE) score = performanceScore(event, context);
  else if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE) score = milestoneScore(event, context);
  else if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.SEASON_RECORD) score = seasonRecordScore(event, context);
  else if (event.type === CAREER_EVENT_TYPES.MANAGER_PRESS) score = 22 + (event.entities?.clubCodes?.includes(context.userClubCode) ? 16 : 0);
  else if (event.type === CAREER_EVENT_TYPES.RED_CARD) score = 34 + (event.entities?.clubCodes?.includes(context.userClubCode) ? 12 : 0);
  else if (event.type === CAREER_EVENT_TYPES.BOARD_MESSAGE) score = 28;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = score >= 75 ? 'lead' : score >= 55 ? 'major' : score >= 35 ? 'brief' : 'wire';
  return { score, tier, validation };
}

export function rankNewsEvents(events = [], context = {}) {
  return events
    .map(event => ({ event, ...scoreNewsworthiness(event, context) }))
    .filter(item => item.validation.valid && item.score > 0 && item.event.visibility !== 'internal')
    .sort((a, b) => b.score - a.score || b.event.gameDate.localeCompare(a.event.gameDate));
}

export function factualClaimsFromEvent(event) {
  const validation = validateNewsFact(event);
  if (!validation.valid) return [];
  const claims = [];
  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) {
    claims.push({ kind: 'score', homeCode: event.facts.homeCode, awayCode: event.facts.awayCode, homeGoals: event.facts.homeGoals, awayGoals: event.facts.awayGoals });
  }
  if (event.type === CAREER_EVENT_TYPES.GOAL) {
    claims.push({
      kind: 'goal',
      playerId: event.facts.playerId,
      clubCode: event.facts.clubCode,
      minute: event.facts.minute,
      assistPlayerId: event.facts.assistPlayerId || null,
      isPenalty: Boolean(event.facts.isPenalty),
      scoreAfter: event.facts.scoreAfter || null
    });
  }
  if (event.type === CAREER_EVENT_TYPES.RED_CARD) {
    claims.push({
      kind: 'red-card',
      playerId: event.facts.playerId,
      clubCode: event.facts.clubCode,
      minute: event.facts.minute,
      reason: event.facts.reason || null,
      scoreAtIncident: event.facts.scoreAtIncident || null
    });
  }
  if (event.type === CAREER_EVENT_TYPES.INJURY) {
    claims.push({ kind: 'injury', playerIds: event.entities?.playerIds || [], daysOut: event.facts.daysOut, minute: event.facts.minute || null, fixtureId: event.facts.fixtureId || null });
  }
  if ([CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) {
    claims.push({ kind: 'move', playerId: event.facts.playerId, fromClubCode: event.facts.fromClubCode, toClubCode: event.facts.toClubCode, fee: event.facts.fee ?? null });
  }
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE) {
    claims.push({
      kind: 'performance',
      fixtureId: event.facts.fixtureId,
      playerId: event.facts.playerId,
      clubCode: event.facts.clubCode,
      opponentCode: event.facts.opponentCode || null,
      performanceTypes: [...event.facts.performanceTypes],
      goals: Math.max(0, Number(event.facts.goals) || 0),
      assists: Math.max(0, Number(event.facts.assists) || 0),
      teamGoalsConceded: event.facts.teamGoalsConceded ?? null,
      officialIndividualCleanSheet: event.facts.officialIndividualCleanSheet ?? null,
      seasonGoalsAfter: event.facts.seasonGoalsAfter ?? null,
      milestonesReached: Array.isArray(event.facts.milestonesReached) ? event.facts.milestonesReached : []
    });
  }
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE) {
    claims.push({
      kind: 'milestone',
      fixtureId: event.facts.fixtureId,
      playerId: event.facts.playerId,
      clubCode: event.facts.clubCode,
      matchGoals: Math.max(0, Number(event.facts.matchGoals) || 0),
      seasonGoalsAfter: event.facts.seasonGoalsAfter ?? null,
      clubGoalsAfter: event.facts.clubGoalsAfter ?? null,
      milestones: [...event.facts.milestones]
    });
  }
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.SEASON_RECORD) {
    claims.push({
      kind: 'season-record',
      recordKind: event.facts.recordKind,
      fixtureId: event.facts.fixtureId,
      playerId: event.facts.playerId || null,
      clubCode: event.facts.clubCode || null,
      goals: event.facts.goals ?? null,
      homeCode: event.facts.homeCode || null,
      awayCode: event.facts.awayCode || null,
      homeGoals: event.facts.homeGoals ?? null,
      awayGoals: event.facts.awayGoals ?? null,
      winnerCode: event.facts.winnerCode || null,
      margin: event.facts.margin ?? null,
      totalGoals: event.facts.totalGoals ?? null,
      previousMargin: event.facts.previousMargin ?? null,
      previousTotalGoals: event.facts.previousTotalGoals ?? null
    });
  }
  return claims;
}
