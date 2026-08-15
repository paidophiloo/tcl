import './career-newsroom-article-ui.css';
import { resolveNewsroomMedia } from './career-core/newsroom-media.js';
import { CLUB_BY_CODE } from './career-core/season-2026-27-live.js';
import { WORLD_PLAYER_BY_ID } from './career-world/world-player-database.js';

const ROUTE = 'news';
let queued = false;
let boundPage = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function onNewsRoute() {
  return typeof window !== 'undefined' && window.location.hash.replace(/^#/, '') === ROUTE;
}

function clubName(code) {
  if (!code) return 'Agente livre';
  return CLUB_BY_CODE.get(code)?.name || code;
}

function playerName(id) {
  if (!id) return 'Jogador';
  return WORLD_PLAYER_BY_ID.get(id)?.name || id;
}

function money(value) {
  const amount = Number(value) || 0;
  if (!amount) return 'sem taxa de transferência';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
  }).format(amount);
}

function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value || '');
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function sourceLabel(source) {
  const labels = {
    'career-results-reconciliation': 'Motor de partidas',
    'match-engine': 'Motor de partidas',
    'living-world-ledger': 'Living World',
    'newsroom-press-conference': 'Coletiva do treinador',
    'availability-engine': 'Departamento médico'
  };
  return labels[source] || 'Touchline Event Ledger';
}

function claimText(claim) {
  if (claim.kind === 'score') {
    return `${clubName(claim.homeCode)} ${claim.homeGoals}–${claim.awayGoals} ${clubName(claim.awayCode)}`;
  }
  if (claim.kind === 'injury') {
    const names = (claim.playerIds || []).map(playerName).join(', ') || 'Jogador';
    return `${names}: ausência estimada de ${Number(claim.daysOut) || 0} dias`;
  }
  if (claim.kind === 'move') {
    return `${playerName(claim.playerId)}: ${clubName(claim.fromClubCode)} → ${clubName(claim.toClubCode)} · ${money(claim.fee)}`;
  }
  return null;
}

function eventFor(career, article) {
  return career?.eventLedger?.events?.find(event => event.id === article?.eventId) || null;
}

function articleFor(career, id) {
  return career?.newsroom?.feed?.find(article => article.id === id)
    || career?.newsroomArchive?.articles?.find(article => article.id === id)
    || null;
}

function factRows(article, event) {
  const rows = (article.factualClaims || []).map(claimText).filter(Boolean);
  if (event?.type === 'manager.press' && event.facts?.quote) rows.push(event.facts.quote);
  if (!rows.length) rows.push('O texto desta matéria foi produzido somente a partir do evento registrado no Event Ledger.');
  return rows;
}

function overlayMarkup(article, event, media) {
  const facts = factRows(article, event);
  const source = sourceLabel(event?.source);
  return `<div class="tn-article-overlay" data-article-overlay role="dialog" aria-modal="true" aria-labelledby="tn-article-title">
    <article class="tn-article-reader">
      <header class="tn-reader-top">
        <div><span>${esc(article.label || 'TOUCHLINE NEWS')}</span><small>${esc(dateLabel(article.gameDate))}</small></div>
        <button type="button" data-article-close aria-label="Fechar matéria">×</button>
      </header>
      <div class="tn-reader-hero">
        ${media?.url ? `<img src="${esc(media.url)}" alt="${esc(media.alt || article.title)}" decoding="async">` : '<div class="tn-reader-placeholder">T</div>'}
        <div><b>${esc(article.tier === 'lead' ? 'DESTAQUE' : article.tier === 'major' ? 'IMPORTANTE' : 'NEWS DESK')}</b><h1 id="tn-article-title">${esc(article.title)}</h1></div>
      </div>
      <div class="tn-reader-body">
        <section class="tn-reader-copy">
          <p class="tn-reader-deck">${esc(article.summary)}</p>
          <div class="tn-reader-rule"></div>
          <h2>O que está confirmado</h2>
          <ul>${facts.map(fact => `<li>${esc(fact)}</li>`).join('')}</ul>
          ${article.storyArcId ? '<p class="tn-reader-context">Esta matéria faz parte de uma história em curso detectada pelo Story Arc Engine.</p>' : ''}
        </section>
        <aside class="tn-reader-proof">
          <span>PROVENIÊNCIA</span>
          <strong>${esc(source)}</strong>
          <dl>
            <div><dt>Relevância</dt><dd>${Math.round(Number(article.newsworthiness) || 0)}/100</dd></div>
            <div><dt>Categoria</dt><dd>${esc(article.category === 'club' ? 'Seu clube' : 'Mundo')}</dd></div>
            <div><dt>Validação</dt><dd>FactValidator ✓</dd></div>
          </dl>
          <small>A interface não adiciona placares, transferências, lesões ou declarações que não existam no estado da carreira.</small>
        </aside>
      </div>
    </article>
  </div>`;
}

async function openArticle(articleId) {
  if (!onNewsRoute()) return;
  const { CareerRepository } = await import('./career-core/career-repository.js');
  const career = await CareerRepository.load();
  const article = articleFor(career, articleId);
  if (!article || !onNewsRoute()) return;
  const event = eventFor(career, article);
  const media = await resolveNewsroomMedia(article, { userClubCode: career.clubCode });
  if (!onNewsRoute()) return;
  document.querySelector('[data-article-overlay]')?.remove();
  document.body.insertAdjacentHTML('beforeend', overlayMarkup(article, event, media));
  const overlay = document.querySelector('[data-article-overlay]');
  overlay?.querySelector('[data-article-close]')?.addEventListener('click', () => overlay.remove());
  overlay?.addEventListener('click', eventClick => {
    if (eventClick.target === overlay) overlay.remove();
  });
  const escape = eventKey => {
    if (eventKey.key !== 'Escape') return;
    overlay?.remove();
    window.removeEventListener('keydown', escape);
  };
  window.addEventListener('keydown', escape);
}

function bindPage() {
  queued = false;
  if (!onNewsRoute()) {
    document.querySelector('[data-article-overlay]')?.remove();
    boundPage = null;
    return;
  }
  const page = document.querySelector('[data-touchline-newsroom]');
  if (!page || page === boundPage) return;
  boundPage = page;
  page.querySelectorAll('[data-news-article]').forEach(card => {
    card.classList.add('tn-article-openable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const open = () => openArticle(card.dataset.newsArticle);
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  });
}

function schedule() {
  if (queued || typeof document === 'undefined') return;
  queued = true;
  queueMicrotask(bindPage);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const root = document.querySelector('#app') || document.documentElement;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  schedule();
}

export const NEWSROOM_ARTICLE_UI_META = Object.freeze({
  route: ROUTE,
  invariant: 'expanded articles display only persisted editorial copy and factual claims derived from ledger events'
});
