/*
 * Touchline Match Simulation Engine v2
 *
 * Design goals:
 * - deterministic 250 ms decision slices;
 * - tactics alter space, risk and decision utility rather than flat score bonuses;
 * - roles have in-possession / out-of-possession behaviour and trade-offs;
 * - player execution comes from attributes, condition, role familiarity and pressure;
 * - match rules are isolated from presentation concerns;
 * - the renderer consumes snapshots only and never drives simulation outcomes.
 */

export const SIMULATION_VERSION = "touchline-match-sim-v2";
export const DECISION_SLICE_SECONDS = 0.25;
export const HALF_SECONDS = 45 * 60;
export const FULL_TIME_SECONDS = 90 * 60;
export const MAX_SUBSTITUTIONS = 5;
export const MAX_SUBSTITUTION_WINDOWS = 3;
const EPSILON = 1e-7;

export const FORMATIONS = Object.freeze({
  "4-2-3-1": [
    { role: "GK", x: .07, y: .50 }, { role: "RB", x: .23, y: .84 },
    { role: "RCB", x: .22, y: .61 }, { role: "LCB", x: .22, y: .39 },
    { role: "LB", x: .23, y: .16 }, { role: "DM", x: .43, y: .60 },
    { role: "CM", x: .43, y: .40 }, { role: "RW", x: .68, y: .81 },
    { role: "AM", x: .62, y: .50 }, { role: "LW", x: .68, y: .19 },
    { role: "ST", x: .82, y: .50 }
  ],
  "4-3-3": [
    { role: "GK", x: .07, y: .50 }, { role: "RB", x: .23, y: .84 },
    { role: "RCB", x: .22, y: .61 }, { role: "LCB", x: .22, y: .39 },
    { role: "LB", x: .23, y: .16 }, { role: "DM", x: .43, y: .50 },
    { role: "RCM", x: .52, y: .66 }, { role: "LCM", x: .52, y: .34 },
    { role: "RW", x: .76, y: .82 }, { role: "ST", x: .83, y: .50 },
    { role: "LW", x: .76, y: .18 }
  ],
  "4-4-2": [
    { role: "GK", x: .07, y: .50 }, { role: "RB", x: .23, y: .84 },
    { role: "RCB", x: .22, y: .61 }, { role: "LCB", x: .22, y: .39 },
    { role: "LB", x: .23, y: .16 }, { role: "RM", x: .49, y: .82 },
    { role: "RCM", x: .47, y: .61 }, { role: "LCM", x: .47, y: .39 },
    { role: "LM", x: .49, y: .18 }, { role: "RST", x: .78, y: .62 },
    { role: "LST", x: .78, y: .38 }
  ],
  "3-4-2-1": [
    { role: "GK", x: .07, y: .50 }, { role: "RCB", x: .23, y: .72 },
    { role: "CB", x: .20, y: .50 }, { role: "LCB", x: .23, y: .28 },
    { role: "RWB", x: .46, y: .89 }, { role: "RCM", x: .45, y: .61 },
    { role: "LCM", x: .45, y: .39 }, { role: "LWB", x: .46, y: .11 },
    { role: "RAM", x: .66, y: .64 }, { role: "LAM", x: .66, y: .36 },
    { role: "ST", x: .82, y: .50 }
  ]
});

export const DEFAULT_TACTICS = Object.freeze({
  formation: "4-2-3-1",
  mentality: 52,
  width: 58,
  defensiveLine: 55,
  pressing: 60,
  tempo: 56,
  passingRisk: 52,
  counterpress: true,
  playerRoles: {},
  playerPositions: {}
});

export const PLAYER_ROLE_OPTIONS = Object.freeze([
  "goleiro-líbero", "zagueiro construtor", "lateral apoio", "lateral ofensivo",
  "volante protetor", "organizador", "área-a-área", "ponta aberto",
  "atacante interior", "meia criativo", "atacante móvel", "referência"
]);

const ROLE_EFFECTS = Object.freeze({
  "goleiro-líbero": { attack: .02, defend: .02, width: 1, involvement: 1.15, fatigue: 1.05, pass: .10, carry: -.08, shot: -.5 },
  "zagueiro construtor": { attack: .025, defend: 0, width: .94, involvement: 1.05, fatigue: 1.02, pass: .13, carry: .01, shot: -.18 },
  "lateral apoio": { attack: .05, defend: -.01, width: 1.12, involvement: 1.05, fatigue: 1.10, pass: .04, carry: .04, shot: -.08 },
  "lateral ofensivo": { attack: .105, defend: .02, width: 1.2, involvement: 1.08, fatigue: 1.25, pass: -.02, carry: .12, shot: .01 },
  "volante protetor": { attack: -.045, defend: -.025, width: .82, involvement: .92, fatigue: 1.05, pass: .09, carry: -.06, shot: -.10 },
  "organizador": { attack: .02, defend: -.01, width: .9, involvement: 1.22, fatigue: .98, pass: .18, carry: .01, shot: -.03 },
  "área-a-área": { attack: .065, defend: -.025, width: .96, involvement: 1.18, fatigue: 1.27, pass: -.01, carry: .11, shot: .05 },
  "ponta aberto": { attack: .055, defend: .01, width: 1.26, involvement: 1.02, fatigue: 1.13, pass: .02, carry: .10, shot: .02 },
  "atacante interior": { attack: .07, defend: .015, width: .68, involvement: 1.08, fatigue: 1.15, pass: -.06, carry: .10, shot: .11 },
  "meia criativo": { attack: .045, defend: -.005, width: .82, involvement: 1.22, fatigue: 1.03, pass: .19, carry: .04, shot: .03 },
  "atacante móvel": { attack: .065, defend: -.005, width: .86, involvement: 1.18, fatigue: 1.18, pass: -.03, carry: .12, shot: .10 },
  "referência": { attack: .075, defend: .01, width: .62, involvement: .9, fatigue: 1.07, pass: -.04, carry: -.08, shot: .14 }
});

