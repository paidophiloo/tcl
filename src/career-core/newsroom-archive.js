const ARCHIVE_SCHEMA_VERSION = 1;
const DEFAULT_MAX_ARTICLES = 480;
const DEFAULT_TICKER_LIMIT = 8;

export const NEWSROOM_ARCHIVE_SCHEMA_VERSION = ARCHIVE_SCHEMA_VERSION;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function articleKey(article) {
  return article?.eventId || article?.id || null;
}

export function ensureNewsroomArchive(career) {
  if (!career || typeof career !== 'object') return career;
  const existing = career.newsroomArchive;
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    const legacy = Array.isArray(career.news) ? career.news : [];
    career.newsroomArchive = {
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      articles: legacy.map(clone),
      seenEventIds: legacy.map(articleKey).filter(Boolean),
      updatedOn: career.currentDate || null
    };
    return career;
  }
  existing.schemaVersion = ARCHIVE_SCHEMA_VERSION;
  existing.articles = Array.isArray(existing.articles) ? existing.articles : [];
  existing.seenEventIds = Array.isArray(existing.seenEventIds)
    ? [...new Set(existing.seenEventIds.filter(Boolean))]
    : [...new Set(existing.articles.map(articleKey).filter(Boolean))];
  if (!existing.updatedOn) existing.updatedOn = career.currentDate || null;
  return career;
}

export function archiveNewsroomSnapshot(career, newsroom, options = {}) {
  ensureNewsroomArchive(career);
  if (!career?.newsroomArchive) return [];
  const archive = career.newsroomArchive;
  const maxArticles = Math.max(40, Number(options.maxArticles) || DEFAULT_MAX_ARTICLES);
  const seen = new Set(archive.seenEventIds);
  const added = [];
  for (const article of Array.isArray(newsroom?.feed) ? newsroom.feed : []) {
    const key = articleKey(article);
    if (!key || seen.has(key)) continue;
    const snapshot = {
      ...clone(article),
      archivedOn: newsroom?.generatedForDate || career.currentDate || article.gameDate || null
    };
    archive.articles.push(snapshot);
    archive.seenEventIds.push(key);
    seen.add(key);
    added.push(snapshot);
  }
  if (archive.articles.length > maxArticles) {
    archive.articles = archive.articles.slice(-maxArticles);
    archive.seenEventIds = [...new Set(archive.articles.map(articleKey).filter(Boolean))];
  }
  archive.updatedOn = newsroom?.generatedForDate || career.currentDate || archive.updatedOn || null;
  career.news = archive.articles.slice(-50).map(clone);
  return added;
}

export function newsroomArchive(career, options = {}) {
  ensureNewsroomArchive(career);
  let articles = [...(career?.newsroomArchive?.articles || [])];
  if (options.category) articles = articles.filter(article => article.category === options.category);
  if (options.tier) articles = articles.filter(article => article.tier === options.tier);
  if (options.since) articles = articles.filter(article => String(article.gameDate || article.archivedOn || '') >= options.since);
  return articles.sort((a, b) => String(b.gameDate || b.archivedOn || '').localeCompare(String(a.gameDate || a.archivedOn || '')));
}

export function buildNewsroomTicker(newsroom, options = {}) {
  const limit = Math.max(1, Number(options.limit) || DEFAULT_TICKER_LIMIT);
  const feed = Array.isArray(newsroom?.feed) ? newsroom.feed : [];
  return feed
    .filter(article => article?.title)
    .sort((a, b) => (b.newsworthiness || 0) - (a.newsworthiness || 0))
    .slice(0, limit)
    .map(article => ({
      id: `ticker-${article.id}`,
      articleId: article.id,
      eventId: article.eventId || null,
      label: article.label || 'NOTÍCIAS',
      title: article.title,
      tier: article.tier || 'wire',
      gameDate: article.gameDate || newsroom?.generatedForDate || null
    }));
}
