import { CAREER_EVENT_TYPES } from './event-ledger.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES } from './newsroom-governance-types.js';
import { NEWSROOM_PERFORMANCE_EVENT_TYPES } from './newsroom-performance-types.js';

const DAY = 86_400_000;
const MARKET_TYPES = new Set([
  CAREER_EVENT_TYPES.TRANSFER_LISTED,
  CAREER_EVENT_TYPES.TRANSFER_OFFERED,
  CAREER_EVENT_TYPES.TRANSFER_COMPLETED,
  CAREER_EVENT_TYPES.LOAN_COMPLETED
]);
const ACHIEVEMENT_TYPES = new Set([
  NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE,
  NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE
]);
const CONTRACT_EDITORIAL_TYPES = new Set([
  CAREER_EVENT_TYPES.CONTRACT_RENEWED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_EXPIRED,
  NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED
]);

function utcDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function ageDays(eventDate, currentDate) {
  const event = utcDay(eventDate);
  const current = utcDay(currentDate);
  if (event == null || current == null) return 0;
  return Math.floor((current - event) / DAY);
}

function tierFor(score) {
  return score >= 75 ? 'lead' : score >= 55 ? 'major' : score >= 35 ? 'brief' : 'wire';
}

function penaltyFor(event, currentDate) {
  const age = ageDays(event.gameDate, currentDate);
  if (age < 0) return Number.POSITIVE_INFINITY;
  if (age === 0) return 0;
  const perDay = event.type === CAREER_EVENT_TYPES.MATCH_PLAYED ? 7
    : event.type === CAREER_EVENT_TYPES.MANAGER_PRESS ? 8
      : event.type === CAREER_EVENT_TYPES.TRANSFER_OFFERED ? 8
        : event.type === CAREER_EVENT_TYPES.INJURY ? 4
          : event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE ? 5
            : event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE ? 4
              : event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE ? 6
                : CONTRACT_EDITORIAL_TYPES.has(event.type) ? 4
                  : MARKET_TYPES.has(event.type) ? 5
                    : 5;
  const grace = event.type === CAREER_EVENT_TYPES.INJURY
    || event.type === CAREER_EVENT_TYPES.TRANSFER_COMPLETED
    || event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE
    || event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE
    || CONTRACT_EDITORIAL_TYPES.has(event.type) ? 1 : 0;
  return Math.max(0, age - grace) * perDay;
}

function marketPlayerKey(event) {
  if (!MARKET_TYPES.has(event.type)) return null;
  return event.facts?.playerId || event.entities?.playerIds?.[0] || null;
}

function marketStage(event) {
  if ([CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) return 3;
  if (event.type === CAREER_EVENT_TYPES.TRANSFER_OFFERED) return 2;
  if (event.type === CAREER_EVENT_TYPES.TRANSFER_LISTED) return 1;
  return 0;
}

function achievementKey(event) {
  if (!ACHIEVEMENT_TYPES.has(event.type)) return null;
  const fixtureId = event.facts?.fixtureId || event.links?.fixtureId;
  const playerId = event.facts?.playerId || event.entities?.playerIds?.[0];
  return fixtureId && playerId ? `${fixtureId}:${playerId}` : null;
}

function pressureClubKey(event) {
  if (event.type !== NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE) return null;
  return event.facts?.clubCode || event.entities?.clubCodes?.[0] || null;
}

function contractPlayerKey(event) {
  if (!CONTRACT_EDITORIAL_TYPES.has(event.type)) return null;
  return event.facts?.playerId || event.entities?.playerIds?.[0] || null;
}

function contractStage(event) {
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED) return 1;
  if (event.type === CAREER_EVENT_TYPES.CONTRACT_RENEWED) return 3;
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED) return 4;
  if (event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_EXPIRED) return 5;
  return 0;
}

function newerPressure(row, current) {
  if (!current) return true;
  if (row.event.gameDate !== current.event.gameDate) return row.event.gameDate > current.event.gameDate;
  const rowBand = row.event.facts?.band === 'critical' ? 2 : 1;
  const currentBand = current.event.facts?.band === 'critical' ? 2 : 1;
  if (rowBand !== currentBand) return rowBand > currentBand;
  const rowConfidence = Number(row.event.facts?.confidence);
  const currentConfidence = Number(current.event.facts?.confidence);
  if (Number.isFinite(rowConfidence) && Number.isFinite(currentConfidence) && rowConfidence !== currentConfidence) return rowConfidence < currentConfidence;
  return row.event.id < current.event.id;
}

