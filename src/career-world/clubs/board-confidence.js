import { appendWorldEvent } from '../world-events.js';

const BOARD_SCHEMA_VERSION = 1;
const WINDOW_MATCHES = 8;
const MIN_REVIEW_MATCHES = 4;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => Math.round(Number(value) * 100) / 100;

function ensureBoardMarket(world) {
  world.boardState ||= {};
  world.boardState.schemaVersion = BOARD_SCHEMA_VERSION;
  world.boardState.clubs ||= {};
  return world.boardState;
}

function bandFor(confidence) {
  if (confidence >= 72) return 'secure';
  if (confidence >= 55) return 'stable';
  if (confidence >= 40) return 'scrutiny';
  if (confidence >= 25) return 'pressure';
  return 'critical';
}

function ensureClubBoardState(career) {
  const world = career.world;
  const board = ensureBoardMarket(world);
  const clubCode = career.clubCode;
  board.clubs[clubCode] ||= {
    clubCode,
    confidence: 65,
    band: 'stable',
    lastReviewedDate: null,
    lastReviewedMatchId: null,
    history: [],
    warningKeys: {}
  };
  const state = board.clubs[clubCode];
  state.confidence = clamp(Number(state.confidence) || 65, 0, 100);
  state.band = bandFor(state.confidence);
  state.history ||= [];
  state.warningKeys ||= {};
  return state;
}

function userResults(career, date, limit = WINDOW_MATCHES) {
  const clubCode = career.clubCode;
  return Object.values(career.results || {})
    .filter(result => result?.fixtureId && result?.date && result.date <= date)
    .filter(result => result.home === clubCode || result.away === clubCode)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.fixtureId).localeCompare(String(right.fixtureId)))
    .slice(-limit);
}

function pointsFor(result, clubCode) {
  const home = result.home === clubCode;
  const own = Number(home ? result.homeGoals : result.awayGoals);
  const opponent = Number(home ? result.awayGoals : result.homeGoals);
  if (!Number.isFinite(own) || !Number.isFinite(opponent)) return 0;
  return own > opponent ? 3 : own === opponent ? 1 : 0;
}

function expectedPointsFor(career, result, clubCode) {
  const world = career.world;
  const opponentCode = result.home === clubCode ? result.away : result.home;
  const ownElo = Number(world.clubs?.[clubCode]?.elo) || 1700;
  const opponentElo = Number(world.clubs?.[opponentCode]?.elo) || 1700;
  const venueAdjustment = result.home === clubCode ? 55 : -20;
  const winProbability = 1 / (1 + Math.pow(10, -((ownElo + venueAdjustment - opponentElo) / 400)));
  return clamp(.55 + winProbability * 2.05, .55, 2.55);
}

export function evaluateUserBoardConfidence(career, date) {
  if (!career?.clubCode || !career?.world) return null;
  const results = userResults(career, date);
  if (!results.length) return {
    matches: 0,
    ppg: null,
    expectedPpg: null,
    performanceGap: 0,
    targetConfidence: 65,
    latestMatchId: null,
    latestMatchDate: null
  };
  const actualPoints = results.reduce((sum, result) => sum + pointsFor(result, career.clubCode), 0);
  const expectedPoints = results.reduce((sum, result) => sum + expectedPointsFor(career, result, career.clubCode), 0);
  const ppg = actualPoints / results.length;
  const expectedPpg = expectedPoints / results.length;
  const performanceGap = ppg - expectedPpg;
  const targetConfidence = clamp(58 + performanceGap * 28, 5, 95);
  const latest = results.at(-1);
  return {
    matches: results.length,
    ppg: round(ppg),
    expectedPpg: round(expectedPpg),
    performanceGap: round(performanceGap),
    targetConfidence: round(targetConfidence),
    latestMatchId: latest.fixtureId,
    latestMatchDate: latest.date
  };
}

function warningMessage(career, metrics, band) {
  const manager = career.managerName || 'Treinador';
  if (band === 'critical') {
    return {
      subject: 'Diretoria exige reação imediata',
      body: `${manager}, a confiança da diretoria entrou em nível crítico. Nos últimos ${metrics.matches} jogos, o time registra ${metrics.ppg.toFixed(2)} ponto(s) por partida contra ${metrics.expectedPpg.toFixed(2)} esperado(s). Uma reação esportiva é necessária.`
    };
  }
  return {
    subject: 'Pressão crescente sobre os resultados',
    body: `${manager}, a diretoria está preocupada com a sequência recente. Nos últimos ${metrics.matches} jogos, o time registra ${metrics.ppg.toFixed(2)} ponto(s) por partida contra ${metrics.expectedPpg.toFixed(2)} esperado(s).`
  };
}

