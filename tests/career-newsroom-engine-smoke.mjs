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
const players = { p1: 'Bruno Example', p2: 'Assist Example', p3: 'City Example' };

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
appendCareerEvent(career, {
  id: 'evt-f3-goal-1',
  type: CAREER_EVENT_TYPES.GOAL,
  gameDate: '2026-08-22',
  source: 'career-match-incidents',
  visibility: 'internal',
  entities: { clubCodes: ['MUN', 'MCI'], playerIds: ['p1', 'p2'] },
  facts: { fixtureId: 'f3', playerId: 'p1', clubCode: 'MUN', minute: 18, assistPlayerId: 'p2', scoreAfter: { homeGoals: 1, awayGoals: 0 } },
  links: { fixtureId: 'f3' }
});
appendCareerEvent(career, {
  id: 'evt-f3-red-1',
  type: CAREER_EVENT_TYPES.RED_CARD,
  gameDate: '2026-08-22',
  source: 'career-match-incidents',
  entities: { clubCodes: ['MUN', 'MCI'], playerIds: ['p3'] },
  facts: { fixtureId: 'f3', playerId: 'p3', clubCode: 'MCI', minute: 66, reason: 'serious-foul-play', scoreAtIncident: { homeGoals: 2, awayGoals: 1 } },
  links: { fixtureId: 'f3' }
});

const context = {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: clubs,
  playerResolver: id => players[id] || id
};
const newsroom = buildCareerNewsroom(career, context);

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
assert.equal(newsroom.lead.factualClaims[0].kind, 'score');
assert.equal(newsroom.lead.factualClaims.some(claim => claim.kind === 'goal' && claim.playerId === 'p1' && claim.minute === 18), true, 'match article should include scorer timeline claim');
assert.equal(newsroom.lead.factualClaims.some(claim => claim.kind === 'red-card' && claim.playerId === 'p3' && claim.minute === 66), true, 'match article should include red-card timeline claim');
assert.equal(newsroom.feed.some(article => article.eventId === 'evt-f3-goal-1'), false, 'internal goal fact must not become standalone feed spam');
const redArticle = newsroom.feed.find(article => article.eventId === 'evt-f3-red-1');
assert.ok(redArticle, 'public red card should be eligible for its own story');
assert.match(redArticle.title, /City Example/);
assert.equal(redArticle.mediaIntent.preference, 'player');

const snapshot = JSON.stringify(newsroom);
const rebuilt = buildCareerNewsroom(career, context);
assert.equal(JSON.stringify(rebuilt), snapshot, 'newsroom output must be deterministic for the same save state');

console.log('career newsroom engine smoke: ok');
