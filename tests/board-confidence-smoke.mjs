import assert from 'node:assert/strict';
import { processUserBoardDay, userBoardSnapshot } from '../src/career-world/clubs/board-confidence.js';
import { ensureEventLedger } from '../src/career-core/event-ledger.js';
import { reconcileWorldNewsEvents } from '../src/career-core/newsroom-world-bridge.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES } from '../src/career-core/newsroom-governance-types.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';

const career = {
  clubCode: 'MUN',
  managerName: 'Gabriel Machado',
  currentDate: '2026-09-01',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  results: {},
  inbox: [],
  world: {
    currentDate: '2026-07-01',
    events: [],
    eventSequence: 0,
    clubs: {
      MUN: { code: 'MUN', elo: 1900 },
      WHU: { code: 'WHU', elo: 1650 },
      FUL: { code: 'FUL', elo: 1640 },
      EVE: { code: 'EVE', elo: 1660 },
      BHA: { code: 'BHA', elo: 1680 },
      BRE: { code: 'BRE', elo: 1630 },
      BOU: { code: 'BOU', elo: 1620 }
    }
  }
};

const opponents = ['WHU', 'FUL', 'EVE', 'BHA', 'BRE', 'BOU'];
const dates = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05'];

for (let index = 0; index < opponents.length; index += 1) {
  const home = index % 2 === 0;
  const fixtureId = `board-loss-${index + 1}`;
  career.results[fixtureId] = {
    fixtureId,
    date: dates[index],
    home: home ? 'MUN' : opponents[index],
    away: home ? opponents[index] : 'MUN',
    homeGoals: home ? 0 : 2,
    awayGoals: home ? 2 : 0,
    lineups: { home: [], away: [] },
    events: []
  };
  career.currentDate = dates[index];
  const result = processUserBoardDay({ career, date: dates[index] });
  if (index < 3) {
    assert.equal(result.confidence, 65, 'board confidence should stay provisional before four matches');
    assert.equal(result.pressureEvent, false);
  }
}

const snapshot = userBoardSnapshot(career);
assert.equal(snapshot.history.length, 6, 'every new user result should produce one board review row');
assert.equal(snapshot.band, 'critical', 'six severe underperforming losses should put the manager in critical pressure');
assert.ok(snapshot.confidence < 25);
assert.equal(career.boardConfidence, snapshot.confidence, 'career-level board confidence mirror should stay synchronized');
assert.ok(career.world.events.some(event => event.type === 'BOARD_CONFIDENCE_CHANGED' && event.visibility === 'system'), 'routine board confidence changes must stay internal');
const pressureEvents = career.world.events.filter(event => event.type === 'MANAGER_JOB_PRESSURE');
assert.ok(pressureEvents.length >= 1, 'crossing into pressure must create a public manager-pressure event');
assert.equal(pressureEvents.at(-1).payload.band, 'critical');
assert.ok(career.inbox.some(message => message.id.startsWith('board-pressure-')), 'board pressure must also reach the user inbox');

const eventCount = career.world.events.length;
const repeat = processUserBoardDay({ career, date: dates.at(-1) });
assert.equal(repeat.reviewed, false, 'same latest match must not be reviewed twice');
assert.equal(career.world.events.length, eventCount, 'same-day board review must be idempotent');

ensureEventLedger(career);
reconcileWorldNewsEvents(career);
assert.equal(career.eventLedger.events.some(event => event.context?.worldEventType === 'BOARD_CONFIDENCE_CHANGED'), false, 'internal confidence telemetry must never enter the editorial ledger');
const pressureStories = career.eventLedger.events.filter(event => event.type === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE);
assert.ok(pressureStories.length >= 1, 'public pressure event must project into the Newsroom Event Ledger');
assert.equal(pressureStories.at(-1).facts.managerName, 'Gabriel Machado');
assert.equal(pressureStories.at(-1).facts.band, 'critical');

const newsroom = buildCareerNewsroom(career, {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: code => ({ MUN: 'Manchester United', WHU: 'West Ham United', FUL: 'Fulham', EVE: 'Everton', BHA: 'Brighton', BRE: 'Brentford', BOU: 'Bournemouth' })[code] || code,
  playerResolver: id => id
});
const latestPressure = pressureStories.at(-1);
const pressureArticle = newsroom.feed.find(article => article.eventId === latestPressure.id);
assert.ok(pressureArticle, 'critical user manager pressure should be publishable');
assert.match(pressureArticle.title, /Gabriel Machado|pressão/i);
assert.equal(newsroom.activeStoryArc?.type, 'club.manager-pressure', 'critical board pressure should outrank the generic losing-streak storyline');
assert.equal(newsroom.activeStoryArc?.facts.managerName, 'Gabriel Machado');
assert.equal(newsroom.activeStoryArc?.facts.band, 'critical');

console.log('board confidence smoke: ok');
