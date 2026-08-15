import './career-newsroom-press-ui.css';
import { buildPressConference, recordPressResponse } from './career-core/newsroom-press.js';

const ROUTE = 'news';
let queued = false;
let installing = false;

function onNewsRoute() {
  return typeof window !== 'undefined' && window.location.hash.replace(/^#/, '') === ROUTE;
}

async function repository() {
  return import('./career-core/career-repository.js').then(module => module.CareerRepository);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function pressureLabel(value) {
  const pressure = Number(value) || 50;
  if (pressure >= 72) return 'Alta';
  if (pressure >= 55) return 'Crescente';
  if (pressure <= 32) return 'Baixa';
  return 'Normal';
}

function panelMarkup(conference, career) {
  const next = conference.questions[0];
  return `<section class="tn-press-panel" data-press-panel="${esc(conference.id)}">
    <header><span>COLETIVA</span><b>${conference.questions.length}</b></header>
    <strong>Imprensa aguardando</strong>
    <p>${esc(next?.prompt || 'Há perguntas aguardando resposta.')}</p>
    <div class="tn-press-meta"><span>Pressão da mídia</span><b>${esc(pressureLabel(career.pressState?.mediaPressure))}</b></div>
    <button type="button" data-press-open>Responder imprensa</button>
  </section>`;
}

function modalMarkup(conference) {
  const question = conference.questions[0];
  return `<div class="tn-press-overlay" data-press-overlay role="dialog" aria-modal="true" aria-labelledby="tn-press-question">
    <section class="tn-press-dialog">
      <header><div><span>TOUCHLINE MEDIA</span><strong>Coletiva pós-jogo</strong></div><button type="button" data-press-close aria-label="Fechar">×</button></header>
      <div class="tn-press-question">
        <small>PERGUNTA ${conference.answeredQuestionIds.length + 1}</small>
        <h2 id="tn-press-question">${esc(question.prompt)}</h2>
      </div>
      <div class="tn-press-options">${question.options.map(option => `<button type="button" data-press-answer data-question="${esc(question.id)}" data-option="${esc(option.id)}">
        <span>${esc(option.label)}</span>
        <p>${esc(option.quote)}</p>
        <small>${option.effect.morale > 0 ? `Moral +${option.effect.morale}` : option.effect.morale < 0 ? `Moral ${option.effect.morale}` : 'Moral estável'} · ${option.effect.pressure > 0 ? `Pressão +${option.effect.pressure}` : option.effect.pressure < 0 ? `Pressão ${option.effect.pressure}` : 'Pressão estável'}</small>
      </button>`).join('')}</div>
      <footer>Suas respostas são registradas no Event Ledger e podem repercutir no Newsroom.</footer>
    </section>
  </div>`;
}

function requestNewsroomRefresh() {
  const event = typeof HashChangeEvent === 'function'
    ? new HashChangeEvent('hashchange')
    : new Event('hashchange');
  window.dispatchEvent(event);
}

async function answerPress(career, conference, button) {
  if (button.disabled) return;
  button.disabled = true;
  const result = recordPressResponse(career, conference, button.dataset.question, button.dataset.option);
  if (!result) {
    button.disabled = false;
    return;
  }
  document.querySelectorAll('[data-press-answer]').forEach(candidate => { candidate.disabled = true; });
  button.classList.add('is-selected');
  const repo = await repository();
  await repo.save(career);
  document.querySelector('[data-press-overlay]')?.remove();
  document.querySelector('[data-press-panel]')?.remove();
  requestNewsroomRefresh();
}

function bindPressUI(career, conference, panel, page) {
  panel.querySelector('[data-press-open]')?.addEventListener('click', () => {
    page.querySelector('[data-press-overlay]')?.remove();
    page.insertAdjacentHTML('beforeend', modalMarkup(conference));
    const overlay = page.querySelector('[data-press-overlay]');
    overlay?.querySelector('[data-press-close]')?.addEventListener('click', () => overlay.remove());
    overlay?.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });
    overlay?.querySelectorAll('[data-press-answer]').forEach(button => {
      button.addEventListener('click', () => answerPress(career, conference, button));
    });
  });
}

async function installPressConference() {
  queued = false;
  if (installing || !onNewsRoute()) return;
  const page = document.querySelector('[data-touchline-newsroom]');
  const side = page?.querySelector('.tn-side-column');
  if (!page || !side) return;
  installing = true;
  try {
    const repo = await repository();
    const career = await repo.load();
    if (!career || !onNewsRoute() || !document.contains(page)) return;
    const conference = buildPressConference(career);
    const existing = side.querySelector('[data-press-panel]');
    if (!conference) {
      existing?.remove();
      page.querySelector('[data-press-overlay]')?.remove();
      return;
    }
    if (existing?.dataset.pressPanel === conference.id) return;
    existing?.remove();
    side.insertAdjacentHTML('afterbegin', panelMarkup(conference, career));
    const panel = side.querySelector('[data-press-panel]');
    if (panel) bindPressUI(career, conference, panel, page);
  } finally {
    installing = false;
  }
}

function schedule() {
  if (queued || typeof document === 'undefined') return;
  queued = true;
  queueMicrotask(installPressConference);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const root = document.querySelector('#app') || document.documentElement;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  schedule();
}

export const NEWSROOM_PRESS_UI_META = Object.freeze({
  route: ROUTE,
  invariant: 'manager quotes only enter the ledger after an explicit player-selected response'
});
