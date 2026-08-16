import { appendWorldEvent } from '../world-events.js';

const OBJECTIVE_SCHEMA_VERSION = 1;
const SEASON_MATCHES = 38;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => Math.round(Number(value) * 100) / 100;

export const BOARD_OBJECTIVE_TYPES = Object.freeze({
  TITLE_CHALLENGE: 'title-challenge',
  TOP_FOUR: 'top-four',
  TOP_SIX: 'top-six',
  TOP_HALF: 'top-half',
  SURVIVAL: 'survival'
});

function seasonKey(career) {
  return String(career?.seasonId || career?.seasonLabel || '2026/27');
}

function boardRoot(career) {
  career.world.boardState ||= {};
  career.world.boardState.objectives ||= {};
  return career.world.boardState;
}

function sameLeaguePeers(career) {
  const clubs = career?.world?.clubs || {};
  const user = clubs[career.clubCode];
  if (!user) return [];
  const league = user.league || null;
  const division = Number(user.division) || 1;
  const peers = Object.values(clubs).filter(club => {
    if (!club?.code) return false;
    if (league && club.league !== league) return false;
    return (Number(club.division) || 1) === division;
  });
  return peers.length >= 10 ? peers : Object.values(clubs).filter(club => club?.code && (Number(club.division) || 1) === division).slice(0, 20);
}

function rankMap(rows, value) {
  return new Map([...rows]
    .sort((left, right) => value(right) - value(left) || String(left.code).localeCompare(String(right.code)))
    .map((row, index) => [row.code, index + 1]));
}

function objectiveForRank(weightedRank, peerCount) {
  const scale = peerCount > 0 ? 20 / peerCount : 1;
  const rank = weightedRank * scale;
  if (rank <= 3) return {
    type: BOARD_OBJECTIVE_TYPES.TITLE_CHALLENGE,
    label: 'Disputar o título',
    targetPositionMax: 3,
    minimumAcceptablePosition: 4
  };
  if (rank <= 5) return {
    type: BOARD_OBJECTIVE_TYPES.TOP_FOUR,
    label: 'Terminar no top 4',
    targetPositionMax: 4,
    minimumAcceptablePosition: 6
  };
  if (rank <= 8) return {
    type: BOARD_OBJECTIVE_TYPES.TOP_SIX,
    label: 'Terminar no top 6',
    targetPositionMax: 6,
    minimumAcceptablePosition: 8
  };
  if (rank <= 12) return {
    type: BOARD_OBJECTIVE_TYPES.TOP_HALF,
    label: 'Terminar na metade de cima',
    targetPositionMax: 10,
    minimumAcceptablePosition: 13
  };
  return {
    type: BOARD_OBJECTIVE_TYPES.SURVIVAL,
    label: 'Evitar o rebaixamento',
    targetPositionMax: 17,
    minimumAcceptablePosition: 17
  };
}

function createObjective(career, date) {
  const peers = sameLeaguePeers(career);
  const user = career.world.clubs?.[career.clubCode] || {};
  const eloRanks = rankMap(peers, club => Number(club.elo) || 1700);
  const budgetRanks = rankMap(peers, club => Number(club.startingTransferBudget ?? club.transferBudget) || 0);
  const eloRank = eloRanks.get(career.clubCode) || Math.ceil(peers.length / 2) || 10;
  const budgetRank = budgetRanks.get(career.clubCode) || eloRank;
  const weightedRank = round(eloRank * .78 + budgetRank * .22);
  const target = objectiveForRank(weightedRank, peers.length || 20);
  return {
    schemaVersion: OBJECTIVE_SCHEMA_VERSION,
    seasonKey: seasonKey(career),
    clubCode: career.clubCode,
    createdOn: date,
    league: user.league || 'League',
    peerCount: peers.length || 20,
    eloAtStart: Number(user.elo) || 1700,
    startingTransferBudget: Number(user.startingTransferBudget ?? user.transferBudget) || 0,
    eloRank,
    budgetRank,
    weightedStrengthRank: weightedRank,
    expectedPosition: Math.max(1, Math.min(peers.length || 20, Math.round(weightedRank))),
    ...target
  };
}

