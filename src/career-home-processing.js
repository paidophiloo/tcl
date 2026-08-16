import { advanceOneDay, formatDate, nextUserFixture, normalizeCareer } from './career-core/career-runtime.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';
import { ensureLegacyCareerPointer, syncManagerProfileFromCareer } from './career-save-profile.js';
import { CLUB_BY_CODE, FIXTURES } from './career-core/season-2026-27.js';
import { PLAYER_BY_ID } from './career-core/career-core.js';
import { isFriendlyFixture, resolveFriendlyClub } from './career-core/friendly-engine.js';

const app = document.querySelector('#app');
const DAY_MS = 86_400_000;
const MAX_PREVIEW_DAYS = 500;
const EVENT_PRIORITY = Object.freeze({
  TRANSFER_COMPLETED: 100, TRANSFER_OFFER_RECEIVED: 96,
  PLAYER_INJURED: 90, INJURY_SUSTAINED: 90, CONTRACT_EXPIRED: 82,
  TRANSFER_OFFER_ACCEPTED: 70, TRANSFER_NEGOTIATION_ENDED: 54,
  TRANSFER_ENQUIRY: 42, TRANSFER_INTEREST_REGISTERED: 34, PLAYER_TRANSFER_LISTED: 22
});
const NEWS_TYPES = new Set(Object.keys(EVENT_PRIORITY));
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' });
const monthFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' });
const shortFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' });

let processing = false;
let passThrough = false;
let layer = null;
let patchQueued = false;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const dateObj = iso => { const [y,m,d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y,m-1,d)); };
const addDays = (iso, days) => new Date(dateObj(iso).getTime() + days * DAY_MS).toISOString().slice(0,10);
const daysBetween = (a,b) => Math.max(0, Math.round((dateObj(b) - dateObj(a)) / DAY_MS));
const weekday = iso => weekdayFmt.format(dateObj(iso)).replaceAll('.','').toUpperCase();
const month = iso => monthFmt.format(dateObj(iso)).replaceAll('.','').toUpperCase();
const shortDate = iso => shortFmt.format(dateObj(iso)).replaceAll('.','').toUpperCase();
const isHome = () => !location.hash || location.hash === '#home';

function club(career, code) {
  if (!code) return { name:'Clube', shortName:'Clube' };
  return CLUB_BY_CODE.get(code) || resolveFriendlyClub(career, code) || { name:String(code), shortName:String(code) };
}
const clubName = (career, code) => club(career, code).shortName || club(career, code).name;
const playerName = id => PLAYER_BY_ID.get(id)?.name || 'Jogador';
function money(value) {
  const n = Number(value) || 0;
  if (n >= 1e6) return `£${(n/1e6).toFixed(n >= 1e7 ? 1 : 2).replace('.0','')}M`;
  if (n >= 1e3) return `£${Math.round(n/1e3)}k`;
  return `£${n}`;
}

