import assert from 'node:assert/strict';
import { resolveNewsroomMedia, resolveNewsroomStadiumMedia, hydrateNewsroomMedia } from '../src/career-core/newsroom-media.js';

const stadium = await resolveNewsroomStadiumMedia('MUN');
assert.ok(stadium?.url, 'Manchester United should resolve verified stadium media');
assert.equal(stadium.kind, 'stadium');
assert.equal(stadium.local, true, 'Premier League stadium media should prefer the verified local pack');
assert.ok(stadium.candidates?.length >= 1);

const article = {
  id: 'news-test',
  eventId: 'evt-test',
  category: 'club',
  mediaIntent: {
    eventId: 'evt-test',
    type: 'match.played',
    clubCodes: ['MUN', 'MCI'],
    playerIds: [],
    fixtureId: 'fixture-test',
    preference: 'club'
  }
};

const media = await resolveNewsroomMedia(article, { userClubCode: 'MUN' });
assert.ok(media?.url);
assert.equal(media.kind, 'stadium', 'match/club stories should prefer contextual stadium photography over a crest');
assert.equal(media.eventId, 'evt-test');

const newsroom = {
  schemaVersion: 1,
  generatedForDate: '2026-08-15',
  lead: article,
  feed: [article],
  activeStoryArc: null
};

const hydrated = await hydrateNewsroomMedia(newsroom, { userClubCode: 'MUN' });
assert.equal(hydrated.feed.length, 1);
assert.ok(hydrated.feed[0].media?.url);
assert.equal(hydrated.lead.media.url, hydrated.feed[0].media.url);
assert.equal(newsroom.feed[0].media, undefined, 'hydration must not mutate the original newsroom snapshot');

console.log('career newsroom media smoke: ok');
