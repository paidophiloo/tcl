import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/career-newsroom-ui.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/career-newsroom-ui.css', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(index, /career-home-v2\.js[\s\S]*career-newsroom-ui\.js/, 'newsroom projection should mount after the existing home module');
assert.match(ui, /const NEWS_ROUTE = 'news'/);
assert.match(ui, /const HOME_NEWS_SELECTOR = '\.tl-news-slide'/);
assert.match(ui, /resolveNewsroomMedia\(lead/);
assert.match(ui, /hydrateNewsroomMedia\(base/);
assert.match(ui, /buildNewsroomTicker\(newsroom/);
assert.match(ui, /newsroomArchive\(career\)/);
assert.match(ui, /slide\.dataset\.homeOpen = NEWS_ROUTE/);
assert.match(ui, /window\.location\.hash = NEWS_ROUTE/);
assert.match(ui, /newsroomRenderedKey === key && content\.querySelector\('\[data-touchline-newsroom\]'\)/, 'same snapshot should not recursively rerender itself');
assert.match(ui, /new MutationObserver\(scheduleProjection\)/);
assert.match(css, /\.cp-content\.cp-content-newsroom/);
assert.match(css, /\.tn-article\.is-featured/);
assert.match(css, /@media\(max-width:760px\)/);

assert.doesNotMatch(ui, /Math\.random|Date\.now\(\).*title|fake|mock/i, 'newsroom UI must not fabricate editorial facts');

console.log('career newsroom ui smoke: ok');
