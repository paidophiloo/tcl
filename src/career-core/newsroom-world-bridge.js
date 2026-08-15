import { CAREER_EVENT_TYPES, appendCareerEvent } from './event-ledger.js';

function compact(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
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

  if (['TRANSFER_COMPLETED', 'FREE_AGENT_SIGNED'].includes(worldEvent.type)) {
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
        freeAgent: worldEvent.type === 'FREE_AGENT_SIGNED' || Boolean(payload.freeAgent)
      },
      context: { worldEventType: worldEvent.type }
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
    'LOAN_STARTED'
  ]),
  invariant: 'world engines remain authoritative; newsroom only projects their recorded events'
});
