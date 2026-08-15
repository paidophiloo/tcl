import { CAREER_EVENT_TYPES } from './event-ledger.js';

const REQUIRED_FACTS = Object.freeze({
  [CAREER_EVENT_TYPES.MATCH_PLAYED]: ['fixtureId', 'homeCode', 'awayCode', 'homeGoals', 'awayGoals'],
  [CAREER_EVENT_TYPES.GOAL]: ['fixtureId', 'playerId', 'clubCode', 'minute'],
  [CAREER_EVENT_TYPES.INJURY]: ['daysOut'],
  [CAREER_EVENT_TYPES.TRANSFER_COMPLETED]: ['playerId', 'toClubCode'],
  [CAREER_EVENT_TYPES.LOAN_COMPLETED]: ['playerId', 'fromClubCode', 'toClubCode']
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
  if (event.type === CAREER_EVENT_TYPES.GOAL) {
    const minute = finiteScore(event.facts?.minute);
    if (minute < 1 || minute > 130) errors.push('goal-minute-invalid');
  }
  if (event.type === CAREER_EVENT_TYPES.TRANSFER_COMPLETED && !event.facts?.freeAgent && !event.facts?.fromClubCode) {
    errors.push('fact-missing:fromClubCode');
  }

  return { valid: errors.length === 0, errors };
}

export function scoreNewsworthiness(event, context = {}) {
  const validation = validateNewsFact(event);
  if (!validation.valid) return { score: 0, tier: 'reject', validation };

  let score = 10;
  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) score = matchScore(event, context);
  else if (event.type === CAREER_EVENT_TYPES.INJURY) score = injuryScore(event, context);
  else if ([CAREER_EVENT_TYPES.TRANSFER_LISTED, CAREER_EVENT_TYPES.TRANSFER_OFFERED, CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) score = transferScore(event, context);
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
  if (event.type === CAREER_EVENT_TYPES.INJURY) {
    claims.push({ kind: 'injury', playerIds: event.entities?.playerIds || [], daysOut: event.facts.daysOut });
  }
  if ([CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) {
    claims.push({ kind: 'move', playerId: event.facts.playerId, fromClubCode: event.facts.fromClubCode, toClubCode: event.facts.toClubCode, fee: event.facts.fee ?? null });
  }
  return claims;
}
