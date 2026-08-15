import assert from 'node:assert/strict';
import { autoPickLineup, createCareer, PLAYER_BY_ID } from '../src/career-core/career-core.js';
import { CLUB_BY_CODE, FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { reconcileCareerData } from '../src/career-core/result-integrity.js';
import { ensureEventLedger } from '../src/career-core/event-ledger.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';
import { deriveSeasonRecordEvents, reconcileSeasonRecordNewsEvents } from '../src/career-core/newsroom-records-bridge.js';
import { NEWSROOM_PERFORMANCE_EVENT_TYPES, SEASON_RECORD_KINDS } from '../src/career-core/newsroom-performance-types.js';

function clubsOf(fixture) {
  return new Set([fixture.home, fixture.away]);
}

function excludes(fixture, blocked) {
  return !blocked.has(fixture.home) && !blocked.has(fixture.away);
}

const fixtureOne = FIXTURES[0];
const fixtureTwo = FIXTURES.find(fixture => fixture.date > fixtureOne.date && excludes(fixture, new Set([fixtureOne.home])));
assert.ok(fixtureTwo);
const fixtureTwoClubs = clubsOf(fixtureTwo);
const fixtureThree = FIXTURES.find(fixture => fixture.date > fixtureTwo.date && excludes(fixture, new Set([fixtureOne.home, ...fixtureTwoClubs])));
assert.ok(fixtureThree);
const fixtureFour = FIXTURES.find(fixture => fixture.date > fixtureThree.date && excludes(fixture, new Set([fixtureOne.home, fixtureThree.home])));
assert.ok(fixtureFour);
const fixtures = [fixtureOne, fixtureTwo, fixtureThree, fixtureFour];
const career = createCareer(fixtureOne.home);

function scorerFrom(lineup) {
  return lineup.map(id => PLAYER_BY_ID.get(id)).find(player => player?.group === 'FWD') || PLAYER_BY_ID.get(lineup[0]);
}

function resultWithGoals(fixture, homeGoalScorers, awayGoalScorers) {
  const homeLineup = autoPickLineup(fixture.home);
  const awayLineup = autoPickLineup(fixture.away);
  const events = [];
  homeGoalScorers.forEach((playerId, index) => events.push({ type: 'goal', side: 'home', minute: 8 + index * 11, playerId }));
  awayGoalScorers.forEach((playerId, index) => events.push({ type: 'goal', side: 'away', minute: 57 + index * 8, playerId }));
  return { fixtureId: fixture.id, lineups: { home: homeLineup, away: awayLineup }, events };
}

const lineups = fixtures.map(fixture => ({ home: autoPickLineup(fixture.home), away: autoPickLineup(fixture.away) }));
const scorerOne = scorerFrom(lineups[0].home);
const scorerTwo = scorerFrom(lineups[2].home);
assert.ok(scorerOne && scorerTwo);
assert.notEqual(scorerOne.clubCode, scorerTwo.clubCode, 'record scenario must use distinct scorer clubs');

career.results = {
  [fixtures[0].id]: resultWithGoals(fixtures[0], Array(3).fill(scorerOne.id), []),
  [fixtures[1].id]: resultWithGoals(fixtures[1], lineups[1].home.slice(0, 3), lineups[1].away.slice(0, 2)),
  [fixtures[2].id]: resultWithGoals(fixtures[2], Array(4).fill(scorerTwo.id), []),
  [fixtures[3].id]: resultWithGoals(fixtures[3], lineups[3].home.slice(0, 4), lineups[3].away.slice(0, 3))
};
career.currentDate = fixtures[3].date;
reconcileCareerData(career);
ensureEventLedger(career);

const derived = deriveSeasonRecordEvents(career);
assert.equal(derived.every(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.SEASON_RECORD), true);

const biggestWins = derived.filter(event => event.facts.recordKind === SEASON_RECORD_KINDS.BIGGEST_WIN_SO_FAR);
assert.equal(biggestWins.length, 2, 'a 3-goal win followed by a 4-goal win should create two progressive season records');
assert.equal(biggestWins[0].facts.margin, 3);
assert.equal(biggestWins[1].facts.margin, 4);
assert.equal(biggestWins[1].facts.previousMargin, 3);

const highestScoring = derived.filter(event => event.facts.recordKind === SEASON_RECORD_KINDS.HIGHEST_SCORING_MATCH_SO_FAR);
assert.equal(highestScoring.length, 2, 'five goals followed by seven goals should create two progressive scoring records');
assert.equal(highestScoring[0].facts.totalGoals, 5);
assert.equal(highestScoring[1].facts.totalGoals, 7);
assert.equal(highestScoring[1].facts.previousTotalGoals, 5);

const scorerLeads = derived.filter(event => event.facts.recordKind === SEASON_RECORD_KINDS.TOP_SCORER_LEAD);
assert.ok(scorerLeads.some(event => event.facts.playerId === scorerOne.id && event.facts.goals === 3), 'first unique three-goal scorer should take the seasonal lead');
assert.ok(scorerLeads.some(event => event.facts.playerId === scorerTwo.id && event.facts.goals === 4), 'later unique four-goal scorer should take over the seasonal lead');

reconcileSeasonRecordNewsEvents(career);
const eventCount = career.eventLedger.events.length;
reconcileSeasonRecordNewsEvents(career);
assert.equal(career.eventLedger.events.length, eventCount, 'season record reconciliation must be idempotent');

const newsroom = buildCareerNewsroom(career, {
  userClubCode: career.clubCode,
  currentDate: career.currentDate,
  clubResolver: code => CLUB_BY_CODE.get(code)?.name || code,
  playerResolver: id => PLAYER_BY_ID.get(id)?.name || id
});
const latestScoringRecord = highestScoring.at(-1);
const recordArticle = newsroom.feed.find(article => article.eventId === latestScoringRecord.id);
assert.ok(recordArticle, 'latest highest-scoring match record should be eligible for the current edition');
assert.match(recordArticle.title, /jogo mais goleador da temporada até aqui/i);
assert.equal(recordArticle.factualClaims.some(claim => claim.kind === 'season-record' && claim.totalGoals === 7), true);
assert.equal(recordArticle.summary.includes('história'), false, 'seasonal record copy must not imply an all-time historical record');

const latestLeader = scorerLeads.at(-1);
const leaderArticle = newsroom.feed.find(article => article.eventId === latestLeader.id);
assert.ok(leaderArticle, 'current unique top scorer lead should be publishable');
assert.match(leaderArticle.title, /liderança isolada da artilharia/i);
assert.equal(leaderArticle.mediaIntent.preference, 'player');
assert.equal(leaderArticle.mediaIntent.playerIds[0], latestLeader.facts.playerId);

console.log('career newsroom records smoke: ok');
