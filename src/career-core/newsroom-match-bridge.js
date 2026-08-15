import { CAREER_EVENT_TYPES, appendCareerEvent } from './event-ledger.js';

function compact(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function clubCodeFor(result, event) {
  if (event?.side === 'home') return result?.home || null;
  if (event?.side === 'away') return result?.away || null;
  return null;
}

function alreadyHasWorldInjury(career, result, incident) {
  const fixtureId = String(result?.fixtureId || '');
  const playerId = String(incident?.playerId || '');
  return (career?.eventLedger?.events || []).some(event =>
    event.type === CAREER_EVENT_TYPES.INJURY &&
    event.source === 'living-world-ledger' &&
    event.gameDate === result?.date &&
    event.entities?.playerIds?.includes(playerId) &&
    String(event.facts?.fixtureId || '') === fixtureId
  );
}

function incidentId(result, incident, index) {
  const fixtureId = String(result?.fixtureId || 'fixture');
  const type = String(incident?.type || 'incident').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const playerId = String(incident?.playerId || 'player').replace(/[^a-z0-9_-]+/gi, '-');
  const minute = Math.max(1, Number(incident?.minute) || 1);
  return `evt-match-incident-${fixtureId}-${type}-${playerId}-${minute}-${index}`;
}

function goalEvent(result, incident, index, scoreAfter) {
  const clubCode = clubCodeFor(result, incident);
  if (!clubCode || !incident?.playerId) return null;
  return {
    id: incidentId(result, incident, index),
    type: CAREER_EVENT_TYPES.GOAL,
    gameDate: result.date,
    source: 'career-match-incidents',
    scope: 'match',
    visibility: 'internal',
    entities: {
      clubCodes: compact([result.home, result.away, clubCode]),
      playerIds: compact([incident.playerId, incident.assistPlayerId])
    },
    facts: {
      fixtureId: result.fixtureId,
      playerId: incident.playerId,
      clubCode,
      side: incident.side,
      minute: Number(incident.minute) || 1,
      assistPlayerId: incident.assistPlayerId || null,
      isPenalty: Boolean(incident.isPenalty),
      goalType: incident.goalType || (incident.isPenalty ? 'penalty' : 'open-play'),
      scoreAfter
    },
    context: {
      homeCode: result.home,
      awayCode: result.away,
      finalScore: { homeGoals: result.homeGoals, awayGoals: result.awayGoals }
    },
    links: { fixtureId: result.fixtureId, resultEventIndex: index }
  };
}

function redCardEvent(result, incident, index, scoreAtIncident) {
  const clubCode = clubCodeFor(result, incident);
  if (!clubCode || !incident?.playerId) return null;
  return {
    id: incidentId(result, incident, index),
    type: CAREER_EVENT_TYPES.RED_CARD,
    gameDate: result.date,
    source: 'career-match-incidents',
    scope: 'match',
    visibility: 'public',
    entities: {
      clubCodes: compact([result.home, result.away, clubCode]),
      playerIds: compact([incident.playerId])
    },
    facts: {
      fixtureId: result.fixtureId,
      playerId: incident.playerId,
      clubCode,
      side: incident.side,
      minute: Number(incident.minute) || 1,
      reason: incident.reason || null,
      scoreAtIncident
    },
    context: {
      homeCode: result.home,
      awayCode: result.away,
      finalScore: { homeGoals: result.homeGoals, awayGoals: result.awayGoals }
    },
    links: { fixtureId: result.fixtureId, resultEventIndex: index }
  };
}

function injuryFallbackEvent(career, result, incident, index, scoreAtIncident) {
  if (alreadyHasWorldInjury(career, result, incident)) return null;
  const clubCode = clubCodeFor(result, incident);
  if (!clubCode || !incident?.playerId) return null;
  return {
    id: incidentId(result, incident, index),
    type: CAREER_EVENT_TYPES.INJURY,
    gameDate: result.date,
    source: 'career-match-incidents',
    scope: 'match',
    visibility: 'public',
    entities: {
      clubCodes: compact([clubCode]),
      playerIds: compact([incident.playerId])
    },
    facts: {
      fixtureId: result.fixtureId,
      playerId: incident.playerId,
      clubCode,
      minute: Number(incident.minute) || 1,
      daysOut: Math.max(0, Number(incident.durationDays) || 0),
      diagnosis: incident.injuryType || 'injury',
      scoreAtIncident
    },
    context: {
      homeCode: result.home,
      awayCode: result.away,
      finalScore: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
      fallbackFromMatchResult: true
    },
    links: { fixtureId: result.fixtureId, resultEventIndex: index }
  };
}

function projectResult(career, result) {
  if (!result?.fixtureId || !result?.date || !Array.isArray(result.events)) return [];
  const projected = [];
  let homeGoals = 0;
  let awayGoals = 0;

  result.events.forEach((incident, index) => {
    if (incident?.type === 'goal') {
      if (incident.side === 'home') homeGoals += 1;
      if (incident.side === 'away') awayGoals += 1;
      const event = goalEvent(result, incident, index, { homeGoals, awayGoals });
      if (event) projected.push(event);
      return;
    }

    const scoreAtIncident = { homeGoals, awayGoals };
    if (incident?.type === 'red-card') {
      const event = redCardEvent(result, incident, index, scoreAtIncident);
      if (event) projected.push(event);
      return;
    }

    if (incident?.type === 'injury') {
      const event = injuryFallbackEvent(career, result, incident, index, scoreAtIncident);
      if (event) projected.push(event);
    }
  });

  return projected;
}

export function reconcileMatchNewsEvents(career) {
  if (!career || typeof career !== 'object') return [];
  const projected = [];
  for (const result of Object.values(career.results || {})) {
    for (const event of projectResult(career, result)) {
      const appended = appendCareerEvent(career, event, { gameDate: event.gameDate, source: event.source });
      if (appended?.id === event.id) projected.push(appended);
    }
  }
  return projected;
}

export const NEWSROOM_MATCH_BRIDGE_META = Object.freeze({
  source: 'career.results[*].events',
  projectedTypes: Object.freeze(['goal', 'red-card', 'injury']),
  invariant: 'match results remain authoritative; granular incidents are projected with stable ids and never rewrite simulation state'
});
