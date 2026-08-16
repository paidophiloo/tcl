import assert from "node:assert/strict";

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
  clear() { values.clear(); }
};

localStorage.setItem("touchline.career.v2.primary", JSON.stringify({ schemaVersion: 3, saveId: "primary", clubCode: "OLD" }));
localStorage.setItem("touchline.career.mode.v1", JSON.stringify({ onboardingComplete: true, selectedClubCode: "OLD" }));

const {
  CAREER_FALLBACK_KEY,
  LEGACY_CAREER_KEY,
  MANAGER_PROFILE_KEY,
  SAVE_RESET_MARKER_KEY,
  activateCareerProfile,
  ensureLegacyCareerPointer,
  readCareerSummary,
  readManagerProfile,
  recordCareerRoute,
  syncManagerProfileFromCareer
} = await import("../src/career-save-profile.js");

assert.equal(localStorage.getItem("touchline.career.v2.primary"), null, "legacy v2 fallback must be reset once");
assert.equal(localStorage.getItem(LEGACY_CAREER_KEY), null, "legacy career pointer must be reset once");
assert.equal(localStorage.getItem(SAVE_RESET_MARKER_KEY), "done");

const profile = readManagerProfile();
assert.equal(profile.managerName, "Gabriel Machado");
assert.equal(profile.lastRoute, "home");
assert.ok(localStorage.getItem(MANAGER_PROFILE_KEY));
assert.equal(readCareerSummary().hasCareer, false);

const career = {
  schemaVersion: 5,
  saveId: "primary",
  clubCode: "MUN",
  managerName: "Gabriel Machado",
  seasonLabel: "2026/27",
  currentDate: "2026-07-01",
  createdAt: "2026-08-08T18:00:00.000Z",
  updatedAt: "2026-08-08T18:05:00.000Z"
};

localStorage.setItem(CAREER_FALLBACK_KEY, JSON.stringify(career));
localStorage.setItem(LEGACY_CAREER_KEY, JSON.stringify({
  onboardingComplete: true,
  selectedClubCode: "MUN",
  selectedClubName: "Manchester United",
  careerSeason: "2026/27"
}));
activateCareerProfile(career, "Manchester United");

let summary = readCareerSummary();
assert.equal(summary.hasCareer, true);
assert.equal(summary.clubCode, "MUN");
assert.equal(summary.clubName, "Manchester United");
assert.equal(summary.currentDate, "2026-07-01");
assert.equal(summary.employmentStatus, "employed");

recordCareerRoute("calendar");
summary = readCareerSummary();
assert.equal(summary.lastRoute, "calendar");

localStorage.removeItem(LEGACY_CAREER_KEY);
summary = ensureLegacyCareerPointer();
assert.equal(summary.hasCareer, true);
assert.equal(summary.legacy.selectedClubCode, "MUN");
assert.equal(summary.legacy.onboardingComplete, true);

const unemployedCareer = {
  ...career,
  clubCode: null,
  formerClubCode: "MUN",
  status: "unemployed",
  currentDate: "2026-10-18",
  managerCareer: {
    schemaVersion: 1,
    status: "unemployed",
    currentClubCode: null,
    lastClubCode: "MUN",
    reputation: 3.2
  }
};
localStorage.setItem(CAREER_FALLBACK_KEY, JSON.stringify(unemployedCareer));
syncManagerProfileFromCareer(unemployedCareer);
summary = ensureLegacyCareerPointer();
assert.equal(summary.hasCareer, true, "a manager without a club must still have a valid career save");
assert.equal(summary.clubCode, null);
assert.equal(summary.lastClubCode, "MUN");
assert.equal(summary.employmentStatus, "unemployed");
assert.equal(summary.lastRoute, "jobs");
assert.equal(summary.legacy.selectedClubCode, null, "legacy club pointer must be cleared so the dismissed club cannot remount as user-controlled");
assert.equal(summary.legacy.managerCareerStatus, "unemployed");
assert.equal(readManagerProfile().activeClubCode, null);
assert.equal(readManagerProfile().lastRoute, "jobs");

localStorage.removeItem(LEGACY_CAREER_KEY);
localStorage.removeItem(CAREER_FALLBACK_KEY);
summary = readCareerSummary();
assert.equal(summary.hasCareer, false, "profile metadata alone must not create a phantom career");

console.log(JSON.stringify({
  ok: true,
  managerName: profile.managerName,
  resumedRoute: "calendar",
  unemployedRoute: "jobs",
  saveSchema: 5,
  legacyReset: true,
  durableStores: ["IndexedDB", "localStorage"]
}, null, 2));
