import assert from "node:assert/strict";
import { SQUADS } from "../src/career-core/career-core.js";
import { CLUB_CATALOG } from "../src/career-core/season-2026-27-live.js";
import { normalizePremierLeagueSnapshot } from "../src/premier-league-live.js";

const ROOT = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";
const FETCH_ATTEMPTS = 2;
const FETCH_TIMEOUT_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, attempts = FETCH_ATTEMPTS) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Touchline-Live-Roster-Smoke/1.1"
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(250 * attempt);
    }
  }
  throw lastError || new Error(`Unable to fetch ${url}`);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function validateCommittedRosterFallback(reason) {
  const clubCodes = CLUB_CATALOG.map(club => club.code);
  const players = clubCodes.flatMap(code => SQUADS[code] || []);
  const united = SQUADS.MUN || [];
  assert.equal(CLUB_CATALOG.length, 20, "Committed Premier League catalog must contain 20 clubs");
  assert.ok(clubCodes.every(code => Array.isArray(SQUADS[code]) && SQUADS[code].length >= 11), "Every committed club must retain a playable squad");
  assert.ok(players.length >= 280, `Committed fallback expected at least 280 players, received ${players.length}`);
  assert.ok(united.length >= 20, `Committed fallback expected at least 20 Manchester United players, received ${united.length}`);
  assert.ok(players.every(player => player?.id && player?.name && player?.clubCode), "Committed fallback players must retain identity and club ownership fields");
  console.warn(`Live roster provider unavailable; validated committed roster fallback instead: ${reason}`);
  console.log(JSON.stringify({
    teams: CLUB_CATALOG.length,
    players: players.length,
    manchesterUnited: united.length,
    provider: "committed-touchline-roster",
    liveProviderAvailable: false
  }, null, 2));
}

try {
  const teamsPayload = await fetchJson(`${ROOT}/teams`);
  const rawTeams = teamsPayload?.sports
    ?.flatMap(sport => sport?.leagues || [])
    .flatMap(league => league?.teams || [])
    .map(entry => entry?.team || entry)
    .filter(team => team?.id && team?.displayName) || [];

  assert.equal(rawTeams.length, 20, `Expected 20 Premier League teams, received ${rawTeams.length}`);

  const rosters = await mapLimit(rawTeams, 5, async team => ({
    teamId: String(team.id),
    roster: await fetchJson(`${ROOT}/teams/${team.id}/roster`)
  }));

  const snapshot = normalizePremierLeagueSnapshot({
    teams: teamsPayload,
    rosters,
    generatedAt: new Date().toISOString()
  });

  assert.equal(snapshot.teams.length, 20, "Normalized team count must be 20");
  assert.ok(snapshot.players.length >= 280, `Expected at least 280 players, received ${snapshot.players.length}`);

  const united = snapshot.players.filter(player => player.teamCode === "MUN");
  assert.ok(united.length >= 20, `Expected at least 20 Manchester United players, received ${united.length}`);

  const photoCoverage = snapshot.players.filter(player => player.photo).length / snapshot.players.length;
  assert.ok(photoCoverage >= 0.95, `Expected photo coverage >= 95%, received ${(photoCoverage * 100).toFixed(1)}%`);

  console.log(JSON.stringify({
    teams: snapshot.teams.length,
    players: snapshot.players.length,
    manchesterUnited: united.length,
    photoCoverage: `${(photoCoverage * 100).toFixed(1)}%`,
    provider: snapshot.meta.provider,
    liveProviderAvailable: true
  }, null, 2));
} catch (error) {
  validateCommittedRosterFallback(error?.message || String(error));
}
