import assert from 'node:assert/strict';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import { ensureEventLedger, careerEvents } from '../src/career-core/event-ledger.js';
import { reconcileWorldNewsEvents } from '../src/career-core/newsroom-world-bridge.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES } from '../src/career-core/newsroom-governance-types.js';
import { scoreNewsworthiness, validateNewsFact } from '../src/career-core/newsroom-editorial.js';
import { buildCareerNewsroom } from '../src/career-core/newsroom-engine.js';
import { strongestStoryArc } from '../src/career-core/newsroom-story-arcs.js';
import {
  acceptManagerJob,
  applyForManagerJob,
  managerJobMarketSnapshot,
  processUserManagerCareerDay,
  USER_MANAGER_CAREER_META
} from '../src/career-world/managers/user-manager-career.js';

const playerPool = [...WORLD_PLAYER_BY_ID.values()].slice(0, 28);

function baseCareer() {
  const employment = {};
  for (const player of playerPool.slice(0, 16)) employment[player.id] = 'MUN';
  for (const player of playerPool.slice(16, 28)) employment[player.id] = 'WHU';
  const career = {
    saveId: 'manager-career-smoke',
    seasonId: '2026-27',
    seasonLabel: '2026/27',
    managerName: 'Gabriel Machado',
    clubCode: 'MUN',
    currentDate: '2026-10-01',
    createdAt: '2026-07-01T08:00:00.000Z',
    status: 'active',
    formation: '4-2-3-1',
    results: {},
    inbox: [],
    playerState: {},
    world: {
      seed: 991122,
      currentDate: '2026-10-01',
      userClubCode: 'MUN',
      events: [],
      eventSequence: 0,
      employment,
      boardState: {
        clubs: {
          MUN: {
            clubCode: 'MUN', confidence: 19, band: 'critical', lastReviewedMatchId: 'm6', lastReviewedDate: '2026-10-01',
            history: Array.from({ length: 6 }, (_, index) => ({
              date: `2026-09-${String(6 + index * 3).padStart(2, '0')}`,
              matchId: `m${index + 1}`,
              confidence: Math.max(19, 58 - index * 8),
              band: index >= 4 ? 'critical' : 'pressure',
              ppg: .25,
              expectedPpg: 1.82,
              performanceGap: -1.57
            })),
            warningKeys: {}
          }
        },
        objectives: {}
      },
      managerMarket: {
        initialized: true,
        managers: {
          'mgr-mun-placeholder': {
            id: 'mgr-mun-placeholder', name: 'Starting Manager', currentClubCode: 'MUN', status: 'employed', reputation: 4,
            brain: { tacticalStyle: 'transition-attack' }
          }
        },
        history: [], sequence: 0
      },
      clubs: {
        MUN: {
          code: 'MUN', name: 'Manchester United', league: 'Premier League', division: 1, elo: 1900,
          transferBudget: 120000000, startingTransferBudget: 120000000, wageBudget: 3200000,
          managerId: 'mgr-mun-placeholder', managerStatus: 'user-controlled',
          managerBrain: { tacticalStyle: 'transition-attack' },
          brain: { tacticalIdentity: { style: 'transition-attack', inPossessionFormation: '4-2-3-1' }, recruitment: { youthBias: .72 } },
          recruitment: { needs: [], requirements: [], shortlist: [] }
        },
        WHU: {
          code: 'WHU', name: 'West Ham United', league: 'Premier League', division: 1, elo: 1660,
          transferBudget: 42000000, startingTransferBudget: 42000000, wageBudget: 1450000,
          managerId: null, managerStatus: 'vacant', managerVacancySince: '2026-09-25',
          managerBrain: { tacticalStyle: 'compact-control' },
          brain: { tacticalIdentity: { style: 'compact-control', inPossessionFormation: '4-2-3-1' }, recruitment: { youthBias: .58 } },
          recruitment: { needs: [], requirements: [], shortlist: [] }
        }
      }
    }
  };
  for (let index = 1; index <= 9; index += 1) {
    career.results[`m${index}`] = {
      fixtureId: `m${index}`,
      date: `2026-09-${String(2 + index * 3).padStart(2, '0')}`,
      home: index % 2 ? 'MUN' : 'WHU',
      away: index % 2 ? 'WHU' : 'MUN',
      homeGoals: index % 2 ? 0 : 2,
      awayGoals: index % 2 ? 2 : 0,
      lineups: { home: [], away: [] }, events: []
    };
  }
  return career;
}

assert.equal(USER_MANAGER_CAREER_META.recoveryMatches, 3);
assert.equal(USER_MANAGER_CAREER_META.minimumMatchesBeforeDismissal, 9);

const recoveryCareer = baseCareer();
let step = processUserManagerCareerDay({ career: recoveryCareer, date: '2026-10-01' });
assert.equal(step.issued, true, 'critical board confidence should create a real recovery ultimatum');
assert.equal(recoveryCareer.managerCareer.ultimatum.recoveryMatches, 3);
assert.equal(recoveryCareer.status, 'active');
assert.ok(recoveryCareer.inbox.some(message => message.subject.includes('Ultimato')));

