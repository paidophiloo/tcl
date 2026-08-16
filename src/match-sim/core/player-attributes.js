import { hashSeed } from './deterministic-rng.js';

const clamp = (value, min = 1, max = 99) => Math.max(min, Math.min(max, Number(value) || min));

export const ATTRIBUTE_KEYS = Object.freeze([
  'goalkeeping','reflexes','handling','oneOnOne','commandArea','kicking','throwing','sweeping',
  'defending','positioning','interceptions','tackling','aggression','bravery','aerial','jumping',
  'passing','vision','technique','firstTouch','dribbling','crossing','finishing','longShots','setPieces','penalties',
  'decisions','anticipation','composure','concentration','offBall','teamwork','workRate','flair',
  'pace','acceleration','stamina','strength','balance','agility','physical'
]);

const GROUP_PROFILE = Object.freeze({
  GK: { goalkeeping: 10, reflexes: 11, handling: 10, oneOnOne: 9, commandArea: 9, kicking: 2, throwing: 2, sweeping: 2, positioning: 7, decisions: 5, anticipation: 4, composure: 4, aerial: 6, jumping: 5, passing: -4, pace: -12, acceleration: -10, stamina: -6 },
  DEF: { defending: 9, positioning: 9, interceptions: 9, tackling: 9, aggression: 4, bravery: 5, aerial: 5, jumping: 5, strength: 5, pace: 0, stamina: 2, passing: -1, finishing: -13, dribbling: -5, offBall: -4 },
  MID: { passing: 7, vision: 7, technique: 6, firstTouch: 7, decisions: 6, anticipation: 5, composure: 5, teamwork: 5, stamina: 4, dribbling: 3, defending: 0, positioning: 2, finishing: -3, crossing: 1 },
  FWD: { finishing: 9, offBall: 9, composure: 7, acceleration: 6, pace: 6, dribbling: 5, technique: 5, firstTouch: 5, anticipation: 5, longShots: 3, strength: 1, defending: -14, tackling: -15, positioning: -5 }
});

function groupOf(player = {}) {
  const raw = String(player.group || player.positionGroup || player.position || player.primaryPosition || '').toUpperCase();
  if (raw.includes('GOAL') || raw === 'GK') return 'GK';
  if (raw.includes('DEF') || /(^|,|\s)(CB|LB|RB|LWB|RWB)(,|\s|$)/.test(raw)) return 'DEF';
  if (raw.includes('FWD') || raw.includes('OFFENCE') || /(^|,|\s)(ST|CF|SS)(,|\s|$)/.test(raw)) return 'FWD';
  return 'MID';
}

function stableVariation(player, key) {
  const hash = hashSeed(`${player.id || player.name || 'player'}:${key}`);
  return (hash % 11) - 5;
}

function explicit(player, key) {
  const value = Number(player?.attributes?.[key]);
  return Number.isFinite(value) ? value : null;
}

function derivedBase(player) {
  const value = Number(player.overall ?? player.rating);
  return Number.isFinite(value) ? value : 70;
}

function deriveAttribute(player, key, group) {
  const direct = explicit(player, key);
  if (direct != null) return clamp(direct);

  const attrs = player?.attributes || {};
  const alias = {
    acceleration: attrs.pace,
    strength: attrs.physical,
    balance: attrs.physical,
    agility: attrs.physical,
    jumping: attrs.aerial,
    interceptions: attrs.defending,
    vision: attrs.passing,
    anticipation: attrs.decisions,
    composure: attrs.decisions,
    concentration: attrs.decisions,
    offBall: attrs.positioning,
    teamwork: attrs.workRate,
    flair: attrs.technique,
    longShots: attrs.finishing,
    setPieces: attrs.crossing,
    penalties: attrs.finishing,
    reflexes: attrs.goalkeeping,
    handling: attrs.goalkeeping,
    oneOnOne: attrs.goalkeeping,
    commandArea: attrs.aerial ?? attrs.goalkeeping,
    kicking: attrs.passing,
    throwing: attrs.passing,
    sweeping: attrs.positioning ?? attrs.goalkeeping
  }[key];
  if (Number.isFinite(Number(alias))) return clamp(Number(alias) + stableVariation(player, key) * 0.35);

  const base = derivedBase(player);
  const profile = GROUP_PROFILE[group] || GROUP_PROFILE.MID;
  const genericMental = ['decisions','anticipation','composure','concentration','teamwork','workRate'].includes(key) ? 1 : 0;
  const genericPhysical = ['pace','acceleration','stamina','strength','balance','agility','physical'].includes(key) ? 0 : 0;
  const goalkeeperPenalty = group === 'GK' && ['finishing','dribbling','crossing','tackling'].includes(key) ? -20 : 0;
  return clamp(base + (profile[key] || genericMental || genericPhysical) + goalkeeperPenalty + stableVariation(player, key) * 0.75);
}

export function normalizeAttributes(player = {}) {
  const group = groupOf(player);
  return Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, deriveAttribute(player, key, group)]));
}

export function normalizeMatchPlayer(player = {}, state = {}) {
  const group = groupOf(player);
  const attributes = normalizeAttributes(player);
  const overall = clamp(player.overall ?? player.rating ?? 70, 40, 99);
  const positionText = String(player.primaryPosition || player.position || 'CM').split(',')[0].trim().toUpperCase();
  const primaryPosition = ({ CDM: 'DM', CAM: 'AM', CF: 'ST', GK: 'GK' })[positionText] || positionText || (group === 'GK' ? 'GK' : group === 'DEF' ? 'CB' : group === 'FWD' ? 'ST' : 'CM');
  const positions = Array.isArray(player.positions) && player.positions.length
    ? player.positions.map(value => String(value).toUpperCase().replace('CDM','DM').replace('CAM','AM').replace('CF','ST'))
    : String(player.position || primaryPosition).split(',').map(value => value.trim().toUpperCase().replace('CDM','DM').replace('CAM','AM').replace('CF','ST')).filter(Boolean);

  return {
    ...player,
    overall,
    rating: Number(player.rating ?? player.overall ?? overall),
    group,
    positionGroup: group === 'GK' ? 'Goalkeeper' : group === 'DEF' ? 'Defence' : group === 'FWD' ? 'Offence' : 'Midfield',
    primaryPosition,
    positions: positions.length ? positions : [primaryPosition],
    roles: Array.isArray(player.roles) ? [...player.roles] : [],
    attributes,
    condition: clamp(state.condition ?? player.condition ?? 94, 1, 100),
    sharpness: clamp(state.sharpness ?? player.sharpness ?? 82, 1, 100),
    morale: clamp(state.morale ?? player.morale ?? 82, 1, 100)
  };
}

export function contextualSkill(playerState, keys = [], { fatigueWeight = 0.18, familiarity = null } = {}) {
  const attributes = playerState?.player?.attributes || playerState?.attributes || {};
  const values = keys.map(key => Number(attributes[key])).filter(Number.isFinite);
  const base = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number(playerState?.player?.overall ?? playerState?.overall ?? 70);
  const energy = Math.max(0.68, 1 - (100 - Number(playerState?.stamina ?? 90)) / 100 * fatigueWeight);
  const sharpness = 0.92 + Math.min(100, Number(playerState?.player?.sharpness ?? playerState?.sharpness ?? 80)) / 1250;
  const morale = 0.96 + Math.min(100, Number(playerState?.player?.morale ?? playerState?.morale ?? 80)) / 2500;
  const fit = familiarity == null ? Number(playerState?.tacticalFit ?? 1) : Number(familiarity);
  return base * energy * sharpness * morale * Math.max(0.72, Math.min(1.04, fit || 1));
}
