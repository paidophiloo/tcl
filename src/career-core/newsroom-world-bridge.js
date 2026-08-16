import { CAREER_EVENT_TYPES, appendCareerEvent } from './event-ledger.js';
import { NEWSROOM_GOVERNANCE_EVENT_TYPES, GOVERNANCE_WORLD_TYPES } from './newsroom-governance-types.js';
import { CLUB_BY_CODE } from './season-2026-27-live.js';
import { WORLD_PLAYER_BY_ID } from '../career-world/world-player-database.js';

function compact(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function clubName(code) {
  if (!code) return 'clube';
  return CLUB_BY_CODE.get(code)?.name || code;
}

function playerName(id) {
  if (!id) return 'Jogador';
  return WORLD_PLAYER_BY_ID.get(id)?.name || 'Jogador';
}

function transferEntities(event) {
  const entities = event?.entities || {};
  return {
    playerIds: compact([entities.playerId]),
    clubCodes: compact([
      entities.fromClubCode,
      entities.toClubCode,
      entities.sellerCode,
      entities.buyerCode,
      entities.parentClubCode,
      entities.borrowerClubCode,
      entities.clubCode
    ])
  };
}

function governanceEvent(worldEvent, common) {
  const entities = worldEvent.entities || {};
  const payload = worldEvent.payload || {};

  if (worldEvent.type === 'MANAGER_JOB_PRESSURE') {
    const managerName = payload.managerName || 'Treinador';
    const club = clubName(entities.clubCode);
    const critical = payload.band === 'critical';
    return {
      ...common,
      type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_UNDER_PRESSURE,
      entities: { clubCodes: compact([entities.clubCode]) },
      facts: {
        clubCode: entities.clubCode,
        managerName,
        confidence: Number(payload.confidence) || 0,
        band: payload.band || 'pressure',
        previousBand: payload.previousBand || null,
        ppg: payload.ppg == null ? null : Number(payload.ppg),
        expectedPpg: payload.expectedPpg == null ? null : Number(payload.expectedPpg),
        performanceGap: payload.performanceGap == null ? null : Number(payload.performanceGap),
        sampleMatches: Number(payload.sampleMatches) || 0,
        latestMatchId: payload.latestMatchId || null,
        headline: critical
          ? `Pressão sobre ${managerName} chega a nível crítico no ${club}`
          : `${managerName} entra sob pressão no ${club}`,
        summary: `A avaliação da diretoria caiu para ${Number(payload.confidence) || 0}/100 após ${Number(payload.sampleMatches) || 0} jogos recentes analisados pelo modelo de pontos esperados do clube.`
      },
      context: { worldEventType: worldEvent.type, boardPressure: true }
    };
  }

  if (worldEvent.type === 'MANAGER_SACKED') {
    const managerName = payload.managerName || 'Treinador';
    const club = clubName(entities.clubCode);
    return {
      ...common,
      type: NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_SACKED,
      entities: { clubCodes: compact([entities.clubCode]), managerIds: compact([entities.managerId]) },
      facts: {
        managerId: entities.managerId,
        clubCode: entities.clubCode,
        managerName,
        jobSecurity: Number(payload.jobSecurity) || 0,
        ppg: payload.ppg == null ? null : Number(payload.ppg),
        expectedPpg: payload.expectedPpg == null ? null : Number(payload.expectedPpg),
        underperformance: payload.underperformance == null ? null : Number(payload.underperformance),
        headline: `${club} demite ${managerName}`,
        summary: `${managerName} deixou o comando do ${club} após a revisão de desempenho registrada pelo Living World.`
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (worldEvent.type === 'MANAGER_HIRED' || worldEvent.type === 'MANAGER_POACHED') {
    const managerName = payload.managerName || 'Treinador';
    const destination = clubName(entities.clubCode);
    const source = entities.fromClubCode ? clubName(entities.fromClubCode) : null;
    const poached = worldEvent.type === 'MANAGER_POACHED';
    return {
      ...common,
      type: poached ? NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_POACHED : NEWSROOM_GOVERNANCE_EVENT_TYPES.MANAGER_HIRED,
      entities: {
        clubCodes: compact([entities.clubCode, entities.fromClubCode]),
        managerIds: compact([entities.managerId])
      },
      facts: {
        managerId: entities.managerId,
        clubCode: entities.clubCode,
        fromClubCode: entities.fromClubCode || null,
        managerName,
        tacticalStyle: payload.tacticalStyle || null,
        fitScore: payload.fitScore == null ? null : Number(payload.fitScore),
        headline: poached && source
          ? `${managerName} troca o ${source} pelo ${destination}`
          : `${destination} anuncia ${managerName} como novo treinador`,
        summary: poached && source
          ? `${destination} tirou ${managerName} do ${source}; a mudança foi registrada pelo mercado de treinadores do Living World.`
          : `${managerName} assumiu o comando permanente do ${destination} após o processo de contratação do clube.`
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (worldEvent.type === 'CONTRACT_RENEWED') {
    const name = playerName(entities.playerId);
    const club = clubName(entities.clubCode);
    return {
      ...common,
      type: CAREER_EVENT_TYPES.CONTRACT_RENEWED,
      entities: { playerIds: compact([entities.playerId]), clubCodes: compact([entities.clubCode]) },
      facts: {
        playerId: entities.playerId,
        clubCode: entities.clubCode,
        weeklyWage: Number(payload.weeklyWage) || 0,
        endDate: payload.endDate || null,
        years: Number(payload.years) || 0,
        playingTime: payload.playingTime || null,
        agentFee: Number(payload.agentFee) || 0,
        signingBonus: Number(payload.signingBonus) || 0,
        headline: `${name} renova contrato com o ${club}`,
        summary: payload.endDate
          ? `${name} acertou um novo vínculo com o ${club} até ${payload.endDate}.`
          : `${name} e ${club} concluíram a renovação contratual.`
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (worldEvent.type === 'CONTRACT_RENEWAL_REJECTED') {
    const name = playerName(entities.playerId);
    const club = clubName(entities.clubCode);
    return {
      ...common,
      type: NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_RENEWAL_REJECTED,
      entities: { playerIds: compact([entities.playerId]), clubCodes: compact([entities.clubCode]) },
      facts: {
        playerId: entities.playerId,
        clubCode: entities.clubCode,
        reason: payload.reason || null,
        riskBand: payload.riskBand || null,
        daysRemaining: Math.max(0, Number(payload.daysRemaining) || 0),
        headline: `${name} e ${club} não chegam a acordo por renovação`,
        summary: `A negociação terminou sem acordo${payload.daysRemaining != null ? ` com ${Math.max(0, Number(payload.daysRemaining) || 0)} dias restantes no vínculo` : ''}.`
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (worldEvent.type === 'CONTRACT_EXPIRED') {
    const name = playerName(entities.playerId);
    const club = clubName(entities.clubCode);
    return {
      ...common,
      type: NEWSROOM_GOVERNANCE_EVENT_TYPES.CONTRACT_EXPIRED,
      entities: { playerIds: compact([entities.playerId]), clubCodes: compact([entities.clubCode]) },
      facts: {
        playerId: entities.playerId,
        clubCode: entities.clubCode || null,
        endDate: payload.endDate || null,
        freeAgent: Boolean(payload.freeAgent),
        headline: `${name} deixa o ${club} ao fim do contrato`,
        summary: `${name} encerrou o vínculo com o ${club} e passou a estar disponível como agente livre.`
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (worldEvent.type === 'BOSMAN_PRECONTRACT_AGREED') {
    const name = playerName(entities.playerId);
    const from = clubName(entities.fromClubCode);
    const to = clubName(entities.toClubCode);
    return {
      ...common,
      type: NEWSROOM_GOVERNANCE_EVENT_TYPES.BOSMAN_PRECONTRACT_AGREED,
      entities: {
        playerIds: compact([entities.playerId]),
        clubCodes: compact([entities.fromClubCode, entities.toClubCode])
      },
      facts: {
        playerId: entities.playerId,
        fromClubCode: entities.fromClubCode || null,
        toClubCode: entities.toClubCode,
        startsAt: payload.startsAt || null,
        weeklyWage: Number(payload.weeklyWage) || 0,
        years: Number(payload.years) || 0,
        signingBonus: Number(payload.signingBonus) || 0,
        agentFee: Number(payload.agentFee) || 0,
        headline: `${name} acerta pré-contrato com o ${to}`,
        summary: `${name}, atualmente no ${from}, acertou a mudança para o ${to}${payload.startsAt ? ` a partir de ${payload.startsAt}` : ''}.`
      },
      context: { worldEventType: worldEvent.type, bosman: true }
    };
  }

  return null;
}

function mappedEvent(worldEvent) {
  if (!worldEvent?.id || !worldEvent?.type || !worldEvent?.date) return null;
  const entities = worldEvent.entities || {};
  const payload = worldEvent.payload || {};
  const common = {
    id: `evt-${worldEvent.id}`,
    gameDate: worldEvent.date,
    source: 'living-world-ledger',
    scope: 'world',
    visibility: worldEvent.visibility === 'system' ? 'internal' : 'public',
    links: { worldEventId: worldEvent.id }
  };

  const governance = governanceEvent(worldEvent, common);
  if (governance) return governance;

  if (worldEvent.type === 'PLAYER_INJURED') {
    return {
      ...common,
      type: CAREER_EVENT_TYPES.INJURY,
      entities: {
        playerIds: compact([entities.playerId]),
        clubCodes: compact([entities.clubCode, entities.ownerClubCode])
      },
      facts: {
        playerId: entities.playerId,
        daysOut: Number(payload.durationDays) || 0,
        diagnosis: payload.injuryType || 'injury',
        severity: payload.severity || null,
        unavailableUntil: payload.unavailableUntil || null,
        fixtureId: entities.fixtureId || null
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (worldEvent.type === 'PLAYER_RETURNED_FROM_INJURY') {
    return {
      ...common,
      type: CAREER_EVENT_TYPES.PLAYER_RETURNED,
      entities: {
        playerIds: compact([entities.playerId]),
        clubCodes: compact([entities.clubCode])
      },
      facts: {
        playerId: entities.playerId,
        injuryType: payload.injuryType || null,
        absenceDays: Number(payload.absenceDays) || 0
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (['TRANSFER_INTEREST_REGISTERED', 'FREE_AGENT_INTEREST_REGISTERED', 'TRANSFER_OFFER_RECEIVED'].includes(worldEvent.type)) {
    return {
      ...common,
      type: CAREER_EVENT_TYPES.TRANSFER_OFFERED,
      entities: transferEntities(worldEvent),
      facts: {
        playerId: entities.playerId,
        fromClubCode: entities.sellerCode || entities.fromClubCode || null,
        toClubCode: entities.buyerCode || entities.toClubCode || null,
        fee: Number(payload.fee ?? payload.marketValue) || 0,
        negotiationId: entities.negotiationId || null,
        stage: worldEvent.type === 'TRANSFER_OFFER_RECEIVED' ? 'formal-offer' : 'interest',
        freeAgent: worldEvent.type.startsWith('FREE_AGENT_') || Boolean(payload.freeAgent)
      },
      context: { worldEventType: worldEvent.type }
    };
  }

  if (['TRANSFER_COMPLETED', 'FREE_AGENT_SIGNED', 'BOSMAN_MOVE_COMPLETED'].includes(worldEvent.type)) {
    return {
      ...common,
      type: CAREER_EVENT_TYPES.TRANSFER_COMPLETED,
      entities: transferEntities(worldEvent),
      facts: {
        playerId: entities.playerId,
        fromClubCode: entities.fromClubCode || null,
        toClubCode: entities.toClubCode,
        fee: Number(payload.fee) || 0,
        weeklyWage: Number(payload.weeklyWage) || 0,
        contractEnd: payload.contractEnd || null,
        freeAgent: worldEvent.type !== 'TRANSFER_COMPLETED' || Boolean(payload.freeAgent),
        bosman: worldEvent.type === 'BOSMAN_MOVE_COMPLETED',
        preContract: worldEvent.type === 'BOSMAN_MOVE_COMPLETED'
      },
      context: { worldEventType: worldEvent.type, bosman: worldEvent.type === 'BOSMAN_MOVE_COMPLETED' }
    };
  }

  if (worldEvent.type === 'LOAN_OFFER_RECEIVED') {
    return {
      ...common,
      type: CAREER_EVENT_TYPES.TRANSFER_OFFERED,
      entities: transferEntities(worldEvent),
      facts: {
        playerId: entities.playerId,
        fromClubCode: entities.parentClubCode,
        toClubCode: entities.borrowerClubCode,
        fee: Number(payload.loanFee) || 0,
        loanId: entities.loanId || null,
        stage: 'loan-offer',
        loan: true
      },
      context: { worldEventType: worldEvent.type, loan: true }
    };
  }

  if (worldEvent.type === 'LOAN_STARTED') {
    return {
      ...common,
      type: CAREER_EVENT_TYPES.LOAN_COMPLETED,
      entities: transferEntities(worldEvent),
      facts: {
        playerId: entities.playerId,
        fromClubCode: entities.parentClubCode,
        toClubCode: entities.borrowerClubCode,
        fee: Number(payload.loanFee) || 0,
        loanId: entities.loanId || null,
        endDate: payload.endDate || null,
        wageContribution: Number(payload.wageContribution) || 0,
        optionToBuy: Boolean(payload.optionToBuy),
        optionFee: Number(payload.optionFee) || 0
      },
      context: { worldEventType: worldEvent.type, loan: true }
    };
  }

  return null;
}

export function reconcileWorldNewsEvents(career) {
  if (!career || typeof career !== 'object') return [];
  const worldEvents = Array.isArray(career.world?.events) ? career.world.events : [];
  const projected = [];
  for (const worldEvent of worldEvents) {
    const event = mappedEvent(worldEvent);
    if (!event) continue;
    const appended = appendCareerEvent(career, event, { gameDate: event.gameDate, source: event.source });
    if (appended?.id === event.id) projected.push(appended);
  }
  return projected;
}

export function newsroomEventFromWorldEvent(worldEvent) {
  return mappedEvent(worldEvent);
}

export const NEWSROOM_WORLD_BRIDGE_META = Object.freeze({
  source: 'career.world.events',
  mappedTypes: Object.freeze([
    'PLAYER_INJURED',
    'PLAYER_RETURNED_FROM_INJURY',
    'TRANSFER_INTEREST_REGISTERED',
    'FREE_AGENT_INTEREST_REGISTERED',
    'TRANSFER_OFFER_RECEIVED',
    'TRANSFER_COMPLETED',
    'FREE_AGENT_SIGNED',
    'LOAN_OFFER_RECEIVED',
    'LOAN_STARTED',
    ...GOVERNANCE_WORLD_TYPES
  ]),
  invariant: 'world engines remain authoritative; newsroom only projects their recorded events'
});
