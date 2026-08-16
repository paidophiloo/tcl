import { randomInt, randomUnit } from '../deterministic-rng.js';
import { appendWorldEvent } from '../world-events.js';
import { WORLD_PLAYER_BY_ID } from '../world-player-database.js';
import { ensureSeasonBoardObjective, evaluateSeasonBoardObjective } from '../clubs/board-objectives.js';

const USER_MANAGER_SCHEMA_VERSION = 1;
const RECOVERY_MATCHES = 3;
const MIN_MATCHES_BEFORE_ULTIMATUM = 6;
const MIN_MATCHES_BEFORE_DISMISSAL = 9;
const OFFER_VALID_DAYS = 5;
const REAPPLICATION_COOLDOWN_DAYS = 21;
const DAY_MS = 86_400_000;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => Math.round(Number(value) * 100) / 100;

function addDays(date, days) {
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) ? new Date(value + days * DAY_MS).toISOString().slice(0, 10) : date;
}

function daysBetween(start, end) {
  const left = Date.parse(`${start}T00:00:00Z`);
  const right = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(left) && Number.isFinite(right) ? Math.max(0, Math.floor((right - left) / DAY_MS)) : 0;
}

function startingReputation(career, clubCode) {
  const elo = Number(career?.world?.clubs?.[clubCode]?.elo) || 1700;
  return round(clamp(1.6 + (elo - 1550) / 190, 1.4, 4.8));
}

function ensureManagerCareer(career) {
  const fallbackClub = career?.clubCode || career?.managerCareer?.lastClubCode || null;
  career.managerCareer ||= {
    schemaVersion: USER_MANAGER_SCHEMA_VERSION,
    managerId: `user-manager-${career?.saveId || 'primary'}`,
    status: career?.clubCode ? 'employed' : 'unemployed',
    currentClubCode: career?.clubCode || null,
    lastClubCode: null,
    reputation: startingReputation(career, fallbackClub),
    appointedAt: career?.createdAt?.slice(0, 10) || career?.currentDate || null,
    dismissedAt: null,
    ultimatum: null,
    lastUltimatumClosedReviewIndex: 0,
    applications: {},
    history: []
  };
  const state = career.managerCareer;
  state.schemaVersion = USER_MANAGER_SCHEMA_VERSION;
  state.managerId ||= `user-manager-${career?.saveId || 'primary'}`;
  state.status ||= career?.clubCode ? 'employed' : 'unemployed';
  if (state.status === 'employed') state.currentClubCode = career?.clubCode || state.currentClubCode || null;
  state.reputation = round(clamp(Number(state.reputation) || startingReputation(career, fallbackClub), 1, 5));
  state.applications ||= {};
  state.history ||= [];
  state.lastUltimatumClosedReviewIndex = Number(state.lastUltimatumClosedReviewIndex) || 0;
  return state;
}

function boardState(career, clubCode = career?.clubCode) {
  return clubCode ? career?.world?.boardState?.clubs?.[clubCode] || null : null;
}

function userMatchCount(career, clubCode) {
  return Object.values(career?.results || {}).filter(result => result?.home === clubCode || result?.away === clubCode).length;
}

function caretakerBrain(club, managerName = 'Caretaker') {
  const style = club?.brain?.tacticalIdentity?.style || 'balanced';
  return {
    schemaVersion: 1,
    managerName,
    tacticalStyle: style,
    formation: club?.brain?.tacticalIdentity?.inPossessionFormation || '4-2-3-1',
    riskTolerance: .5,
    rotation: .58,
    youthTrust: Number(club?.brain?.recruitment?.youthBias) || .6,
    tacticalRigidity: .52,
    squadLoyalty: .58,
    negotiationPatience: .55
  };
}

function addInbox(career, message) {
  career.inbox ||= [];
  if (!career.inbox.some(item => item.id === message.id)) career.inbox.unshift(message);
}

