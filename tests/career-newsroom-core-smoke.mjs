import assert from 'node:assert/strict';
import { appendCareerEvent, CAREER_EVENT_TYPES } from '../src/career-core/event-ledger.js';
import { buildStoryArcs } from '../src/career-core/newsroom-story-arcs.js';
import { rankNewsEvents, scoreNewsworthiness, validateNewsFact } from '../src/career-core/newsroom-editorial.js';

const career = {
  clubCode: 'MUN',
  currentDate: '2026-08-24',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-08-24T12:00:00.000Z'
};

function match(date, id, homeCode, awayCode, homeGoals, awayGoals, context = {}) {
  return appendCareerEvent(career, {
    type: CAREER_EVENT_TYPES.MATCH_PLAYED,
    gameDate: date,
    source: 'match-engine',
    entities: { clubCodes: [homeCode, awayCode] },
    facts: { fixtureId: id, homeCode, awayCode, homeGoals, awayGoals },
    context,
    links: { fixtureId: id }
  });
}

match('2026-08-10', 'f1', 'MUN', 'WHU', 2, 0);
match('2026-08-15', 'f2', 'FUL', 'MUN', 0, 1);
const derby = match('2026-08-22', 'f3', 'MUN', 'MCI', 3, 1, { rivalry: true, titleRace: true, eloUpsetGap: 90 });

appendCareerEvent(career, {
  type: CAREER_EVENT_TYPES.INJURY,
  gameDate: '2026-08-23',
  source: 'availability-engine',
  entities: { clubCodes: ['MUN'], playerIds: ['mun-10'] },
  facts: { daysOut: 35, diagnosis: 'ankle' },
  context: { playerImportance: 0.9 }
});

const arcs = buildStoryArcs(career);
const winning = arcs.find(arc => arc.type === 'form.winning-streak' && arc.subject.clubCode === 'MUN');
const injuries = arcs.find(arc => arc.type === 'squad.injury-pressure' && arc.subject.clubCode === 'MUN');
assert.ok(winning, 'three consecutive wins should open a winning-streak arc');
assert.equal(winning.facts.streak, 3);
assert.ok(injuries, 'active injury should open an injury-pressure arc');
assert.equal(injuries.facts.activeInjuries, 1);

const validation = validateNewsFact(derby);
assert.equal(validation.valid, true);
const lead = scoreNewsworthiness(derby, { userClubCode: 'MUN' });
assert.ok(lead.score >= 75, `derby/title-race result should be a lead story, got ${lead.score}`);
assert.equal(lead.tier, 'lead');

const impossible = {
  id: 'bad',
  type: CAREER_EVENT_TYPES.MATCH_PLAYED,
  gameDate: '2026-08-24',
  source: 'match-engine',
  facts: { fixtureId: 'bad', homeCode: 'MUN', awayCode: 'MCI', homeGoals: -1, awayGoals: 2 },
  entities: { clubCodes: ['MUN', 'MCI'] }
};
assert.equal(validateNewsFact(impossible).valid, false);
assert.equal(scoreNewsworthiness(impossible, { userClubCode: 'MUN' }).tier, 'reject');

const ranked = rankNewsEvents(career.eventLedger.events, { userClubCode: 'MUN' });
assert.equal(ranked[0].event.id, derby.id, 'highest-context match should lead the editorial queue');

appendCareerEvent(career, {
  type: CAREER_EVENT_TYPES.PLAYER_RETURNED,
  gameDate: '2026-09-20',
  source: 'availability-engine',
  entities: { clubCodes: ['MUN'], playerIds: ['mun-10'] },
  facts: { playerId: 'mun-10' }
});
const healedArcs = buildStoryArcs(career);
assert.equal(healedArcs.some(arc => arc.type === 'squad.injury-pressure' && arc.subject.clubCode === 'MUN'), false);

console.log('career newsroom core smoke: ok');
