import './career-manager-job-centre.css';
import { CareerRepository } from './career-core/career-repository.js';
import { advanceOneDay, formatDate } from './career-core/career-runtime.js';
import { CLUB_BY_CODE } from './career-core/season-2026-27-live.js';
import {
  acceptManagerJob,
  applyForManagerJob,
  declineManagerJob,
  managerJobMarketSnapshot
} from './career-world/managers/user-manager-career.js';
import {
  activateCareerProfile,
  ensureLegacyCareerPointer,
  syncManagerProfileFromCareer
} from './career-save-profile.js';

const app = document.querySelector('#app');
let rendering = false;
let processing = false;
let queued = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function unemployed(career) {
  return Boolean(career && (career.status === 'unemployed' || career.managerCareer?.status === 'unemployed') && !career.clubCode);
}

function clubName(code) {
  return CLUB_BY_CODE.get(code)?.name || code || 'Clube';
}

function crest(code) {
  if (!code) return '<span class="jm-crest jm-crest-empty">TL</span>';
  return `<span class="jm-crest"><img src="/assets/clubs/2026-27/${String(code).toLowerCase()}/crest.svg" alt="" onerror="this.remove()"><b>${esc(String(code).slice(0, 3))}</b></span>`;
}

function applicationLabel(application) {
  const labels = {
    pending: 'Em análise', offered: 'Proposta recebida', rejected: 'Recusada', closed: 'Vaga preenchida',
    expired: 'Proposta expirada', declined: 'Recusada por você', accepted: 'Aceita', withdrawn: 'Retirada'
  };
  return labels[application?.status] || application?.status || '—';
}

function vacancyCard(row, application) {
  const status = application?.status || null;
  const disabled = ['pending', 'offered'].includes(status);
  return `<article class="jm-vacancy ${status === 'offered' ? 'has-offer' : ''}">
    <header>${crest(row.clubCode)}<div><strong>${esc(row.clubName)}</strong><span>Premier League · Elo ${Math.round(row.elo)}</span></div><em>${Math.round(row.fitScore * 100)}% fit</em></header>
    <div class="jm-vacancy-meta"><span><small>VAGA ABERTA</small><b>${row.vacancyDays} dia${row.vacancyDays === 1 ? '' : 's'}</b></span><span><small>REPUTAÇÃO PEDIDA</small><b>${row.requiredReputation.toFixed(1)}/5</b></span></div>
    ${status ? `<p class="jm-application-state">${esc(applicationLabel(application))}${application.decisionDate && status === 'pending' ? ` · resposta prevista ${esc(application.decisionDate)}` : ''}</p>` : ''}
    <footer>${status === 'offered'
      ? `<button class="jm-primary" data-job-accept="${esc(row.clubCode)}">Aceitar proposta</button><button data-job-decline="${esc(row.clubCode)}">Recusar</button>`
      : `<button class="jm-primary" data-job-apply="${esc(row.clubCode)}" ${disabled ? 'disabled' : ''}>${status === 'pending' ? 'Candidatura enviada' : 'Candidatar-se'}</button>`}</footer>
  </article>`;
}

function applicationRows(snapshot) {
  const rows = [...snapshot.applications]
    .filter(application => !['accepted', 'withdrawn'].includes(application.status))
    .sort((left, right) => String(right.createdOn || '').localeCompare(String(left.createdOn || '')));
  if (!rows.length) return '<div class="jm-empty"><b>Nenhum processo ativo</b><span>Candidate-se apenas às vagas que fazem sentido para sua reputação atual.</span></div>';
  return rows.map(application => `<article class="jm-process ${application.status === 'offered' ? 'is-offer' : ''}">
    <div>${crest(application.clubCode)}<span><strong>${esc(clubName(application.clubCode))}</strong><small>${esc(applicationLabel(application))}</small></span></div>
    <b>${application.status === 'pending' ? esc(application.decisionDate || 'Em breve') : application.status === 'offered' ? `até ${esc(application.offerExpiresOn)}` : 'Encerrado'}</b>
  </article>`).join('');
}

function historyRows(career) {
  const rows = [...(career.managerCareer?.history || [])].slice(-5).reverse();
  if (!rows.length) return '<p class="jm-muted">A trajetória do treinador aparecerá aqui conforme a carreira evoluir.</p>';
  return rows.map(row => `<div class="jm-history-row"><time>${esc(row.date || row.closedOn || row.issuedOn || '')}</time><span>${row.type === 'dismissed' ? `Saiu do ${esc(clubName(row.clubCode))}` : row.type === 'appointed' ? `Assumiu o ${esc(clubName(row.clubCode))}` : row.type === 'ultimatum' ? `Ultimato: ${esc(row.outcome)}` : esc(row.type)}</span></div>`).join('');
}