function emitUltimatum(career, date, state, board) {
  const reviews = board.history?.length || 0;
  const objective = evaluateSeasonBoardObjective(career, date);
  state.ultimatum = {
    id: `ultimatum-${career.clubCode}-${board.lastReviewedMatchId}`,
    status: 'active',
    clubCode: career.clubCode,
    issuedOn: date,
    issuedAfterMatchId: board.lastReviewedMatchId,
    issuedReviewIndex: reviews,
    recoveryMatches: RECOVERY_MATCHES,
    startConfidence: board.confidence,
    objectiveStatusAtIssue: objective?.status || null,
    objectivePositionAtIssue: objective?.position || null
  };
  appendWorldEvent(career.world, {
    date,
    type: 'USER_MANAGER_ULTIMATUM',
    entities: { clubCode: career.clubCode },
    payload: {
      managerName: career.managerName || 'Treinador',
      confidence: board.confidence,
      band: board.band,
      recoveryMatches: RECOVERY_MATCHES,
      objectiveType: objective?.objective?.type || null,
      objectiveStatus: objective?.status || null,
      position: objective?.position || null
    }
  });
  addInbox(career, {
    id: state.ultimatum.id,
    date,
    sender: 'Diretoria',
    subject: 'Ultimato: reação necessária nos próximos jogos',
    body: `${career.managerName || 'Treinador'}, a confiança chegou a ${Math.round(board.confidence)}/100. A diretoria concederá os próximos ${RECOVERY_MATCHES} jogos para uma reação clara. A avaliação combinará desempenho recente e o objetivo esportivo da temporada.`,
    read: false
  });
  return state.ultimatum;
}

function closeUltimatum(career, date, state, board, outcome) {
  if (!state.ultimatum) return null;
  const current = state.ultimatum;
  current.status = outcome;
  current.closedOn = date;
  current.endConfidence = board?.confidence ?? null;
  current.reviewsCompleted = Math.max(0, (board?.history?.length || 0) - Number(current.issuedReviewIndex || 0));
  state.history.push({
    type: 'ultimatum',
    clubCode: current.clubCode,
    issuedOn: current.issuedOn,
    closedOn: date,
    outcome,
    startConfidence: current.startConfidence,
    endConfidence: current.endConfidence
  });
  state.lastUltimatumClosedReviewIndex = board?.history?.length || state.lastUltimatumClosedReviewIndex;
  state.ultimatum = null;
  return current;
}

function vacancyManagerCleanup(world, club, date) {
  const linked = club?.managerId ? world?.managerMarket?.managers?.[club.managerId] : null;
  if (linked) {
    linked.status = 'unemployed';
    linked.currentClubCode = null;
    linked.dismissedAt ||= date;
  }
  if (!club) return;
  club.managerId = null;
  club.managerStatus = 'vacant';
  club.managerVacancySince = date;
  club.managerBrain = caretakerBrain(club, `Caretaker ${club.name || club.code}`);
  if (club.recruitment) {
    club.recruitment.requirements = [];
    club.recruitment.needs = [];
    club.recruitment.lastEvaluatedDate = null;
  }
}

function dismissUserManager(career, date, state, board, objective) {
  const clubCode = career.clubCode;
  const club = career.world?.clubs?.[clubCode];
  if (!clubCode || !club) return false;
  const managerId = state.managerId;
  const confidence = Number(board?.confidence) || 0;
  const latestBoardRow = board?.history?.at(-1) || {};
  vacancyManagerCleanup(career.world, club, date);
  appendWorldEvent(career.world, {
    date,
    type: 'MANAGER_SACKED',
    entities: { managerId, clubCode },
    payload: {
      managerName: career.managerName || 'Treinador',
      userManager: true,
      jobSecurity: round(confidence / 100),
      confidence,
      ppg: latestBoardRow.ppg ?? null,
      expectedPpg: latestBoardRow.expectedPpg ?? null,
      underperformance: latestBoardRow.performanceGap != null ? round(Math.max(0, -Number(latestBoardRow.performanceGap))) : null,
      objectiveType: objective?.objective?.type || null,
      objectiveStatus: objective?.status || null,
      position: objective?.position || null
    }
  });
  state.status = 'unemployed';
  state.currentClubCode = null;
  state.lastClubCode = clubCode;
  state.dismissedAt = date;
  state.reputation = round(clamp(state.reputation - .22, 1, 5));
  state.history.push({ type: 'dismissed', clubCode, date, confidence, objectiveStatus: objective?.status || null, position: objective?.position || null });
  state.ultimatum = null;
  career.formerClubCode = clubCode;
  career.clubCode = null;
  career.status = 'unemployed';
  career.boardConfidence = null;
  career.boardObjective = null;
  career.transferBudget = 0;
  career.wageBudget = 0;
  career.lineup = [];
  career.world.userClubCode = null;
  addInbox(career, {
    id: `manager-dismissed-${clubCode}-${date}`,
    date,
    sender: 'Diretoria',
    subject: 'Decisão sobre o cargo de treinador',
    body: `${career.managerName || 'Treinador'}, a diretoria decidiu encerrar seu trabalho no ${club.name || clubCode}. A carreira continua: você está livre para analisar vagas e assumir outro projeto.`,
    read: false
  });
  return true;
}

