import assert from 'node:assert/strict';
import { BOARD_OBJECTIVE_TYPES, ensureSeasonBoardObjective, evaluateSeasonBoardObjective } from '../src/career-world/clubs/board-objectives.js';
import { evaluateUserBoardConfidence } from '../src/career-world/clubs/board-confidence.js';

const clubs = {};
const codes = ['ARS', 'MCI', 'LIV', 'MUN', 'CHE', 'TOT', 'NEW', 'AVL', 'BHA', 'BRE', 'FUL', 'WHU', 'EVE', 'CRY', 'BOU', 'NFO', 'LEE', 'SUN', 'COV', 'HUL'];
codes.forEach((code, index) => {
  clubs[code] = {
    code,
    league: 'Premier League',
    division: 1,
    elo: 1980 - index * 24,
    startingTransferBudget: 150_000_000 - index * 5_000_000,
    transferBudget: 150_000_000 - index * 5_000_000
  };
});

const career = {
  saveId: 'board-objective-smoke',
  seasonId: '2026-27',
  seasonLabel: '2026/27',
  clubCode: 'MUN',
  managerName: 'Gabriel Machado',
  currentDate: '2026-07-01',
  results: {},
  inbox: [],
  world: { currentDate: '2026-07-01', eventSequence: 0, events: [], clubs }
};

const objective = ensureSeasonBoardObjective(career, '2026-07-01');
assert.equal(objective.type, BOARD_OBJECTIVE_TYPES.TOP_FOUR, 'fourth-ranked strength profile should receive a top-four objective');
assert.equal(objective.targetPositionMax, 4);
assert.equal(objective.minimumAcceptablePosition, 6);
assert.equal(objective.expectedPosition, 4);
assert.equal(objective.eloRank, 4);
assert.equal(objective.budgetRank, 4);
assert.equal(career.boardObjective.type, BOARD_OBJECTIVE_TYPES.TOP_FOUR);
assert.ok(career.inbox.some(message => message.subject === 'Objetivo da temporada: Terminar no top 4'), 'board must communicate the frozen season target');
assert.equal(career.world.events.filter(event => event.type === 'BOARD_SEASON_OBJECTIVE_SET').length, 1);

clubs.MUN.elo = 1400;
clubs.MUN.startingTransferBudget = 1_000_000;
const frozen = ensureSeasonBoardObjective(career, '2026-08-01');
assert.deepEqual(frozen, objective, 'season objective must not be rewritten after team strength changes');
assert.equal(career.world.events.filter(event => event.type === 'BOARD_SEASON_OBJECTIVE_SET').length, 1, 'objective initialization must be idempotent');

for (let index = 0; index < 4; index += 1) {
  const opponent = codes.filter(code => code !== 'MUN')[index];
  career.results[`early-${index}`] = {
    fixtureId: `early-${index}`,
    date: `2026-08-${String(2 + index * 5).padStart(2, '0')}`,
    home: 'MUN', away: opponent, homeGoals: 0, awayGoals: 2
  };
}
let progress = evaluateSeasonBoardObjective(career, '2026-08-20');
assert.equal(progress.played, 4);
assert.equal(progress.status, 'too-early', 'league position must not be judged before five matches');
assert.equal(progress.score, 50);

for (let index = 4; index < 20; index += 1) {
  const opponent = codes.filter(code => code !== 'MUN')[index % 19];
  career.results[`loss-${index}`] = {
    fixtureId: `loss-${index}`,
    date: `2026-${index < 10 ? '09' : index < 15 ? '10' : '11'}-${String(2 + (index % 5) * 5).padStart(2, '0')}`,
    home: index % 2 === 0 ? 'MUN' : opponent,
    away: index % 2 === 0 ? opponent : 'MUN',
    homeGoals: index % 2 === 0 ? 0 : 2,
    awayGoals: index % 2 === 0 ? 2 : 0
  };
}
career.currentDate = '2026-11-25';
progress = evaluateSeasonBoardObjective(career, career.currentDate);
assert.equal(progress.played, 20);
assert.ok(progress.position > objective.minimumAcceptablePosition, 'extended losing season should sit below the minimum board target');
assert.equal(progress.status, 'failing');
assert.ok(progress.score < 40);
assert.ok(progress.maturity >= .75, 'season objective must gain weight as the table matures');

const confidence = evaluateUserBoardConfidence(career, career.currentDate);
assert.ok(confidence.objectiveWeight > 0, 'mature season objective must influence board confidence');
assert.ok(confidence.objectiveWeight <= .45, 'objective influence must stay capped so recent form remains relevant');
assert.equal(confidence.objective.objective.type, BOARD_OBJECTIVE_TYPES.TOP_FOUR);
assert.ok(confidence.targetConfidence < confidence.recentFormTargetConfidence || confidence.objective.score <= confidence.recentFormTargetConfidence, 'failing the frozen objective must not improve the manager evaluation');

console.log('board objectives smoke: ok');
