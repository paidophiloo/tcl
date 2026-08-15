import { PLAYER_BY_ID } from './career-core.js';
import { CLUB_BY_CODE } from './season-2026-27.js';
import { stadiumAssetCandidates } from './stadium-assets.js';
import { cachedClubStadiumMedia, resolveClubStadiumMedia } from './stadium-media-service.js';
import { resolveOfficialClubLogo } from './official-club-logo-service.js';

const PLAYER_MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const PLAYER_FALLBACK_URL = '/assets/players/player-placeholder.svg';
const CACHE_KEY = 'touchline.newsroom-media.v1';
const POSITIVE_TTL = 1000 * 60 * 60 * 24 * 30;
const NEGATIVE_TTL = 1000 * 60 * 60 * 6;

let manifestPromise = null;
let cacheLoaded = false;
let cache = {};
let saveTimer = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || '{}');
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }
}

function persistCacheSoon() {
  if (!globalThis.localStorage || saveTimer) return;
  saveTimer = globalThis.setTimeout(() => {
    saveTimer = null;
    try { globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }, 180);
}

function readCache(key) {
  loadCache();
  const entry = cache[key];
  if (!entry || Number(entry.expiresAt) <= Date.now()) return null;
  return clone(entry.value);
}

function writeCache(key, value) {
  loadCache();
  cache[key] = {
    value: clone(value),
    expiresAt: Date.now() + (value?.url ? POSITIVE_TTL : NEGATIVE_TTL)
  };
  persistCacheSoon();
}

async function loadPlayerManifest() {
  if (manifestPromise) return manifestPromise;
  if (typeof fetch !== 'function') return { players: {} };
  manifestPromise = fetch(`${PLAYER_MANIFEST_URL}?v=7`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => manifest?.players ? manifest : { players: {} })
    .catch(() => ({ players: {} }));
  return manifestPromise;
}

function localPlayerFaceFromRecord(player, record) {
  if (!player || !record) return null;
  if (record.playerId !== player.id || record.clubCode !== player.clubCode) return null;
  if (!record.fotmobId || !record.localPath) return null;
  return {
    kind: 'player',
    url: record.localPath,
    source: 'FotMob local portrait pack',
    subjectId: player.id,
    subjectName: player.name,
    alt: player.name,
    local: true
  };
}

export async function resolveNewsroomPlayerMedia(playerId) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return null;
  const key = `player:${playerId}`;
  const cached = readCache(key);
  if (cached) return cached.url ? cached : null;
  const manifest = await loadPlayerManifest();
  const found = localPlayerFaceFromRecord(player, manifest.players?.[playerId]);
  const value = found || {
    kind: 'player',
    url: PLAYER_FALLBACK_URL,
    source: 'Touchline player placeholder',
    subjectId: player.id,
    subjectName: player.name,
    alt: player.name,
    local: true,
    fallback: true
  };
  writeCache(key, value);
  return value;
}

export async function resolveNewsroomClubMedia(clubCode) {
  const club = CLUB_BY_CODE.get(clubCode);
  if (!club) return null;
  const key = `club:${clubCode}`;
  const cached = readCache(key);
  if (cached) return cached.url ? cached : null;
  const logo = await resolveOfficialClubLogo(club);
  const value = logo?.url ? {
    kind: 'club',
    url: logo.url,
    source: logo.source,
    subjectId: clubCode,
    subjectName: club.name,
    alt: `${club.name} crest`,
    local: !/^https:\/\//i.test(logo.url)
  } : null;
  writeCache(key, value || { url: null });
  return value;
}

