import assert from 'node:assert/strict';
import { appendCareerEvent, CAREER_EVENT_TYPES, ensureEventLedger } from '../src/career-core/event-ledger.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';
import { archiveNewsroomSnapshot } from '../src/career-core/newsroom-archive.js';
import { buildStoryArcs } from '../src/career-core/newsroom-story-arcs.js';
import { buildPressConference, recordPressResponse } from '../src/career-core/newsroom-press.js';
import { rankNewsEvents, validateNewsFact } from '../src/career-core/newsroom-editorial.js';
import { reconcileWorldNewsEvents } from '../src/career-core/newsroom-world-bridge.js';

function baseCareer() {
  return {
    schemaVersion: 3,
    saveId: 'lab',
    clubCode: 'MUN',
    managerName: 'Gabriel Machado',
    currentDate: '2026-09-01',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    results: {},
    playerState: {
      p1: { morale: 75 },
      p2: { morale: 76 }
    },
    world: { events: [] },
    news: []
  };
}

const clubNames = {
  MUN: 'Manchester United', MCI: 'Manchester City', ARS: 'Arsenal', CHE: 'Chelsea',
  AVL: 'Aston Villa', WHU: 'West Ham United', FUL: 'Fulham'
};
const context = {
  userClubCode: 'MUN',
  currentDate: '2026-09-01',
  clubResolver: code => clubNames[code] || code,
  playerResolver: id => ({ p1: 'Player One', p2: 'Player Two', p3: 'Player Three', p4: 'Player Four' })[id] || id
};

function addMatch(career, index, home, away, homeGoals, awayGoals, extra = {}) {
  return appendCareerEvent(career, {
    id: `evt-lab-match-${index}`,
    type: CAREER_EVENT_TYPES.MATCH_PLAYED,
    gameDate: `2026-08-${String(10 + index).padStart(2, '0')}`,
    source: 'realism-lab-match-engine',
    entities: { clubCodes: [home, away] },
    facts: { fixtureId: `lab-${index}`, homeCode: home, awayCode: away, homeGoals, awayGoals, rivalry: Boolean(extra.rivalry) },
    context: extra,
    links: { fixtureId: `lab-${index}` }
  });
}

