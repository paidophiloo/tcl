import assert from 'node:assert/strict';
import { PLAYER_BY_ID } from '../src/career-core/career-core.js';
import { FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { auditCareerData, canonicalizeResult, reconcileCareerData } from '../src/career-core/result-integrity.js';

const fixture = FIXTURES[0];
assert.ok(fixture, 'expected at least one official fixture');
const players = [...PLAYER_BY_ID.values()];
const homePlayer = players.find(player => player.clubCode === fixture.home);
const awayPlayer = players.find(player => player.clubCode === fixture.away);
const transferredPlayer = players.find(player => ![fixture.home, fixture.away].includes(player.clubCode));
assert.ok(homePlayer && awayPlayer && transferredPlayer, 'expected players for incident test');

const raw = {
  fixtureId: fixture.id,
  lineups: {
    home: [homePlayer.id, transferredPlayer.id],
    away: [awayPlayer.id]
  },
  events: [
    { type: 'goal', minute: 12, side: 'home', playerId: transferredPlayer.id, assistPlayerId: homePlayer.id },
    { type: 'yellow-card', minute: 24, side: 'away', playerId: awayPlayer.id },
    { type: 'red-card', minute: 58, side: 'away', playerId: awayPlayer.id, reason: 'serious-foul-play' },
    { type: 'injury', minute: 71, side: 'home', playerId: homePlayer.id, injuryType: 'hamstring', durationDays: 24 },
    { type: 'goal', minute: 83, side: 'away', playerId: awayPlayer.id, isPenalty: true }
  ]
};

const canonical = canonicalizeResult(raw);
assert.ok(canonical, 'fixture result should canonicalize');
assert.equal(canonical.events.length, 5, 'non-goal incidents must survive canonicalization');
assert.deepEqual(canonical.events.map(event => event.type), ['goal', 'yellow-card', 'red-card', 'injury', 'goal']);
assert.equal(canonical.homeGoals, 1);
assert.equal(canonical.awayGoals, 1);
assert.equal(canonical.events.find(event => event.type === 'red-card')?.reason, 'serious-foul-play');
assert.equal(canonical.events.find(event => event.type === 'injury')?.durationDays, 24);
assert.ok(canonical.lineups.home.includes(transferredPlayer.id), 'historical lineup must not reject a player because static catalog clubCode is stale after a transfer');

const career = { results: { [fixture.id]: raw } };
reconcileCareerData(career);
assert.equal(career.results[fixture.id].events.length, 5, 'save reconciliation must preserve match incidents');
assert.equal(career.playerStats[transferredPlayer.id].goals, 1, 'only goal events should increment goal statistics');
assert.equal(career.playerStats[awayPlayer.id].goals, 1, 'penalty goal should still count');

const audit = auditCareerData(career);
assert.equal(audit.ok, true);
assert.equal(audit.goals, 2);
assert.equal(audit.incidents, 5);
assert.equal(audit.redCards, 1);
assert.equal(audit.injuries, 1);

console.log('career result incidents smoke: ok');
