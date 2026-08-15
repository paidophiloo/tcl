import assert from 'node:assert/strict';
import { ensureEventLedger, CAREER_EVENT_TYPES, careerEvents } from '../src/career-core/event-ledger.js';
import { reconcileWorldNewsEvents } from '../src/career-core/newsroom-world-bridge.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';
import { validateNewsFact } from '../src/career-core/newsroom-editorial.js';

const career = {
  clubCode: 'MUN',
  currentDate: '2026-08-18',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
  results: {},
  world: {
    events: [
      {
        id: 'world-2026-08-14-000001', date: '2026-08-14', type: 'PLAYER_INJURED', visibility: 'world',
        entities: { playerId: 'p-injured', clubCode: 'MUN', fixtureId: 'f-10' },
        payload: { injuryType: 'hamstring', severity: 'moderate', durationDays: 24, unavailableUntil: '2026-09-07' }
      },
      {
        id: 'world-2026-08-15-000002', date: '2026-08-15', type: 'TRANSFER_COMPLETED', visibility: 'world',
        entities: { playerId: 'p-transfer', fromClubCode: 'AVL', toClubCode: 'MUN', negotiationId: 'n-1' },
        payload: { fee: 32000000, weeklyWage: 95000, contractEnd: '2030-06-30' }
      },
      {
        id: 'world-2026-08-16-000003', date: '2026-08-16', type: 'FREE_AGENT_SIGNED', visibility: 'world',
        entities: { playerId: 'p-free', fromClubCode: null, toClubCode: 'WHU', negotiationId: 'n-2' },
        payload: { fee: 0, weeklyWage: 62000, contractEnd: '2029-06-30', freeAgent: true }
      },
      {
        id: 'world-2026-08-17-000004', date: '2026-08-17', type: 'LOAN_STARTED', visibility: 'world',
        entities: { playerId: 'p-loan', parentClubCode: 'ARS', borrowerClubCode: 'FUL', loanId: 'loan-1' },
        payload: { loanFee: 1200000, endDate: '2027-06-30', wageContribution: 0.75, optionToBuy: true, optionFee: 18000000 }
      },
      {
        id: 'world-2026-08-18-000005', date: '2026-08-18', type: 'PLAYER_RETURNED_FROM_INJURY', visibility: 'world',
        entities: { playerId: 'p-old', clubCode: 'MCI' },
        payload: { injuryType: 'knock', absenceDays: 6 }
      },
      {
        id: 'world-2026-08-18-000006', date: '2026-08-18', type: 'TRANSFER_INTEREST_REGISTERED', visibility: 'system',
        entities: { playerId: 'p-rumor', sellerCode: 'CHE', buyerCode: 'MCI', negotiationId: 'n-internal' },
        payload: { marketValue: 45000000 }
      }
    ]
  }
};

ensureEventLedger(career);
const first = reconcileWorldNewsEvents(career);
assert.equal(first.length, 6);
assert.equal(career.eventLedger.events.length, 6);

const injury = careerEvents(career, { type: CAREER_EVENT_TYPES.INJURY })[0];
assert.equal(injury.facts.daysOut, 24);
assert.equal(injury.facts.diagnosis, 'hamstring');
assert.deepEqual(injury.entities.clubCodes, ['MUN']);

const transfers = careerEvents(career, { type: CAREER_EVENT_TYPES.TRANSFER_COMPLETED });
assert.equal(transfers.length, 2);
const paid = transfers.find(event => event.facts.playerId === 'p-transfer');
const free = transfers.find(event => event.facts.playerId === 'p-free');
assert.equal(paid.facts.fromClubCode, 'AVL');
assert.equal(paid.facts.toClubCode, 'MUN');
assert.equal(paid.facts.fee, 32000000);
assert.equal(free.facts.fromClubCode, null);
assert.equal(free.facts.freeAgent, true);
assert.equal(validateNewsFact(free).valid, true, 'free-agent signing must be editorially valid without a source club');

const loan = careerEvents(career, { type: CAREER_EVENT_TYPES.LOAN_COMPLETED })[0];
assert.equal(loan.facts.fromClubCode, 'ARS');
assert.equal(loan.facts.toClubCode, 'FUL');
assert.equal(loan.facts.optionToBuy, true);

const countBeforeSecondPass = career.eventLedger.events.length;
reconcileWorldNewsEvents(career);
assert.equal(career.eventLedger.events.length, countBeforeSecondPass, 'reopening/reconciling the same save must not duplicate world events');

const newsroom = buildCareerNewsroom(career, {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: code => ({ MUN: 'Manchester United', AVL: 'Aston Villa', WHU: 'West Ham United', ARS: 'Arsenal', FUL: 'Fulham', MCI: 'Manchester City', CHE: 'Chelsea' })[code] || code,
  playerResolver: id => ({ 'p-injured': 'Player Injured', 'p-transfer': 'Player Transfer', 'p-free': 'Player Free', 'p-loan': 'Player Loan', 'p-old': 'Player Old', 'p-rumor': 'Player Rumor' })[id] || id
});

assert.ok(newsroom.feed.some(article => article.eventId === paid.id), 'completed real transfer should appear in editorial feed');
assert.ok(newsroom.feed.some(article => article.eventId === free.id), 'free-agent signing should appear in editorial feed');
assert.ok(newsroom.feed.some(article => article.eventId === injury.id), 'real injury should appear in editorial feed');
assert.equal(newsroom.feed.some(article => article.eventId === 'evt-world-2026-08-18-000006'), false, 'system-only market interest must never leak into the public feed');

console.log('career newsroom world bridge smoke: ok');