function objectiveMessage(career, objective) {
  const manager = career.managerName || 'Treinador';
  return {
    id: `board-objective-${objective.seasonKey}-${career.clubCode}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    date: objective.createdOn,
    sender: 'Diretoria',
    subject: `Objetivo da temporada: ${objective.label}`,
    body: `${manager}, a diretoria definiu o objetivo esportivo para ${objective.seasonKey}: ${objective.label}. A expectativa parte da força inicial do clube na liga, considerando Elo e capacidade financeira. A avaliação será progressiva ao longo da temporada.`,
    read: false
  };
}

export function ensureSeasonBoardObjective(career, date = career?.currentDate || career?.world?.currentDate) {
  if (!career?.world || !career?.clubCode) return null;
  const root = boardRoot(career);
  const key = `${seasonKey(career)}:${career.clubCode}`;
  if (root.objectives[key]) {
    career.boardObjective = { ...root.objectives[key] };
    return root.objectives[key];
  }
  const objective = createObjective(career, date);
  root.objectives[key] = objective;
  career.boardObjective = { ...objective };
  appendWorldEvent(career.world, {
    date,
    type: 'BOARD_SEASON_OBJECTIVE_SET',
    entities: { clubCode: career.clubCode },
    payload: {
      objectiveType: objective.type,
      label: objective.label,
      targetPositionMax: objective.targetPositionMax,
      minimumAcceptablePosition: objective.minimumAcceptablePosition,
      expectedPosition: objective.expectedPosition,
      eloRank: objective.eloRank,
      budgetRank: objective.budgetRank,
      weightedStrengthRank: objective.weightedStrengthRank
    },
    visibility: 'system'
  });
  career.inbox ||= [];
  const message = objectiveMessage(career, objective);
  if (!career.inbox.some(item => item.id === message.id)) career.inbox.unshift(message);
  return objective;
}

function tableRows(career, objective) {
  const peers = sameLeaguePeers(career);
  const codes = new Set(peers.map(club => club.code));
  const rows = new Map([...codes].map(code => [code, {
    code, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0
  }]));
  for (const result of Object.values(career.results || {})) {
    if (!result?.home || !result?.away || !codes.has(result.home) || !codes.has(result.away)) continue;
    const homeGoals = Number(result.homeGoals);
    const awayGoals = Number(result.awayGoals);
    if (!Number.isInteger(homeGoals) || homeGoals < 0 || !Number.isInteger(awayGoals) || awayGoals < 0) continue;
    const home = rows.get(result.home);
    const away = rows.get(result.away);
    home.played += 1; away.played += 1;
    home.gf += homeGoals; home.ga += awayGoals;
    away.gf += awayGoals; away.ga += homeGoals;
    if (homeGoals > awayGoals) { home.won += 1; home.points += 3; away.lost += 1; }
    else if (awayGoals > homeGoals) { away.won += 1; away.points += 3; home.lost += 1; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  }
  const sorted = [...rows.values()]
    .map(row => ({ ...row, gd: row.gf - row.ga }))
    .sort((left, right) => right.points - left.points || right.gd - left.gd || right.gf - left.gf || left.code.localeCompare(right.code));
  return sorted.map((row, index) => ({ ...row, position: index + 1, objectiveType: objective?.type || null }));
}

function progressBand(score) {
  if (score >= 72) return 'ahead';
  if (score >= 55) return 'on-track';
  if (score >= 40) return 'at-risk';
  return 'failing';
}

export function evaluateSeasonBoardObjective(career, date = career?.currentDate || career?.world?.currentDate) {
  const objective = ensureSeasonBoardObjective(career, date);
  if (!objective) return null;
  const table = tableRows(career, objective);
  const row = table.find(candidate => candidate.code === career.clubCode);
  if (!row) return { objective, played: 0, position: null, score: 50, status: 'too-early', maturity: 0 };
  const played = row.played;
  if (played < 5) return {
    objective,
    played,
    position: row.position,
    points: row.points,
    goalDifference: row.gd,
    score: 50,
    status: 'too-early',
    maturity: 0
  };
  const expectedGap = row.position - objective.expectedPosition;
  const targetGap = row.position - objective.targetPositionMax;
  const minimumGap = row.position - objective.minimumAcceptablePosition;
  const rawPositionScore = clamp(68 - expectedGap * 4.5 - Math.max(0, targetGap) * 2.5 - Math.max(0, minimumGap) * 5, 5, 95);
  const maturity = clamp((played - 4) / 20, .05, 1);
  const score = round(50 + (rawPositionScore - 50) * maturity);
  return {
    objective,
    played,
    position: row.position,
    points: row.points,
    goalDifference: row.gd,
    score,
    status: progressBand(score),
    maturity: round(maturity),
    targetGap,
    minimumGap,
    expectedGap,
    matchesRemaining: Math.max(0, SEASON_MATCHES - played)
  };
}

export const BOARD_OBJECTIVES_META = Object.freeze({
  schemaVersion: OBJECTIVE_SCHEMA_VERSION,
  seasonMatches: SEASON_MATCHES,
  invariant: 'season objectives are frozen from starting same-league Elo and financial capacity; progress is audited only from persisted league results'
});