function maybeReviewUltimatum(career, date, state) {
  const clubCode = career.clubCode;
  const board = boardState(career, clubCode);
  if (!board) return { issued: false, resolved: false, dismissed: false };
  const reviewCount = board.history?.length || 0;
  if (!state.ultimatum) {
    const cooldownSatisfied = reviewCount >= state.lastUltimatumClosedReviewIndex + RECOVERY_MATCHES;
    if (board.band === 'critical' && reviewCount >= MIN_MATCHES_BEFORE_ULTIMATUM && cooldownSatisfied) {
      emitUltimatum(career, date, state, board);
      return { issued: true, resolved: false, dismissed: false };
    }
    return { issued: false, resolved: false, dismissed: false };
  }

  const ultimatum = state.ultimatum;
  if (ultimatum.clubCode !== clubCode) {
    closeUltimatum(career, date, state, board, 'superseded');
    return { issued: false, resolved: true, dismissed: false };
  }
  const reviewsCompleted = Math.max(0, reviewCount - Number(ultimatum.issuedReviewIndex || 0));
  if (board.confidence >= 34 || ['scrutiny', 'stable', 'secure'].includes(board.band)) {
    closeUltimatum(career, date, state, board, 'recovered');
    appendWorldEvent(career.world, {
      date,
      type: 'USER_MANAGER_ULTIMATUM_SURVIVED',
      entities: { clubCode },
      payload: { managerName: career.managerName || 'Treinador', confidence: board.confidence, reviewsCompleted }
    });
    addInbox(career, {
      id: `ultimatum-recovered-${clubCode}-${board.lastReviewedMatchId}`,
      date,
      sender: 'Diretoria',
      subject: 'Diretoria reconhece a reação',
      body: `A evolução dos últimos jogos elevou a confiança para ${Math.round(board.confidence)}/100. O ultimato foi encerrado e o trabalho volta a ser avaliado pelo ciclo normal da temporada.`,
      read: false
    });
    return { issued: false, resolved: true, dismissed: false };
  }
  if (reviewsCompleted < RECOVERY_MATCHES) return { issued: false, resolved: false, dismissed: false };

  const objective = evaluateSeasonBoardObjective(career, date);
  const totalMatches = userMatchCount(career, clubCode);
  const latestBoardRow = board.history?.at(-1) || {};
  const objectiveCompromised = Number(objective?.maturity) >= .25 && ['at-risk', 'failing'].includes(objective?.status);
  const catastrophicRecentForm = Number(latestBoardRow.performanceGap) <= -.75;
  const dismissalEligible = totalMatches >= MIN_MATCHES_BEFORE_DISMISSAL
    && board.band === 'critical'
    && Number(board.confidence) < 25
    && (objectiveCompromised || catastrophicRecentForm);
  if (dismissalEligible) {
    closeUltimatum(career, date, state, board, 'failed');
    return { issued: false, resolved: true, dismissed: dismissUserManager(career, date, state, board, objective) };
  }

  closeUltimatum(career, date, state, board, 'survived');
  appendWorldEvent(career.world, {
    date,
    type: 'USER_MANAGER_ULTIMATUM_SURVIVED',
    entities: { clubCode },
    payload: { managerName: career.managerName || 'Treinador', confidence: board.confidence, reviewsCompleted, reason: 'dismissal-threshold-not-met' }
  });
  return { issued: false, resolved: true, dismissed: false };
}