function eventStory(career, event) {
  if (!event) return null;
  const e = event.entities || {}, p = event.payload || {};
  const player = playerName(e.playerId);
  const buyer = clubName(career, e.buyerCode || e.toClubCode);
  const seller = clubName(career, e.sellerCode || e.fromClubCode || e.clubCode);
  const base = { date:event.date, kind:'transfer', category:'MERCADO' };
  switch (event.type) {
    case 'TRANSFER_COMPLETED': return { ...base, title:`${player} troca ${seller} por ${buyer}`, body:`${buyer} concluiu a contratação por ${money(p.fee)}. O jogador já passa a integrar o elenco usado pela simulação.`, activity:`${buyer} fechou ${player} por ${money(p.fee)}` };
    case 'TRANSFER_OFFER_RECEIVED': return { ...base, kind:'decision', category:'DECISÃO', title:`${buyer} envia proposta por ${player}`, body:`Chegou uma oferta formal de ${money(p.fee)}. A negociação também entra na caixa de entrada do clube.`, activity:`Proposta por ${player}: ${money(p.fee)}` };
    case 'TRANSFER_OFFER_ACCEPTED': return { ...base, title:`${seller} aceita proposta por ${player}`, body:`${buyer} avançou para termos pessoais após acordo de ${money(p.fee)} entre os clubes.`, activity:`${seller} aceitou ${money(p.fee)} por ${player}` };
    case 'TRANSFER_ENQUIRY': return { ...base, title:`${buyer} consulta ${seller} por ${player}`, body:'O interesse virou contato entre clubes. Ainda não existe acordo formal.', activity:`${buyer} consultou ${seller} por ${player}` };
    case 'TRANSFER_INTEREST_REGISTERED': return { ...base, title:`${buyer} acompanha ${player}`, body:'O departamento de recrutamento abriu uma movimentação real no mercado.', activity:`${buyer} iniciou movimentos por ${player}` };
    case 'TRANSFER_NEGOTIATION_ENDED': return { ...base, title:`Negociação por ${player} chega ao fim`, body:`As conversas entre ${buyer} e ${seller} terminaram sem transferência.`, activity:`Negociação por ${player} encerrada` };
    case 'PLAYER_TRANSFER_LISTED': return { ...base, title:`${seller} coloca ${player} no mercado`, body:'A análise do elenco marcou o jogador como negociável e ele fica mais exposto a clubes com necessidade compatível.', activity:`${player} foi colocado à venda pelo ${seller}` };
    case 'CONTRACT_EXPIRED': return { ...base, kind:'contract', category:'CONTRATOS', title:`${player} deixa ${seller} ao fim do contrato`, body:'O vínculo terminou e o jogador deixou o elenco ativo.', activity:`Contrato de ${player} chegou ao fim` };
    case 'PLAYER_INJURED': case 'INJURY_SUSTAINED': return { ...base, kind:'injury', category:'DEP. MÉDICO', title:`${player} sofre problema físico`, body:'O departamento médico atualizou a disponibilidade do atleta.', activity:`${player} entrou no departamento médico` };
    default: return null;
  }
}

function matchStory(career, fixture, result) {
  const home = clubName(career, fixture.home), away = clubName(career, fixture.away);
  return { kind:'match', category:isFriendlyFixture(fixture)?'PRÉ-TEMPORADA':'RESULTADO', date:fixture.date,
    title:`${home} ${result.homeGoals}–${result.awayGoals} ${away}`,
    body:isFriendlyFixture(fixture)?'O amistoso foi processado e já faz parte do histórico da pré-temporada.':'A partida já afeta tabela, forma e narrativa da temporada.',
    activity:`${home} ${result.homeGoals}–${result.awayGoals} ${away}` };
}

function dailyStory(career, date, beforeResults, summary) {
  const event = (career.world?.events || []).filter(x => x.date === date && NEWS_TYPES.has(x.type))
    .sort((a,b) => (EVENT_PRIORITY[b.type]||0)-(EVENT_PRIORITY[a.type]||0) || (b.sequence||0)-(a.sequence||0))[0];
  if (event) return eventStory(career, event);
  const fresh = FIXTURES.filter(f => career.results?.[f.id] && !beforeResults.has(f.id)).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if (fresh) return matchStory(career, fresh, career.results[fresh.id]);
  const opened = Number(summary?.transferMarket?.opened)||0, completed = Number(summary?.transferMarket?.completed)||0;
  if (completed) return { kind:'routine', activity:`${completed} transferência${completed===1?'':'s'} concluída${completed===1?'':'s'} hoje` };
  if (opened) return { kind:'routine', activity:`${opened} nova${opened===1?'':'s'} negociação${opened===1?'':'ões'} aberta${opened===1?'':'s'} no mercado` };
  return { kind:'routine', activity:'Treinos, condição, contratos e mercado processados' };
}

function latestStory(career) {
  const event = [...(career.world?.events || [])].filter(x => NEWS_TYPES.has(x.type) && (EVENT_PRIORITY[x.type]||0)>=40)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || (EVENT_PRIORITY[b.type]||0)-(EVENT_PRIORITY[a.type]||0) || (b.sequence||0)-(a.sequence||0))[0];
  const eStory = eventStory(career, event);
  const fixture = FIXTURES.filter(f => career.results?.[f.id]).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const mStory = fixture ? matchStory(career, fixture, career.results[fixture.id]) : null;
  if (!eStory) return mStory; if (!mStory) return eStory;
  return eStory.date >= mStory.date ? eStory : mStory;
}

