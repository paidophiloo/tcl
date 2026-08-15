import assert from 'node:assert/strict';
import { autoPickLineup, createCareer, PLAYER_BY_ID } from '../src/career-core/career-core.js';
import { FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { reconcileCareerData } from '../src/career-core/result-integrity.js';
import { appendCareerEvent, CAREER_EVENT_TYPES, ensureEventLedger } from '../src/career-core/event-ledger.js';
import { reconcileMatchNewsEvents } from '../src/career-core/newsroom-match-bridge.js';
import { derivePerformanceEvents, reconcilePerformanceNewsEvents } from '../src/career-core/newsroom-performance-bridge.js';
import { NEWSROOM_PERFORMANCE_EVENT_TYPES, PERFORMANCE_KINDS, MILESTONE_KINDS } from '../src/career-core/newsroom-performance-types.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';

const clubCode = 'MUN';
const fixtures = FIXTURES.filter(fixture => fixture.home === clubCode || fixture.away === clubCode).slice(0, 3);
assert.equal(fixtures.length, 3, 'test requires three Manchester United league fixtures');

const career = createCareer(clubCode);
const baseUnitedLineup = autoPickLineup(clubCode);
const originalForwardIndex = baseUnitedLineup.findIndex(id => PLAYER_BY_ID.get(id)?.group === 'FWD');
assert.ok(originalForwardIndex >= 0);
const initialClubScorer = PLAYER_BY_ID.get(baseUnitedLineup[originalForwardIndex]);
const excludedClubs = new Set([clubCode, ...fixtures.map(fixture => fixture.home === clubCode ? fixture.away : fixture.home)]);
const scorer = [...PLAYER_BY_ID.values()].find(player => player.group === 'FWD' && !excludedClubs.has(player.clubCode));
assert.ok(scorer, 'test requires a transfer-safe forward from another Premier League club');
const unitedLineup = [...baseUnitedLineup];
unitedLineup[originalForwardIndex] = scorer.id;
const keeper = unitedLineup.map(id => PLAYER_BY_ID.get(id)).find(player => player?.group === 'GK');
assert.ok(initialClubScorer && keeper);

function resultFor(fixture, unitedGoals, opponentGoals) {
  const opponentCode = fixture.home === clubCode ? fixture.away : fixture.home;
  const opponentLineup = autoPickLineup(opponentCode);
  const side = fixture.home === clubCode ? 'home' : 'away';
  const opponentSide = side === 'home' ? 'away' : 'home';
  const events = [];
  for (let index = 0; index < unitedGoals; index += 1) {
    events.push({ type: 'goal', side, minute: 12 + index * 17, playerId: scorer.id });
  }
  const opponentScorer = opponentLineup.map(id => PLAYER_BY_ID.get(id)).find(player => player?.group === 'FWD') || PLAYER_BY_ID.get(opponentLineup[1]);
  for (let index = 0; index < opponentGoals; index += 1) {
    events.push({ type: 'goal', side: opponentSide, minute: 70 + index * 5, playerId: opponentScorer.id });
  }
  return {
    fixtureId: fixture.id,
    lineups: side === 'home'
      ? { home: unitedLineup, away: opponentLineup }
      : { home: opponentLineup, away: unitedLineup },
    events
  };
}

const thirdResult = resultFor(fixtures[2], 1, 0);
thirdResult.events.push({
  type: 'goal',
  side: fixtures[2].home === clubCode ? 'home' : 'away',
  minute: 81,
  playerId: initialClubScorer.id
});

career.results = {
  [fixtures[0].id]: resultFor(fixtures[0], 2, 1),
  [fixtures[1].id]: resultFor(fixtures[1], 3, 1),
  [fixtures[2].id]: thirdResult
};
career.currentDate = fixtures[2].date;
reconcileCareerData(career);
ensureEventLedger(career);
appendCareerEvent(career, {
  id: `evt-test-arrival-${scorer.id}-mun`,
  type: CAREER_EVENT_TYPES.TRANSFER_COMPLETED,
  gameDate: '2026-07-15',
  source: 'performance-smoke-arrival',
  entities: { playerIds: [scorer.id], clubCodes: [scorer.clubCode, clubCode] },
  facts: { playerId: scorer.id, fromClubCode: scorer.clubCode, toClubCode: clubCode, fee: 30_000_000 }
});
reconcileMatchNewsEvents(career);

const derived = derivePerformanceEvents(career);
const brace = derived.find(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE && event.facts?.fixtureId === fixtures[0].id && event.facts?.playerId === scorer.id);
assert.ok(brace?.facts.performanceTypes.includes(PERFORMANCE_KINDS.BRACE), 'two goals must derive a brace performance');
const firstGoal = derived.find(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE && event.facts?.fixtureId === fixtures[0].id && event.facts?.playerId === scorer.id);
assert.ok(firstGoal?.facts.milestones.some(item => item.kind === MILESTONE_KINDS.FIRST_CLUB_GOAL), 'first goal after a recorded arrival must derive a first-club-goal milestone');

const falseFirstGoal = derived.find(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE && event.facts?.fixtureId === fixtures[2].id && event.facts?.playerId === initialClubScorer.id && event.facts?.milestones?.some(item => item.kind === MILESTONE_KINDS.FIRST_CLUB_GOAL));
assert.equal(falseFirstGoal, undefined, 'an incumbent player must not be labeled as scoring his first-ever club goal merely because the save started in July');

const hatTrick = derived.find(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE && event.facts?.fixtureId === fixtures[1].id && event.facts?.playerId === scorer.id);
assert.ok(hatTrick?.facts.performanceTypes.includes(PERFORMANCE_KINDS.HAT_TRICK), 'three goals must derive a hat-trick performance');
assert.equal(hatTrick.facts.seasonGoalsAfter, 5, 'cumulative season goals must be derived from canonical results');
assert.ok(hatTrick.facts.milestonesReached.some(item => item.kind === MILESTONE_KINDS.SEASON_GOALS && item.value === 5), 'hat-trick crossing five goals must carry the milestone');
const fifthGoal = derived.find(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE && event.facts?.fixtureId === fixtures[1].id && event.facts?.playerId === scorer.id);
assert.ok(fifthGoal?.facts.milestones.some(item => item.kind === MILESTONE_KINDS.SEASON_GOALS && item.value === 5));

const shutout = derived.find(event => event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE && event.facts?.fixtureId === fixtures[2].id && event.facts?.playerId === keeper.id);
assert.ok(shutout?.facts.performanceTypes.includes(PERFORMANCE_KINDS.STARTER_SHUTOUT), 'starting goalkeeper in a team shutout must be recorded');
assert.equal(shutout.facts.officialIndividualCleanSheet, false, 'engine must not invent official individual clean-sheet credit without substitution minutes');

reconcilePerformanceNewsEvents(career);
const countAfterFirstPass = career.eventLedger.events.length;
reconcilePerformanceNewsEvents(career);
assert.equal(career.eventLedger.events.length, countAfterFirstPass, 'performance reconciliation must be idempotent');

const newsroom = buildCareerNewsroom(career, {
  userClubCode: clubCode,
  currentDate: career.currentDate,
  clubResolver: code => code,
  playerResolver: id => PLAYER_BY_ID.get(id)?.name || id
});
assert.equal(newsroom.activeStoryArc?.type, 'player.scoring-form', 'six goals across recent matches should create a scorer-form story arc');
assert.equal(newsroom.activeStoryArc?.facts.playerId, scorer.id);
assert.equal(newsroom.activeStoryArc?.facts.goals, 6);

const secondFixtureAchievementStories = newsroom.feed.filter(article =>
  article.mediaIntent?.fixtureId === fixtures[1].id && article.mediaIntent?.playerIds?.[0] === scorer.id &&
  article.factualClaims?.some(claim => ['performance', 'milestone'].includes(claim.kind))
);
assert.equal(secondFixtureAchievementStories.length, 1, 'one player-match achievement must produce one editorial story');
assert.match(secondFixtureAchievementStories[0].title, /hat-trick/i);
assert.equal(secondFixtureAchievementStories[0].factualClaims.some(claim => claim.kind === 'performance'), true);
assert.equal(secondFixtureAchievementStories[0].factualClaims.some(claim => claim.kind === 'milestone'), true, 'selected performance article must retain related milestone proof');
assert.equal(secondFixtureAchievementStories[0].mediaIntent.preference, 'player');
assert.equal(secondFixtureAchievementStories[0].mediaIntent.playerIds[0], scorer.id);

console.log('career newsroom performance smoke: ok');
