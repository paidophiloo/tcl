import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/career-newsroom-ui.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/career-newsroom-ui.css', import.meta.url), 'utf8');
const pressUi = await readFile(new URL('../src/career-newsroom-press-ui.js', import.meta.url), 'utf8');
const pressCss = await readFile(new URL('../src/career-newsroom-press-ui.css', import.meta.url), 'utf8');
const articleUi = await readFile(new URL('../src/career-newsroom-article-ui.js', import.meta.url), 'utf8');
const articleCss = await readFile(new URL('../src/career-newsroom-article-ui.css', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(index, /career-home-v2\.js[\s\S]*career-newsroom-ui\.js/, 'newsroom projection should mount after the existing home module');
assert.match(index, /career-newsroom-ui\.js[\s\S]*career-newsroom-press-ui\.js/, 'press UI should mount after the newsroom projection');
assert.match(index, /career-newsroom-press-ui\.js[\s\S]*career-newsroom-article-ui\.js/, 'article reader should mount after newsroom and press UI');
assert.match(ui, /const NEWS_ROUTE = 'news'/);
assert.match(ui, /const HOME_NEWS_SELECTOR = '\.tl-news-slide'/);
assert.match(ui, /resolveNewsroomMedia\(lead/);
assert.match(ui, /hydrateNewsroomMedia\(base/);
assert.match(ui, /buildNewsroomTicker\(newsroom/);
assert.match(ui, /newsroomArchive\(career\)/);
assert.match(ui, /slide\.dataset\.homeOpen = NEWS_ROUTE/);
assert.match(ui, /window\.location\.hash = NEWS_ROUTE/);
assert.match(ui, /data-newsroom-route/);
assert.match(ui, /button\.innerHTML = '<i>◆<\/i><span>Newsroom<\/span>'/);
assert.match(ui, /'player\.scoring-form': 'ARTILHEIRO EM ALTA'/, 'scorer-form story arc must have an explicit newsroom presentation');
assert.match(ui, /WORLD_PLAYER_BY_ID\.get\(arc\.facts\?\.playerId\)/, 'scorer-form story arc must resolve the actual player name');
assert.match(ui, /class="tn-archive-row" data-news-article=/, 'archive rows must expose article ids to the shared article reader');
assert.match(ui, /nav\.querySelectorAll\('\[data-route\]\.active'\)/, 'legacy home route must not stay highlighted while newsroom is active');
assert.match(ui, /newsroomRenderedKey === key && content\.querySelector\('\[data-touchline-newsroom\]'\)/, 'same snapshot should not recursively rerender itself');
assert.match(ui, /new MutationObserver\(scheduleProjection\)/);
assert.match(css, /\.cp-content\.cp-content-newsroom/);
assert.match(css, /\.tn-article\.is-featured/);
assert.match(css, /@media\(max-width:760px\)/);

assert.match(pressUi, /buildPressConference\(career\)/);
assert.match(pressUi, /recordPressResponse\(career, conference/);
assert.match(pressUi, /await repo\.save\(career\)/, 'press response must persist before newsroom refresh');
assert.match(pressUi, /data-press-answer/);
assert.match(pressUi, /manager quotes only enter the ledger after an explicit player-selected response/);
assert.match(pressCss, /\.tn-press-overlay/);
assert.match(pressCss, /\.tn-press-options>button\.is-selected/);

assert.match(articleUi, /article\.factualClaims/);
assert.match(articleUi, /eventFor\(career, article\)/);
assert.match(articleUi, /resolveNewsroomMedia\(article/);
assert.match(articleUi, /'career-performance-derivation': 'Análise factual de performance'/, 'performance stories must expose factual provenance');
assert.match(articleUi, /claim\.kind === 'performance'/, 'article reader must render verified performance claims');
assert.match(articleUi, /claim\.kind === 'milestone'/, 'article reader must render verified milestone claims');
assert.match(articleUi, /FactValidator ✓/);
assert.match(articleUi, /expanded articles display only persisted editorial copy and factual claims derived from ledger events/);
assert.match(articleCss, /\.tn-article-overlay/);
assert.match(articleCss, /\.tn-reader-proof/);

assert.doesNotMatch(ui, /Math\.random|Date\.now\(\).*title|fake|mock/i, 'newsroom UI must not fabricate editorial facts');
assert.doesNotMatch(pressUi, /Math\.random|fake|mock/i, 'press UI must only expose deterministic authored choices');
assert.doesNotMatch(articleUi, /Math\.random|fake|mock/i, 'expanded article reader must not fabricate facts');

console.log('career newsroom ui smoke: ok');