function ensureLayer() {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'tl-calendar-processing';
  layer.innerHTML = `<div class="tl-processing-scrim"></div><section class="tl-processing-card" role="status" aria-live="polite">
    <header><span class="tl-processing-clock"><i></i><b></b></span><div><small>TOUCHLINE LIVE</small><strong>Avançando calendário</strong></div><em data-processing-percent>0%</em></header>
    <div class="tl-processing-calendar" data-processing-calendar></div>
    <div class="tl-processing-meta"><div><small>DATA ATUAL</small><strong data-processing-date>—</strong></div><div><small>PRÓXIMO COMPROMISSO</small><span data-processing-target>—</span></div></div>
    <div class="tl-processing-activity"><i></i><span data-processing-activity>Preparando mundo da carreira…</span></div><div class="tl-processing-progress"><i data-processing-progress></i></div>
  </section>`;
  document.body.append(layer); return layer;
}
function calendarWindow(date) {
  return Array.from({length:7},(_,i)=>addDays(date,i-2)).map(d=>`<div class="${d===date?'is-active':''}"><span>${weekday(d)}</span><b>${d.slice(-2)}</b><small>${month(d)}</small></div>`).join('');
}
function updateLayer(date, targetDate, targetLabel, progress, activity, final=false) {
  const root=ensureLayer(); root.querySelector('[data-processing-calendar]').innerHTML=calendarWindow(date);
  root.querySelector('[data-processing-date]').textContent=formatDate(date); root.querySelector('[data-processing-target]').textContent=targetLabel;
  root.querySelector('[data-processing-percent]').textContent=`${Math.round(progress*100)}%`; root.querySelector('[data-processing-progress]').style.width=`${Math.max(2,progress*100)}%`;
  root.querySelector('[data-processing-activity]').textContent=activity; root.classList.toggle('is-final',final); root.dataset.targetDate=targetDate;
}
function showLayer(){ ensureLayer(); document.documentElement.classList.add('tl-calendar-is-processing'); requestAnimationFrame(()=>layer.classList.add('is-visible')); }
async function hideLayer(){ if(!layer)return; layer.classList.remove('is-visible'); document.documentElement.classList.remove('tl-calendar-is-processing'); await sleep(220); layer?.remove(); layer=null; }

function renderBackgroundTimeline(career, fixture) {
  const host=document.querySelector('.tl-calendar-strip > div'); if(!host)return;
  const dates=Array.from({length:6},(_,i)=>addDays(career.currentDate,i)); if(fixture&&!dates.includes(fixture.date))dates[5]=fixture.date;
  host.innerHTML=[...new Set(dates)].sort().map(d=>{const today=d===career.currentDate, match=fixture?.date===d, delta=daysBetween(career.currentDate,d); const label=match?(isFriendlyFixture(fixture)?'AMISTOSO':'JOGO'):today?'HOJE':delta%3===0?'RECUPERAÇÃO':'TREINO'; return `<div class="tl-day ${today?'is-today':''} ${match?'is-match':''}"><span>${weekday(d)}</span><b>${d.slice(-2)}</b><small>${label}</small></div>`}).join('');
}
function patchBackground(career){ const text=formatDate(career.currentDate); document.querySelector('.cp-top > div:first-child small')?.replaceChildren(text); document.querySelector('.tl-calendar-strip > header b')?.replaceChildren(text); renderBackgroundTimeline(career,nextUserFixture(career)); }
function patchNews(story){ if(!story?.title)return; const slide=document.querySelector('.tl-news-slide'); if(!slide)return; slide.querySelector('article>header b')?.replaceChildren(story.category||'MUNDO'); slide.querySelector('article>header time')?.replaceChildren(story.date?`${shortDate(story.date)} · LIVE`:'Agora'); slide.querySelector('h3')?.replaceChildren(story.title); slide.querySelector('p')?.replaceChildren(story.body||story.activity); slide.querySelector('footer b')?.replaceChildren('Touchline World Desk'); slide.querySelector('footer span')?.replaceChildren('Gerado pelos acontecimentos do save'); slide.classList.remove('tl-world-news-pulse'); void slide.offsetWidth; slide.classList.add('tl-world-news-pulse'); }
async function patchLatestWorldNews(){ if(!isHome()||!document.querySelector('.tl-home-v2'))return; const selected=legacyClubSelection(), loaded=await CareerRepository.load(); if(!selected||!loaded)return; const story=latestStory(normalizeCareer(loaded,selected)); if(story)patchNews(story); }