function requiredReputation(club) {
  const elo = Number(club?.elo) || 1700;
  return clamp(1.4 + (elo - 1500) / 180, 1.3, 4.8);
}

function jobFit(career, clubCode, state) {
  const club = career.world?.clubs?.[clubCode];
  if (!club) return 0;
  const required = requiredReputation(club);
  const reputationFit = clamp(1 - Math.max(0, required - state.reputation) * .22, .15, 1);
  const lastClub = career.world?.clubs?.[state.lastClubCode];
  const stepUp = lastClub ? clamp(1 - Math.max(0, Number(club.elo) - Number(lastClub.elo)) / 520, .45, 1) : .72;
  const style = club.brain?.tacticalIdentity?.style || 'balanced';
  const managerStyle = state.preferredStyle || style;
  const styleFit = style === managerStyle ? 1 : .72;
  return round(reputationFit * .55 + stepUp * .30 + styleFit * .15);
}

function vacancyRows(career, date, state) {
  return Object.values(career.world?.clubs || {})
    .filter(club => club?.code && club.managerStatus === 'vacant')
    .filter(club => !(club.code === state.lastClubCode && daysBetween(state.dismissedAt || date, date) < 120))
    .map(club => ({
      clubCode: club.code,
      clubName: club.name || club.code,
      elo: Number(club.elo) || 1700,
      vacantSince: club.managerVacancySince || date,
      vacancyDays: daysBetween(club.managerVacancySince || date, date),
      requiredReputation: round(requiredReputation(club)),
      fitScore: jobFit(career, club.code, state),
      applied: Boolean(state.applications?.[club.code] && ['pending', 'offered'].includes(state.applications[club.code].status))
    }))
    .sort((left, right) => right.fitScore - left.fitScore || right.elo - left.elo || left.clubCode.localeCompare(right.clubCode));
}

function processApplications(career, date, state) {
  let offers = 0;
  let rejected = 0;
  let closed = 0;
  for (const application of Object.values(state.applications || {})) {
    if (application.status === 'offered' && application.offerExpiresOn < date) {
      application.status = 'expired';
      application.closedOn = date;
      closed += 1;
      continue;
    }
    if (application.status !== 'pending' || application.decisionDate > date) continue;
    const club = career.world?.clubs?.[application.clubCode];
    if (!club || club.managerStatus !== 'vacant') {
      application.status = 'closed';
      application.closedOn = date;
      application.reason = 'vacancy-filled';
      closed += 1;
      continue;
    }
    const fit = jobFit(career, application.clubCode, state);
    const roll = randomUnit(career.world.seed, state.managerId, application.clubCode, application.createdOn, 'user-job-decision');
    const accepted = fit + roll * .22 >= .72;
    application.fitScoreAtDecision = fit;
    if (accepted) {
      application.status = 'offered';
      application.offerCreatedOn = date;
      application.offerExpiresOn = addDays(date, OFFER_VALID_DAYS);
      offers += 1;
      appendWorldEvent(career.world, {
        date,
        type: 'USER_MANAGER_JOB_OFFER',
        entities: { clubCode: application.clubCode },
        payload: { managerName: career.managerName || 'Treinador', fitScore: fit, expiresOn: application.offerExpiresOn },
        visibility: 'system'
      });
      addInbox(career, {
        id: `manager-job-offer-${application.clubCode}-${date}`,
        date,
        sender: club.name || application.clubCode,
        subject: 'Proposta para assumir o comando técnico',
        body: `O clube aprovou sua candidatura e formalizou uma proposta. A oferta permanece disponível até ${application.offerExpiresOn}.`,
        read: false
      });
    } else {
      application.status = 'rejected';
      application.closedOn = date;
      application.cooldownUntil = addDays(date, REAPPLICATION_COOLDOWN_DAYS);
      rejected += 1;
      addInbox(career, {
        id: `manager-job-rejected-${application.clubCode}-${date}`,
        date,
        sender: club.name || application.clubCode,
        subject: 'Atualização sobre sua candidatura',
        body: 'O clube decidiu seguir com outros candidatos neste processo. Sua carreira permanece ativa e novas vagas podem surgir com o avanço dos dias.',
        read: false
      });
    }
  }
  return { offers, rejected, closed };
}

