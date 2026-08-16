import assert from "node:assert/strict";
import {
  DECISION_SLICE_SECONDS,
  MatchEngine,
  MAX_SUBSTITUTION_WINDOWS,
  SIMULATION_VERSION,
  calculateTeamProfile
} from "../src/match-engine.js";
import { createMvpMatchData } from "../src/mvp-data.js";

function makeEngine({ seed = 2718, homeTactics = {}, awayTactics = {}, requiresWinner = false } = {}) {
  const data = createMvpMatchData();
  return new MatchEngine({
    home: data.home,
    away: data.away,
    homeLineup: data.homeLineup,
    awayLineup: data.awayLineup,
    homeTactics: { ...data.homeTactics, ...homeTactics },
    awayTactics: { ...data.awayTactics, ...awayTactics },
    seed,
    realDurationSeconds: 120,
    requiresWinner,
    strictInvariants: true
  });
}

function averageStamina(team) {
  return team.players.reduce((sum, player) => sum + player.stamina, 0) / team.players.length;
}

assert.equal(SIMULATION_VERSION, "touchline-match-sim-v2");
assert.equal(DECISION_SLICE_SECONDS, .25, "the simulation must reevaluate at 250 ms slices");
assert.equal(MAX_SUBSTITUTION_WINDOWS, 3);

{
  const engine = makeEngine();
  engine.start();
  engine.processGameWindow(20);
  const beforePause = engine.getSnapshot().clockSeconds;
  engine.setPaused(true);
  engine.tick(1 / 30);
  engine.tick(1 / 30);
  assert.equal(engine.getSnapshot().clockSeconds, beforePause, "pause must freeze simulation time exactly");
  engine.setPaused(false);
  engine.processGameWindow(.25);
  assert.ok(engine.getSnapshot().clockSeconds > beforePause, "resume must continue from the frozen instant");
}

{
  const highPress = makeEngine({ homeTactics: { pressing: 92, tempo: 78, counterpress: true } });
  const lowPress = makeEngine({ homeTactics: { pressing: 22, tempo: 42, counterpress: false } });
  highPress.start();
  lowPress.start();
  highPress.processGameWindow(900);
  lowPress.processGameWindow(900);
  assert.ok(
    averageStamina(highPress.getSnapshot().teams[0]) < averageStamina(lowPress.getSnapshot().teams[0]),
    "high pressing/tempo must have a measurable physical cost"
  );
}

{
  const data = createMvpMatchData();
  const controlled = calculateTeamProfile(data.home, data.homeLineup, {
    ...data.homeTactics,
    mentality: 34,
    pressing: 35,
    tempo: 42,
    passingRisk: 35,
    counterpress: false
  });
  const aggressive = calculateTeamProfile(data.home, data.homeLineup, {
    ...data.homeTactics,
    mentality: 78,
    pressing: 88,
    tempo: 82,
    passingRisk: 72,
    counterpress: true
  });
  assert.ok(aggressive.attackIntent > controlled.attackIntent, "tactics must alter attacking intent");
  assert.ok(aggressive.pressIntensity > controlled.pressIntensity, "tactics must alter pressing intensity");
}

{
  const engine = makeEngine();
  engine.start();
  const team = engine.getSnapshot().teams[0];
  for (let window = 0; window < 3; window += 1) {
    const outgoing = team.players.find(player => player.role !== "GK" && !team.substitutedOutIds.includes(String(player.id)));
    const incoming = team.bench.find(player => !team.usedPlayerIds.includes(String(player.id)));
    assert.ok(outgoing && incoming, "test squad needs substitution candidates");
    assert.equal(engine.queueSubstitution(0, outgoing.id, incoming.id).ok, true);
    engine.applyPendingChanges();
  }
  assert.equal(team.substitutionWindowsUsed, 3);
  const outgoing = team.players.find(player => player.role !== "GK");
  const incoming = team.bench.find(player => !team.usedPlayerIds.includes(String(player.id)));
  assert.equal(engine.queueSubstitution(0, outgoing.id, incoming.id).ok, false, "fourth in-play window must be rejected");
}

{
  const engine = makeEngine();
  engine.start();
  engine.state.clockSeconds = 45 * 60;
  engine.enterHalftime();
  const team = engine.getSnapshot().teams[0];
  const outgoing = team.players.find(player => player.role !== "GK");
  const incoming = team.bench.find(player => !team.usedPlayerIds.includes(String(player.id)));
  assert.equal(engine.queueSubstitution(0, outgoing.id, incoming.id).ok, true);
  engine.applyPendingChanges({ halftime: true });
  assert.equal(team.substitutionsUsed, 1);
  assert.equal(team.substitutionWindowsUsed, 0, "halftime substitution must not consume an in-play window");
}

{
  const league = makeEngine({ requiresWinner: false });
  league.start();
  league.state.score = [0, 0];
  league.state.teams[0].stats.goals = 0;
  league.state.teams[1].stats.goals = 0;
  league.finishMatch();
  assert.equal(league.getSnapshot().shootout, null, "league draw must not trigger penalties");

  const knockout = makeEngine({ requiresWinner: true });
  knockout.start();
  knockout.state.score = [0, 0];
  knockout.state.teams[0].stats.goals = 0;
  knockout.state.teams[1].stats.goals = 0;
  knockout.finishMatch();
  assert.ok(knockout.getSnapshot().shootout, "knockout draw must resolve through a shootout when required");
  assert.notEqual(knockout.getSnapshot().shootout.goals[0], knockout.getSnapshot().shootout.goals[1]);
}

console.log("Match Engine V2 smoke: OK");
