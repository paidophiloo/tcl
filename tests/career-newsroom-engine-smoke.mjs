import assert from 'node:assert/strict';
import { appendCareerEvent, CAREER_EVENT_TYPES } from '../src/career-core/event-ledger.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';

const career = {
  clubCode: 'MUN',
  currentDate: '2026-08-22',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-08-22T18:00:00.000Z'
};

const clubs = {
  MUN: { name: 'Manchester United' },
  MCI: { name: 'Manchester City' },
  WHU: { name: 'West Ham United' },
  FUL: { name: 'Fulham' }
};

for (const [date, id, homeCode, awayCode, homeGoals, awayGoals] of [
  ['2026-08-10', 'f1', 'MUN', 'WHU', 2, 0],
  ['2026-08-15', 'f2', 'FUL', 'MUN', 0, 1]
]) {
  appendCareerEvent(career, {
    type: CAREER_EVENT_TYPES.MATCH_PLAYED,
    gameDate: date,
    source: 'match-engine',
    entities: { clubCodes: [homeCode, awayCode] },
    facts: { fixtureId: id, homeCode, awayCode, homeGoals, awayGoals },
    links: { fixtureId: id }
  });
}

const derby = appendCareerEvent(career, {
  type: CAREER_EVENT_TYPES.MATCH_PLAYED,
  gameDate: '2026-08-22',
  source: 'match-engine',
  entities: { clubCodes: ['MUN', 'MCI'] },
  facts: { fixtureId: 'f3', homeCode: 'MUN', awayCode: 'MCI', homeGoals: 3, awayGoals: 1, rivalry: true },
  context: { rivalry: true, titleRace: true, eloUpsetGap: 80 },
  links: { fixtureId: 'f3' }
});

const newsroom = buildCareerNewsroom(career, {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: clubs
});

assert.equal(newsroom.schemaVersion, 1);
assert.equal(newsroom.lead.eventId, derby.id);
assert.equal(newsroom.lead.tier, 'lead');
assert.equal(newsroom.lead.category, 'club');
assert.match(newsroom.lead.title, /Manchester United/);
assert.match(newsroom.lead.title, /Manchester City/);
assert.equal(newsroom.lead.timestamp, 'Hoje');
assert.equal(newsroom.lead.mediaIntent.fixtureId, 'f3');
assert.deepEqual(newsroom.lead.mediaIntent.clubCodes, ['MUN', 'MCI']);
assert.ok(newsroom.activeStoryArc);
assert.equal(newsroom.activeStoryArc.type, 'form.winning-streak');
assert.equal(newsroom.lead.storyArcId, newsroom.activeStoryArc.id);

const snapshot = JSON.stringify(newsroom);
const rebuilt = buildCareerNewsroom(career, {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: clubs
});
assert.equal(JSON.stringify(rebuilt), snapshot, 'newsroom output must be deterministic for the same save state');

console.log('career newsroom engine smoke: ok');
