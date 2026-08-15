import assert from 'node:assert/strict';
import { CAREER_EVENT_TYPES, ensureEventLedger } from '../src/career-core/event-ledger.js';
import { rankNewsEvents } from '../src/career-core/newsroom-editorial.js';
import { reconcileMatchNewsEvents } from '../src/career-core/newsroom-match-bridge.js';
import { reconcileWorldNewsEvents } from '../src/career-core/newsroom-world-bridge.js';

const career = {
  clubCode: 'MUN',
  currentDate: '2026-08-18',
  createdAt: '2026-07-01T08:00:00.000Z',
  results: {
    f1: {
      fixtureId: 'f1', date: '2026-08-18', home: 'MUN', away: 'MCI', homeGoals: 2, awayGoals: 1,
      events: [
        { type: 'goal', minute: 14, side: 'home', playerId: 'p1', assistPlayerId: 'p2' },
        { type: 'red-card', minute: 39, side: 'away', playerId: 'p3', reason: 'serious-foul-play' },
        { type: 'injury', minute: 52, side: 'home', playerId: 'p4', injuryType: 'hamstring', durationDays: 21 },
        { type: 'goal', minute: 63, side: 'away', playerId: 'p5', isPenalty: true },
        { type: 'goal', minute: 81, side: 'home', playerId: 'p1' }
      ]
    }
  },
  world: {
    events: [{
      id: 'world-injury-p4', date: '2026-08-18', type: 'PLAYER_INJURED', visibility: 'world',
      entities: { playerId: 'p4', clubCode: 'MUN', fixtureId: 'f1' },
      payload: { durationDays: 21, injuryType: 'hamstring', severity: 'moderate', unavailableUntil: '2026-09-08' }
    }]
  }
};

ensureEventLedger(career);
reconcileWorldNewsEvents(career);
const projected = reconcileMatchNewsEvents(career);
assert.equal(projected.length, 4, 'two goals + red card + third goal should project; injury should use richer world event');

const events = career.eventLedger.events;
const goals = events.filter(event => event.type === CAREER_EVENT_TYPES.GOAL);
const reds = events.filter(event => event.type === CAREER_EVENT_TYPES.RED_CARD);
const injuries = events.filter(event => event.type === CAREER_EVENT_TYPES.INJURY);
assert.equal(goals.length, 3);
assert.equal(reds.length, 1);
assert.equal(injuries.length, 1, 'same fixture/player injury must not duplicate world medical event');
assert.deepEqual(goals.map(event => event.facts.scoreAfter), [
  { homeGoals: 1, awayGoals: 0 },
  { homeGoals: 1, awayGoals: 1 },
  { homeGoals: 2, awayGoals: 1 }
]);
assert.equal(goals.every(event => event.visibility === 'internal'), true, 'individual goals are timeline facts, not standalone feed spam');
assert.equal(reds[0].visibility, 'public');
assert.equal(reds[0].facts.minute, 39);
assert.equal(reds[0].facts.reason, 'serious-foul-play');

const before = events.length;
reconcileMatchNewsEvents(career);
assert.equal(career.eventLedger.events.length, before, 'match projection must be idempotent');

const ranked = rankNewsEvents(career.eventLedger.events, { userClubCode: 'MUN' });
assert.equal(ranked.some(row => row.event.type === CAREER_EVENT_TYPES.GOAL), false, 'timeline goals must stay out of editorial feed');
assert.equal(ranked.some(row => row.event.type === CAREER_EVENT_TYPES.RED_CARD), true, 'red card may become an editorial story');

console.log('career newsroom match bridge smoke: ok');