function markup(career, snapshot) {
  const lastClub = snapshot.lastClubCode;
  const applications = new Map(snapshot.applications.map(application => [application.clubCode, application]));
  const vacancies = snapshot.vacancies;
  return `<main class="jm-page" data-manager-job-centre>
    <header class="jm-top">
      <div class="jm-brand"><b>TL</b><span>TOUCHLINE<small>MANAGER CAREER</small></span></div>
      <div class="jm-date"><small>DATA DO JOGO</small><strong>${esc(formatDate(career.currentDate))}</strong></div>
    </header>
    <section class="jm-hero">
      <div><small>STATUS DA CARREIRA</small><h1>Disponível para um novo projeto</h1><p>${esc(career.managerName || 'Treinador')} deixou o ${esc(clubName(lastClub))}, mas o mundo da temporada continua avançando normalmente. Clubes só aparecem aqui quando existe uma vaga real no Living World.</p></div>
      <aside><span><small>REPUTAÇÃO</small><b>${snapshot.reputation.toFixed(2)}<i>/5</i></b></span><span><small>ÚLTIMO CLUBE</small><b>${esc(lastClub || '—')}</b></span></aside>
    </section>
    <div class="jm-toolbar">
      <div><strong>Job Centre</strong><span>${vacancies.length} vaga${vacancies.length === 1 ? '' : 's'} aberta${vacancies.length === 1 ? '' : 's'} compatível${vacancies.length === 1 ? '' : 'is'} agora</span></div>
      <div><button data-job-advance="1">Avançar 1 dia</button><button class="jm-primary" data-job-advance="7">Avançar 7 dias</button></div>
    </div>
    <section class="jm-layout">
      <div class="jm-main">
        <header><small>VAGAS REAIS</small><h2>Clubes procurando treinador</h2></header>
        <div class="jm-vacancy-list">${vacancies.length ? vacancies.map(row => vacancyCard(row, applications.get(row.clubCode))).join('') : '<div class="jm-empty jm-empty-large"><b>Nenhuma vaga adequada hoje</b><span>Avance os dias. Demissões e contratações dos clubes continuam acontecendo no Living World, sem vagas roteirizadas para o jogador.</span></div>'}</div>
      </div>
      <aside class="jm-side">
        <section><header><small>PROCESSOS</small><h3>Suas candidaturas</h3></header>${applicationRows(snapshot)}</section>
        <section><header><small>TRAJETÓRIA</small><h3>Histórico do técnico</h3></header>${historyRows(career)}</section>
        <section class="jm-rule"><b>COMO FUNCIONA</b><p>Você compete apenas por vagas abertas. Reputação, força do clube, salto de nível e fit determinam a análise. A resposta demora alguns dias e a vaga pode ser preenchida por outro técnico antes da decisão.</p></section>
      </aside>
    </section>
    ${processing ? '<div class="jm-processing"><span></span><b>Avançando o mundo da carreira…</b></div>' : ''}
  </main>`;
}

async function loadUnemployedCareer() {
  const career = await CareerRepository.load();
  return unemployed(career) ? career : null;
}

async function render() {
  if (rendering || processing) return;
  rendering = true;
  try {
    const career = await loadUnemployedCareer();
    if (!career) return;
    if (location.hash !== '#jobs') history.replaceState(null, '', `${location.pathname}${location.search}#jobs`);
    const snapshot = managerJobMarketSnapshot(career, career.currentDate);
    app.innerHTML = markup(career, snapshot);
    bind(career);
  } finally {
    rendering = false;
  }
}

async function persist(career) {
  const saved = await CareerRepository.save(career);
  syncManagerProfileFromCareer(saved);
  ensureLegacyCareerPointer();
  return saved;
}

async function advance(career, days) {
  if (processing) return;
  processing = true;
  app.querySelector('[data-manager-job-centre]')?.classList.add('is-processing');
  try {
    for (let index = 0; index < days; index += 1) {
      advanceOneDay(career);
      if (career.managerCareer?.status !== 'unemployed') break;
    }
    await persist(career);
  } finally {
    processing = false;
    await render();
  }
}

function bind(career) {
  app.querySelectorAll('[data-job-apply]').forEach(button => button.addEventListener('click', async () => {
    const result = applyForManagerJob(career, button.dataset.jobApply, career.currentDate);
    if (!result) return;
    await persist(career);
    await render();
  }));
  app.querySelectorAll('[data-job-accept]').forEach(button => button.addEventListener('click', async () => {
    const clubCode = button.dataset.jobAccept;
    const appointment = acceptManagerJob(career, clubCode, career.currentDate);
    if (!appointment) return;
    const saved = await persist(career);
    activateCareerProfile(saved, appointment.clubName);
    ensureLegacyCareerPointer();
    history.replaceState(null, '', `${location.pathname}${location.search}#home`);
    location.reload();
  }));
  app.querySelectorAll('[data-job-decline]').forEach(button => button.addEventListener('click', async () => {
    if (!declineManagerJob(career, button.dataset.jobDecline, career.currentDate)) return;
    await persist(career);
    await render();
  }));
  app.querySelectorAll('[data-job-advance]').forEach(button => button.addEventListener('click', () => advance(career, Number(button.dataset.jobAdvance) || 1)));
}

function schedule() {
  if (queued) return;
  queued = true;
  queueMicrotask(async () => {
    queued = false;
    const career = await loadUnemployedCareer();
    if (!career) return;
    if (location.hash !== '#jobs') history.replaceState(null, '', `${location.pathname}${location.search}#jobs`);
    await render();
  });
}

if (typeof window !== 'undefined' && app) {
  new MutationObserver(() => {
    if (location.hash === '#jobs' || document.querySelector('[data-manager-job-centre]')) schedule();
  }).observe(app, { childList: true, subtree: false });
  window.addEventListener('hashchange', schedule);
  schedule();
}

export const MANAGER_JOB_CENTRE_UI_META = Object.freeze({
  route: 'jobs',
  invariant: 'an unemployed manager can only apply to persisted Living World vacancies and re-enters club control only after a deterministic accepted application and explicit offer acceptance'
});
