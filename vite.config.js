import { defineConfig, loadEnv } from "vite";

const API_ROOT = "https://api.football-data.org/v4";
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function getCached(key) {
  const item = cache.get(key);
  if (!item || Date.now() - item.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.payload;
}

function setCached(key, payload) {
  cache.set(key, { createdAt: Date.now(), payload });
}

async function fetchFootballData(pathname, apiKey) {
  const cached = getCached(pathname);
  if (cached) return cached;

  const upstream = await fetch(`${API_ROOT}${pathname}`, {
    headers: {
      "X-Auth-Token": apiKey,
      "User-Agent": "Touchline-Matchday-Prototype/0.3"
    }
  });

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = new Error(payload.message || `Football Data respondeu ${upstream.status}`);
    error.status = upstream.status;
    throw error;
  }

  setCached(pathname, payload);
  return payload;
}

function footballDataProxy(apiKey) {
  return {
    name: "touchline-football-data-proxy",
    configureServer(server) {
      server.middlewares.use("/api/football-data", async (request, response) => {
        const url = new URL(request.url || "/", "http://touchline.local");

        if (url.pathname === "/status") {
          sendJson(response, 200, {
            configured: Boolean(apiKey),
            provider: "football-data.org",
            competition: "PL"
          });
          return;
        }

        if (!apiKey) {
          sendJson(response, 503, {
            configured: false,
            code: "FOOTBALL_DATA_KEY_MISSING",
            message: "Configure FOOTBALL_DATA_API_KEY em .env.local."
          });
          return;
        }

        try {
          if (url.pathname === "/competition") {
            const payload = await fetchFootballData("/competitions/PL/teams", apiKey);
            sendJson(response, 200, payload);
            return;
          }

          if (url.pathname === "/team") {
            const teamId = Number(url.searchParams.get("id"));
            if (!Number.isInteger(teamId) || teamId < 1 || teamId > 999999) {
              sendJson(response, 400, { message: "Team id inválido." });
              return;
            }
            const payload = await fetchFootballData(`/teams/${teamId}`, apiKey);
            sendJson(response, 200, payload);
            return;
          }

          sendJson(response, 404, { message: "Endpoint não encontrado." });
        } catch (error) {
          sendJson(response, error.status || 502, {
            message: error.message,
            provider: "football-data.org"
          });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [footballDataProxy(env.FOOTBALL_DATA_API_KEY)],
    server: {
      host: "0.0.0.0"
    }
  };
});