export function applyForManagerJob(career, clubCode, date = career?.currentDate) {
  const state = ensureManagerCareer(career);
  if (state.status !== 'unemployed' || career?.clubCode) return null;
  const club = career.world?.clubs?.[clubCode];
  if (!club || club.managerStatus !== 'vacant') return null;
  const previous = state.applications?.[clubCode];
  if (previous && ['pending', 'offered'].includes(previous.status)) return previous;
  if (previous?.cooldownUntil && previous.cooldownUntil > date) return null;
  const fit = jobFit(career, clubCode, state);
  if (fit < .42) return null;
  const decisionDays = 2 + randomInt(0, 3, career.world.seed, state.managerId, clubCode, date, 'job-response-days');
  const application = {
    id: `manager-application-${clubCode}-${date}`,
    clubCode,
    createdOn: date,
    decisionDate: addDays(date, decisionDays),
    status: 'pending',
    fitScoreAtApplication: fit
  };
  state.applications[clubCode] = application;
  appendWorldEvent(career.world, {
    date,
    type: 'USER_MANAGER_JOB_APPLICATION',
    entities: { clubCode },
    payload: { managerName: career.managerName || 'Treinador', fitScore: fit, decisionDate: application.decisionDate },
    visibility: 'system'
  });
  addInbox(career, {
    id: application.id,
    date,
    sender: 'Representante',
    subject: `Candidatura enviada para ${club.name || clubCode}`,
    body: `Seu interesse foi formalizado. O clube deve concluir a análise por volta de ${application.decisionDate}.`,
    read: false
  });
  return application;
}

function lineupForClub(career, clubCode) {
  const players = Object.entries(career.world?.employment || {})
    .filter(([, code]) => code === clubCode)
    .map(([playerId]) => WORLD_PLAYER_BY_ID.get(playerId))
    .filter(Boolean)
    .sort((left, right) => Number(right.rating) - Number(left.rating) || left.name.localeCompare(right.name));
  const selected = [];
  const take = (group, count) => {
    for (const player of players.filter(row => row.group === group)) {
      if (selected.length >= 11 || selected.filter(id => WORLD_PLAYER_BY_ID.get(id)?.group === group).length >= count) break;
      selected.push(player.id);
    }
  };
  take('GK', 1); take('DEF', 4); take('MID', 5); take('FWD', 1);
  for (const player of players) {
    if (selected.length >= 11) break;
    if (!selected.includes(player.id)) selected.push(player.id);
  }
  return selected.slice(0, 11);
}

function initializeUserPlayerState(career, clubCode) {
  career.playerState ||= {};
  const squadIds = Object.entries(career.world?.employment || {}).filter(([, code]) => code === clubCode).map(([playerId]) => playerId);
  for (const playerId of squadIds) {
    career.playerState[playerId] ||= { condition: 92, sharpness: 74, morale: 72 };
  }
}

