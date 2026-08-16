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

function randomFor(seed) {
  let state = hashString(seed) || 0x9e3779b9;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(random, lambda) {
  let count = 0;
  let product = 1;
  const limit = Math.exp(-lambda);
  do {
    count += 1;
    product *= random();
  } while (product > limit && count < 9);
  return count - 1;
}

function generatedLineup(club) {
  const stems = ['Silva','Santos','Martin','Müller','Rossi','García','Jensen','Kovač','Nielsen','Moreau','Costa'];
  return Array.from({ length: 11 }, (_, index) => ({
    id: `${club.id}-friendly-${index + 1}`,
    name: `${stems[(hashString(club.id) + index) % stems.length]} ${index + 1}`,
    group: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 9 ? 'MID' : 'FWD',
    rating: clamp((club.rating || 70) + (index % 3) - 1, 55, 92)
  }));
}

function sideProfile(career, reference, home) {
  const club = resolveFriendlyClub(career, reference);
  const user = reference === career.clubCode;
  const players = user
    ? career.lineup
      .map(id => Base.PLAYER_BY_ID.get(id))
      .filter(player => player && clubCodeForPlayer(career, player) === career.clubCode)
    : generatedLineup(club);
  const average = players.length ? players.reduce((sum, player) => sum + player.rating, 0) / players.length : club.rating || 70;
  const condition = user
    ? players.reduce((sum, player) => sum + (career.playerState[player.id]?.condition || 92), 0) / Math.max(1, players.length)
    : 94;
  const tactical = user ? Base.analyzeTactics(career.tactics, players).metrics : { creation: 66, protection: 66, intensity: 62 };
  const power = average + (home ? 1.8 : 0) + (condition - 90) / 7 + (tactical.creation - tactical.protection) / 80;
  return { club, user, players, power, tactical };
}

function weightedPlayer(random, players) {
  const weighted = players.map(player => ({ player, weight: player.group === 'FWD' ? 5 : player.group === 'MID' ? 2.4 : player.group === 'DEF' ? 0.55 : 0.08 }));
  let roll = random() * weighted.reduce((sum, row) => sum + row.weight, 0);
  for (const row of weighted) {
    roll -= row.weight;
    if (roll <= 0) return row.player;
  }
  return weighted.at(-1)?.player;
}

function friendlyEvents(random, goals, side, players) {
  const used = new Set();
  return Array.from({ length: goals }, () => {
    let minute = 6 + Math.floor(random() * 83);
    while (used.has(minute)) minute = 6 + Math.floor(random() * 83);
    used.add(minute);
    const scorer = weightedPlayer(random, players);
    const assist = random() > 0.2 ? weightedPlayer(random, players.filter(player => player.id !== scorer?.id)) : null;
    return {
      type: 'goal', minute, side,
      playerId: scorer?.id || null, playerName: scorer?.name || 'Gol',
      assistPlayerId: assist?.id || null, assistName: assist?.name || null
    };
  });
}

export function simulateFixture(career, fixture) {
  ensureLivingWorld(career);
  if (!isFriendlyFixture(fixture)) return simulateWorldFixture(career, fixture);
  const random = randomFor(`${career.friendlySeed}:${fixture.id}:${JSON.stringify(career.tactics)}`);
  const home = sideProfile(career, fixture.home, true);
  const away = sideProfile(career, fixture.away, false);
  const difference = (home.power - away.power) / 18;
  const homeXg = clamp(1.14 + difference * 0.27 + (random() - 0.5) * 0.34, 0.25, 4.1);
  const awayXg = clamp(1.02 - difference * 0.24 + (random() - 0.5) * 0.34, 0.2, 3.9);
  const homeGoals = poisson(random, homeXg);
  const awayGoals = poisson(random, awayXg);
  const events = [
    ...friendlyEvents(random, homeGoals, 'home', home.players),
    ...friendlyEvents(random, awayGoals, 'away', away.players)
  ].sort((a, b) => a.minute - b.minute);
  const possession = clamp(Math.round(50 + difference * 5 + (random() - 0.5) * 7), 30, 70);
  return {
    fixtureId: fixture.id,
    fixtureType: 'friendly',
    competition: 'Friendly',
    matchweek: 0,
    date: fixture.date,
    time: fixture.time,
    home: fixture.home,
    away: fixture.away,
    homeGoals,
    awayGoals,
    lineups: { home: home.players.map(player => player.id), away: away.players.map(player => player.id) },
    events,
    stats: {
      home: { xg: +homeXg.toFixed(2), shots: Math.max(homeGoals, Math.round(homeXg * 6 + random() * 3)), possession, corners: 2 + Math.floor(random() * 7), highRecoveries: 5 + Math.floor(random() * 8), counters: 1 + Math.floor(random() * 5), crosses: 6 + Math.floor(random() * 10) },
      away: { xg: +awayXg.toFixed(2), shots: Math.max(awayGoals, Math.round(awayXg * 6 + random() * 3)), possession: 100 - possession, corners: 2 + Math.floor(random() * 7), highRecoveries: 5 + Math.floor(random() * 8), counters: 1 + Math.floor(random() * 5), crosses: 6 + Math.floor(random() * 10) }
    },
    tactical: {
      home: { metrics: home.tactical, load: home.tactical.intensity || 62, plan: home.user ? career.tactics.activePlan || 'A' : 'AI' },
      away: { metrics: away.tactical, load: away.tactical.intensity || 62, plan: away.user ? career.tactics.activePlan || 'A' : 'AI' }
    }
  };
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

export function advanceOneDay(career) {
  ensureFriendlyWorld(career);
  ensureLivingWorld(career);
  const processingDate = career.currentDate;
  const daySummary = processWorldDay(career, processingDate);
  if (career.status === 'unemployed' || career.managerCareer?.status === 'unemployed') {
    return { career, ready: false, fixture: null, daySummary, employmentChanged: true, employmentChangeDate: processingDate };
  }
  const userFixture = userFixtures(career).find(fixture => fixture.date === processingDate && !friendlyResultFor(career, fixture));
  simulateOtherMatches(career, processingDate, userFixture);
  if (userFixture) return { career, ready: true, fixture: userFixture, daySummary };
  recover(career);
  career.currentDate = nextDay(processingDate);
  finishSeasonIfNeeded(career);
  return { career, ready: false, fixture: null, daySummary };
}

export function continueToNextMatch(career) {
  for (let index = 0; index < 500; index += 1) {
    const step = advanceOneDay(career);
    if (step.ready || career.status === 'complete' || career.status === 'unemployed' || career.managerCareer?.status === 'unemployed') return step;
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
