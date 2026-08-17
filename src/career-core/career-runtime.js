export * from './career-core.js';
export {
  recentLivingWorldEvents,
  respondToWorldTransferOffer,
  setLoanListing,
  setPlayerAskingPrice,
  setTransferListing,
  worldActiveNegotiations,
  worldMarketSearch,
  worldPlayerStatus,
  worldSquadFor,
  worldTransferHistory
} from '../career-world/world-engine.js';

import * as Base from './career-core.js';
import { FIXTURES, SEASON_END_DATE } from './season-2026-27-live.js';
import {
  allFixturesOnDate,
  combinedUserFixtures,
  ensureFriendlyWorld,
  friendlyResultFor,
  isFriendlyFixture,
  nextCombinedUserFixture,
  recordFriendlyResult,
  resolveFriendlyClub
} from './friendly-engine.js';
import { ensureLivingWorld, processWorldDay } from '../career-world/world-engine.js';
import { simulateWorldFixture } from '../career-world/world-match-adapter.js';
import { clubCodeForPlayer } from '../career-world/world-selectors.js';

const DAY_MS = 86_400_000;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function seasonStartDate(label = '2026/27') {
  const year = Number(String(label).slice(0, 4)) || 2026;
  return `${year}-07-01`;
}

function addDay(date) {
  return new Date(`${date}T00:00:00Z`).getTime() + DAY_MS;
}