for (let iteration = 0; iteration < 25; iteration += 1) {
  const career = baseCareer();
  ensureEventLedger(career);
  addMatch(career, 1, 'MUN', 'WHU', 2, 0);
  addMatch(career, 2, 'FUL', 'MUN', 0, 1);
  const derby = addMatch(career, 3, 'MUN', 'MCI', 3, 1, { rivalry: true, titleRace: true, eloUpsetGap: 75 });

  career.world.events.push(
    {
      id: 'world-lab-injury', date: '2026-08-14', type: 'PLAYER_INJURED', visibility: 'world',
      entities: { playerId: 'p1', clubCode: 'MUN', fixtureId: 'lab-3' },
      payload: { durationDays: 28, injuryType: 'hamstring', severity: 'moderate', unavailableUntil: '2026-09-11' }
    },
    {
      id: 'world-lab-transfer', date: '2026-08-20', type: 'TRANSFER_COMPLETED', visibility: 'world',
      entities: { playerId: 'p3', fromClubCode: 'AVL', toClubCode: 'MUN' },
      payload: { fee: 28000000, weeklyWage: 85000, contractEnd: '2030-06-30' }
    },
    {
      id: 'world-lab-internal', date: '2026-08-21', type: 'TRANSFER_INTEREST_REGISTERED', visibility: 'system',
      entities: { playerId: 'p4', sellerCode: 'CHE', buyerCode: 'ARS' },
      payload: { marketValue: 50000000 }
    }
  );

  reconcileWorldNewsEvents(career);
  const eventCount = career.eventLedger.events.length;
  reconcileWorldNewsEvents(career);
  assert.equal(career.eventLedger.events.length, eventCount, `iteration ${iteration}: world projection duplicated events`);

  const arcs = buildStoryArcs(career);
  const winning = arcs.find(arc => arc.type === 'form.winning-streak' && arc.subject.clubCode === 'MUN');
  assert.equal(winning?.facts?.streak, 3, `iteration ${iteration}: winning arc threshold drifted`);

  const newsroomA = buildCareerNewsroom(career, context);
  const newsroomB = buildCareerNewsroom(career, context);
  assert.deepEqual(newsroomA, newsroomB, `iteration ${iteration}: newsroom is not deterministic`);
  assert.equal(newsroomA.lead.eventId, 'evt-world-lab-transfer', `iteration ${iteration}: newer meaningful story should outrank a stale derby`);
  assert.notEqual(newsroomA.lead.eventId, derby.id, `iteration ${iteration}: 19-day-old derby remained on the front page`);
  assert.equal(newsroomA.feed.some(article => article.eventId === 'evt-world-lab-internal'), false, `iteration ${iteration}: internal event leaked`);

  archiveNewsroomSnapshot(career, newsroomA);
  const archivedCount = career.newsroomArchive.articles.length;
  archiveNewsroomSnapshot(career, newsroomA);
  assert.equal(career.newsroomArchive.articles.length, archivedCount, `iteration ${iteration}: archive duplicated an event`);

  assert.equal(buildPressConference(career), null, `iteration ${iteration}: stale press conference remained available weeks after the match`);
  const pressCareer = structuredClone(career);
  pressCareer.currentDate = derby.gameDate;
  pressCareer.updatedAt = `${derby.gameDate}T18:00:00.000Z`;
  const conference = buildPressConference(pressCareer);
  assert.ok(conference, `iteration ${iteration}: match-day press conference should be eligible`);
  assert.equal(conference.sourceEventId, derby.id, `iteration ${iteration}: press conference attached to the wrong match`);
  assert.equal(pressCareer.eventLedger.events.some(event => event.type === CAREER_EVENT_TYPES.MANAGER_PRESS), false, `iteration ${iteration}: press quote existed before user choice`);
  const question = conference.questions[0];
  const selected = question.options[0];
  const response = recordPressResponse(pressCareer, conference, question.id, selected.id);
  assert.ok(response?.event, `iteration ${iteration}: selected response was not recorded`);
  assert.equal(response.event.facts.quote, selected.quote, `iteration ${iteration}: stored quote differs from selected authored quote`);
  assert.equal(recordPressResponse(pressCareer, conference, question.id, question.options.at(-1).id), null, `iteration ${iteration}: answered press question was rewritable`);

  const pressContext = { ...context, currentDate: pressCareer.currentDate };
  const rankedA = rankNewsEvents(pressCareer.eventLedger.events, pressContext).map(row => `${row.event.id}:${row.score}:${row.tier}`);
  const rankedB = rankNewsEvents(pressCareer.eventLedger.events, pressContext).map(row => `${row.event.id}:${row.score}:${row.tier}`);
  assert.deepEqual(rankedA, rankedB, `iteration ${iteration}: editorial ranking drifted`);
}

const impossibleScore = {
  id: 'evt-impossible',
  type: CAREER_EVENT_TYPES.MATCH_PLAYED,
  gameDate: '2026-09-01',
  source: 'realism-lab',
  entities: { clubCodes: ['MUN', 'MCI'] },
  facts: { fixtureId: 'bad', homeCode: 'MUN', awayCode: 'MCI', homeGoals: -2, awayGoals: 1 }
};
assert.equal(validateNewsFact(impossibleScore).valid, false, 'negative score must never pass FactValidator');

const incompleteMove = {
  id: 'evt-incomplete-transfer',
  type: CAREER_EVENT_TYPES.TRANSFER_COMPLETED,
  gameDate: '2026-09-01',
  source: 'realism-lab',
  entities: { playerIds: ['p4'], clubCodes: ['ARS'] },
  facts: { playerId: 'p4', toClubCode: 'ARS', fee: 10000000, freeAgent: false }
};
assert.equal(validateNewsFact(incompleteMove).valid, false, 'non-free transfer without source club must never publish');

console.log('career newsroom realism lab: ok — 25 deterministic worlds audited');
