import { reconcileCareerData } from './result-integrity.js';
import { reconcileMailbox } from './mailbox-core.js';
import { ensureEventLedger } from './event-ledger.js';
import { archiveNewsroomSnapshot, ensureNewsroomArchive } from './newsroom-archive.js';
import { buildCareerNewsroom } from './newsroom-engine.js';
import { reconcileWorldNewsEvents } from './newsroom-world-bridge.js';
import { CLUB_BY_CODE } from './season-2026-27-live.js';
import { WORLD_PLAYER_BY_ID } from '../career-world/world-player-database.js';

const DB_NAME = "touchline-career-v5";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const FALLBACK_PREFIX = "touchline.career.v5.";
const LOCAL_FALLBACK_SOFT_LIMIT = 3_600_000;
const LEGACY_CORE_FORMATIONS = new Set(['4-2-3-1', '4-3-3', '3-4-2-1', '4-4-2', '4-1-4-1', '3-5-2', '5-3-2']);
let storageRevisionCounter = 0;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "saveId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open career database"));
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error("Career storage operation failed"));
      transaction.onabort = () => reject(transaction.error || new Error("Career storage transaction aborted"));
    });
  } finally {
    database.close();
  }
}

function fallbackKey(saveId) {
  return `${FALLBACK_PREFIX}${saveId}`;
}

function readFallback(saveId) {
  try {
    const value = JSON.parse(localStorage.getItem(fallbackKey(saveId)) || "null");
    return value?.fallbackSummaryOnly ? null : value;
  } catch {
    return null;
  }
}

function compactFallback(save) {
  return {
    schemaVersion: save.schemaVersion,
    saveId: save.saveId,
    clubCode: save.clubCode,
    clubName: save.clubName || save.clubCode,
    managerName: save.managerName,
    seasonId: save.seasonId,
    seasonLabel: save.seasonLabel,
    currentDate: save.currentDate,
    status: save.status,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    storageRevision: save.storageRevision,
    fallbackSummaryOnly: true,
    storageMode: "indexeddb-primary"
  };
}

function writeFallback(save) {
  try {
    const serialized = JSON.stringify(save);
    if (serialized.length <= LOCAL_FALLBACK_SOFT_LIMIT) {
      localStorage.setItem(fallbackKey(save.saveId), serialized);
      return "full";
    }
    localStorage.setItem(fallbackKey(save.saveId), JSON.stringify(compactFallback(save)));
    return "summary";
  } catch {
    try {
      localStorage.setItem(fallbackKey(save.saveId), JSON.stringify(compactFallback(save)));
      return "summary";
    } catch {
      return "failed";
    }
  }
}

