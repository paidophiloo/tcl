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
    'career-match-incidents': 'Linha do tempo da partida',
    'career-performance-derivation': 'Análise factual de performance',
    'career-season-record-derivation': 'Auditoria sazonal do Event Ledger',
    'match-engine': 'Motor de partidas',
    'living-world-ledger': 'Living World',
    'newsroom-press-conference': 'Coletiva do treinador',
    'availability-engine': 'Departamento médico'
  };
  return labels[source] || 'Touchline Event Ledger';
}

function scoreSuffix(score) {
  if (!score || !Number.isFinite(Number(score.homeGoals)) || !Number.isFinite(Number(score.awayGoals))) return '';
  return ` · placar ${Number(score.homeGoals)}–${Number(score.awayGoals)}`;
}

function milestoneText(item, clubCode) {
  if (item?.kind === 'first-club-goal') return `primeiro gol registrado pelo ${clubName(clubCode)}`;
  if (item?.kind === 'season-goals') return `${Number(item.value) || 0} gols na temporada`;
  return null;
}

function seasonRecordText(claim) {
  if (claim.recordKind === 'top-scorer-lead') {
    return `${playerName(claim.playerId)} assume a liderança isolada da artilharia da temporada com ${Number(claim.goals) || 0} gols`;
  }
  if (claim.recordKind === 'biggest-win-so-far') {
    return `${clubName(claim.homeCode)} ${Number(claim.homeGoals) || 0}–${Number(claim.awayGoals) || 0} ${clubName(claim.awayCode)} · margem de ${Number(claim.margin) || 0} gols, maior da temporada no save até esta data`;
  }
  if (claim.recordKind === 'highest-scoring-match-so-far') {
    return `${clubName(claim.homeCode)} ${Number(claim.homeGoals) || 0}–${Number(claim.awayGoals) || 0} ${clubName(claim.awayCode)} · ${Number(claim.totalGoals) || 0} gols, maior total da temporada no save até esta data`;
  }
  return 'Nova marca da temporada registrada a partir dos resultados canônicos do save';
}

function managerChangeText(claim) {
  const manager = claim.managerName || 'Treinador';
  if (claim.action === 'manager.under-pressure') {
    const band = claim.band === 'critical' ? 'crítico' : 'de pressão';
    const performance = Number.isFinite(Number(claim.ppg)) && Number.isFinite(Number(claim.expectedPpg))
      ? ` · ${Number(claim.ppg).toFixed(2)} PPG reais vs ${Number(claim.expectedPpg).toFixed(2)} esperados`
      : '';
    return `${manager}: confiança da diretoria em nível ${band} (${Number(claim.confidence) || 0}/100) no ${clubName(claim.clubCode)}${performance}`;
  }
  if (claim.action === 'manager.sacked') {
    const ppg = Number.isFinite(Number(claim.ppg)) ? ` · ${Number(claim.ppg).toFixed(2)} ponto(s) por jogo na amostra da revisão` : '';
    return `${manager} foi demitido pelo ${clubName(claim.clubCode)}${ppg}`;
  }
  if (claim.action === 'manager.poached') {
    return `${manager}: ${clubName(claim.fromClubCode)} → ${clubName(claim.clubCode)}${claim.tacticalStyle ? ` · estilo ${claim.tacticalStyle}` : ''}`;
  }
  return `${manager} assumiu o ${clubName(claim.clubCode)}${claim.tacticalStyle ? ` · estilo ${claim.tacticalStyle}` : ''}`;
}

