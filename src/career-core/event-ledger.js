const LEDGER_SCHEMA_VERSION = 1;
const EVENT_SCHEMA_VERSION = 1;
const DEFAULT_SOURCE = 'career-runtime';

export const EVENT_LEDGER_SCHEMA_VERSION = LEDGER_SCHEMA_VERSION;
export const CAREER_EVENT_SCHEMA_VERSION = EVENT_SCHEMA_VERSION;

export const CAREER_EVENT_TYPES = Object.freeze({
  MATCH_SCHEDULED: 'match.scheduled',
  MATCH_PLAYED: 'match.played',
  MATCH_POSTPONED: 'match.postponed',
  GOAL: 'match.goal',
  RED_CARD: 'match.red-card',
  INJURY: 'player.injury',
  PLAYER_RETURNED: 'player.returned',
  TRANSFER_LISTED: 'transfer.listed',
  TRANSFER_OFFERED: 'transfer.offered',
  TRANSFER_COMPLETED: 'transfer.completed',
  LOAN_COMPLETED: 'loan.completed',
  CONTRACT_RENEWED: 'contract.renewed',
  TABLE_CHANGED: 'competition.table-changed',
  MANAGER_PRESS: 'manager.press',
  BOARD_MESSAGE: 'club.board-message',
  LEGACY: 'legacy.event'
});

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function cleanString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function cleanStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => cleanString(item)).filter(Boolean))];
}

function dateOnly(value, fallback = null) {
  const normalized = cleanString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return fallback;
}