function timestampOf(save) {
  const parsed = Date.parse(save?.updatedAt || save?.createdAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function revisionOf(save) {
  const revision = Number(save?.storageRevision);
  return Number.isFinite(revision) && revision > 0 ? revision : 0;
}

function freshestSnapshot(primary, fallback) {
  if (!primary) return fallback || null;
  if (!fallback) return primary;
  const primaryRevision = revisionOf(primary);
  const fallbackRevision = revisionOf(fallback);
  if (primaryRevision !== fallbackRevision) {
    return fallbackRevision > primaryRevision ? fallback : primary;
  }
  return timestampOf(fallback) >= timestampOf(primary) ? fallback : primary;
}

function rememberRevision(save) {
  storageRevisionCounter = Math.max(storageRevisionCounter, revisionOf(save));
  return save;
}

function nextRevision(save, fallback) {
  storageRevisionCounter = Math.max(storageRevisionCounter, revisionOf(save), revisionOf(fallback)) + 1;
  return storageRevisionCounter;
}

function syncFormationDraftFromCareer(career) {
  if (!career || typeof career !== "object") return;
  if (!career.saveId || !career.clubCode || !career.formation || !career.tacticalLayouts) return;
  globalThis.__touchlineFormationDraft = {
    saveId: career.saveId,
    clubCode: career.clubCode,
    formation: career.formation,
    tacticalLayouts: structuredClone(career.tacticalLayouts)
  };
}

function consumeCareerDraft(save) {
  const draft = globalThis.__touchlineCareerDraft;
  if (!draft || typeof draft !== "object") return save;
  if (draft.saveId !== save.saveId || draft.clubCode !== save.clubCode) return save;
  syncFormationDraftFromCareer(draft);
  delete globalThis.__touchlineCareerDraft;
  return {
    ...save,
    ...structuredClone(draft),
    tactics: { ...(save.tactics || {}), ...(draft.tactics || {}) },
    results: { ...(save.results || {}), ...(draft.results || {}) },
    playerState: { ...(save.playerState || {}), ...(draft.playerState || {}) },
    playerStats: { ...(save.playerStats || {}), ...(draft.playerStats || {}) },
    world: draft.world ? structuredClone(draft.world) : save.world
  };
}

function mergeFormationDraft(save) {
  const draft = globalThis.__touchlineFormationDraft;
  if (!save || !draft || typeof draft !== "object") return save;
  if (draft.saveId !== save.saveId || draft.clubCode !== save.clubCode) return save;
  if (!draft.formation || !draft.tacticalLayouts) return save;
  return { ...save, formation: draft.formation, tacticalLayouts: structuredClone(draft.tacticalLayouts) };
}

function markExtendedFormation(save) {
  if (!save?.formation || LEGACY_CORE_FORMATIONS.has(save.formation)) return save;
  return {
    ...save,
    __touchlineExtendedFormation: save.formation,
    __touchlineExtendedTacticalLayouts: structuredClone(save.tacticalLayouts || {})
  };
}

function restoreExtendedFormation(save) {
  if (!save || typeof save !== "object") return save;
  const requested = save.__touchlineExtendedFormation;
  const requestedLayouts = save.__touchlineExtendedTacticalLayouts;
  const next = { ...save };
  delete next.__touchlineExtendedFormation;
  delete next.__touchlineExtendedTacticalLayouts;
  if (requested && !LEGACY_CORE_FORMATIONS.has(requested)) {
    next.formation = requested;
    if (requestedLayouts && typeof requestedLayouts === "object") {
      next.tacticalLayouts = structuredClone(requestedLayouts);
    }
  }
  return next;
}

function reconcileStoredCareer(save) {
  if (!save) return save;
  const snapshot = structuredClone(save);
  reconcileCareerData(snapshot);
  reconcileMailbox(snapshot);
  ensureEventLedger(snapshot);
  reconcileWorldNewsEvents(snapshot);
  ensureNewsroomArchive(snapshot);
  const newsroom = buildCareerNewsroom(snapshot, {
    userClubCode: snapshot.clubCode,
    currentDate: snapshot.currentDate,
    clubResolver: code => CLUB_BY_CODE.get(code)?.name || code,
    playerResolver: playerId => WORLD_PLAYER_BY_ID.get(playerId)?.name || playerId
  });
  snapshot.newsroom = newsroom;
  archiveNewsroomSnapshot(snapshot, newsroom);
  return snapshot;
}

function prepareLoadedCareer(save) {
  return rememberRevision(markExtendedFormation(reconcileStoredCareer(mergeFormationDraft(save))));
}

export const CareerRepository = Object.freeze({
  async load(saveId = "primary") {
    const fallback = readFallback(saveId);
    try {
      const saved = await withStore("readonly", store => store.get(saveId));
      return prepareLoadedCareer(freshestSnapshot(saved, fallback));
    } catch {
      return prepareLoadedCareer(fallback);
    }
  },

  async save(save) {
    const fallbackBeforeSave = readFallback(save?.saveId || "primary");
    const merged = restoreExtendedFormation(
      reconcileStoredCareer(mergeFormationDraft(consumeCareerDraft(save)))
    );
    const snapshot = structuredClone({
      ...merged,
      updatedAt: new Date().toISOString(),
      storageRevision: nextRevision(merged, fallbackBeforeSave)
    });
    const fallbackMode = writeFallback(snapshot);
    try {
      await withStore("readwrite", store => store.put(snapshot));
    } catch (error) {
      if (fallbackMode !== "full") throw error;
    }
    return snapshot;
  },

  async remove(saveId = "primary") {
    if (globalThis.__touchlineFormationDraft?.saveId === saveId) delete globalThis.__touchlineFormationDraft;
    try { localStorage.removeItem(fallbackKey(saveId)); } catch {}
    try { await withStore("readwrite", store => store.delete(saveId)); } catch {}
  }
});

export function legacyClubSelection() {
  try {
    const legacy = JSON.parse(localStorage.getItem("touchline.career.mode.v1") || "null");
    return legacy?.selectedClubCode || null;
  } catch {
    return null;
  }
}