ensureEventLedger(recoveryCareer);
reconcileWorldNewsEvents(recoveryCareer);
const formalUltimatum = careerEvents(recoveryCareer, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_ULTIMATUM })[0];
assert.ok(formalUltimatum, 'formal board ultimatum must project into the Newsroom ledger');
assert.equal(formalUltimatum.facts.recoveryMatches, 3);
assert.equal(validateNewsFact(formalUltimatum).valid, true);
assert.ok(scoreNewsworthiness(formalUltimatum, { userClubCode: 'MUN' }).score >= 85, 'formal ultimatum must outrank generic manager pressure');
assert.equal(strongestStoryArc(recoveryCareer, 'MUN')?.type, 'club.manager-ultimatum', 'formal ultimatum must become the strongest active manager story');
const ultimatumNewsroom = buildCareerNewsroom(recoveryCareer, {
  userClubCode: 'MUN', currentDate: recoveryCareer.currentDate,
  clubResolver: code => ({ MUN: 'Manchester United', WHU: 'West Ham United' })[code] || code,
  playerResolver: id => id
});
const ultimatumArticle = ultimatumNewsroom.feed.find(article => article.eventId === formalUltimatum.id);
assert.ok(ultimatumArticle, 'formal ultimatum must publish as factual Newsroom material');
assert.match(ultimatumArticle.title, /3 jogos|reagir/i);
assert.ok(ultimatumArticle.factualClaims.some(claim => claim.action === NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_ULTIMATUM && claim.recoveryMatches === 3));

recoveryCareer.world.boardState.clubs.MUN.history.push({
  date: '2026-10-05', matchId: 'm7', confidence: 42, band: 'scrutiny', ppg: 1.4, expectedPpg: 1.55, performanceGap: -.15
});
recoveryCareer.world.boardState.clubs.MUN.confidence = 42;
recoveryCareer.world.boardState.clubs.MUN.band = 'scrutiny';
recoveryCareer.world.boardState.clubs.MUN.lastReviewedMatchId = 'm7';
step = processUserManagerCareerDay({ career: recoveryCareer, date: '2026-10-05' });
assert.equal(step.resolved, true, 'a factual recovery must close the ultimatum');
assert.equal(step.dismissed, false);
assert.equal(recoveryCareer.managerCareer.ultimatum, null);
assert.equal(recoveryCareer.clubCode, 'MUN');
reconcileWorldNewsEvents(recoveryCareer);
const survived = careerEvents(recoveryCareer, { type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_ULTIMATUM_SURVIVED })[0];
assert.ok(survived, 'survived ultimatum must become a recorded resolution story');
assert.equal(validateNewsFact(survived).valid, true);
assert.notEqual(strongestStoryArc(recoveryCareer, 'MUN')?.type, 'club.manager-ultimatum', 'survival must close the formal ultimatum arc instead of leaving stale crisis context');

const firedCareer = baseCareer();
step = processUserManagerCareerDay({ career: firedCareer, date: '2026-10-01' });
assert.equal(step.issued, true);
const board = firedCareer.world.boardState.clubs.MUN;
for (let index = 7; index <= 9; index += 1) {
  board.history.push({
    date: `2026-10-${String(index * 2).padStart(2, '0')}`,
    matchId: `m${index}`,
    confidence: 18 - (index - 7),
    band: 'critical',
    ppg: .2,
    expectedPpg: 1.75,
    performanceGap: -1.55
  });
  board.confidence = 18 - (index - 7);
  board.band = 'critical';
  board.lastReviewedMatchId = `m${index}`;
  step = processUserManagerCareerDay({ career: firedCareer, date: `2026-10-${String(index * 2).padStart(2, '0')}` });
}
assert.equal(step.dismissed, true, 'three failed recovery matches while still critically underperforming must permit dismissal');
assert.equal(firedCareer.status, 'unemployed');
assert.equal(firedCareer.clubCode, null, 'dismissed manager must stop owning the former club at the career root');
assert.equal(firedCareer.world.userClubCode, null);
assert.equal(firedCareer.formerClubCode, 'MUN');
assert.equal(firedCareer.world.clubs.MUN.managerStatus, 'vacant');
assert.equal(firedCareer.world.clubs.MUN.managerId, null);
assert.equal(firedCareer.world.managerMarket.managers['mgr-mun-placeholder'].status, 'unemployed', 'old hidden starting-manager entity must not remain employed at the user club');
assert.ok(firedCareer.world.events.some(event => event.type === 'MANAGER_SACKED' && event.payload?.userManager));
assert.ok(firedCareer.inbox.some(message => message.subject === 'Decisão sobre o cargo de treinador'));

const market = managerJobMarketSnapshot(firedCareer, '2026-10-18');
assert.equal(market.status, 'unemployed');
assert.equal(market.vacancies.some(row => row.clubCode === 'MUN'), false, 'recently fired manager cannot immediately reapply to the same club');
assert.ok(market.vacancies.some(row => row.clubCode === 'WHU'), 'real open vacancies must be exposed to the unemployed manager');

const application = applyForManagerJob(firedCareer, 'WHU', '2026-10-18');
assert.ok(application);
assert.equal(application.status, 'pending');
assert.ok(application.decisionDate > '2026-10-18');
processUserManagerCareerDay({ career: firedCareer, date: application.decisionDate });
const offered = firedCareer.managerCareer.applications.WHU;
assert.equal(offered.status, 'offered', 'high-fit vacancy should produce a deterministic job offer in this fixture');
const appointment = acceptManagerJob(firedCareer, 'WHU', offered.offerCreatedOn);
assert.ok(appointment);
assert.equal(firedCareer.status, 'active');
assert.equal(firedCareer.clubCode, 'WHU');
assert.equal(firedCareer.world.userClubCode, 'WHU');
assert.equal(firedCareer.world.clubs.WHU.managerStatus, 'user-controlled');
assert.ok(firedCareer.lineup.length >= 11, 'new appointment must hand the manager a playable current squad');
assert.ok(firedCareer.world.events.some(event => event.type === 'MANAGER_HIRED' && event.payload?.userManager));
assert.ok(firedCareer.managerCareer.history.some(row => row.type === 'dismissed' && row.clubCode === 'MUN'));
assert.ok(firedCareer.managerCareer.history.some(row => row.type === 'appointed' && row.clubCode === 'WHU'));

console.log('user manager career smoke: ok');