function timestamp(value, fallback = null) {
  const parsed = Date.parse(cleanString(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeEntities(entities = {}) {
  return {
    clubCodes: cleanStringList(entities.clubCodes),
    playerIds: cleanStringList(entities.playerIds),
    managerIds: cleanStringList(entities.managerIds),
    competitionIds: cleanStringList(entities.competitionIds)
  };
}

function eventFingerprint(event) {
  if (cleanString(event.fingerprint)) return cleanString(event.fingerprint);
  return hashString(stableSerialize({
    type: event.type,
    gameDate: event.gameDate,
    source: event.source,
    entities: event.entities,
    facts: event.facts,
    links: event.links
  }));
}

function eventId(event, sequence = 0) {
  if (cleanString(event.id)) return cleanString(event.id);
  const fingerprint = eventFingerprint(event);
  return `evt-${event.gameDate || 'undated'}-${fingerprint}-${Math.max(1, Number(sequence) || 1)}`;
}

export function normalizeCareerEvent(input = {}, options = {}) {
  const fallbackDate = dateOnly(options.gameDate) || dateOnly(options.currentDate) || '1970-01-01';
  const gameDate = dateOnly(input.gameDate || input.date, fallbackDate);
  const recordedAt = timestamp(input.recordedAt || input.timestamp, timestamp(options.recordedAt) || `${gameDate}T12:00:00.000Z`);
  const type = cleanString(input.type, CAREER_EVENT_TYPES.LEGACY);
  const source = cleanString(input.source, cleanString(options.source, DEFAULT_SOURCE));
  const entities = normalizeEntities(input.entities || input.subjects || {});
  const facts = input.facts && typeof input.facts === 'object' ? clone(input.facts) : {};
  const context = input.context && typeof input.context === 'object' ? clone(input.context) : {};
  const links = input.links && typeof input.links === 'object' ? clone(input.links) : {};
  const normalized = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    id: cleanString(input.id),
    fingerprint: cleanString(input.fingerprint),
    type,
    gameDate,
    recordedAt,
    source,
    scope: cleanString(input.scope, 'world'),
    entities,
    facts,
    context,
    links,
    visibility: cleanString(input.visibility, 'public')
  };
  normalized.fingerprint = eventFingerprint(normalized);
  normalized.id = eventId(normalized, options.sequence);
  return normalized;
}

function legacyArrayToLedger(events, career) {
  const normalized = [];
  let sequence = 0;
  for (const raw of Array.isArray(events) ? events : []) {
    sequence += 1;
    normalized.push(normalizeCareerEvent(raw, {
      sequence,
      currentDate: career?.currentDate,
      recordedAt: career?.updatedAt || career?.createdAt,
      source: 'legacy-ledger-migration'
    }));
  }
  return normalized;
}

export function createEventLedger(career = {}) {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    sequence: 0,
    events: [],
    createdAt: timestamp(career.createdAt) || null,
    updatedAt: timestamp(career.updatedAt || career.createdAt) || null
  };
}

export function ensureEventLedger(career) {
  if (!career || typeof career !== 'object') return career;
  const existing = career.eventLedger;
  if (!existing) {
    career.eventLedger = createEventLedger(career);
    return career;
  }

  if (Array.isArray(existing)) {
    const events = legacyArrayToLedger(existing, career);
    career.eventLedger = {
      ...createEventLedger(career),
      sequence: events.length,
      events
    };
    return career;
  }

  const rawEvents = Array.isArray(existing.events) ? existing.events : [];
  const events = [];
  const seenIds = new Set();
  const seenFingerprints = new Set();
  let sequence = 0;

  for (const raw of rawEvents) {
    sequence += 1;
    const normalized = normalizeCareerEvent(raw, {
      sequence,
      currentDate: career.currentDate,
      recordedAt: career.updatedAt || career.createdAt,
      source: raw?.source || 'ledger-migration'
    });
    if (seenIds.has(normalized.id) || seenFingerprints.has(normalized.fingerprint)) continue;
    seenIds.add(normalized.id);
    seenFingerprints.add(normalized.fingerprint);
    events.push(normalized);
  }

  career.eventLedger = {
    ...existing,
    schemaVersion: LEDGER_SCHEMA_VERSION,
    sequence: Math.max(Number(existing.sequence) || 0, events.length),
    events,
    createdAt: timestamp(existing.createdAt) || timestamp(career.createdAt) || null,
    updatedAt: timestamp(existing.updatedAt) || timestamp(career.updatedAt || career.createdAt) || null
  };
  return career;
}

export function appendCareerEvent(career, event, options = {}) {
  ensureEventLedger(career);
  if (!career?.eventLedger) return null;
  const ledger = career.eventLedger;
  const sequence = Math.max(Number(ledger.sequence) || 0, ledger.events.length) + 1;
  const normalized = normalizeCareerEvent(event, {
    sequence,
    currentDate: career.currentDate,
    gameDate: options.gameDate,
    recordedAt: options.recordedAt || career.updatedAt,
    source: options.source
  });

  const duplicate = ledger.events.find(item =>
    item.id === normalized.id || item.fingerprint === normalized.fingerprint
  );
  if (duplicate) return duplicate;

  ledger.sequence = sequence;
  ledger.events.push(normalized);
  ledger.updatedAt = normalized.recordedAt;
  return normalized;
}

export function appendCareerEvents(career, events = [], options = {}) {
  return events.map(event => appendCareerEvent(career, event, options)).filter(Boolean);
}

export function careerEvents(career, filter = {}) {
  ensureEventLedger(career);
  const events = career?.eventLedger?.events || [];
  return events.filter(event => {
    if (filter.type && event.type !== filter.type) return false;
    if (filter.since && event.gameDate < filter.since) return false;
    if (filter.until && event.gameDate > filter.until) return false;
    if (filter.clubCode && !event.entities.clubCodes.includes(filter.clubCode)) return false;
    if (filter.playerId && !event.entities.playerIds.includes(filter.playerId)) return false;
    return true;
  });
}

export function latestCareerEvents(career, limit = 50, filter = {}) {
  const events = careerEvents(career, filter);
  return events.slice(Math.max(0, events.length - Math.max(0, Number(limit) || 0)));
}
