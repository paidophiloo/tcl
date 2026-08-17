import assert from "node:assert/strict";

import { createMvpMatchData } from "../src/mvp-data.js";
import { calculateTeamProfile, MatchEngine } from "../src/match-engine.js";

function createEngine(speed = 4) {
  const data = createMvpMatchData();
  const engine = new MatchEngine({
    home: data.home,
    away: data.away,
    homeLineup: data.homeLineup,
    awayLineup: data.awayLineup,
    homeTactics: data.homeTactics,
    awayTactics: data.awayTactics,
    seed: data.meta.seed,
    realDurationSeconds: data.meta.realDurationSeconds,
    aiTeamIndexes: [1 - data.userTeamIndex],
    strictInvariants: true
  });
  engine.setSpeed(speed);
  return { data, engine };
}

function runToHalftime(engine) {
  engine.start();
  let guard = 0;
  while (engine.getSnapshot().phase !== "halftime" && guard < 5000) {
    engine.tick(1 / 60);
    guard += 1;
  }
  assert.ok(guard < 5000, "a partida deve chegar ao intervalo");
}

function runToFulltime(engine) {
  runToHalftime(engine);
  const half = engine.getSnapshot();
  assert.equal(half.clockSeconds, 45 * 60);
  assert.equal(half.paused, true);
  assert.equal(engine.resumeSecondHalf(), true);
  let guard = 0;
  while (engine.getSnapshot().phase !== "fulltime" && guard < 5000) {
    engine.tick(1 / 60);
    guard += 1;
  }
  assert.ok(guard < 5000, "a partida deve chegar ao fim");
  return engine.getSnapshot();
}

function centralEvents(snapshot) {
  return snapshot.events
    .filter(event => [
      "goal",
      "yellowCard",
      "redCard",
      "injury",
      "substitution",
      "halftime",
      "fulltime"
    ].includes(event.type))
    .map(event => ({
      type: event.type,
      teamIndex: event.teamIndex,
      playerId: event.playerId,
      minute: event.minute,
      description: event.description
    }));
}

const data = createMvpMatchData();
assert.equal(data.home.squad.length, 25);
assert.equal(data.away.squad.length, 25);
assert.equal(data.homeLineup.length, 11);
assert.equal(data.awayLineup.length, 11);
assert.equal(new Set([...data.home.squad, ...data.away.squad].map(player => player.id)).size, 50);

const first = runToFulltime(createEngine(1).engine);
const second = runToFulltime(createEngine(4).engine);
assert.equal(first.clockSeconds, 90 * 60);
assert.equal(first.paused, true);
assert.deepEqual(first.score, first.teams.map(team => team.stats.goals));
assert.deepEqual(centralEvents(first), centralEvents(second), "velocidade não pode mudar os eventos centrais");

first.teams.forEach(team => {
  assert.ok(team.stats.passesCompleted <= team.stats.passesAttempted);
  assert.ok(team.stats.shotsOnTarget <= team.stats.shots);
  assert.ok(team.stats.goals <= team.stats.shotsOnTarget);
  assert.equal(team.substitutionsUsed, team.substitutionHistory.length);
  assert.ok(team.substitutionsUsed <= 5);
  team.players.forEach(player => {
    assert.ok(Number.isFinite(player.x));
    assert.ok(Number.isFinite(player.y));
    assert.ok(player.stats.rating >= 4.2 && player.stats.rating <= 10);
  });
});

const goalCounts = first.events.filter(event => event.type === "goal").reduce(
  (counts, event) => {
    counts[event.teamIndex] += 1;
    return counts;
  },
  [0, 0]
);
assert.deepEqual(goalCounts, first.score);
const totalGoals = first.score.reduce((sum, value) => sum + value, 0);
const totalShots = first.teams.reduce((sum, team) => sum + team.stats.shots, 0);
const totalShotsOnTarget = first.teams.reduce((sum, team) => sum + team.stats.shotsOnTarget, 0);
const totalXg = first.teams.reduce((sum, team) => sum + team.stats.xG, 0);

// This file is a single deterministic scenario smoke test, not a distribution
// calibration test. Real football can legitimately produce a 0-0, a low-shot
// match or an unusually open game. Average-like minimums on one seed made this
// smoke brittle and, worse, encouraged tuning the engine to one scoreline.
// Distribution quality is permanently gated by match-engine-v3-realism.mjs.
// Here we retain broad anti-arcade / anti-corruption safety limits plus the
// stronger relational invariants above.
const singleMatchDiagnostic = {
  seed: data.meta.seed,
  score: first.score,
  goals: totalGoals,
  shots: totalShots,
  shotsOnTarget: totalShotsOnTarget,
  xG: Number(totalXg.toFixed(3))
};
console.log("MVP_MATCH_DIAGNOSTIC", JSON.stringify(singleMatchDiagnostic));
assert.ok(totalGoals >= 0 && totalGoals <= 9, "uma partida isolada não deve produzir placar arcade");
assert.ok(totalShots >= 4 && totalShots <= 55, "uma partida isolada deve manter volume de chutes fisicamente plausível");
assert.ok(totalShotsOnTarget >= 0 && totalShotsOnTarget <= 28, "uma partida isolada deve manter chutes no alvo em limite plausível");
assert.ok(totalXg >= 0 && totalXg <= 8.5, "uma partida isolada deve manter xG dentro de limite anti-corrupção");
assert.ok(totalGoals <= totalShotsOnTarget, "gols não podem superar finalizações no alvo");

const substitutionCase = createEngine(1);
substitutionCase.engine.start();
const userTeam = substitutionCase.engine.getSnapshot().teams[substitutionCase.data.userTeamIndex];
const outgoing = userTeam.players.find(player => player.role !== "GK");
const incoming = userTeam.bench[0];
const queued = substitutionCase.engine.queueSubstitution(
  substitutionCase.data.userTeamIndex,
  outgoing.id,
  incoming.id
);
assert.equal(queued.ok, true);
substitutionCase.engine.applyPendingChanges();
assert.equal(userTeam.substitutionsUsed, 1);
assert.ok(userTeam.players.some(player => String(player.id) === String(incoming.id)));
assert.ok(!userTeam.players.some(player => String(player.id) === String(outgoing.id)));

const positionCase = createEngine(1);
const positionTeamIndex = positionCase.data.userTeamIndex;
const positionTeam = positionCase.engine.getSnapshot().teams[positionTeamIndex];
const positionPlayer = positionTeam.players.find(player => player.role !== "GK");
assert.ok(positionPlayer);
const preview = positionCase.engine.previewPlayerPosition(
  positionTeamIndex,
  positionPlayer.id,
  { x: -1, y: 2 }
);
assert.ok(preview);
assert.ok(preview.x >= 0 && preview.x <= 1);
assert.ok(preview.y >= 0 && preview.y <= 1);
assert.equal(preview.clamped, true);

const profile = calculateTeamProfile(
  data.away,
  data.awayLineup,
  data.awayTactics
);
assert.ok(Number.isFinite(profile.overall));
assert.ok(profile.overall > 0);

console.log("MVP smoke: OK");
