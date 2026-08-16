export const MANAGER_PROFILE_KEY = "touchline.manager.profile.v1";
export const LEGACY_CAREER_KEY = "touchline.career.mode.v1";
export const CAREER_FALLBACK_KEY = "touchline.career.v5.primary";
export const SAVE_RESET_MARKER_KEY = "touchline.career.reset.v5";

const VALID_ROUTES = new Set(["home", "squad", "tactics", "calendar", "league", "inbox", "club", "jobs"]);
const DEFAULT_MANAGER_NAME = "Gabriel Machado";
const DEFAULT_COUNTRY = "Brasil";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function readLocal(key, fallback = null) {
  try {
    return parseJson(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function normalizeRoute(route) {
  return VALID_ROUTES.has(route) ? route : "home";
}

function baseProfile(createdAt = nowIso()) {
  return {
    schemaVersion: 1,
    profileId: "manager-primary",
    managerName: DEFAULT_MANAGER_NAME,
    country: DEFAULT_COUNTRY,
    level: 1,
    xp: 0,
    activeSaveId: null,
    activeClubCode: null,
    activeClubName: null,
    employmentStatus: null,
    lastClubCode: null,
    seasonLabel: "2026/27",
    currentDate: null,
    lastRoute: "home",
    storagePersistent: null,
    createdAt,
    updatedAt: createdAt,
    lastPlayedAt: null
  };
}

function normalizeProfile(profile) {
  const fallback = baseProfile(profile?.createdAt || nowIso());
  return {
    ...fallback,
    ...(profile && typeof profile === "object" ? profile : {}),
    schemaVersion: 1,
    profileId: String(profile?.profileId || fallback.profileId),
    managerName: String(profile?.managerName || DEFAULT_MANAGER_NAME).trim() || DEFAULT_MANAGER_NAME,
    country: String(profile?.country || DEFAULT_COUNTRY).trim() || DEFAULT_COUNTRY,
    level: Math.max(1, Number(profile?.level) || 1),
    xp: Math.max(0, Number(profile?.xp) || 0),
    lastRoute: normalizeRoute(profile?.lastRoute)
  };
}

function resetLegacyCareerStorageOnce() {
  try {
    if (localStorage.getItem(SAVE_RESET_MARKER_KEY) === "done") return;
    const profile = normalizeProfile(readLocal(MANAGER_PROFILE_KEY));
    [
      LEGACY_CAREER_KEY,
      "touchline.career.v2.primary",
      "touchline.career.v3.primary",
      "touchline.career.v4.primary",
      CAREER_FALLBACK_KEY
    ].forEach(key => localStorage.removeItem(key));
    writeLocal(MANAGER_PROFILE_KEY, {
      ...profile,
      activeSaveId: null,
      activeClubCode: null,
      activeClubName: null,
      employmentStatus: null,
      lastClubCode: null,
      currentDate: null,
      lastRoute: "home",
      lastPlayedAt: null,
      updatedAt: nowIso()
    });
    localStorage.setItem(SAVE_RESET_MARKER_KEY, "done");
  } catch {}
  try {
    if ("indexedDB" in globalThis) indexedDB.deleteDatabase("touchline-career");
  } catch {}
}

resetLegacyCareerStorageOnce();

export function readManagerProfile() {
  const stored = readLocal(MANAGER_PROFILE_KEY);
  const profile = normalizeProfile(stored);
  if (!stored) writeLocal(MANAGER_PROFILE_KEY, profile);
  return profile;
}

export function writeManagerProfile(patch = {}) {
  const current = readManagerProfile();
  const next = normalizeProfile({
    ...current,
    ...patch,
    updatedAt: nowIso()
  });
  writeLocal(MANAGER_PROFILE_KEY, next);
  return next;
}

export function readCareerSummary() {
  const profile = readManagerProfile();
  const legacy = readLocal(LEGACY_CAREER_KEY, {}) || {};
  const career = readLocal(CAREER_FALLBACK_KEY, null);
  const unemployed = Boolean(career?.status === "unemployed" || career?.managerCareer?.status === "unemployed");
  const validCareer = Boolean([3, 4, 5].includes(career?.schemaVersion) && career?.saveId === "primary" && (career?.clubCode || unemployed));
  const lastClubCode = validCareer ? (career?.managerCareer?.lastClubCode || career?.formerClubCode || profile.lastClubCode || null) : profile.lastClubCode || null;
  const clubCode = validCareer ? (career.clubCode || null) : legacy.selectedClubCode || profile.activeClubCode || null;
  const clubName = validCareer
    ? (career.clubCode ? (legacy.selectedClubName || profile.activeClubName || career.clubCode) : null)
    : legacy.selectedClubName || profile.activeClubName || clubCode;
  const lastRoute = unemployed ? "jobs" : normalizeRoute(profile.lastRoute);

  return {
    hasCareer: validCareer,
    saveId: validCareer ? career.saveId : null,
    clubCode,
    clubName,
    lastClubCode,
    employmentStatus: validCareer ? (unemployed ? "unemployed" : "employed") : profile.employmentStatus,
    managerName: validCareer ? (career.managerName || profile.managerName) : profile.managerName,
    seasonLabel: validCareer ? (career.seasonLabel || "2026/27") : profile.seasonLabel || "2026/27",
    currentDate: validCareer ? (career.currentDate || null) : null,
    updatedAt: validCareer ? (career.updatedAt || null) : profile.updatedAt || null,
    lastRoute,
    profile,
    legacy,
    career: validCareer ? career : null
  };
}

export function ensureLegacyCareerPointer() {
  const summary = readCareerSummary();
  if (!summary.career) return summary;
  if (summary.employmentStatus === "unemployed") {
    writeLocal(LEGACY_CAREER_KEY, {
      ...(summary.legacy || {}),
      onboardingComplete: true,
      saveId: summary.career.saveId || "primary",
      managerName: summary.career.managerName || summary.profile.managerName,
      selectedClubCode: null,
      selectedClubName: null,
      managerCareerStatus: "unemployed",
      lastClubCode: summary.lastClubCode || null,
      careerSeason: summary.career.seasonLabel || "2026/27",
      careerStartedAt: summary.career.createdAt || nowIso(),
      careerUpdatedAt: summary.career.updatedAt || nowIso(),
      lastRoute: "jobs"
    });
    writeManagerProfile({
      managerName: summary.career.managerName || summary.profile.managerName,
      activeSaveId: summary.career.saveId || "primary",
      activeClubCode: null,
      activeClubName: null,
      employmentStatus: "unemployed",
      lastClubCode: summary.lastClubCode || null,
      seasonLabel: summary.career.seasonLabel || "2026/27",
      currentDate: summary.career.currentDate || null,
      lastRoute: "jobs",
      lastPlayedAt: nowIso()
    });
    return readCareerSummary();
  }
  if (!summary.career.clubCode) return summary;
  if (summary.legacy?.onboardingComplete && summary.legacy?.selectedClubCode === summary.career.clubCode && summary.legacy?.managerCareerStatus !== "unemployed") {
    return summary;
  }
  writeLocal(LEGACY_CAREER_KEY, {
    ...(summary.legacy || {}),
    onboardingComplete: true,
    saveId: summary.career.saveId || "primary",
    managerName: summary.career.managerName || summary.profile.managerName,
    selectedClubCode: summary.career.clubCode,
    selectedClubName: summary.profile.activeClubName || summary.career.clubCode,
    managerCareerStatus: "employed",
    lastClubCode: summary.lastClubCode || null,
    careerSeason: summary.career.seasonLabel || "2026/27",
    careerStartedAt: summary.career.createdAt || nowIso(),
    careerUpdatedAt: summary.career.updatedAt || nowIso(),
    lastRoute: summary.profile.lastRoute || "home"
  });
  return readCareerSummary();
}

export function activateCareerProfile(career, clubName = null) {
  if (!career?.clubCode) return readManagerProfile();
  return writeManagerProfile({
    managerName: career.managerName || readManagerProfile().managerName,
    activeSaveId: career.saveId || "primary",
    activeClubCode: career.clubCode,
    activeClubName: clubName || career.clubName || career.clubCode,
    employmentStatus: "employed",
    lastClubCode: career.managerCareer?.lastClubCode || career.formerClubCode || null,
    seasonLabel: career.seasonLabel || "2026/27",
    currentDate: career.currentDate || null,
    lastRoute: "home",
    lastPlayedAt: nowIso()
  });
}

export function syncManagerProfileFromCareer(career) {
  if (!career) return readManagerProfile();
  const unemployed = career.status === "unemployed" || career.managerCareer?.status === "unemployed";
  if (unemployed) {
    return writeManagerProfile({
      managerName: career.managerName || readManagerProfile().managerName,
      activeSaveId: career.saveId || "primary",
      activeClubCode: null,
      activeClubName: null,
      employmentStatus: "unemployed",
      lastClubCode: career.managerCareer?.lastClubCode || career.formerClubCode || null,
      seasonLabel: career.seasonLabel || "2026/27",
      currentDate: career.currentDate || null,
      lastRoute: "jobs",
      lastPlayedAt: nowIso()
    });
  }
  if (!career.clubCode) return readManagerProfile();
  return writeManagerProfile({
    managerName: career.managerName || readManagerProfile().managerName,
    activeSaveId: career.saveId || "primary",
    activeClubCode: career.clubCode,
    employmentStatus: "employed",
    lastClubCode: career.managerCareer?.lastClubCode || career.formerClubCode || null,
    seasonLabel: career.seasonLabel || "2026/27",
    currentDate: career.currentDate || null,
    lastPlayedAt: nowIso()
  });
}

export function recordCareerRoute(route) {
  const nextRoute = normalizeRoute(route);
  const summary = readCareerSummary();
  if (!summary.hasCareer) return summary.profile;
  return writeManagerProfile({
    lastRoute: nextRoute,
    lastPlayedAt: nowIso(),
    currentDate: summary.currentDate,
    activeSaveId: summary.saveId,
    activeClubCode: summary.clubCode,
    activeClubName: summary.clubName,
    employmentStatus: summary.employmentStatus,
    lastClubCode: summary.lastClubCode
  });
}

export function markStoragePersistence(granted) {
  return writeManagerProfile({ storagePersistent: Boolean(granted) });
}

export function clearActiveCareerProfile() {
  return writeManagerProfile({
    activeSaveId: null,
    activeClubCode: null,
    activeClubName: null,
    employmentStatus: null,
    lastClubCode: null,
    currentDate: null,
    lastRoute: "home",
    lastPlayedAt: null
  });
}