function nextDay(date) {
  return new Date(addDay(date)).toISOString().slice(0, 10);
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** One simulation authority for league, cup/future rules and friendlies.
 * Watched and headless fixtures now differ only by presentation. */
export function simulateFixture(career, fixture) {
  ensureLivingWorld(career);
  return simulateWorldFixture(career, fixture);
}

function recover(career, amount = 4) {
  for (const state of Object.values(career.playerState || {})) {
    state.condition = clamp((state.condition || 90) + amount, 0, 100);
    state.sharpness = clamp((state.sharpness || 70) + 1, 0, 100);
  }
}

function commitFriendlyResult(career, result, world = false) {
  recordFriendlyResult(career, result, world);
  if (world || (result.home !== career.clubCode && result.away !== career.clubCode)) return career;
  const userSide = result.home === career.clubCode ? 'home' : 'away';
  const opponentId = userSide === 'home' ? result.away : result.home;
  const opponent = resolveFriendlyClub(career, opponentId);
  for (const id of career.lineup) {
    const state = career.playerState[id];
    if (!state) continue;
    state.condition = clamp(state.condition - (4 + hashString(`${result.fixtureId}:${id}`) % 4), 55, 100);
    state.sharpness = clamp(state.sharpness + 5, 0, 100);
    state.morale = clamp(state.morale + (result[`${userSide}Goals`] >= result[userSide === 'home' ? 'awayGoals' : 'homeGoals'] ? 1 : 0), 20, 100);
  }
  career.inbox ||= [];
  career.inbox.unshift({
    id: `friendly-report-${result.fixtureId}`,
    date: result.date,
    sender: 'Analista',
    subject: `Relatório do amistoso contra ${opponent.name}`,
    body: `Placar ${result.homeGoals}–${result.awayGoals}. A partida elevou o ritmo competitivo sem alterar a classificação da liga.`,
    read: false
  });
  return career;
}

export function createCareer(code = 'MUN', now = new Date().toISOString()) {
  const career = Base.createCareer(code, now);
  career.schemaVersion = 5;
  career.currentDate = seasonStartDate(career.seasonLabel);
  career.inbox = (career.inbox || []).map(message => ({ ...message, date: career.currentDate }));
  ensureFriendlyWorld(career);
  ensureLivingWorld(career);
  return career;
}

export function normalizeCareer(source, code = 'MUN') {
  let career;
  if (!source || source.schemaVersion !== 5) {
    career = createCareer(code);
  } else {
    career = Base.normalizeCareer({ ...source, schemaVersion: 3 }, code);
    career.schemaVersion = 5;
    career.currentDate ||= seasonStartDate(career.seasonLabel);
    ensureFriendlyWorld(career);
    ensureLivingWorld(career);
  }
  return career;
}

export const userFixtures = career => combinedUserFixtures(career, FIXTURES);
export const fixturesOnDate = (date, career = null) => career ? allFixturesOnDate(career, date) : FIXTURES.filter(fixture => fixture.date === date);
export const nextUserFixture = career => nextCombinedUserFixture(career);

export function topScorers(career, number = 10) {
  ensureLivingWorld(career);
  return Base.topScorers(career, number).map(row => ({
    ...row,
    player: row.player ? { ...row.player, clubCode: clubCodeForPlayer(career, row.player) || row.player.clubCode } : row.player
  }));
}

function simulateOtherMatches(career, date, userFixture = null) {
  ensureFriendlyWorld(career);
  ensureLivingWorld(career);
  for (const fixture of FIXTURES.filter(item => item.date === date)) {
    if (!career.results[fixture.id] && fixture.id !== userFixture?.id) Base.commitResult(career, simulateFixture(career, fixture));
  }
  for (const fixture of career.worldFriendlies.filter(item => item.date === date)) {
    if (!career.worldFriendlyResults[fixture.id]) commitFriendlyResult(career, simulateFixture(career, fixture), true);
  }
}

function finishSeasonIfNeeded(career) {
  if (career.currentDate > SEASON_END_DATE && Object.keys(career.results || {}).length === FIXTURES.length) {
    career.status = 'complete';
    career.seasonSummary = Base.buildSeasonSummary(career);
  }
}

function managerIsUnemployed(career) {
  return career.status === 'unemployed' || career.managerCareer?.status === 'unemployed';
}

export function advanceOneDay(career) {
  ensureFriendlyWorld(career);
  ensureLivingWorld(career);
  const processingDate = career.currentDate;
  const unemployedBeforeTick = managerIsUnemployed(career);
  const daySummary = processWorldDay(career, processingDate);
  const unemployedAfterTick = managerIsUnemployed(career);
  if (!unemployedBeforeTick && unemployedAfterTick) {
    return { career, ready: false, fixture: null, daySummary, employmentChanged: true, employmentChangeDate: processingDate };
  }
  const userFixture = unemployedAfterTick
    ? null
    : userFixtures(career).find(fixture => fixture.date === processingDate && !friendlyResultFor(career, fixture));
  simulateOtherMatches(career, processingDate, userFixture);
  if (userFixture) return { career, ready: true, fixture: userFixture, daySummary };
  if (!unemployedAfterTick) recover(career);
  career.currentDate = nextDay(processingDate);
  finishSeasonIfNeeded(career);
  return { career, ready: false, fixture: null, daySummary };
}

export function continueToNextMatch(career) {
  for (let index = 0; index < 500; index += 1) {
    const step = advanceOneDay(career);
    if (step.ready || career.status === 'complete' || step.employmentChanged) return step;
  }
  throw new Error('Calendar guard exceeded');
}

export function completePreparedUserMatch(career, result) {
  ensureFriendlyWorld(career);
  ensureLivingWorld(career);
  const fixture = userFixtures(career).find(item => item.id === result?.fixtureId);
  if (!fixture) return { career, fixture: null, result: null };
  if (isFriendlyFixture(fixture)) {
    if (!career.friendlyResults[fixture.id]) commitFriendlyResult(career, result, false);
    simulateOtherMatches(career, fixture.date, fixture);
    recover(career, 3);
    career.currentDate = nextDay(career.currentDate);
    return { career, fixture, result };
  }
  if (!career.results[fixture.id]) Base.commitResult(career, result);
  simulateOtherMatches(career, fixture.date, fixture);
  recover(career, 3);
  career.currentDate = nextDay(career.currentDate);
  finishSeasonIfNeeded(career);
  return { career, fixture, result: career.results[fixture.id] || result };
}

export function playCurrentUserFixture(career) {
  const fixture = userFixtures(career).find(item => item.date === career.currentDate && !friendlyResultFor(career, item));
  return fixture
    ? completePreparedUserMatch(career, simulateFixture(career, fixture))
    : { career, fixture: null, result: null };
}