function contractText(claim) {
  const player = playerName(claim.playerId);
  if (claim.action === 'contract.renewed') {
    return `${player} renovou com o ${clubName(claim.clubCode)}${claim.endDate ? ` até ${claim.endDate}` : ''}`;
  }
  if (claim.action === 'contract.renewal-rejected') {
    return `${player} e ${clubName(claim.clubCode)} encerraram a negociação sem acordo${claim.daysRemaining != null ? ` · ${Number(claim.daysRemaining) || 0} dias restantes no vínculo naquele momento` : ''}`;
  }
  if (claim.action === 'contract.expired') {
    return `${player} encerrou o contrato com o ${clubName(claim.clubCode)}${claim.freeAgent ? ' e tornou-se agente livre' : ''}`;
  }
  if (claim.action === 'contract.bosman-precontract-agreed') {
    return `${player}: pré-contrato acordado para sair do ${clubName(claim.fromClubCode)} e se juntar ao ${clubName(claim.toClubCode)}${claim.startsAt ? ` em ${claim.startsAt}` : ''}`;
  }
  return `${player}: atualização contratual registrada pelo Living World`;
}

function claimText(claim) {
  if (claim.kind === 'score') {
    return `${clubName(claim.homeCode)} ${claim.homeGoals}–${claim.awayGoals} ${clubName(claim.awayCode)}`;
  }
  if (claim.kind === 'goal') {
    const assist = claim.assistPlayerId ? `, assistência de ${playerName(claim.assistPlayerId)}` : '';
    const penalty = claim.isPenalty ? ' (pênalti)' : '';
    return `${Number(claim.minute) || 0}' — Gol de ${playerName(claim.playerId)} pelo ${clubName(claim.clubCode)}${penalty}${assist}${scoreSuffix(claim.scoreAfter)}`;
  }
  if (claim.kind === 'red-card') {
    return `${Number(claim.minute) || 0}' — Cartão vermelho para ${playerName(claim.playerId)} (${clubName(claim.clubCode)})${scoreSuffix(claim.scoreAtIncident)}`;
  }
  if (claim.kind === 'injury') {
    const names = (claim.playerIds || []).map(playerName).join(', ') || 'Jogador';
    const minute = claim.minute ? `${Number(claim.minute)}' — ` : '';
    const days = Number(claim.daysOut) || 0;
    return days ? `${minute}${names}: ausência estimada de ${days} dias` : `${minute}${names}: lesão registrada pelo departamento médico`;
  }
  if (claim.kind === 'move') {
    return `${playerName(claim.playerId)}: ${clubName(claim.fromClubCode)} → ${clubName(claim.toClubCode)} · ${money(claim.fee)}`;
  }
  if (claim.kind === 'manager-change') return managerChangeText(claim);
  if (claim.kind === 'contract') return contractText(claim);
  if (claim.kind === 'performance') {
    const pieces = [];
    if (Number(claim.goals) > 0) pieces.push(`${Number(claim.goals)} gol${Number(claim.goals) === 1 ? '' : 's'}`);
    if (Number(claim.assists) > 0) pieces.push(`${Number(claim.assists)} assistência${Number(claim.assists) === 1 ? '' : 's'}`);
    if ((claim.performanceTypes || []).includes('starter-shutout')) pieces.push('titular em partida em que a equipe não sofreu gols');
    const milestone = (claim.milestonesReached || []).map(item => milestoneText(item, claim.clubCode)).filter(Boolean);
    return `${playerName(claim.playerId)} (${clubName(claim.clubCode)}): ${pieces.join(' · ') || 'atuação registrada'}${milestone.length ? ` · ${milestone.join(' · ')}` : ''}`;
  }
  if (claim.kind === 'milestone') {
    const milestones = (claim.milestones || []).map(item => milestoneText(item, claim.clubCode)).filter(Boolean);
    return `${playerName(claim.playerId)}: ${milestones.join(' · ') || 'marco registrado'}${claim.seasonGoalsAfter != null ? ` · total da temporada: ${Number(claim.seasonGoalsAfter) || 0}` : ''}`;
  }
  if (claim.kind === 'season-record') return seasonRecordText(claim);
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
  return [...new Set(rows)];
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
          <small>A interface não adiciona placares, transferências, lesões, cartões, gols, marcos, recordes históricos, contratos, trocas de treinador, pressão da diretoria ou declarações que não existam no estado da carreira.</small>
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
