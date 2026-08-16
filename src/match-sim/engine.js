import { MatchEngine as TacticalSliceEngine } from "./v2.js";
export * from "./v2.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function attr(playerState, key, fallback = null) {
  const value = Number(playerState?.player?.attributes?.[key]);
  if (Number.isFinite(value)) return value;
  return fallback == null ? finite(playerState?.player?.overall, 70) : fallback;
}

function skill(playerState, keys) {
  const base = mean(keys.map(key => attr(playerState, key)));
  const energy = .78 + .22 * clamp(finite(playerState?.stamina, 90) / 100, 0, 1);
  const fit = clamp(finite(playerState?.tacticalFit, .9), .65, 1.03);
  return base * energy * fit;
}

function localPosition(team, player) {
  return team.direction === 1
    ? { x: player.x, y: player.y }
    : { x: 1 - player.x, y: 1 - player.y };
}

function pressureAround(opponent, shooter) {
  let pressure = 0;
  for (const defender of opponent.players) {
    if (defender.redCard) continue;
    const distance = Math.hypot((defender.x - shooter.x) * 1.12, defender.y - shooter.y);
    if (distance > .28) continue;
    const defending = skill(defender, ["defending", "positioning", "tackling"]) / 100;
    pressure += Math.exp(-distance * 11) * defending;
  }
  return clamp(pressure, 0, 1.65);
}

function calibratedXg(team, shooter, opponent) {
  const local = localPosition(team, shooter);
  const dx = 1 - local.x;
  const dy = Math.abs(local.y - .5);
  const distance = Math.hypot(dx, dy * .76);
  const angleQuality = clamp(1 - dy * 1.42, .22, 1);
  const pressure = pressureAround(opponent, shooter);
  const finishing = skill(shooter, ["finishing", "technique", "decisions", "positioning"]);

  // Space is dominant: elite finishing improves a chance but cannot turn a
  // low-angle 30-metre effort into the probability of a six-yard tap-in.
  const spatial = .018 + Math.pow(clamp(1 - distance, 0, 1), 2.65) * .34;
  const execution = clamp(.82 + (finishing - 70) / 210, .68, 1.18);
  const contest = clamp(1 - pressure * .19, .55, 1);
  return clamp(spatial * angleQuality * execution * contest, .012, .46);
}

function worldGoalPoint(team, random) {
  const local = { x: 1, y: clamp(.5 + random(-.12, .12), .36, .64) };
  return team.direction === 1 ? local : { x: 0, y: 1 - local.y };
}

/**
 * Public calibration layer. The 250ms tactical engine continuously evaluates
 * players and space; this layer decides whether a selected shooting intention
 * has actually matured into a viable attempt and calibrates shot outcomes.
 */
export class MatchEngine extends TacticalSliceEngine {
  constructor(options = {}) {
    super(options);
    this.lastAcceptedShotAt = [-999, -999];
  }

