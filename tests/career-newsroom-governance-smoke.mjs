import assert from 'node:assert/strict';
import { ensureEventLedger, CAREER_EVENT_TYPES, careerEvents } from '../src/career-core/event-ledger.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES } from '../src/career-core/newsroom-governance-types.js';
import { reconcileWorldNewsEvents } from '../src/career-core/newsroom-world-bridge.js';
import { validateNewsFact, scoreNewsworthiness } from '../src/career-core/newsroom-editorial.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';

const career = {
  clubCode: 'MUN',
  currentDate: '2026-09-10',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  results: {},
  world: {
    events: [
      {
        id: 'world-manager-sacked', date: '2026-09-08', type: 'MANAGER_SACKED', visibility: 'world',
        entities: { managerId: 'mgr-che-test', clubCode: 'CHE' },
        payload: { managerName: 'Manager Test', jobSecurity: 0.22, ppg: 0.8, expectedPpg: 1.7, underperformance: 0.5 }
      },
      {
        id: 'world-manager-hired', date: '2026-09-10', type: 'MANAGER_HIRED', visibility: 'world',
        entities: { managerId: 'mgr-che-new', clubCode: 'CHE', fromClubCode: null },
        payload: { managerName: 'New Manager', tacticalStyle: 'high-press-vertical', fitScore: 0.84 }
      },
      {
        id: 'world-manager-poached', date: '2026-09-10', type: 'MANAGER_POACHED', visibility: 'world',
        entities: { managerId: 'mgr-ars-poached', clubCode: 'ARS', fromClubCode: 'WHU' },
        payload: { managerName: 'Poached Manager', tacticalStyle: 'compact-control', fitScore: 0.81 }
      },
      {
        id: 'world-contract-renewed', date: '2026-09-10', type: 'CONTRACT_RENEWED', visibility: 'world',
        entities: { playerId: 'p-renewed', clubCode: 'MCI', renewalId: 'r-1' },
        payload: { weeklyWage: 160000, endDate: '2031-06-30', years: 4, playingTime: 'key-player', agentFee: 800000, signingBonus: 1200000 }
      },
      {
        id: 'world-contract-rejected', date: '2026-09-09', type: 'CONTRACT_RENEWAL_REJECTED', visibility: 'world',
        entities: { playerId: 'p-rejected', clubCode: 'ARS', renewalId: 'r-2' },
        payload: { reason: 'wage-below-expectation', riskBand: 'final-year', daysRemaining: 210 }
      },
      {
        id: 'world-contract-expired', date: '2026-09-10', type: 'CONTRACT_EXPIRED', visibility: 'world',
        entities: { playerId: 'p-expired', clubCode: 'WHU' },
        payload: { endDate: '2026-09-09', freeAgent: true }
      },
      {
        id: 'world-bosman-agreed', date: '2026-09-10', type: 'BOSMAN_PRECONTRACT_AGREED', visibility: 'world',
        entities: { playerId: 'p-bosman', fromClubCode: 'ARS', toClubCode: 'MCI', rumorId: 'rumor-1' },
        payload: { startsAt: '2027-07-01', weeklyWage: 140000, years: 3, signingBonus: 900000, agentFee: 600000 }
      },
      {
        id: 'world-bosman-completed', date: '2026-09-10', type: 'BOSMAN_MOVE_COMPLETED', visibility: 'world',
        entities: { playerId: 'p-bosman-move', fromClubCode: 'WHU', toClubCode: 'MCI' },
        payload: { fee: 0, weeklyWage: 110000, contractEnd: '2030-06-30' }
      },
      {
        id: 'world-contract-offer-internal', date: '2026-09-10', type: 'CONTRACT_OFFER_MADE', visibility: 'world',
        entities: { playerId: 'p-internal', clubCode: 'CHE', renewalId: 'r-internal' },
        payload: { weeklyWage: 90000, years: 3, playingTime: 'rotation' }
      }
    ]
  }
};

ensureEventLedger(career);
const projected = reconcileWorldNewsEvents(career);
assert.equal(projected.length, 8, 'only terminal/noticiable governance events should be projected');
assert.equal(career.eventLedger.events.some(event => event.links?.worldEventId === 'world-contract-offer-internal'), false, 'club offer stage must stay outside public newsroom');

const sacked = careerEvents(career, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_SACKED })[0];
assert.ok(sacked);
assert.deepEqual(sacked.entities.managerIds, ['mgr-che-test']);
assert.equal(sacked.facts.managerName, 'Manager Test');
assert.equal(validateNewsFact(sacked).valid, true);
assert.ok(scoreNewsworthiness(sacked, { userClubCode: 'MUN' }).score >= 60, 'manager sacking should be major news');

const hired = careerEvents(career, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_HIRED })[0];
assert.ok(hired);
assert.equal(validateNewsFact(hired).valid, true);
assert.match(hired.facts.headline, /New Manager/);

const poached = careerEvents(career, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_POACHED })[0];
assert.ok(poached);
assert.equal(poached.facts.fromClubCode, 'WHU');
assert.equal(validateNewsFact(poached).valid, true);

const renewed = careerEvents(career, { type: CAREER_EVENT_TYPES.CONTRACT_RENEWED })[0];
assert.ok(renewed);
assert.equal(renewed.facts.endDate, '2031-06-30');
assert.equal(validateNewsFact(renewed).valid, true);

const rejected = careerEvents(career, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED })[0];
assert.ok(rejected);
assert.equal(rejected.facts.daysRemaining, 210);
assert.equal(validateNewsFact(rejected).valid, true);

const expired = careerEvents(career, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_EXPIRED })[0];
assert.ok(expired);
assert.equal(expired.facts.freeAgent, true);
assert.equal(validateNewsFact(expired).valid, true);

const preContract = careerEvents(career, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED })[0];
assert.ok(preContract);
assert.equal(preContract.facts.startsAt, '2027-07-01');
assert.equal(validateNewsFact(preContract).valid, true);
assert.ok(scoreNewsworthiness(preContract, { userClubCode: 'MUN' }).score >= 60, 'Bosman agreement should be significant market news');

const bosmanMove = careerEvents(career, { type: CAREER_EVENT_TYPES.TRANSFER_COMPLETED }).find(event => event.facts?.bosman);
assert.ok(bosmanMove, 'completed Bosman move should join the canonical completed-transfer stream');
assert.equal(bosmanMove.facts.fee, 0);
assert.equal(bosmanMove.facts.freeAgent, true);
assert.equal(validateNewsFact(bosmanMove).valid, true);

const count = career.eventLedger.events.length;
reconcileWorldNewsEvents(career);
assert.equal(career.eventLedger.events.length, count, 'governance projection must be idempotent');

const newsroom = buildCareerNewsroom(career, {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: code => ({ MUN: 'Manchester United', CHE: 'Chelsea', ARS: 'Arsenal', WHU: 'West Ham United', MCI: 'Manchester City' })[code] || code,
  playerResolver: id => id
});

for (const event of [sacked, hired, poached, renewed, rejected, expired, preContract, bosmanMove]) {
  assert.ok(newsroom.feed.some(article => article.eventId === event.id), `expected governance story ${event.id} in current edition`);
}
assert.ok(newsroom.feed.find(article => article.eventId === sacked.id)?.factualClaims.some(claim => claim.kind === 'manager-change'));
assert.ok(newsroom.feed.find(article => article.eventId === renewed.id)?.factualClaims.some(claim => claim.kind === 'contract'));
assert.ok(newsroom.feed.find(article => article.eventId === preContract.id)?.factualClaims.some(claim => claim.kind === 'contract'));

console.log('career newsroom governance smoke: ok');
