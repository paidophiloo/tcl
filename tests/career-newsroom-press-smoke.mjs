import assert from 'node:assert/strict';
import { appendCareerEvent, CAREER_EVENT_TYPES, careerEvents } from '../src/career-core/event-ledger.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';
import { buildPressConference, recordPressResponse } from '../src/career-core/newsroom-press.js';

const career = {
  clubCode: 'MUN',
  managerName: 'Gabriel Machado',
  currentDate: '2026-08-22',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-08-22T18:00:00.000Z',
  playerState: {
    p1: { morale: 74, condition: 90 },
    p2: { morale: 81, condition: 92 }
  }
};

function addWin(date, id, opponent, rivalry = false) {
  return appendCareerEvent(career, {
    id: `evt-match-${id}`,
    type: CAREER_EVENT_TYPES.MATCH_PLAYED,
    gameDate: date,
    source: 'match-engine',
    entities: { clubCodes: ['MUN', opponent] },
    facts: { fixtureId: id, homeCode: 'MUN', awayCode: opponent, homeGoals: 2, awayGoals: 0, rivalry },
    context: { rivalry },
    links: { fixtureId: id }
  });
}

addWin('2026-08-10', 'f1', 'WHU');
addWin('2026-08-15', 'f2', 'FUL');
const derby = addWin('2026-08-22', 'f3', 'MCI', true);

const conference = buildPressConference(career);
assert.ok(conference, 'latest played user match should open a press conference');
assert.equal(conference.sourceEventId, derby.id);
assert.equal(conference.questions.length, 3, 'result, rivalry and winning-streak contexts should produce three questions');
assert.equal(conference.questions[0].id, 'result-reaction');
assert.equal(conference.questions[1].id, 'rivalry');
assert.equal(conference.questions[2].id, 'story-arc');

const first = recordPressResponse(career, conference, 'result-reaction', 'collective');
assert.ok(first?.event);
assert.equal(first.remainingQuestions, 2);
assert.equal(first.event.type, CAREER_EVENT_TYPES.MANAGER_PRESS);
assert.equal(first.event.facts.optionId, 'collective');
assert.match(first.event.facts.quote, /Gabriel Machado/);
assert.equal(career.playerState.p1.morale, 76);
assert.equal(career.playerState.p2.morale, 83);
assert.equal(career.pressState.mediaPressure, 50);

assert.equal(recordPressResponse(career, conference, 'result-reaction', 'ambitious'), null, 'answered question cannot be rewritten');

let next = buildPressConference(career);
assert.deepEqual(next.questions.map(question => question.id), ['rivalry', 'story-arc']);
const second = recordPressResponse(career, next, 'rivalry', 'edge');
assert.equal(second.remainingQuestions, 1);
assert.equal(career.pressState.mediaPressure, 52);

next = buildPressConference(career);
const third = recordPressResponse(career, next, 'story-arc', 'process');
assert.equal(third.remainingQuestions, 0);
assert.equal(buildPressConference(career), null, 'conference closes only after every available question is answered');
assert.equal(careerEvents(career, { type: CAREER_EVENT_TYPES.MANAGER_PRESS }).length, 3);

const newsroom = buildCareerNewsroom(career, {
  userClubCode: 'MUN',
  currentDate: career.currentDate,
  clubResolver: code => ({ MUN: 'Manchester United', MCI: 'Manchester City', WHU: 'West Ham United', FUL: 'Fulham' })[code] || code
});
const pressArticle = newsroom.feed.find(article => article.eventId === first.event.id);
assert.ok(pressArticle, 'selected press response should become eligible editorial material');
assert.equal(pressArticle.label, 'COLETIVA');
assert.match(pressArticle.summary, /Gabriel Machado/);

console.log('career newsroom press smoke: ok');
