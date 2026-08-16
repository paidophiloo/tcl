import assert from 'node:assert/strict';
import { CAREER_EVENT_TYPES } from '../src/career-core/event-ledger.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES } from '../src/career-core/newsroom-governance-types.js';
import { rankNewsEvents } from '../src/career-core/newsroom-editorial.js';
import { selectEditorialEdition } from '../src/career-core/newsroom-edition.js';

const context = { userClubCode: 'MUN', currentDate: '2026-08-20' };
const events = [];

function match(id, date, homeCode, awayCode, homeGoals, awayGoals, extra = {}) {
  events.push({
    id, type: CAREER_EVENT_TYPES.MATCH_PLAYED, gameDate: date, source: 'edition-smoke', visibility: 'public',
    entities: { clubCodes: [homeCode, awayCode] },
    facts: { fixtureId: id, homeCode, awayCode, homeGoals, awayGoals, rivalry: Boolean(extra.rivalry) },
    context: extra
  });
}

function market(id, date, type, playerId, fromClubCode, toClubCode, fee) {
  events.push({
    id, type, gameDate: date, source: 'edition-smoke', visibility: 'public',
    entities: { playerIds: [playerId], clubCodes: [fromClubCode, toClubCode].filter(Boolean) },
    facts: { playerId, fromClubCode, toClubCode, fee, freeAgent: false }
  });
}

function pressure(id, date, band, confidence) {
  events.push({
    id,
    type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE,
    gameDate: date,
    source: 'edition-smoke',
    visibility: 'public',
    entities: { clubCodes: ['MUN'] },
    facts: {
      clubCode: 'MUN', managerName: 'Manager', confidence, band, previousBand: band === 'critical' ? 'pressure' : 'scrutiny',
      ppg: .8, expectedPpg: 1.8, performanceGap: -1, sampleMatches: 6
    }
  });
}

function rejectedContract(id, date, playerId) {
  events.push({
    id,
    type: NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED,
    gameDate: date,
    source: 'edition-smoke',
    visibility: 'public',
    entities: { playerIds: [playerId], clubCodes: ['ARS'] },
    facts: { playerId, clubCode: 'ARS', reason: 'wage-below-expectation', daysRemaining: 280 }
  });
}

function bosmanContract(id, date, playerId) {
  events.push({
    id,
    type: NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED,
    gameDate: date,
    source: 'edition-smoke',
    visibility: 'public',
    entities: { playerIds: [playerId], clubCodes: ['ARS', 'MCI'] },
    facts: { playerId, fromClubCode: 'ARS', toClubCode: 'MCI', startsAt: '2027-07-01', years: 3 }
  });
}

match('old-derby', '2026-08-01', 'MUN', 'MCI', 4, 0, { rivalry: true, titleRace: true, eloUpsetGap: 100 });
match('today-match', '2026-08-20', 'FUL', 'WHU', 2, 1);
match('future-match', '2026-08-21', 'MUN', 'ARS', 7, 0, { rivalry: true, titleRace: true, eloUpsetGap: 200 });

market('same-player-offer', '2026-08-19', CAREER_EVENT_TYPES.TRANSFER_OFFERED, 'p-same', 'AVL', 'MUN', 30000000);
market('same-player-done', '2026-08-20', CAREER_EVENT_TYPES.TRANSFER_COMPLETED, 'p-same', 'AVL', 'MUN', 32000000);
for (let index = 0; index < 8; index += 1) {
  market(`market-${index}`, '2026-08-20', CAREER_EVENT_TYPES.TRANSFER_OFFERED, `p-${index}`, 'CHE', 'ARS', 20000000 + index * 1000000);
}

pressure('pressure-old', '2026-08-19', 'pressure', 29);
pressure('pressure-critical', '2026-08-20', 'critical', 21);
rejectedContract('contract-rejected', '2026-08-18', 'p-contract');
bosmanContract('contract-bosman', '2026-08-20', 'p-contract');

const ranked = rankNewsEvents(events, context);
const edition = selectEditorialEdition(ranked, { ...context, marketLimit: 3, maxStories: 16 });

assert.equal(edition.some(row => row.event.id === 'future-match'), false, 'future events must never publish');
const today = edition.find(row => row.event.id === 'today-match');
const old = edition.find(row => row.event.id === 'old-derby');
assert.ok(today, 'today match should remain in edition');
assert.ok(old, 'old event may remain as low-priority archive-like wire while within the candidate set');
assert.ok(today.score > old.score, 'recency must outrank a much older high-context result');
assert.equal(edition.some(row => row.event.id === 'same-player-offer'), false, 'completed transfer must supersede prior offer for same player');
assert.ok(edition.some(row => row.event.id === 'same-player-done'));
const marketRows = edition.filter(row => [CAREER_EVENT_TYPES.TRANSFER_OFFERED, CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(row.event.type));
assert.ok(marketRows.length <= 3, `market cap exceeded: ${marketRows.length}`);

assert.equal(edition.some(row => row.event.id === 'pressure-old'), false, 'older board-pressure escalation must leave the front page');
assert.ok(edition.some(row => row.event.id === 'pressure-critical'), 'latest critical board pressure must remain publishable');
assert.equal(edition.some(row => row.event.id === 'contract-rejected'), false, 'Bosman agreement must supersede the prior rejected renewal in the current edition');
assert.ok(edition.some(row => row.event.id === 'contract-bosman'), 'most advanced contract stage must remain in the edition');
assert.ok(edition.length <= 16);

const snapshot = edition.map(row => `${row.event.id}:${row.score}:${row.tier}`);
const rebuilt = selectEditorialEdition(rankNewsEvents(events, context), { ...context, marketLimit: 3, maxStories: 16 })
  .map(row => `${row.event.id}:${row.score}:${row.tier}`);
assert.deepEqual(rebuilt, snapshot, 'daily edition must remain deterministic');

console.log('career newsroom edition smoke: ok');
