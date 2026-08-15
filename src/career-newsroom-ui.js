import './career-newsroom-ui.css';
import { buildNewsroomTicker, newsroomArchive } from './career-core/newsroom-archive.js';
import { hydrateNewsroomMedia, prefetchNewsroomMedia, resolveNewsroomMedia } from './career-core/newsroom-media.js';

const NEWS_ROUTE = 'news';
const HOME_NEWS_SELECTOR = '.tl-news-slide';
const CONTENT_SELECTOR = '.cp-content';
let installQueued = false;
let renderToken = 0;
let lastHomeEventId = null;
let newsroomRenderedKey = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function route() {
  return browserReady() ? window.location.hash.replace(/^#/, '') : '';
}

function formatGameDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value || '');
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace('.', '');
}

function relativeDate(article, career) {
  if (article?.timestamp && article.timestamp !== article.gameDate) return article.timestamp;
  if (article?.gameDate === career?.currentDate) return 'Hoje';
  return formatGameDate(article?.gameDate);
}

async function loadCareer() {
  const { CareerRepository } = await import('./career-core/career-repository.js');
  return CareerRepository.load();
}

function leadFallbackImage(career) {
  const code = String(career?.clubCode || 'MUN').toLowerCase();
  return `/assets/clubs/2026-27/${code}/stadium.webp`;
}

function ensureNewsNavigation() {
  const nav = document.querySelector('.cp-side nav');
  if (!nav) return;
  let button = nav.querySelector('[data-newsroom-route]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.newsroomRoute = NEWS_ROUTE;
    button.innerHTML = '<i>◆</i><span>Newsroom</span>';
    button.addEventListener('click', () => { window.location.hash = NEWS_ROUTE; });
    const inbox = nav.querySelector('[data-route="inbox"]');
    if (inbox) nav.insertBefore(button, inbox);
    else nav.append(button);
  }
  const active = route() === NEWS_ROUTE;
  button.classList.toggle('active', active);
  if (active) nav.querySelectorAll('[data-route].active').forEach(item => item.classList.remove('active'));
}

async function hydrateHomeCard() {
  const slide = document.querySelector(HOME_NEWS_SELECTOR);
  if (!slide || route() === NEWS_ROUTE) return;
  const career = await loadCareer();
  const lead = career?.newsroom?.lead;
  if (!lead || !document.contains(slide)) return;

  const image = slide.querySelector('.tl-news-image img');
  const label = slide.querySelector('article header b');
  const time = slide.querySelector('article header time');
  const title = slide.querySelector('article h3');
  const summary = slide.querySelector('article p');
  const credit = slide.querySelector('article footer span');
  const byline = slide.querySelector('article footer b');

  if (label) label.textContent = lead.label || 'TOUCHLINE NEWS';
  if (time) time.textContent = relativeDate(lead, career);
  if (title) title.textContent = lead.title || 'Touchline News';
  if (summary) summary.textContent = lead.summary || '';
  if (byline) byline.textContent = 'Touchline Newsroom';
  if (credit) credit.textContent = 'Fatos verificados pelo Event Ledger';

  slide.dataset.newsroomEventId = lead.eventId || '';
  slide.dataset.homeOpen = NEWS_ROUTE;
  slide.setAttribute('role', 'button');
  slide.setAttribute('tabindex', '0');
  slide.setAttribute('aria-label', `Abrir Touchline Newsroom: ${lead.title || 'notícia principal'}`);
  slide.classList.add('tl-newsroom-live');

  if (lastHomeEventId !== lead.eventId || !image?.dataset.newsroomResolved) {
    const media = await resolveNewsroomMedia(lead, { userClubCode: career.clubCode });
    if (image && document.contains(image)) {
      image.src = media?.url || leadFallbackImage(career);
      image.alt = media?.alt || lead.title || 'Touchline News';
      image.dataset.newsroomResolved = 'true';
      if (media?.candidates?.[1]) image.dataset.fallback = media.candidates[1];
    }
    lastHomeEventId = lead.eventId || null;
  }

  if (!slide.dataset.newsroomBound) {
    slide.dataset.newsroomBound = 'true';
    slide.addEventListener('click', event => {
      if (event.target.closest('button,a')) return;
      window.location.hash = NEWS_ROUTE;
    });
    slide.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.hash = NEWS_ROUTE;
      }
    });
  }
}

function storyArcMarkup(arc) {
  if (!arc) return '';
  const labels = {
    'form.winning-streak': 'EM ALTA',
    'form.losing-streak': 'SOB PRESSÃO',
    'squad.injury-pressure': 'ELENCO',
    'club.transfer-activity': 'MERCADO'
  };
  const title = arc.type === 'form.winning-streak'
    ? `${arc.facts?.streak || 0} vitórias seguidas`
    : arc.type === 'form.losing-streak'
      ? `${arc.facts?.streak || 0} derrotas seguidas`
      : arc.type === 'squad.injury-pressure'
        ? `${arc.facts?.activeInjuries || 0} desfalques ativos`
        : `${arc.facts?.activity || 0} movimentos recentes`;
  return `<aside class="tn-story-arc">
    <span>${esc(labels[arc.type] || 'HISTÓRIA EM CURSO')}</span>
    <strong>${esc(title)}</strong>
    <div><i style="width:${Math.max(8, Math.min(100, Number(arc.strength) || 0))}%"></i></div>
    <small>A narrativa evolui apenas a partir de eventos registrados no save.</small>
  </aside>`;
}

