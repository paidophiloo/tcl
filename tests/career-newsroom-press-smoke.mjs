import assert from 'node:assert/strict';
import { appendCareerEvent, CAREER_EVENT_TYPES, careerEvents } from '../src/career-core/event-ledger.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';
import { buildPressConference, NEWSROOM_PRESS_WINDOW_DAYS, recordPressResponse } from '../src/career-core/newsroom-press.js';

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

assert.equal(NEWSROOM_PRESS_WINDOW_DAYS, 1);
const conference = buildPressConference(career);
assert.ok(conference, 'latest played user match should open a press conference');
assert.equal(conference.sourceEventId, derby.id);
assert.equal(conference.expiresOn, '2026-08-23');
assert.equal(conference.ageDays, 0);
assert.equal(conference.questions.length, 3, 'result, rivalry and winning-streak contexts should produce three questions');
assert.equal(conference.questions[0].id, 'result-reaction');
assert.equal(conference.questions[1].id, 'rivalry');
assert.equal(conference.questions[2].id, 'story-arc');

const nextDayCareer = structuredClone(career);
nextDayCareer.currentDate = '2026-08-23';
assert.ok(buildPressConference(nextDayCareer), 'post-match press conference remains available on the next in-game day');
const expiredCareer = structuredClone(career);
expiredCareer.currentDate = '2026-08-24';
assert.equal(buildPressConference(expiredCareer), null, 'post-match press conference must expire after the one-day window');

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

const scorerCareer = {
  clubCode: 'MUN',
  managerName: 'Gabriel Machado',
  currentDate: '2026-09-02',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-09-02T18:00:00.000Z'
};
for (const [date, fixtureId, opponent] of [
  ['2026-08-29', 'sf1', 'WHU'],
  ['2026-09-02', 'sf2', 'FUL']
]) {
  appendCareerEvent(scorerCareer, {
    id: `evt-match-${fixtureId}`,
    type: CAREER_EVENT_TYPES.MATCH_PLAYED,
    gameDate: date,
    source: 'match-engine',
    entities: { clubCodes: ['MUN', opponent] },
    facts: { fixtureId, homeCode: 'MUN', awayCode: opponent, homeGoals: 2, awayGoals: 2 },
    links: { fixtureId }
  });
  for (const [index, minute] of [18, 61].entries()) {
    appendCareerEvent(scorerCareer, {
      id: `evt-${fixtureId}-goal-${index + 1}`,
      type: CAREER_EVENT_TYPES.GOAL,
      gameDate: date,
      source: 'career-match-incidents',
      visibility: 'internal',
      entities: { clubCodes: ['MUN', opponent], playerIds: ['scorer-p1'] },
      facts: { fixtureId, playerId: 'scorer-p1', clubCode: 'MUN', minute },
      links: { fixtureId }
    });
  }
}
const scorerConference = buildPressConference(scorerCareer);
assert.ok(scorerConference);
assert.equal(scorerConference.questions.length, 2, 'result and scorer-form contexts should create two questions without a rivalry');
const scorerQuestion = scorerConference.questions.find(question => question.id === 'story-arc');
assert.ok(scorerQuestion, 'scorer form must become a contextual press question');
assert.match(scorerQuestion.prompt, /4 gols/);
assert.match(scorerQuestion.prompt, /2 dos últimos 2 jogos/);
assert.equal(scorerQuestion.topic, 'a fase do artilheiro');

console.log('career newsroom press smoke: ok');