export async function resolveNewsroomStadiumMedia(clubCode) {
  const club = CLUB_BY_CODE.get(clubCode);
  if (!club) return null;
  const key = `stadium:${clubCode}`;
  const cached = readCache(key);
  if (cached) return cached.url ? cached : null;

  const localCandidates = stadiumAssetCandidates(clubCode).filter(Boolean);
  if (localCandidates.length) {
    const value = {
      kind: 'stadium',
      url: localCandidates[0],
      candidates: localCandidates,
      source: 'Touchline verified local stadium pack',
      subjectId: clubCode,
      subjectName: club.stadium || club.name,
      alt: club.stadium || `${club.name} stadium`,
      local: true
    };
    writeCache(key, value);
    return value;
  }

  const resolved = cachedClubStadiumMedia(club) || await resolveClubStadiumMedia(club);
  const value = resolved?.url ? {
    kind: 'stadium',
    url: resolved.url,
    candidates: [resolved.url],
    source: resolved.source,
    subjectId: clubCode,
    subjectName: resolved.stadiumName || club.stadium || club.name,
    alt: resolved.stadiumName || club.stadium || `${club.name} stadium`,
    local: false
  } : null;
  writeCache(key, value || { url: null });
  return value;
}

function preferredClubCode(mediaIntent, article) {
  const codes = mediaIntent?.clubCodes || [];
  if (!codes.length) return null;
  if (article?.category === 'club' && article?.userClubCode && codes.includes(article.userClubCode)) return article.userClubCode;
  return codes[0];
}

export async function resolveNewsroomMedia(article, options = {}) {
  const intent = article?.mediaIntent || {};
  const preference = intent.preference || 'club';
  const playerId = intent.playerIds?.[0] || null;
  const clubCode = preferredClubCode(intent, { ...article, userClubCode: options.userClubCode });

  const order = preference === 'player'
    ? ['player', 'stadium', 'club']
    : preference === 'competition'
      ? ['stadium', 'club', 'player']
      : ['stadium', 'player', 'club'];

  for (const kind of order) {
    if (kind === 'player' && playerId) {
      const media = await resolveNewsroomPlayerMedia(playerId);
      if (media?.url && !media.fallback) return { ...media, eventId: article?.eventId || intent.eventId || null };
    }
    if (kind === 'stadium' && clubCode) {
      const media = await resolveNewsroomStadiumMedia(clubCode);
      if (media?.url) return { ...media, eventId: article?.eventId || intent.eventId || null };
    }
    if (kind === 'club' && clubCode) {
      const media = await resolveNewsroomClubMedia(clubCode);
      if (media?.url) return { ...media, eventId: article?.eventId || intent.eventId || null };
    }
  }

  if (playerId) {
    const fallback = await resolveNewsroomPlayerMedia(playerId);
    if (fallback?.url) return { ...fallback, eventId: article?.eventId || intent.eventId || null };
  }
  return null;
}

export async function hydrateNewsroomMedia(newsroom, options = {}) {
  const feed = Array.isArray(newsroom?.feed) ? newsroom.feed : [];
  const hydrated = await Promise.all(feed.map(async article => ({
    ...article,
    media: await resolveNewsroomMedia(article, options)
  })));
  return {
    ...newsroom,
    feed: hydrated,
    lead: newsroom?.lead ? hydrated.find(article => article.id === newsroom.lead.id) || newsroom.lead : null
  };
}

export async function prefetchNewsroomMedia(newsroom, options = {}) {
  const feed = Array.isArray(newsroom?.feed) ? newsroom.feed.slice(0, Math.max(1, Number(options.limit) || 8)) : [];
  const media = await Promise.all(feed.map(article => resolveNewsroomMedia(article, options)));
  if (typeof Image === 'function') {
    for (const item of media) {
      for (const url of item?.candidates || [item?.url]) {
        if (!url) continue;
        const image = new Image();
        image.decoding = 'async';
        image.src = url;
      }
    }
  }
  return media.filter(Boolean);
}

export function clearNewsroomMediaCache() {
  cache = {};
  cacheLoaded = true;
  manifestPromise = null;
  try { globalThis.localStorage?.removeItem(CACHE_KEY); } catch {}
}

export const NEWSROOM_MEDIA_META = Object.freeze({
  playerSource: 'FotMob local portrait manifest',
  clubSource: 'official club logo service',
  stadiumSource: 'verified local pack then stadium media service',
  cacheDays: 30,
  invariant: 'reuse verified Touchline media before network resolution'
});