function maybeEmitPressure({ career, date, state, previousBand, metrics }) {
  if (!['pressure', 'critical'].includes(state.band)) return false;
  if (state.band === previousBand && state.warningKeys[state.band]) return false;
  const key = `${state.band}:${metrics.latestMatchId}`;
  if (state.warningKeys[key]) return false;
  state.warningKeys[key] = date;
  state.warningKeys[state.band] = date;
  appendWorldEvent(career.world, {
    date,
    type: 'MANAGER_JOB_PRESSURE',
    entities: { clubCode: career.clubCode },
    payload: {
      managerName: career.managerName || 'Treinador',
      confidence: state.confidence,
      band: state.band,
      previousBand,
      ppg: metrics.ppg,
      expectedPpg: metrics.expectedPpg,
      performanceGap: metrics.performanceGap,
      sampleMatches: metrics.matches,
      latestMatchId: metrics.latestMatchId
    }
  });
  const message = warningMessage(career, metrics, state.band);
  career.inbox ||= [];
  career.inbox.unshift({
    id: `board-pressure-${state.band}-${metrics.latestMatchId}`,
    date,
    sender: 'Diretoria',
    subject: message.subject,
    body: message.body,
    read: false
  });
  return true;
}

export function processUserBoardDay({ career, date }) {
  if (!career?.clubCode || !career?.world) return { reviewed: false, confidence: null, band: null, pressureEvent: false };
  const state = ensureClubBoardState(career);
  const metrics = evaluateUserBoardConfidence(career, date);
  if (!metrics?.latestMatchId || metrics.latestMatchId === state.lastReviewedMatchId) {
    career.boardConfidence = state.confidence;
    return { reviewed: false, confidence: state.confidence, band: state.band, pressureEvent: false, metrics };
  }

  state.lastReviewedMatchId = metrics.latestMatchId;
  state.lastReviewedDate = date;
  if (metrics.matches < MIN_REVIEW_MATCHES) {
    state.history.push({ date, matchId: metrics.latestMatchId, confidence: state.confidence, band: state.band, provisional: true });
    career.boardConfidence = state.confidence;
    return { reviewed: true, provisional: true, confidence: state.confidence, band: state.band, pressureEvent: false, metrics };
  }

  const previousConfidence = state.confidence;
  const previousBand = state.band;
  state.confidence = round(clamp(previousConfidence * .55 + metrics.targetConfidence * .45, 0, 100));
  state.band = bandFor(state.confidence);
  state.history.push({
    date,
    matchId: metrics.latestMatchId,
    confidence: state.confidence,
    previousConfidence,
    band: state.band,
    previousBand,
    ppg: metrics.ppg,
    expectedPpg: metrics.expectedPpg,
    performanceGap: metrics.performanceGap
  });
  if (state.history.length > 120) state.history.splice(0, state.history.length - 120);

  appendWorldEvent(career.world, {
    date,
    type: 'BOARD_CONFIDENCE_CHANGED',
    entities: { clubCode: career.clubCode },
    payload: {
      managerName: career.managerName || 'Treinador',
      confidence: state.confidence,
      previousConfidence,
      band: state.band,
      previousBand,
      ppg: metrics.ppg,
      expectedPpg: metrics.expectedPpg,
      performanceGap: metrics.performanceGap,
      sampleMatches: metrics.matches,
      latestMatchId: metrics.latestMatchId
    },
    visibility: 'system'
  });

  const pressureEvent = maybeEmitPressure({ career, date, state, previousBand, metrics });
  career.boardConfidence = state.confidence;
  return { reviewed: true, provisional: false, confidence: state.confidence, band: state.band, pressureEvent, metrics };
}

export function userBoardSnapshot(career) {
  if (!career?.clubCode || !career?.world) return null;
  const state = ensureClubBoardState(career);
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    clubCode: career.clubCode,
    confidence: state.confidence,
    band: state.band,
    lastReviewedDate: state.lastReviewedDate,
    lastReviewedMatchId: state.lastReviewedMatchId,
    history: [...state.history]
  };
}

export const BOARD_CONFIDENCE_META = Object.freeze({
  windowMatches: WINDOW_MATCHES,
  minimumMatches: MIN_REVIEW_MATCHES,
  invariant: 'user manager pressure is derived from persisted match results versus Elo-based expected points; this engine does not fire the user manager'
});