function applyRecency(row, currentDate) {
  const penalty = penaltyFor(row.event, currentDate);
  const score = Number.isFinite(penalty) ? Math.max(1, Number(row.score || 0) - penalty) : 0;
  return {
    ...row,
    rawScore: Number(row.score || 0),
    score,
    tier: score > 0 ? tierFor(score) : 'reject',
    ageDays: ageDays(row.event.gameDate, currentDate)
  };
}

export function selectEditorialEdition(ranked = [], context = {}) {
  const currentDate = context.currentDate || null;
  const maxStories = Math.max(6, Number(context.maxStories) || 24);
  const marketLimit = Math.max(2, Number(context.marketLimit) || 6);
  const wireLimit = Math.max(2, Number(context.wireLimit) || 6);
  const clubLimit = Math.max(2, Number(context.clubLimit) || 4);
  const userClubLimit = Math.max(clubLimit, Number(context.userClubLimit) || 7);

  const recencyRanked = ranked
    .map(row => applyRecency(row, currentDate))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || b.event.gameDate.localeCompare(a.event.gameDate));

  const bestMarketStory = new Map();
  const bestAchievementStory = new Map();
  const bestPressureStory = new Map();
  const bestContractStory = new Map();
  for (const row of recencyRanked) {
    const marketKey = marketPlayerKey(row.event);
    if (marketKey) {
      const current = bestMarketStory.get(marketKey);
      if (!current || marketStage(row.event) > marketStage(current.event)
        || (marketStage(row.event) === marketStage(current.event) && row.event.gameDate > current.event.gameDate)) {
        bestMarketStory.set(marketKey, row);
      }
    }
    const achievement = achievementKey(row.event);
    if (achievement) {
      const current = bestAchievementStory.get(achievement);
      if (!current || row.score > current.score || (row.score === current.score && row.event.id < current.event.id)) {
        bestAchievementStory.set(achievement, row);
      }
    }
    const pressureKey = pressureClubKey(row.event);
    if (pressureKey && newerPressure(row, bestPressureStory.get(pressureKey))) bestPressureStory.set(pressureKey, row);

    const contractKey = contractPlayerKey(row.event);
    if (contractKey) {
      const current = bestContractStory.get(contractKey);
      if (!current || contractStage(row.event) > contractStage(current.event)
        || (contractStage(row.event) === contractStage(current.event) && row.event.gameDate > current.event.gameDate)
        || (contractStage(row.event) === contractStage(current.event) && row.event.gameDate === current.event.gameDate && row.score > current.score)) {
        bestContractStory.set(contractKey, row);
      }
    }
  }

  const selected = [];
  const clubCounts = new Map();
  let marketCount = 0;
  let wireCount = 0;

  for (const row of recencyRanked) {
    if (selected.length >= maxStories) break;
    const marketKey = marketPlayerKey(row.event);
    if (marketKey && bestMarketStory.get(marketKey)?.event.id !== row.event.id) continue;
    const achievement = achievementKey(row.event);
    if (achievement && bestAchievementStory.get(achievement)?.event.id !== row.event.id) continue;
    const pressureKey = pressureClubKey(row.event);
    if (pressureKey && bestPressureStory.get(pressureKey)?.event.id !== row.event.id) continue;
    const contractKey = contractPlayerKey(row.event);
    if (contractKey && bestContractStory.get(contractKey)?.event.id !== row.event.id) continue;
    if (marketKey && marketCount >= marketLimit && row.tier !== 'lead') continue;
    if (row.tier === 'wire' && wireCount >= wireLimit) continue;

    const clubs = row.event.entities?.clubCodes || [];
    const primaryClub = clubs[0] || null;
    if (primaryClub && row.tier !== 'lead') {
      const current = clubCounts.get(primaryClub) || 0;
      const limit = primaryClub === context.userClubCode ? userClubLimit : clubLimit;
      if (current >= limit) continue;
    }

    selected.push(row);
    if (marketKey) marketCount += 1;
    if (row.tier === 'wire') wireCount += 1;
    for (const club of clubs) clubCounts.set(club, (clubCounts.get(club) || 0) + 1);
  }

  return selected;
}

export const NEWSROOM_EDITION_META = Object.freeze({
  maxStories: 24,
  marketLimit: 6,
  wireLimit: 6,
  invariant: 'old events decay, future events never publish, negotiation and contract stages cannot flood the edition, board pressure keeps only the latest escalation, and one player-match achievement yields one editorial story'
});