const pauseRail=()=>document.querySelector('[data-home-rail]')?.dispatchEvent(new Event('mouseenter'));
const resumeRail=()=>document.querySelector('[data-home-rail]')?.dispatchEvent(new Event('mouseleave'));
const delayFor=(days,story)=>(days<=8?210:days<=21?135:days<=60?84:52)+(story?.kind&&story.kind!=='routine'?85:0);
async function waitForCommittedCareer(date,timeout=8000){const end=performance.now()+timeout; while(performance.now()<end){const save=await CareerRepository.load(); if(save?.currentDate===date)return save; await sleep(55)} return null}
async function waitForHome(timeout=5000){const end=performance.now()+timeout; while(performance.now()<end){if(document.querySelector('.tl-home-v2'))return true; await sleep(32)} return false}
function callOriginalContinue(){const button=document.querySelector('.cp-top [data-continue]'); if(!button)return false; passThrough=true; try{button.click()}finally{queueMicrotask(()=>{passThrough=false})} return true}

async function runProcessing(){
  if(processing||!isHome())return; processing=true;
  try{
    const selected=legacyClubSelection(), loaded=await CareerRepository.load(); if(!selected||!loaded){callOriginalContinue();return}
    const preview=normalizeCareer(loaded,selected), next=nextUserFixture(preview); if(!next||next.date===preview.currentDate){callOriginalContinue();return}
    const start=preview.currentDate, target=next.date, total=Math.max(1,daysBetween(start,target)); const opponent=club(preview,next.home===preview.clubCode?next.away:next.home); const targetLabel=`${isFriendlyFixture(next)?'Amistoso':'Jogo'} · ${opponent.shortName||opponent.name} · ${shortDate(target)}`;
    pauseRail(); showLayer(); updateLayer(start,target,targetLabel,0,'Lendo agenda, elencos, contratos e mercado…'); await sleep(130);
    for(let i=0;i<MAX_PREVIEW_DAYS;i+=1){const day=preview.currentDate, before=new Set(Object.keys(preview.results||{})); const step=advanceOneDay(preview); const shown=step.ready?day:preview.currentDate; const story=dailyStory(preview,step.daySummary?.date||day,before,step.daySummary); const progress=Math.min(1,daysBetween(start,shown)/total); patchBackground(preview); if(story?.title)patchNews(story); updateLayer(shown,target,targetLabel,progress,story?.activity||'Mundo atualizado'); await sleep(delayFor(total,story)); if(step.ready||preview.status==='complete'||preview.status==='unemployed')break}
    const committedDate=preview.currentDate;
    if(preview.status==='unemployed'){
      updateLayer(committedDate,target,'MERCADO DE EMPREGOS',1,'A diretoria encerrou seu vínculo. Abrindo o Job Centre…',true); await sleep(220);
      const saved=await CareerRepository.save(preview); syncManagerProfileFromCareer(saved); ensureLegacyCareerPointer(); window.location.hash='jobs'; await sleep(100); return;
    }
    updateLayer(committedDate,target,targetLabel,1,'Calendário atualizado. Preparando a próxima decisão…',true); await sleep(220);
    if(!callOriginalContinue())return; await waitForCommittedCareer(committedDate); await waitForHome(); await patchLatestWorldNews(); await sleep(80);
  }catch(error){console.error('Touchline calendar processing failed:',error); callOriginalContinue()}
  finally{await hideLayer(); resumeRail(); processing=false}
}
function intercept(event){if(passThrough||!isHome()||!(event.target instanceof Element))return; const button=event.target.closest('.cp-top [data-continue], .tl-home-v2 [data-home-continue]'); if(!button)return; event.preventDefault(); event.stopImmediatePropagation(); if(!processing)runProcessing()}
function schedulePatch(){if(patchQueued)return; patchQueued=true; queueMicrotask(async()=>{patchQueued=false; if(!processing)await patchLatestWorldNews()})}

document.addEventListener('click',intercept,true);
new MutationObserver(schedulePatch).observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',schedulePatch);
schedulePatch();