export function acceptManagerJob(career, clubCode, date = career?.currentDate) {
  const state = ensureManagerCareer(career);
  if (state.status !== 'unemployed' || career?.clubCode) return null;
  const application = state.applications?.[clubCode];
  const club = career.world?.clubs?.[clubCode];
  if (!application || application.status !== 'offered' || application.offerExpiresOn < date || !club || club.managerStatus !== 'vacant') return null;
  const previousClubCode = state.lastClubCode;
  state.status = 'employed';
  state.currentClubCode = clubCode;
  state.lastClubCode = previousClubCode;
  state.appointedAt = date;
  state.dismissedAt = null;
  state.ultimatum = null;
  state.reputation = round(clamp(state.reputation + .08, 1, 5));
  application.status = 'accepted';
  application.closedOn = date;
  for (const other of Object.values(state.applications || {})) {
    if (other !== application && ['pending', 'offered'].includes(other.status)) {
      other.status = 'withdrawn';
      other.closedOn = date;
    }
  }
  club.managerId = null;
  club.managerStatus = 'user-controlled';
  club.managerVacancySince = null;
  club.managerBrain = {
    ...caretakerBrain(club, career.managerName || 'Treinador'),
    managerName: career.managerName || 'Treinador',
    formation: career.formation || '4-2-3-1'
  };
  career.clubCode = clubCode;
  career.formerClubCode = previousClubCode || career.formerClubCode || null;
  career.status = 'active';
  career.world.userClubCode = clubCode;
  career.transferBudget = Number(club.transferBudget) || 0;
  career.wageBudget = Number(club.wageBudget) || 0;
  career.boardConfidence = 65;
  initializeUserPlayerState(career, clubCode);
  career.lineup = lineupForClub(career, clubCode);
  const objective = ensureSeasonBoardObjective(career, date);
  career.objectives = [objective?.label || 'Cumprir o objetivo esportivo da diretoria', 'Desenvolver o elenco', 'Manter as finanças sob controle'];
  state.history.push({ type: 'appointed', clubCode, date, fitScore: application.fitScoreAtDecision ?? application.fitScoreAtApplication });
  appendWorldEvent(career.world, {
    date,
    type: 'MANAGER_HIRED',
    entities: { managerId: state.managerId, clubCode, fromClubCode: null },
    payload: { managerName: career.managerName || 'Treinador', userManager: true, tacticalStyle: club.managerBrain.tacticalStyle, fitScore: application.fitScoreAtDecision ?? application.fitScoreAtApplication }
  });
  addInbox(career, {
    id: `manager-appointed-${clubCode}-${date}`,
    date,
    sender: 'Diretoria',
    subject: `Bem-vindo ao ${club.name || clubCode}`,
    body: `Sua nomeação foi concluída. Você assume imediatamente o comando esportivo, com orçamento, elenco e calendário já no estado atual da temporada.`,
    read: false
  });
  return { clubCode, clubName: club.name || clubCode, objective, lineup: [...career.lineup] };
}

export function declineManagerJob(career, clubCode, date = career?.currentDate) {
  const state = ensureManagerCareer(career);
  const application = state.applications?.[clubCode];
  if (!application || application.status !== 'offered') return false;
  application.status = 'declined';
  application.closedOn = date;
  return true;
}

export function managerJobMarketSnapshot(career, date = career?.currentDate) {
  const state = ensureManagerCareer(career);
  return {
    schemaVersion: USER_MANAGER_SCHEMA_VERSION,
    status: state.status,
    reputation: state.reputation,
    currentClubCode: state.currentClubCode,
    lastClubCode: state.lastClubCode,
    dismissedAt: state.dismissedAt,
    ultimatum: state.ultimatum ? { ...state.ultimatum } : null,
    vacancies: state.status === 'unemployed' ? vacancyRows(career, date, state) : [],
    applications: Object.values(state.applications || {}).map(application => ({ ...application }))
  };
}

export function processUserManagerCareerDay({ career, date }) {
  const state = ensureManagerCareer(career);
  if (state.status === 'employed' && career.clubCode) {
    const review = maybeReviewUltimatum(career, date, state);
    return { status: state.status, ...review, reputation: state.reputation, vacancies: 0, applications: { offers: 0, rejected: 0, closed: 0 } };
  }
  const applications = processApplications(career, date, state);
  return {
    status: state.status,
    issued: false,
    resolved: false,
    dismissed: false,
    reputation: state.reputation,
    vacancies: vacancyRows(career, date, state).length,
    applications
  };
}

export const USER_MANAGER_CAREER_META = Object.freeze({
  schemaVersion: USER_MANAGER_SCHEMA_VERSION,
  recoveryMatches: RECOVERY_MATCHES,
  minimumMatchesBeforeUltimatum: MIN_MATCHES_BEFORE_ULTIMATUM,
  minimumMatchesBeforeDismissal: MIN_MATCHES_BEFORE_DISMISSAL,
  offerValidDays: OFFER_VALID_DAYS,
  invariant: 'the user can only be dismissed after a persisted critical-confidence ultimatum, a real three-match recovery window and a still-severe audited sporting failure; dismissal keeps the save alive as an unemployed manager'
});