const POSITION_GROUP = Object.freeze({
  GK: "Goalkeeper", RB: "Defence", RCB: "Defence", CB: "Defence", LCB: "Defence", LB: "Defence", RWB: "Defence", LWB: "Defence",
  DM: "Midfield", RCM: "Midfield", CM: "Midfield", LCM: "Midfield", RM: "Midfield", LM: "Midfield", AM: "Midfield", RAM: "Midfield", LAM: "Midfield",
  RW: "Offence", LW: "Offence", RST: "Offence", ST: "Offence", LST: "Offence"
});
const RIGHT = new Set(["RB", "RWB", "RCB", "RCM", "RM", "RW", "RAM", "RST"]);
const LEFT = new Set(["LB", "LWB", "LCB", "LCM", "LM", "LW", "LAM", "LST"]);
const WIDE = new Set(["RB", "RWB", "LB", "LWB", "RM", "LM", "RW", "LW"]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function sigmoid(value) { return 1 / (1 + Math.exp(-value)); }
function idEqual(a, b) { return String(a) === String(b); }

class SeededRandom {
  constructor(seed = 1) {
    const text = String(seed ?? 1);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    this.state = hash >>> 0 || 1;
  }
  next() {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  chance(probability) { return this.next() < clamp(probability, 0, 1); }
  pick(items) { return items.length ? items[Math.floor(this.next() * items.length)] : null; }
  weighted(items, weightOf) {
    if (!items.length) return null;
    const weights = items.map(item => Math.max(0, finite(weightOf(item), 0)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= EPSILON) return this.pick(items);
    let cursor = this.next() * total;
    for (let index = 0; index < items.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return items[index];
    }
    return items.at(-1);
  }
}

function roleLimits(role) {
  if (role === "GK") return { minX: .025, maxX: .20, minY: .30, maxY: .70, maxDx: .13, maxDy: .20 };
  const group = POSITION_GROUP[role] || "Midfield";
  let limits;
  if (group === "Defence") limits = WIDE.has(role)
    ? { minX: .10, maxX: .62, minY: .03, maxY: .97, maxDx: .32, maxDy: .30 }
    : { minX: .08, maxX: .50, minY: .12, maxY: .88, maxDx: .24, maxDy: .27 };
  else if (group === "Offence") limits = WIDE.has(role)
    ? { minX: .38, maxX: .95, minY: .025, maxY: .975, maxDx: .30, maxDy: .30 }
    : { minX: .46, maxX: .96, minY: .16, maxY: .84, maxDx: .28, maxDy: .28 };
  else {
    const advanced = ["AM", "RAM", "LAM"].includes(role);
    const holding = role === "DM";
    limits = { minX: holding ? .18 : advanced ? .30 : .20, maxX: holding ? .68 : advanced ? .90 : .82, minY: .05, maxY: .95, maxDx: holding ? .29 : .32, maxDy: .32 };
  }
  if (RIGHT.has(role)) limits.minY = Math.max(limits.minY, .44);
  if (LEFT.has(role)) limits.maxY = Math.min(limits.maxY, .56);
  return limits;
}

export function sanitizePlayerPosition(position, role, basePosition = { x: .5, y: .5 }) {
  const limits = roleLimits(role);
  const baseX = clamp(finite(basePosition?.x, .5), .025, .975);
  const baseY = clamp(finite(basePosition?.y, .5), .025, .975);
  const rawX = finite(position?.x, baseX);
  const rawY = finite(position?.y, baseY);
  const x = clamp(rawX, Math.max(limits.minX, baseX - limits.maxDx), Math.min(limits.maxX, baseX + limits.maxDx));
  const y = clamp(rawY, Math.max(limits.minY, baseY - limits.maxDy), Math.min(limits.maxY, baseY + limits.maxDy));
  const displacement = clamp(Math.hypot((x - baseX) / limits.maxDx, (y - baseY) / limits.maxDy) / Math.SQRT2, 0, 1);
  const zoneFit = clamp(1 - Math.max(0, displacement - .28) * .34, .72, 1);
  return { x, y, zoneFit, displacement, clamped: Math.abs(x - rawX) > EPSILON || Math.abs(y - rawY) > EPSILON };
}

function sanitizeTactics(current = DEFAULT_TACTICS, patch = {}) {
  const next = { ...DEFAULT_TACTICS, ...current, ...patch };
  if (!FORMATIONS[next.formation]) next.formation = FORMATIONS[current?.formation] ? current.formation : DEFAULT_TACTICS.formation;
  for (const key of ["mentality", "width", "defensiveLine", "pressing", "tempo", "passingRisk"]) next[key] = clamp(finite(next[key], DEFAULT_TACTICS[key]), 0, 100);
  next.counterpress = Boolean(next.counterpress);
  next.playerRoles = { ...(current?.playerRoles || {}), ...(patch.playerRoles || {}) };
  next.playerPositions = { ...(current?.playerPositions || {}), ...(patch.playerPositions || {}) };
  return next;
}

function attribute(player, key, fallback = null) {
  const own = finite(player?.attributes?.[key], NaN);
  if (Number.isFinite(own)) return own;
  if (fallback != null) return finite(fallback, 70);
  return finite(player?.overall, 70);
}

function preferredPositions(player) {
  return new Set([player?.primaryPosition, ...(player?.positions || [])].filter(Boolean).map(String));
}

function positionFit(player, slotRole) {
  const positions = preferredPositions(player);
  if (positions.has(slotRole)) return 1;
  const group = POSITION_GROUP[slotRole];
  const playerGroup = String(player?.positionGroup || player?.position || "");
  if (group && playerGroup.toLowerCase().includes(group.toLowerCase())) return .93;
  if (group === "Midfield" && [...positions].some(position => ["DM", "CM", "AM", "RM", "LM", "RCM", "LCM"].includes(position))) return .91;
  if (group === "Offence" && [...positions].some(position => ["RW", "LW", "ST", "CF", "AM"].includes(position))) return .89;
  if (group === "Defence" && [...positions].some(position => ["RB", "LB", "CB", "RWB", "LWB"].includes(position))) return .88;
  return slotRole === "GK" ? .35 : .76;
}

function defaultInstructionRole(slot) {
  if (slot === "GK") return "goleiro-líbero";
  if (["CB", "RCB", "LCB"].includes(slot)) return "zagueiro construtor";
  if (["RB", "LB", "RWB", "LWB"].includes(slot)) return "lateral apoio";
  if (slot === "DM") return "volante protetor";
  if (["CM", "RCM", "LCM", "RM", "LM"].includes(slot)) return "área-a-área";
  if (["RW", "LW"].includes(slot)) return "ponta aberto";
  if (["AM", "RAM", "LAM"].includes(slot)) return "meia criativo";
  return "atacante móvel";
}

function roleFamiliarity(player, instructionRole, slotRole) {
  const rawRoles = (player?.roles || []).map(role => String(role).toLowerCase());
  const translatedHints = {
    "goleiro-líbero": ["sweeper", "goalkeeper"], "zagueiro construtor": ["ball", "central-defender"],
    "lateral apoio": ["full-back", "wing-back"], "lateral ofensivo": ["attacking", "wing-back"],
    "volante protetor": ["holding", "defensive", "ball-winning"], "organizador": ["playmaker", "deep-lying"],
    "área-a-área": ["box", "central"], "ponta aberto": ["winger", "wide"],
    "atacante interior": ["inside", "inverted"], "meia criativo": ["playmaker", "attacking-midfielder"],
    "atacante móvel": ["forward", "advanced", "complete"], "referência": ["target", "poacher"]
  };
  const hints = translatedHints[instructionRole] || [];
  const familiar = rawRoles.some(role => hints.some(hint => role.includes(hint)));
  return clamp(positionFit(player, slotRole) * (familiar ? 1 : .94), .68, 1.03);
}

function createPlayerStats() {
  return { touches: 0, passesAttempted: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, goals: 0, assists: 0, tackles: 0, interceptions: 0, fouls: 0, keyPasses: 0, rating: 6.5 };
}

function createTeamStats() {
  return { goals: 0, shots: 0, shotsOnTarget: 0, xG: 0, passesAttempted: 0, passesCompleted: 0, possessionSeconds: 0, tackles: 0, interceptions: 0, fouls: 0, yellowCards: 0, redCards: 0, saves: 0, offsides: 0, corners: 0 };
}

function playerState(player, slot, index, tactics, direction) {
  const custom = sanitizePlayerPosition(tactics.playerPositions?.[String(player.id)], slot.role, slot);
  const instructionRole = PLAYER_ROLE_OPTIONS.includes(tactics.playerRoles?.[String(player.id)]) ? tactics.playerRoles[String(player.id)] : defaultInstructionRole(slot.role);
  const fit = roleFamiliarity(player, instructionRole, slot.role) * custom.zoneFit;
  const localX = custom.x;
  const localY = custom.y;
  return {
    id: player.id,
    player,
    slotIndex: index,
    role: slot.role,
    instructionRole,
    tacticalFit: fit,
    customPosition: tactics.playerPositions?.[String(player.id)] ? { x: custom.x, y: custom.y } : null,
    positionZoneFit: custom.zoneFit,
    positionDisplacement: custom.displacement,
    x: direction === 1 ? localX : 1 - localX,
    y: direction === 1 ? localY : 1 - localY,
    targetX: direction === 1 ? localX : 1 - localX,
    targetY: direction === 1 ? localY : 1 - localY,
    stamina: clamp(finite(player.condition, 94), 1, 100),
    yellowCards: 0,
    redCard: false,
    injured: false,
    stats: createPlayerStats()
  };
}

function teamLineup(team, lineup) {
  const ids = Array.isArray(lineup) ? lineup : lineup?.startingIds || team?.defaultLineup?.startingIds || [];
  return ids.map(id => team.squad.find(player => idEqual(player.id, id))).filter(Boolean).slice(0, 11);
}

function createTeamState(team, lineup, tacticsInput, direction) {
  const tactics = sanitizeTactics(DEFAULT_TACTICS, { ...(team?.tactics || {}), ...(tacticsInput || {}) });
  const formation = FORMATIONS[tactics.formation] || FORMATIONS[DEFAULT_TACTICS.formation];
  const starters = teamLineup(team, lineup);
  const players = starters.map((player, index) => playerState(player, formation[index] || formation.at(-1), index, tactics, direction));
  const starterIds = new Set(players.map(player => String(player.id)));
  const bench = (team?.squad || []).filter(player => !starterIds.has(String(player.id)));
  return {
    team, direction, tactics, pendingTactics: null, pendingSubstitution: null,
    players, bench, stats: createTeamStats(), substitutionsUsed: 0, substitutionWindowsUsed: 0,
    substitutionHistory: [], usedPlayerIds: players.map(player => String(player.id)), substitutedOutIds: [],
    ai: { enabled: false, lastTacticalMinute: -99, lastSubMinute: -99 },
    profile: calculateTeamProfile(team, players.map(player => player.id), tactics)
  };
}

export function calculateTeamProfile(team, lineupIds = [], tacticsInput = {}) {
  const tactics = sanitizeTactics(DEFAULT_TACTICS, tacticsInput);
  const formation = FORMATIONS[tactics.formation] || FORMATIONS[DEFAULT_TACTICS.formation];
  const squad = team?.squad || [];
  const players = lineupIds.map(id => squad.find(player => idEqual(player.id, id))).filter(Boolean);
  const ratings = players.map(player => finite(player.overall, 70));
  const technical = players.map(player => mean([attribute(player, "passing"), attribute(player, "technique"), attribute(player, "firstTouch")]));
  const physical = players.map(player => mean([attribute(player, "pace"), attribute(player, "physical"), attribute(player, "stamina")]));
  const defensive = players.map(player => mean([attribute(player, "defending"), attribute(player, "positioning"), attribute(player, "tackling")]));
  let fitSum = 0;
  let customPositions = 0;
  players.forEach((player, index) => {
    const slot = formation[index] || formation.at(-1);
    const customValue = tactics.playerPositions?.[String(player.id)];
    const custom = sanitizePlayerPosition(customValue, slot.role, slot);
    if (customValue) customPositions += 1;
    const instruction = tactics.playerRoles?.[String(player.id)] || defaultInstructionRole(slot.role);
    fitSum += roleFamiliarity(player, instruction, slot.role) * custom.zoneFit;
  });
  const averageFit = players.length ? fitSum / players.length : .82;
  const cohesion = Math.round(clamp(100 * averageFit - customPositions * 1.6, 55, 100));
  return {
    overall: Math.round(mean(ratings) || finite(team?.displayOverall, 70)),
    technique: Math.round(mean(technical) || 70), physical: Math.round(mean(physical) || 70),
    defending: Math.round(mean(defensive) || 70), cohesion, customPositions,
    roleFit: Math.round(averageFit * 100),
    attackIntent: Math.round(clamp(tactics.mentality * .55 + tactics.tempo * .25 + tactics.passingRisk * .20, 0, 100)),
    pressIntensity: Math.round(clamp(tactics.pressing * .72 + (tactics.counterpress ? 14 : 0), 0, 100))
  };
}

function localCoordinates(teamState, state) {
  return teamState.direction === 1 ? { x: state.x, y: state.y } : { x: 1 - state.x, y: 1 - state.y };
}

function worldCoordinates(teamState, x, y) {
  return teamState.direction === 1 ? { x, y } : { x: 1 - x, y: 1 - y };
}

function effectiveSkill(state, keys) {
  const base = mean(keys.map(key => attribute(state.player, key)));
  const energy = .78 + .22 * clamp(state.stamina / 100, 0, 1);
  const morale = .93 + .001 * clamp(finite(state.player?.morale, 80), 0, 100);
  const sharpness = .93 + .0008 * clamp(finite(state.player?.sharpness, 80), 0, 100);
  return base * energy * morale * sharpness * clamp(state.tacticalFit, .65, 1.03);
}

function teamPressureAt(opponent, worldX, worldY) {
  const press = opponent.tactics.pressing / 100;
  let pressure = 0;
  for (const defender of opponent.players) {
    if (defender.redCard) continue;
    const distance = Math.hypot((defender.x - worldX) * 1.12, defender.y - worldY);
    const defensiveAbility = effectiveSkill(defender, ["defending", "positioning", "workRate"]) / 100;
    pressure += Math.exp(-distance * (11 + press * 6)) * defensiveAbility;
  }
  return clamp(pressure * (.8 + press * .5), 0, 1.7);
}

function spaceValue(opponent, worldX, worldY) {
  return clamp(1 - teamPressureAt(opponent, worldX, worldY) * .52, .12, 1);
}

function chooseCarrier(team, rng) {
  const candidates = team.players.filter(player => !player.redCard);
  return rng.weighted(candidates, player => {
    const local = localCoordinates(team, player);
    const role = ROLE_EFFECTS[player.instructionRole] || {};
    return (.4 + local.x * 1.4) * (role.involvement || 1) * (.65 + effectiveSkill(player, ["firstTouch", "decisions"]) / 180);
  });
}

function tacticalAnchor(team, player, possessionTeamIndex, ownIndex, ball) {
  const formation = FORMATIONS[team.tactics.formation] || FORMATIONS[DEFAULT_TACTICS.formation];
  const slot = formation[player.slotIndex] || formation.at(-1);
  const custom = sanitizePlayerPosition(team.tactics.playerPositions?.[String(player.id)], slot.role, slot);
  const role = ROLE_EFFECTS[player.instructionRole] || ROLE_EFFECTS[defaultInstructionRole(slot.role)] || {};
  const inPossession = possessionTeamIndex === ownIndex;
  const mentality = (team.tactics.mentality - 50) / 100;
  const line = (team.tactics.defensiveLine - 50) / 100;
  const widthScale = (.78 + team.tactics.width / 225) * (role.width || 1);
  let x = custom.x;
  let y = .5 + (custom.y - .5) * widthScale;
  if (inPossession) x += (role.attack || 0) + mentality * .12 + clamp(ball.localX - .5, -.5, .5) * .065;
  else x += (role.defend || 0) + line * .13 + mentality * .035;
  if (!inPossession && team.tactics.pressing > 65) {
    const pressPull = (team.tactics.pressing - 65) / 100;
    x = lerp(x, ball.localOpponentX, pressPull * .15);
    y = lerp(y, ball.localOpponentY, pressPull * .12);
  }
  return { x: clamp(x, .025, .975), y: clamp(y, .025, .975) };
}

function movePlayers(state, seconds) {
  const carrier = state.teams.flatMap(team => team.players).find(player => idEqual(player.id, state.ball.carrierId));
  state.teams.forEach((team, teamIndex) => {
    const ballWorldX = carrier?.x ?? state.ball.x;
    const ballWorldY = carrier?.y ?? state.ball.y;
    const ballLocal = team.direction === 1
      ? { localX: ballWorldX, localY: ballWorldY, localOpponentX: 1 - ballWorldX, localOpponentY: 1 - ballWorldY }
      : { localX: 1 - ballWorldX, localY: 1 - ballWorldY, localOpponentX: ballWorldX, localOpponentY: ballWorldY };
    team.players.forEach(player => {
      if (player.redCard) return;
      const anchor = tacticalAnchor(team, player, state.possessionTeamIndex, teamIndex, ballLocal);
      const world = worldCoordinates(team, anchor.x, anchor.y);
      player.targetX = world.x;
      player.targetY = world.y;
      const pace = effectiveSkill(player, ["pace", "stamina", "workRate"]) / 100;
      const movement = clamp(seconds * (.075 + pace * .09), 0, .09);
      player.x = lerp(player.x, world.x, movement);
      player.y = lerp(player.y, world.y, movement);
    });
  });
}

function drainFatigue(state, seconds) {
  state.teams.forEach(team => {
    const pressLoad = .72 + team.tactics.pressing / 115;
    const tempoLoad = .78 + team.tactics.tempo / 180;
    const possessionLoad = state.possessionTeamIndex === state.teams.indexOf(team) ? .94 : 1.06;
    team.players.forEach(player => {
      if (player.redCard) return;
      const roleLoad = ROLE_EFFECTS[player.instructionRole]?.fatigue || 1;
      const staminaAttribute = attribute(player.player, "stamina", 72);
      const resilience = .72 + staminaAttribute / 255;
      const perSecond = .0037 * pressLoad * tempoLoad * roleLoad * possessionLoad / resilience;
      player.stamina = clamp(player.stamina - perSecond * seconds, 1, 100);
    });
  });
}

function passCandidates(team, carrier, opponent) {
  const carrierLocal = localCoordinates(team, carrier);
  return team.players.filter(player => !player.redCard && !idEqual(player.id, carrier.id)).map(player => {
    const local = localCoordinates(team, player);
    const forward = local.x - carrierLocal.x;
    const distance = Math.hypot((local.x - carrierLocal.x) * 1.05, local.y - carrierLocal.y);
    const space = spaceValue(opponent, player.x, player.y);
    return { player, local, forward, distance, space };
  });
}

function setBallCarrier(state, player) {
  state.ball.carrierId = player?.id ?? null;
  if (player) { state.ball.x = player.x; state.ball.y = player.y; state.ball.z = 0; }
  state.ball.moving = false;
  state.ball.progress = 1;
  state.ball.targetCarrierId = null;
}

function ballFlight(state, from, to, duration = .35) {
  state.ball = { ...state.ball, x: from.x, y: from.y, z: 0, carrierId: null, moving: true, progress: 0, duration, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, targetCarrierId: to.id || null };
}

function updateBall(state, seconds) {
  if (state.ball.carrierId) {
    const carrier = state.teams.flatMap(team => team.players).find(player => idEqual(player.id, state.ball.carrierId));
    if (carrier) { state.ball.x = carrier.x; state.ball.y = carrier.y; state.ball.z = 0; }
    return;
  }
  if (!state.ball.moving) return;
  state.ball.progress = clamp(state.ball.progress + seconds / Math.max(.08, state.ball.duration), 0, 1);
  const eased = 1 - Math.pow(1 - state.ball.progress, 2);
  state.ball.x = lerp(state.ball.fromX, state.ball.toX, eased);
  state.ball.y = lerp(state.ball.fromY, state.ball.toY, eased);
  state.ball.z = Math.sin(Math.PI * state.ball.progress) * .015;
  if (state.ball.progress >= 1 - EPSILON) state.ball.moving = false;
}

function chanceQuality(team, shooter, opponent) {
  const local = localCoordinates(team, shooter);
  const distanceToGoal = Math.hypot(1 - local.x, (local.y - .5) * .72);
  const angle = clamp(1 - Math.abs(local.y - .5) * 1.35, .25, 1);
  const pressure = teamPressureAt(opponent, shooter.x, shooter.y);
  const finishing = effectiveSkill(shooter, ["finishing", "technique", "decisions", "positioning"]);
  const base = .025 + Math.pow(clamp(1 - distanceToGoal, 0, 1), 2.25) * .29;
  const quality = base * (.72 + finishing / 230) * (.72 + angle * .38) * clamp(1 - pressure * .18, .58, 1.05);
  return clamp(quality, .018, .48);
}

function shotUtility(team, carrier, opponent) {
  const local = localCoordinates(team, carrier);
  const xg = chanceQuality(team, carrier, opponent);
  const roleBias = ROLE_EFFECTS[carrier.instructionRole]?.shot || 0;
  return clamp((local.x - .55) * 1.5 + xg * 2.2 + roleBias + (team.tactics.mentality - 50) / 250, -.5, 1.4);
}

function passUtility(team, carrier, target, opponent) {
  const roleBias = ROLE_EFFECTS[carrier.instructionRole]?.pass || 0;
  const risk = (team.tactics.passingRisk - 50) / 100;
  const tempo = (team.tactics.tempo - 50) / 100;
  return .25 + target.forward * (1.05 + risk) + target.space * .55 - target.distance * (.45 - risk * .18) + roleBias + tempo * .08;
}

function carryUtility(team, carrier, opponent) {
  const local = localCoordinates(team, carrier);
  const roleBias = ROLE_EFFECTS[carrier.instructionRole]?.carry || 0;
  const pressure = teamPressureAt(opponent, carrier.x, carrier.y);
  const dribble = effectiveSkill(carrier, ["dribbling", "pace", "technique"]);
  return .1 + (1 - local.x) * .25 + dribble / 260 - pressure * .32 + roleBias;
}

function selectDecision(team, carrier, opponent, rng) {
  const candidates = passCandidates(team, carrier, opponent);
  const bestPass = rng.weighted(candidates, candidate => Math.exp(passUtility(team, carrier, candidate, opponent) * 2.1));
  const shoot = shotUtility(team, carrier, opponent);
  const pass = bestPass ? passUtility(team, carrier, bestPass, opponent) : -1;
  const carry = carryUtility(team, carrier, opponent);
  const temperature = .15 + (100 - effectiveSkill(carrier, ["decisions"])) / 420;
  const options = [
    { type: "pass", utility: pass, payload: bestPass },
    { type: "carry", utility: carry },
    { type: "shot", utility: shoot }
  ];
  return rng.weighted(options, option => Math.exp(option.utility / temperature));
}

function minuteOf(state) { return Math.min(120, Math.floor(state.clockSeconds / 60) + 1); }

export class MatchEngine {
  constructor({ home, away, homeLineup, awayLineup, homeTactics, awayTactics, seed = 1, realDurationSeconds = 120, aiTeamIndexes = [], strictInvariants = false, requiresWinner = false } = {}) {
    if (!home || !away) throw new TypeError("MatchEngine requires home and away teams.");
    this.listeners = new Set();
    this.rng = new SeededRandom(seed);
    this.strictInvariants = Boolean(strictInvariants);
    this.requiresWinner = Boolean(requiresWinner);
    this.clockRate = FULL_TIME_SECONDS / Math.max(30, finite(realDurationSeconds, 120));
    this.nextActionAt = 2.5;
    this.eventId = 0;
    this.state = {
      version: SIMULATION_VERSION, seed, phase: "prematch", period: 1, paused: true, speed: 1,
      clockSeconds: 0, simulationAccumulator: 0, halftimeCompleted: false,
      score: [0, 0], events: [], possessionTeamIndex: this.rng.chance(.5) ? 0 : 1,
      lastCompletedPass: null, stoppage: null, shootout: null,
      teams: [createTeamState(home, homeLineup, homeTactics, 1), createTeamState(away, awayLineup, awayTactics, -1)],
      ball: { x: .5, y: .5, z: 0, carrierId: null, moving: false, progress: 1, duration: .25, fromX: .5, fromY: .5, toX: .5, toY: .5, targetCarrierId: null }
    };
    this.state.teams.forEach((team, index) => { team.ai.enabled = aiTeamIndexes.includes(index); });
    this.resetKickoff(this.state.possessionTeamIndex);
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(type, payload = {}) { for (const listener of this.listeners) listener({ type, payload, snapshot: this.state }); }
  getSnapshot() { return this.state; }

  addEvent(type, teamIndex, playerId, description, extra = {}) {
    const event = { id: ++this.eventId, type, teamIndex, playerId, minute: minuteOf(this.state), second: Math.floor(this.state.clockSeconds), description, ...extra };
    this.state.events.unshift(event);
    if (this.state.events.length > 500) this.state.events.length = 500;
    this.notify("event", { event });
    return event;
  }

  start() {
    if (this.state.phase === "prematch") {
      this.state.phase = "firstHalf"; this.state.paused = false;
      this.addEvent("kickoff", null, null, "A partida começou."); this.notify("started"); return true;
    }
    if (this.state.phase === "halftime") return this.resumeSecondHalf();
    return false;
  }

  setPaused(value) {
    if (this.state.phase === "fulltime") return false;
    if (!value && this.state.phase === "halftime") return this.resumeSecondHalf();
    this.state.paused = Boolean(value); this.notify("pause", { paused: this.state.paused }); return true;
  }

  setSpeed(value) {
    this.state.speed = [1, 2, 4].includes(Number(value)) ? Number(value) : 1;
    this.notify("speed", { speed: this.state.speed }); return this.state.speed;
  }

  resumeSecondHalf() {
    if (this.state.phase !== "halftime" || this.state.halftimeCompleted) return false;
    this.applyPendingChanges({ halftime: true });
    this.state.halftimeCompleted = true; this.state.period = 2; this.state.phase = "secondHalf"; this.state.paused = false;
    this.resetKickoff(1); this.nextActionAt = this.state.clockSeconds + 2.5;
    this.addEvent("secondHalf", null, null, "Começa o segundo tempo."); this.notify("secondHalfStarted"); return true;
  }

  resumeFromHalftime() { return this.resumeSecondHalf(); }

  queueTactics(teamIndex, patch, options = {}) {
    const team = this.state.teams[teamIndex];
    if (!team) return { ok: false, reason: "Equipe inválida." };
    team.pendingTactics = sanitizeTactics(team.tactics, patch);
    this.addEvent("tacticalChange", teamIndex, null, `${options.source === "ai" ? "O adversário preparou" : "Mudança tática preparada:"} ${team.pendingTactics.formation} para a próxima interrupção.`, { source: options.source || "user", status: "queued" });
    this.notify("tacticsQueued", { teamIndex, tactics: team.pendingTactics });
    return { ok: true };
  }

  previewPlayerPosition(teamIndex, playerId, position, formationName = null) {
    const team = this.state.teams[teamIndex];
    if (!team) return null;
    const index = team.players.findIndex(player => idEqual(player.id, playerId));
    if (index < 0) return null;
    const formation = FORMATIONS[formationName || team.pendingTactics?.formation || team.tactics.formation] || FORMATIONS[DEFAULT_TACTICS.formation];
    const slot = formation[index] || formation.at(-1);
    const evaluated = sanitizePlayerPosition(position, slot.role, slot);
    return { ...evaluated, role: slot.role, playerId: team.players[index].id, tacticalFit: positionFit(team.players[index].player, slot.role) * evaluated.zoneFit };
  }

  queueSubstitution(teamIndex, outgoingId, incomingId, options = {}) {
    const team = this.state.teams[teamIndex];
    if (!team) return { ok: false, reason: "Equipe inválida." };
    const outgoing = team.players.find(player => idEqual(player.id, outgoingId));
    const incoming = team.bench.find(player => idEqual(player.id, incomingId));
    if (!outgoing || !incoming || idEqual(outgoingId, incomingId)) return { ok: false, reason: "Jogadores inválidos." };
    if (outgoing.redCard) return { ok: false, reason: "Um atleta expulso não pode ser substituído." };
    if (team.pendingSubstitution) return { ok: false, reason: "Já existe uma substituição preparada." };
    if (team.substitutionsUsed >= MAX_SUBSTITUTIONS) return { ok: false, reason: "Limite de substituições atingido." };
    const atHalftime = this.state.phase === "halftime";
    if (!atHalftime && team.substitutionWindowsUsed >= MAX_SUBSTITUTION_WINDOWS) return { ok: false, reason: "As três janelas de substituição já foram utilizadas." };
    if (team.usedPlayerIds.includes(String(incomingId))) return { ok: false, reason: "Este atleta já participou da partida." };
    if (incoming.available === false || incoming.suspended || incoming.unavailable) return { ok: false, reason: "O atleta não está disponível." };
    team.pendingSubstitution = { outgoingId, incomingId, source: options.source || "user", queuedAt: this.state.clockSeconds };
    this.addEvent("substitutionPrepared", teamIndex, outgoingId, `${incoming.name} está pronto para entrar.`);
    this.notify("substitutionQueued", { teamIndex, outgoingId, incomingId });
    return { ok: true };
  }

  applyTeamTactics(team, teamIndex) {
    if (!team.pendingTactics) return;
    team.tactics = sanitizeTactics(team.tactics, team.pendingTactics); team.pendingTactics = null;
    const formation = FORMATIONS[team.tactics.formation] || FORMATIONS[DEFAULT_TACTICS.formation];
    team.players.forEach((player, index) => {
      const slot = formation[index] || formation.at(-1);
      const evaluated = sanitizePlayerPosition(team.tactics.playerPositions?.[String(player.id)], slot.role, slot);
      player.role = slot.role;
      player.instructionRole = PLAYER_ROLE_OPTIONS.includes(team.tactics.playerRoles?.[String(player.id)]) ? team.tactics.playerRoles[String(player.id)] : defaultInstructionRole(slot.role);
      player.positionZoneFit = evaluated.zoneFit; player.positionDisplacement = evaluated.displacement;
      player.customPosition = team.tactics.playerPositions?.[String(player.id)] ? { x: evaluated.x, y: evaluated.y } : null;
      player.tacticalFit = roleFamiliarity(player.player, player.instructionRole, slot.role) * evaluated.zoneFit;
    });
    team.profile = calculateTeamProfile(team.team, team.players.filter(player => !player.redCard).map(player => player.id), team.tactics);
    this.addEvent("tacticalChange", teamIndex, null, `Estrutura alterada para ${team.tactics.formation}.`, { status: "applied" });
  }

  applyTeamSubstitution(team, teamIndex, { halftime = false } = {}) {
    if (!team.pendingSubstitution) return;
    const pending = team.pendingSubstitution; team.pendingSubstitution = null;
    const outgoingIndex = team.players.findIndex(player => idEqual(player.id, pending.outgoingId));
    const incomingIndex = team.bench.findIndex(player => idEqual(player.id, pending.incomingId));
    if (outgoingIndex < 0 || incomingIndex < 0 || team.substitutionsUsed >= MAX_SUBSTITUTIONS) {
      this.addEvent("substitutionCancelled", teamIndex, pending.outgoingId, "A substituição preparada deixou de ser válida."); return;
    }
    if (!halftime && this.state.phase !== "halftime" && team.substitutionWindowsUsed >= MAX_SUBSTITUTION_WINDOWS) {
      this.addEvent("substitutionCancelled", teamIndex, pending.outgoingId, "A equipe já utilizou as três janelas de substituição."); return;
    }
    const outgoing = team.players[outgoingIndex]; const incoming = team.bench[incomingIndex];
    const formation = FORMATIONS[team.tactics.formation] || FORMATIONS[DEFAULT_TACTICS.formation];
    const slot = formation[outgoingIndex] || formation.at(-1);
    const replacement = playerState(incoming, slot, outgoingIndex, team.tactics, team.direction);
    replacement.x = outgoing.x; replacement.y = outgoing.y; replacement.targetX = outgoing.targetX; replacement.targetY = outgoing.targetY;
    outgoing.stats.subbedOut = true; outgoing.stats.minuteOut = minuteOf(this.state);
    team.players[outgoingIndex] = replacement; team.bench.splice(incomingIndex, 1);
    team.substitutionsUsed += 1;
    if (!halftime && this.state.phase !== "halftime") team.substitutionWindowsUsed += 1;
    team.usedPlayerIds.push(String(incoming.id)); team.substitutedOutIds.push(String(outgoing.id));
    team.substitutionHistory.push({ minute: minuteOf(this.state), second: Math.floor(this.state.clockSeconds), outgoingId: outgoing.id, incomingId: incoming.id, outgoingName: outgoing.player.name, incomingName: incoming.name, source: pending.source, queuedAt: pending.queuedAt, window: halftime || this.state.phase === "halftime" ? "halftime" : team.substitutionWindowsUsed, outgoingState: outgoing });
    if (idEqual(this.state.ball.carrierId, outgoing.id)) setBallCarrier(this.state, replacement);
    team.profile = calculateTeamProfile(team.team, team.players.filter(player => !player.redCard).map(player => player.id), team.tactics);
    this.addEvent("substitution", teamIndex, incoming.id, `${incoming.name} entrou no lugar de ${outgoing.player.name}.`, { outgoingId: outgoing.id, incomingId: incoming.id, source: pending.source });
    this.notify("substitutionApplied", { teamIndex, outgoingId: outgoing.id, incomingId: incoming.id, substitutionsUsed: team.substitutionsUsed, substitutionWindowsUsed: team.substitutionWindowsUsed });
  }

  applyPendingChanges(options = {}) {
    this.state.teams.forEach((team, index) => { this.applyTeamTactics(team, index); this.applyTeamSubstitution(team, index, options); });
  }

  resetKickoff(teamIndex) {
    this.state.possessionTeamIndex = teamIndex;
    const team = this.state.teams[teamIndex];
    const striker = team.players.find(player => ["ST", "RST", "LST", "AM"].includes(player.role)) || chooseCarrier(team, this.rng) || team.players[0];
    setBallCarrier(this.state, striker);
    if (striker) { striker.x = .5; striker.y = .5; }
  }

  tick(realDeltaSeconds) {
    const state = this.state;
    if (state.paused || ["prematch", "halftime", "fulltime"].includes(state.phase)) return;
    state.simulationAccumulator += clamp(finite(realDeltaSeconds), 0, .08) * this.clockRate * state.speed;
    let guard = 0;
    while (state.simulationAccumulator + EPSILON >= DECISION_SLICE_SECONDS && !state.paused && state.phase !== "fulltime" && guard < 512) {
      state.simulationAccumulator -= DECISION_SLICE_SECONDS;
      this.processSlice(DECISION_SLICE_SECONDS); guard += 1;
    }
    if (guard >= 512) throw new Error("O motor excedeu o limite de slices em um tick.");
    if (this.strictInvariants) { const checked = this.checkInvariants(); if (!checked.ok) throw new Error(`Invariantes inválidas: ${checked.errors.join(" | ")}`); }
  }

  processGameWindow(gameSeconds) {
    let remaining = Math.max(0, finite(gameSeconds));
    while (remaining > EPSILON && !this.state.paused && this.state.phase !== "fulltime") {
      const slice = Math.min(DECISION_SLICE_SECONDS, remaining); this.processSlice(slice); remaining -= slice;
    }
  }

  processSlice(seconds) {
    const state = this.state;
    const periodEnd = state.halftimeCompleted ? FULL_TIME_SECONDS : HALF_SECONDS;
    const usable = Math.min(seconds, periodEnd - state.clockSeconds);
    if (usable <= EPSILON) { state.halftimeCompleted ? this.finishMatch() : this.enterHalftime(); return; }
    state.clockSeconds += usable;
    state.teams[state.possessionTeamIndex].stats.possessionSeconds += usable;
    movePlayers(state, usable); drainFatigue(state, usable); updateBall(state, usable);
    if (state.clockSeconds + EPSILON >= this.nextActionAt && !state.ball.moving) {
      this.resolveDecision();
      const tempoTeam = state.teams[state.possessionTeamIndex];
      this.nextActionAt = state.clockSeconds + this.rng.range(4.6, 7.4) * (1.12 - tempoTeam.tactics.tempo / 250);
    }
    this.maybeManageAi();
    if (state.clockSeconds + EPSILON >= periodEnd) state.halftimeCompleted ? this.finishMatch() : this.enterHalftime();
  }

  resolveDecision() {
    const state = this.state;
    const teamIndex = state.possessionTeamIndex; const opponentIndex = 1 - teamIndex;
    const team = state.teams[teamIndex]; const opponent = state.teams[opponentIndex];
    let carrier = team.players.find(player => idEqual(player.id, state.ball.carrierId) && !player.redCard);
    if (!carrier) { carrier = chooseCarrier(team, this.rng); setBallCarrier(state, carrier); }
    if (!carrier) return;
    carrier.stats.touches += 1;
    const decision = selectDecision(team, carrier, opponent, this.rng);
    if (decision.type === "shot") this.resolveShot(teamIndex, carrier);
    else if (decision.type === "carry") this.resolveCarry(teamIndex, carrier);
    else this.resolvePass(teamIndex, carrier, decision.payload?.player);
  }

  resolvePass(teamIndex, passer, receiver) {
    const team = this.state.teams[teamIndex]; const opponent = this.state.teams[1 - teamIndex];
    if (!receiver || receiver.redCard) return this.turnover(teamIndex, passer, "Passe sem opção limpa.");
    const from = localCoordinates(team, passer); const to = localCoordinates(team, receiver);
    const distance = Math.hypot((to.x - from.x) * 1.08, to.y - from.y);
    const progress = to.x - from.x; const pressure = teamPressureAt(opponent, passer.x, passer.y);
    const passing = effectiveSkill(passer, ["passing", "technique", "decisions", "firstTouch"]);
    const receiving = effectiveSkill(receiver, ["firstTouch", "positioning", "decisions"]);
    const risk = team.tactics.passingRisk / 100;
    const difficulty = .2 + distance * .58 + Math.max(0, progress) * (.23 + risk * .1) + pressure * .14;
    const success = clamp(.55 + passing / 230 + receiving / 500 - difficulty, .25, .96);
    team.stats.passesAttempted += 1; passer.stats.passesAttempted += 1;
    ballFlight(this.state, passer, receiver, clamp(.22 + distance * .48, .22, .7));
    if (this.rng.chance(success)) {
      team.stats.passesCompleted += 1; passer.stats.passesCompleted += 1;
      this.state.lastCompletedPass = { teamIndex, passerId: passer.id, receiverId: receiver.id, at: this.state.clockSeconds };
      setBallCarrier(this.state, receiver);
      if (progress > .18 && to.x > .62) { passer.stats.keyPasses += .12; }
      return;
    }
    const interceptor = this.rng.weighted(opponent.players.filter(player => !player.redCard), player => {
      const distanceToTarget = Math.hypot(player.x - receiver.x, player.y - receiver.y);
      return Math.exp(-distanceToTarget * 7) * (.4 + effectiveSkill(player, ["interceptions", "defending", "positioning"]) / 100);
    });
    if (interceptor) { interceptor.stats.interceptions += 1; opponent.stats.interceptions += 1; }
    this.turnover(teamIndex, passer, "Interceptação", interceptor);
  }

  resolveCarry(teamIndex, carrier) {
    const team = this.state.teams[teamIndex]; const opponent = this.state.teams[1 - teamIndex];
    const local = localCoordinates(team, carrier); const pressure = teamPressureAt(opponent, carrier.x, carrier.y);
    const dribble = effectiveSkill(carrier, ["dribbling", "pace", "technique", "decisions"]);
    const defender = this.rng.weighted(opponent.players.filter(player => !player.redCard), player => Math.exp(-Math.hypot(player.x - carrier.x, player.y - carrier.y) * 8));
    const defend = defender ? effectiveSkill(defender, ["defending", "tackling", "physical", "decisions"]) : 70;
    const success = clamp(.63 + (dribble - defend) / 190 - pressure * .13, .28, .89);
    if (!this.rng.chance(success)) {
      if (defender) { defender.stats.tackles += 1; opponent.stats.tackles += 1; }
      this.turnover(teamIndex, carrier, "Desarme", defender); return;
    }
    const advance = clamp(this.rng.range(.025, .065) * (.72 + attribute(carrier.player, "pace") / 180), .018, .085);
    const lateral = this.rng.range(-.035, .035);
    const nextLocalX = clamp(local.x + advance, .03, .96); const nextLocalY = clamp(local.y + lateral, .04, .96);
    const world = worldCoordinates(team, nextLocalX, nextLocalY);
    carrier.x = world.x; carrier.y = world.y; setBallCarrier(this.state, carrier);
  }

  resolveShot(teamIndex, shooter) {
    const state = this.state; const team = state.teams[teamIndex]; const opponent = state.teams[1 - teamIndex];
    const xg = chanceQuality(team, shooter, opponent);
    const goalkeeper = opponent.players.find(player => player.role === "GK" && !player.redCard) || opponent.players.find(player => !player.redCard);
    const finishing = effectiveSkill(shooter, ["finishing", "technique", "decisions"]);
    const goalkeeping = goalkeeper ? effectiveSkill(goalkeeper, ["goalkeeping", "positioning", "decisions", "aerial"]) : 55;
    const onTarget = clamp(.34 + finishing / 230 + xg * .42 - teamPressureAt(opponent, shooter.x, shooter.y) * .08, .27, .78);
    team.stats.shots += 1; team.stats.xG += xg; shooter.stats.shots += 1;
    const onFrame = this.rng.chance(onTarget);
    if (!onFrame) {
      ballFlight(state, shooter, worldCoordinates(team, 1, clamp(.5 + this.rng.range(-.18, .18), .25, .75)), .45);
      this.addEvent("shot", teamIndex, shooter.id, `${shooter.player.name} finalizou para fora.`, { xG: xg });
      this.stoppage("goalKick"); return;
    }
    team.stats.shotsOnTarget += 1; shooter.stats.shotsOnTarget += 1;
    const conversion = clamp(xg * (.77 + (finishing - goalkeeping) / 230), .012, .72);
    if (this.rng.chance(conversion / Math.max(xg, .02))) {
      team.stats.goals += 1; state.score[teamIndex] += 1; shooter.stats.goals += 1;
      shooter.stats.rating = clamp(shooter.stats.rating + .78, 4.2, 10);
      const assister = state.lastCompletedPass?.teamIndex === teamIndex && state.clockSeconds - state.lastCompletedPass.at < 12
        ? team.players.find(player => idEqual(player.id, state.lastCompletedPass.passerId)) : null;
      if (assister && !idEqual(assister.id, shooter.id)) { assister.stats.assists += 1; assister.stats.rating = clamp(assister.stats.rating + .28, 4.2, 10); }
      this.addEvent("goal", teamIndex, shooter.id, `Gol de ${shooter.player.name}.`, { xG: xg, assistPlayerId: assister?.id || null });
      this.stoppage("goal"); this.resetKickoff(1 - teamIndex); return;
    }
    if (goalkeeper) { opponent.stats.saves += 1; goalkeeper.stats.rating = clamp(goalkeeper.stats.rating + .08 + xg * .18, 4.2, 10); }
    this.addEvent("shotOnTarget", teamIndex, shooter.id, `${shooter.player.name} obrigou o goleiro a trabalhar.`, { xG: xg });
    if (this.rng.chance(.23)) { team.stats.corners += 1; this.stoppage("corner"); } else { this.stoppage("keeperBall"); this.state.possessionTeamIndex = 1 - teamIndex; setBallCarrier(state, goalkeeper); }
  }

  turnover(teamIndex, carrier, reason, winner = null) {
    const nextIndex = 1 - teamIndex; this.state.possessionTeamIndex = nextIndex; this.state.lastCompletedPass = null;
    const opponent = this.state.teams[nextIndex]; const next = winner || chooseCarrier(opponent, this.rng);
    setBallCarrier(this.state, next);
    if (reason === "Interceptação" || reason === "Desarme") {
      carrier.stats.rating = clamp(carrier.stats.rating - .015, 4.2, 10);
      if (next) next.stats.rating = clamp(next.stats.rating + .012, 4.2, 10);
    }
  }

  stoppage(reason) {
    this.state.stoppage = { reason, at: this.state.clockSeconds };
    this.applyPendingChanges({ halftime: false });
    this.maybeDiscipline();
    this.state.stoppage = null;
  }

  maybeDiscipline() {
    if (!this.rng.chance(.055)) return;
    const offenderTeamIndex = this.rng.chance(.5) ? 0 : 1; const team = this.state.teams[offenderTeamIndex];
    const offender = this.rng.weighted(team.players.filter(player => !player.redCard && player.role !== "GK"), player => .5 + attribute(player.player, "aggression") / 100);
    if (!offender) return;
    team.stats.fouls += 1; offender.stats.fouls += 1;
    const severity = this.rng.next();
    if (severity > .79) {
      offender.yellowCards += 1; team.stats.yellowCards += 1;
      this.addEvent("yellowCard", offenderTeamIndex, offender.id, `Cartão amarelo para ${offender.player.name}.`);
      if (offender.yellowCards >= 2) this.sendOff(offenderTeamIndex, offender, "Segundo amarelo");
    } else if (severity > .985) this.sendOff(offenderTeamIndex, offender, "Cartão vermelho direto");
  }

  sendOff(teamIndex, player, reason) {
    if (player.redCard) return;
    player.redCard = true; this.state.teams[teamIndex].stats.redCards += 1; player.stats.rating = clamp(player.stats.rating - .55, 4.2, 10);
    this.addEvent("redCard", teamIndex, player.id, `${reason}: ${player.player.name} foi expulso.`);
    if (idEqual(this.state.ball.carrierId, player.id)) { this.state.possessionTeamIndex = 1 - teamIndex; setBallCarrier(this.state, chooseCarrier(this.state.teams[1 - teamIndex], this.rng)); }
  }

  maybeManageAi() {
    const minute = Math.floor(this.state.clockSeconds / 60);
    if (minute < 12 || Math.floor(this.state.clockSeconds) % 8 !== 0) return;
    this.state.teams.forEach((team, teamIndex) => {
      if (!team.ai.enabled) return;
      const goalDelta = this.state.score[teamIndex] - this.state.score[1 - teamIndex];
      if (minute >= 55 && minute - team.ai.lastSubMinute >= 10 && team.substitutionsUsed < MAX_SUBSTITUTIONS && team.substitutionWindowsUsed < MAX_SUBSTITUTION_WINDOWS && !team.pendingSubstitution) {
        const tired = team.players.filter(player => !player.redCard && player.role !== "GK").sort((a, b) => a.stamina - b.stamina)[0];
        const replacement = team.bench.filter(player => !team.usedPlayerIds.includes(String(player.id))).sort((a, b) => finite(b.overall, 0) - finite(a.overall, 0))[0];
        if (tired && replacement && (tired.stamina < 72 || minute >= 72)) {
          if (this.queueSubstitution(teamIndex, tired.id, replacement.id, { source: "ai" }).ok) { team.ai.lastSubMinute = minute; if (this.state.stoppage) this.applyPendingChanges(); }
        }
      }
      if (minute >= 60 && minute - team.ai.lastTacticalMinute >= 18 && !team.pendingTactics) {
        let patch = null;
        if (goalDelta < 0) patch = { mentality: clamp(team.tactics.mentality + 12, 0, 100), pressing: clamp(team.tactics.pressing + 9, 0, 100), tempo: clamp(team.tactics.tempo + 8, 0, 100), passingRisk: clamp(team.tactics.passingRisk + 7, 0, 100) };
        else if (goalDelta > 0 && minute >= 72) patch = { mentality: clamp(team.tactics.mentality - 9, 0, 100), tempo: clamp(team.tactics.tempo - 6, 0, 100), passingRisk: clamp(team.tactics.passingRisk - 8, 0, 100), defensiveLine: clamp(team.tactics.defensiveLine - 4, 0, 100) };
        if (patch) { this.queueTactics(teamIndex, patch, { source: "ai" }); team.ai.lastTacticalMinute = minute; }
      }
    });
  }

  enterHalftime() {
    if (this.state.phase === "halftime" || this.state.halftimeCompleted) return;
    this.state.clockSeconds = HALF_SECONDS; this.state.phase = "halftime"; this.state.paused = true;
    this.state.simulationAccumulator = 0; this.addEvent("halftime", null, null, "Intervalo."); this.notify("halftime");
  }

  finishMatch() {
    if (this.state.phase === "fulltime") return;
    this.state.clockSeconds = FULL_TIME_SECONDS; this.state.phase = "fulltime"; this.state.paused = true; this.state.simulationAccumulator = 0;
    this.finalizeRatings();
    if (this.requiresWinner && this.state.score[0] === this.state.score[1]) this.resolvePenaltyShootout();
    this.addEvent("fulltime", null, null, "Fim de jogo."); this.notify("fulltime");
  }

  resolvePenaltyShootout() {
    const kicks = [[], []]; let goals = [0, 0]; let round = 0;
    const kickers = this.state.teams.map(team => team.players.filter(player => !player.redCard).sort((a, b) => effectiveSkill(b, ["finishing", "technique", "decisions"]) - effectiveSkill(a, ["finishing", "technique", "decisions"])));
    while (round < 5 || (goals[0] === goals[1] && round < 16)) {
      for (let teamIndex = 0; teamIndex < 2; teamIndex += 1) {
        const kicker = kickers[teamIndex][round % Math.max(1, kickers[teamIndex].length)];
        const keeper = this.state.teams[1 - teamIndex].players.find(player => player.role === "GK" && !player.redCard);
        const skill = kicker ? effectiveSkill(kicker, ["finishing", "technique", "decisions"]) : 65;
        const gk = keeper ? effectiveSkill(keeper, ["goalkeeping", "decisions", "positioning"]) : 65;
        const scored = this.rng.chance(clamp(.72 + (skill - gk) / 260, .55, .9));
        kicks[teamIndex].push({ playerId: kicker?.id || null, scored }); if (scored) goals[teamIndex] += 1;
        if (round < 5) {
          const remainingThis = 4 - round;
          if (goals[teamIndex] > goals[1 - teamIndex] + remainingThis + (teamIndex === 0 ? 1 : 0)) break;
        }
      }
      round += 1;
      if (round >= 5 && goals[0] !== goals[1] && kicks[0].length === kicks[1].length) break;
    }
    this.state.shootout = { goals, kicks, winnerTeamIndex: goals[0] > goals[1] ? 0 : 1 };
    this.addEvent("penaltyShootout", this.state.shootout.winnerTeamIndex, null, `Disputa de pênaltis: ${goals[0]} × ${goals[1]}.`, { shootout: this.state.shootout });
    return this.state.shootout;
  }

  finalizeRatings() {
    this.state.teams.forEach((team, teamIndex) => {
      const result = this.state.score[teamIndex] - this.state.score[1 - teamIndex];
      team.players.forEach(player => {
        if (player.redCard) return;
        const contribution = player.stats.goals * .58 + player.stats.assists * .32 + player.stats.tackles * .018 + player.stats.interceptions * .014 + player.stats.passesCompleted * .0015;
        const resultBonus = result > 0 ? .12 : result < 0 ? -.08 : .02;
        player.stats.rating = clamp(player.stats.rating + contribution + resultBonus, 4.2, 10);
      });
    });
  }

  checkInvariants() {
    const errors = [];
    if (!Number.isFinite(this.state.clockSeconds) || this.state.clockSeconds < 0 || this.state.clockSeconds > FULL_TIME_SECONDS + EPSILON) errors.push("relógio inválido");
    if (this.state.score.some(score => !Number.isInteger(score) || score < 0)) errors.push("placar inválido");
    this.state.teams.forEach((team, index) => {
      if (team.stats.passesCompleted > team.stats.passesAttempted) errors.push(`passes equipe ${index}`);
      if (team.stats.shotsOnTarget > team.stats.shots) errors.push(`chutes equipe ${index}`);
      if (team.stats.goals > team.stats.shotsOnTarget) errors.push(`gols equipe ${index}`);
      if (team.substitutionsUsed > MAX_SUBSTITUTIONS) errors.push(`substituições equipe ${index}`);
      if (team.substitutionWindowsUsed > MAX_SUBSTITUTION_WINDOWS) errors.push(`janelas equipe ${index}`);
      if (team.substitutionsUsed !== team.substitutionHistory.length) errors.push(`histórico de substituições equipe ${index}`);
      team.players.forEach(player => {
        if (![player.x, player.y, player.stamina, player.stats.rating].every(Number.isFinite)) errors.push(`estado jogador ${player.id}`);
      });
    });
    return { ok: errors.length === 0, errors };
  }
}