  resolveShot(teamIndex, shooter) {
    const state = this.state;
    const team = state.teams[teamIndex];
    const opponent = state.teams[1 - teamIndex];
    const local = localPosition(team, shooter);
    const xG = calibratedXg(team, shooter, opponent);
    const pressure = pressureAround(opponent, shooter);
    const secondsSinceShot = state.clockSeconds - this.lastAcceptedShotAt[teamIndex];

    // A player's decision to look for goal is not automatically a registered
    // shot. The attempt only materialises when position, space, tactical risk
    // and recent attacking rhythm make the window viable. Rejected intentions
    // become a carry, so the same agents keep creating the next phase instead
    // of emitting arcade-like shots every few simulation decisions.
    const territorialQuality = clamp((local.x - .52) / .42, 0, 1);
    const tacticalRisk = .8 + team.tactics.mentality / 250 + team.tactics.passingRisk / 500;
    const rhythm = secondsSinceShot < 35 ? .08 : secondsSinceShot < 70 ? .34 : secondsSinceShot < 110 ? .68 : 1;
    const opportunityProbability = clamp(
      (.018 + xG * .25 + territorialQuality * .035) * tacticalRisk * rhythm * clamp(1 - pressure * .08, .78, 1),
      .006,
      .16
    );

    if (local.x < .55 || !this.rng.chance(opportunityProbability)) {
      this.resolveCarry(teamIndex, shooter);
      return;
    }
    this.lastAcceptedShotAt[teamIndex] = state.clockSeconds;

    const goalkeeper = opponent.players.find(player => player.role === "GK" && !player.redCard)
      || opponent.players.find(player => !player.redCard);
    const finishing = skill(shooter, ["finishing", "technique", "decisions"]);
    const keeping = goalkeeper ? skill(goalkeeper, ["goalkeeping", "positioning", "decisions"]) : 58;

    // On-target and goal are distinct stages. xG remains the unconditional
    // scoring probability for the registered shot.
    const onTargetProbability = clamp(.38 + (finishing - 70) / 190 + xG * .55 - pressure * .07, .27, .72);
    const keeperAdjustment = clamp(1 + (finishing - keeping) / 260, .78, 1.2);
    const unconditionalGoalProbability = clamp(xG * keeperAdjustment, .008, .52);
    const goalGivenOnTarget = clamp(unconditionalGoalProbability / onTargetProbability, .025, .76);

    team.stats.shots += 1;
    team.stats.xG += xG;
    shooter.stats.shots += 1;

    if (!this.rng.chance(onTargetProbability)) {
      const target = worldGoalPoint(team, (min, max) => this.rng.range(min, max));
      state.ball.carrierId = null;
      state.ball.x = target.x;
      state.ball.y = target.y;
      state.ball.z = 0;
      this.addEvent("shot", teamIndex, shooter.id, `${shooter.player.name} finalizou para fora.`, { xG });
      this.stoppage("goalKick");
      state.possessionTeamIndex = 1 - teamIndex;
      const restart = goalkeeper || opponent.players.find(player => !player.redCard);
      if (restart) {
        state.ball.carrierId = restart.id;
        state.ball.x = restart.x;
        state.ball.y = restart.y;
      }
      return;
    }

    team.stats.shotsOnTarget += 1;
    shooter.stats.shotsOnTarget += 1;

    if (this.rng.chance(goalGivenOnTarget)) {
      team.stats.goals += 1;
      state.score[teamIndex] += 1;
      shooter.stats.goals += 1;
      shooter.stats.rating = clamp(shooter.stats.rating + .78, 4.2, 10);
      const pass = state.lastCompletedPass;
      const assister = pass?.teamIndex === teamIndex && state.clockSeconds - pass.at < 12
        ? team.players.find(player => String(player.id) === String(pass.passerId))
        : null;
      if (assister && String(assister.id) !== String(shooter.id)) {
        assister.stats.assists += 1;
        assister.stats.rating = clamp(assister.stats.rating + .28, 4.2, 10);
      }
      this.addEvent("goal", teamIndex, shooter.id, `Gol de ${shooter.player.name}.`, {
        xG,
        assistPlayerId: assister?.id || null
      });
      this.stoppage("goal");
      this.resetKickoff(1 - teamIndex);
      return;
    }

    if (goalkeeper) {
      opponent.stats.saves += 1;
      goalkeeper.stats.rating = clamp(goalkeeper.stats.rating + .07 + xG * .2, 4.2, 10);
    }
    this.addEvent("shotOnTarget", teamIndex, shooter.id, `${shooter.player.name} obrigou o goleiro a trabalhar.`, { xG });
    if (this.rng.chance(.22)) {
      team.stats.corners += 1;
      this.stoppage("corner");
    } else {
      this.stoppage("keeperBall");
      state.possessionTeamIndex = 1 - teamIndex;
      if (goalkeeper) {
        state.ball.carrierId = goalkeeper.id;
        state.ball.x = goalkeeper.x;
        state.ball.y = goalkeeper.y;
      }
    }
  }

  maybeDiscipline() {
    if (!this.rng.chance(.055)) return;
    const teamIndex = this.rng.chance(.5) ? 0 : 1;
    const team = this.state.teams[teamIndex];
    const candidates = team.players.filter(player => !player.redCard && player.role !== "GK");
    const offender = this.rng.weighted(candidates, player => .45 + attr(player, "aggression") / 100);
    if (!offender) return;

    team.stats.fouls += 1;
    offender.stats.fouls += 1;
    const severity = this.rng.next();
    if (severity > .987) {
      this.sendOff(teamIndex, offender, "Cartão vermelho direto");
      return;
    }
    if (severity > .79) {
      offender.yellowCards += 1;
      team.stats.yellowCards += 1;
      this.addEvent("yellowCard", teamIndex, offender.id, `Cartão amarelo para ${offender.player.name}.`);
      if (offender.yellowCards >= 2) this.sendOff(teamIndex, offender, "Segundo amarelo");
    }
  }
}
