import {
  clearActiveCareerProfile,
  markStoragePersistence,
  readCareerSummary,
  recordCareerRoute,
  syncManagerProfileFromCareer
} from "./career-save-profile.js";

const CAREER_ROUTES = new Set(["home", "squad", "tactics", "calendar", "league", "inbox", "club", "jobs"]);

function routeFromLocation() {
  const route = location.hash.replace(/^#/, "");
  return CAREER_ROUTES.has(route) ? route : null;
}

function syncSession() {
  const summary = readCareerSummary();
  if (!summary.hasCareer) return;
  if (summary.career) syncManagerProfileFromCareer(summary.career);
  const route = routeFromLocation();
  if (route) recordCareerRoute(route);
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    const alreadyPersistent = await navigator.storage.persisted?.();
    const granted = alreadyPersistent || await navigator.storage.persist();
    markStoragePersistence(granted);
  } catch {
    // IndexedDB and the localStorage fallback remain available.
  }
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-reset]")) {
    clearActiveCareerProfile();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton?.dataset.route && CAREER_ROUTES.has(routeButton.dataset.route)) {
    recordCareerRoute(routeButton.dataset.route);
    return;
  }
  if (event.target.closest("[data-postmatch]")) recordCareerRoute("home");
}, true);

window.addEventListener("hashchange", syncSession);
window.addEventListener("pagehide", syncSession);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") syncSession();
});

syncSession();
void requestPersistentStorage();
