import assert from 'node:assert/strict';
import { archiveNewsroomSnapshot, buildNewsroomTicker, ensureNewsroomArchive, newsroomArchive } from '../src/career-core/newsroom-archive.js';

const career = {
  currentDate: '2026-08-15',
  news: [{ id: 'legacy-news', eventId: 'legacy-event', title: 'Legacy headline', category: 'league' }]
};

ensureNewsroomArchive(career);
assert.equal(career.newsroomArchive.articles.length, 1);
assert.equal(career.newsroomArchive.seenEventIds[0], 'legacy-event');

const newsroom = {
  generatedForDate: '2026-08-15',
  feed: [
    { id: 'news-a', eventId: 'evt-a', title: 'Lead story', label: 'RESULTADO', category: 'club', tier: 'lead', newsworthiness: 91, gameDate: '2026-08-15' },
    { id: 'news-b', eventId: 'evt-b', title: 'Secondary story', label: 'MERCADO', category: 'league', tier: 'major', newsworthiness: 68, gameDate: '2026-08-15' }
  ]
};

const added = archiveNewsroomSnapshot(career, newsroom);
assert.equal(added.length, 2);
assert.equal(career.newsroomArchive.articles.length, 3);
assert.equal(career.news.length, 3);

const duplicate = archiveNewsroomSnapshot(career, newsroom);
assert.equal(duplicate.length, 0, 'same event must never be archived twice');
assert.equal(career.newsroomArchive.articles.length, 3);

const clubArchive = newsroomArchive(career, { category: 'club' });
assert.equal(clubArchive.length, 1);
assert.equal(clubArchive[0].eventId, 'evt-a');

const ticker = buildNewsroomTicker(newsroom, { limit: 2 });
assert.equal(ticker.length, 2);
assert.equal(ticker[0].eventId, 'evt-a');
assert.equal(ticker[0].tier, 'lead');
assert.equal(ticker[1].eventId, 'evt-b');

console.log('career newsroom archive smoke: ok');