function articleCard(article, featured = false) {
  const media = article.media;
  return `<article class="tn-article ${featured ? 'is-featured' : ''}" data-news-article="${esc(article.id)}">
    <div class="tn-article-media">
      ${media?.url ? `<img src="${esc(media.url)}" alt="${esc(media.alt || article.title)}" loading="${featured ? 'eager' : 'lazy'}" decoding="async">` : '<div class="tn-media-placeholder">T</div>'}
      <span>${esc(article.label || 'NOTÍCIAS')}</span>
    </div>
    <div class="tn-article-copy">
      <header><b>${esc(article.tier === 'lead' ? 'DESTAQUE' : article.tier === 'major' ? 'IMPORTANTE' : 'NEWS DESK')}</b><time>${esc(formatGameDate(article.gameDate))}</time></header>
      <h2>${esc(article.title)}</h2>
      <p>${esc(article.summary)}</p>
      <footer><span>${Math.round(Number(article.newsworthiness) || 0)} relevância</span><span>${esc(media?.source || 'Touchline Event Ledger')}</span></footer>
    </div>
  </article>`;
}

function archiveRows(articles) {
  if (!articles.length) return '<div class="tn-empty">Nenhuma matéria arquivada ainda.</div>';
  return articles.slice(0, 14).map(article => `<article class="tn-archive-row">
    <time>${esc(formatGameDate(article.gameDate || article.archivedOn))}</time>
    <div><span>${esc(article.label || 'NOTÍCIAS')}</span><strong>${esc(article.title)}</strong></div>
    <b>${esc(article.tier || 'wire')}</b>
  </article>`).join('');
}

function newsroomMarkup(career, newsroom) {
  const lead = newsroom.lead;
  const rest = newsroom.feed.filter(article => article.id !== lead?.id).slice(0, 7);
  const ticker = buildNewsroomTicker(newsroom, { limit: 8 });
  const archive = newsroomArchive(career).filter(article => !newsroom.feed.some(current => current.eventId === article.eventId));
  return `<main class="tn-page" data-touchline-newsroom>
    <header class="tn-topbar">
      <button type="button" data-news-back aria-label="Voltar para início">←</button>
      <div><span>TOUCHLINE</span><strong>NEWSROOM</strong><small>O mundo da sua carreira, contado pelos fatos</small></div>
      <aside><small>DATA DO JOGO</small><b>${esc(formatGameDate(career.currentDate))}</b></aside>
    </header>

    ${ticker.length ? `<div class="tn-ticker"><b>AGORA</b><div>${ticker.map(item => `<span>${esc(item.title)}</span>`).join('')}</div></div>` : ''}

    <section class="tn-layout">
      <div class="tn-main-column">
        ${lead ? articleCard(lead, true) : `<section class="tn-empty tn-empty-lead"><strong>Newsroom aguardando acontecimentos</strong><p>Jogue, avance os dias e deixe o mundo da carreira produzir histórias reais.</p></section>`}
        ${rest.length ? `<section class="tn-grid">${rest.map(article => articleCard(article)).join('')}</section>` : ''}
      </div>
      <aside class="tn-side-column">
        ${storyArcMarkup(newsroom.activeStoryArc)}
        <section class="tn-desk-status"><span>NEWS DESK</span><strong>${newsroom.feed.length} pautas ativas</strong><p>Cada manchete passa por FactValidator e pontuação de relevância antes de aparecer.</p><div><i></i><b>EVENT LEDGER ONLINE</b></div></section>
        <section class="tn-archive"><header><span>ARQUIVO</span><b>${career.newsroomArchive?.articles?.length || 0}</b></header>${archiveRows(archive)}</section>
      </aside>
    </section>
  </main>`;
}

async function renderNewsroomPage() {
  if (route() !== NEWS_ROUTE) return false;
  const content = document.querySelector(CONTENT_SELECTOR);
  if (!content) return false;
  const token = ++renderToken;
  const career = await loadCareer();
  if (token !== renderToken || route() !== NEWS_ROUTE || !career) return false;
  const base = career.newsroom || { feed: [], lead: null, activeStoryArc: null, generatedForDate: career.currentDate };
  const hydrated = await hydrateNewsroomMedia(base, { userClubCode: career.clubCode });
  if (token !== renderToken || route() !== NEWS_ROUTE) return false;

  const key = `${career.storageRevision || 0}:${career.currentDate}:${hydrated.feed.map(item => item.eventId).join('|')}`;
  if (newsroomRenderedKey === key && content.querySelector('[data-touchline-newsroom]')) return true;
  newsroomRenderedKey = key;
  content.classList.remove('cp-content-home-v2');
  content.classList.add('cp-content-newsroom');
  content.innerHTML = newsroomMarkup(career, hydrated);
  content.querySelector('[data-news-back]')?.addEventListener('click', () => { window.location.hash = 'home'; });
  prefetchNewsroomMedia(hydrated, { userClubCode: career.clubCode, limit: 8 }).catch(() => {});
  return true;
}

async function installProjection() {
  installQueued = false;
  if (!browserReady()) return;
  ensureNewsNavigation();
  if (route() === NEWS_ROUTE) {
    await renderNewsroomPage();
    ensureNewsNavigation();
    return;
  }
  document.querySelector(CONTENT_SELECTOR)?.classList.remove('cp-content-newsroom');
  await hydrateHomeCard();
  ensureNewsNavigation();
}

function scheduleProjection() {
  if (!browserReady() || installQueued) return;
  installQueued = true;
  queueMicrotask(installProjection);
}

if (browserReady()) {
  const root = document.querySelector('#app') || document.documentElement;
  new MutationObserver(scheduleProjection).observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => {
    newsroomRenderedKey = null;
    scheduleProjection();
  });
  scheduleProjection();
}

export const NEWSROOM_UI_META = Object.freeze({
  route: NEWS_ROUTE,
  homeSelector: HOME_NEWS_SELECTOR,
  invariant: 'project persistent newsroom data into existing career UI without changing match/calendar rendering'
});
