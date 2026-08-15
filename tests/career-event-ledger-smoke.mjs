import assert from 'node:assert/strict';
import {
  CAREER_EVENT_TYPES,
  EVENT_LEDGER_SCHEMA_VERSION,
  appendCareerEvent,
  careerEvents,
  ensureEventLedger,
  latestCareerEvents
} from '../src/career-core/event-ledger.js';

const legacySave = {
  schemaVersion: 3,
  saveId: 'primary',
  clubCode: 'MUN',
  currentDate: '2026-08-15',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z'
};

ensureEventLedger(legacySave);
assert.equal(legacySave.eventLedger.schemaVersion, EVENT_LEDGER_SCHEMA_VERSION);
assert.equal(legacySave.eventLedger.sequence, 0);
assert.deepEqual(legacySave.eventLedger.events, []);

const derby = appendCareerEvent(legacySave, {
  type: CAREER_EVENT_TYPES.MATCH_PLAYED,
  gameDate: '2026-08-15',
  source: 'match-engine',
  entities: { clubCodes: ['MUN', 'MCI'] },
  facts: {
    fixtureId: 'pl-2026-mun-mci',
    homeCode: 'MUN',
    awayCode: 'MCI',
    homeGoals: 2,
    awayGoals: 1
  },
  links: { fixtureId: 'pl-2026-mun-mci' }
});

assert.equal(legacySave.eventLedger.sequence, 1);
assert.equal(legacySave.eventLedger.events.length, 1);
assert.equal(derby.type, CAREER_EVENT_TYPES.MATCH_PLAYED);
assert.equal(derby.gameDate, '2026-08-15');
assert.deepEqual(derby.entities.clubCodes, ['MUN', 'MCI']);
assert.ok(derby.id.startsWith('evt-2026-08-15-'));
assert.ok(derby.fingerprint);

const duplicate = appendCareerEvent(legacySave, {
  type: CAREER_EVENT_TYPES.MATCH_PLAYED,
  gameDate: '2026-08-15',
  source: 'match-engine',
  entities: { clubCodes: ['MUN', 'MCI'] },
  facts: {
    fixtureId: 'pl-2026-mun-mci',
    homeCode: 'MUN',
    awayCode: 'MCI',
    homeGoals: 2,
    awayGoals: 1
  },
  links: { fixtureId: 'pl-2026-mun-mci' }
});

assert.equal(duplicate.id, derby.id);
assert.equal(legacySave.eventLedger.sequence, 1);
assert.equal(legacySave.eventLedger.events.length, 1);

appendCareerEvent(legacySave, {
  type: CAREER_EVENT_TYPES.INJURY,
  gameDate: '2026-08-16',
  source: 'availability-engine',
  entities: { clubCodes: ['MUN'], playerIds: ['mun-player-7'] },
  facts: { daysOut: 18, diagnosis: 'hamstring' }
});

assert.equal(legacySave.eventLedger.sequence, 2);
assert.equal(careerEvents(legacySave, { clubCode: 'MCI' }).length, 1);
assert.equal(careerEvents(legacySave, { playerId: 'mun-player-7' }).length, 1);
assert.equal(latestCareerEvents(legacySave, 1)[0].type, CAREER_EVENT_TYPES.INJURY);

const arrayLegacy = {
  currentDate: '2026-08-17',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-08-17T12:00:00.000Z',
  eventLedger: [
    {
      date: '2026-08-10',
      type: 'legacy.custom-event',
      facts: { note: 'preserve me' }
    }
  ]
};

ensureEventLedger(arrayLegacy);
assert.equal(arrayLegacy.eventLedger.events.length, 1);
assert.equal(arrayLegacy.eventLedger.events[0].type, 'legacy.custom-event');
assert.equal(arrayLegacy.eventLedger.events[0].facts.note, 'preserve me');
assert.equal(arrayLegacy.eventLedger.sequence, 1);

const snapshot = JSON.stringify(arrayLegacy.eventLedger);
ensureEventLedger(arrayLegacy);
assert.equal(JSON.stringify(arrayLegacy.eventLedger), snapshot, 'normalization should be idempotent');

console.log('career event ledger smoke: ok');
