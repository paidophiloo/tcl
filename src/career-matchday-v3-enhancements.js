import './career-matchday-v3-enhancements.css';
import { PitchRenderer } from './pitch-renderer.js';

const ACTIVE_RENDERER='__TOUCHLINE_ACTIVE_PITCH_RENDERER__';
const MODES=['FULL','COMPREHENSIVE','EXTENDED','KEY','DYNAMIC'];
const LABEL_PRIORITY={GOL:10,PÊNALTI:9,VERMELHO:9,'NO ALVO':6,FINALIZAÇÃO:4,AMARELO:3,LESÃO:5,SUBSTITUIÇÃO:2,TÁTICA:1,IMPEDIMENTO:2,ESCANTEIO:2};
const THRESHOLD={FULL:0,COMPREHENSIVE:1,EXTENDED:3,KEY:6,DYNAMIC:5};

if(!PitchRenderer.prototype.__touchlineV3Exposed){
  const original=PitchRenderer.prototype.connect;
  PitchRenderer.prototype.connect=function(...args){globalThis[ACTIVE_RENDERER]=this;return original.apply(this,args)};
  PitchRenderer.prototype.__touchlineV3Exposed=true;
}

const state={mode:'KEY',anchors:true,lines:true,trails:false,replaying:false,observer:null};
const activeRenderer=()=>globalThis[ACTIVE_RENDERER]||null;
const activeEngine=()=>activeRenderer()?.source?.getSnapshot?activeRenderer().source:null;

function priorityForEventNode(node){const label=node.querySelector('b')?.textContent?.trim()?.toUpperCase()||'';return LABEL_PRIORITY[label]??0}
function applyHighlightFilter(){const panel=document.querySelector('[data-m3-panel]');if(!panel)return;const dynamicThreshold=(()=>{const s=activeEngine()?.getSnapshot?.();if(state.mode!=='DYNAMIC'||!s)return THRESHOLD[state.mode]??5;const delta=Math.abs((s.score?.[0]||0)-(s.score?.[1]||0));const minute=(s.clockSeconds||0)/60;return minute>75&&delta<=1?3:delta>=3?7:5})();panel.querySelectorAll('.tlm3-event').forEach(node=>{node.dataset.hiddenHighlight=priorityForEventNode(node)<dynamicThreshold?'true':'false'})}
function setOverlay(key,value){state[key]=value;activeRenderer()?.setOverlayOptions?.({anchors:state.anchors,lines:state.lines,trails:state.trails});document.querySelectorAll(`[data-m3-enhance="${key}"]`).forEach(button=>button.classList.toggle('active',value))}
function latestReplay(){const s=activeEngine()?.getSnapshot?.();return s?.events?.find?.(event=>Array.isArray(event?.replay?.frames)&&event.replay.frames.length>2)?.replay||null}
async function playReplay(){if(state.replaying)return;const renderer=activeRenderer(),engine=activeEngine(),replay=latestReplay();if(!renderer||!engine||!replay)return;state.replaying=true;const wasPaused=Boolean(engine.getSnapshot().paused);engine.setPaused(true);renderer.stop();const badge=document.querySelector('[data-m3-replay-badge]'),bar=document.querySelector('[data-m3-replay-progress]');badge?.classList.add('show');bar?.classList.add('show');for(let i=0;i<replay.frames.length;i++){renderer.setSnapshot(replay.frames[i]);if(bar)bar.style.setProperty('--v',`${((i+1)/replay.frames.length)*100}%`);await new Promise(resolve=>setTimeout(resolve,90))}renderer.setSource(engine);renderer.render(engine.getSnapshot());renderer.start();badge?.classList.remove('show');bar?.classList.remove('show');if(!wasPaused&&engine.getSnapshot().phase!=='halftime')engine.setPaused(false);state.replaying=false}
function mount(){const root=document.querySelector('[data-matchday-v3]');if(!root||root.dataset.enhanced==='true')return;root.dataset.enhanced='true';const overlay=root.querySelector('.tlm3-overlaybar'),pitchCard=root.querySelector('.tlm3-pitch-card');if(overlay){const controls=document.createElement('div');controls.className='tlm3-enhance';controls.innerHTML=`<button class="active" data-m3-enhance="anchors">Âncoras</button><button class="active" data-m3-enhance="lines">Linhas</button><button data-m3-enhance="trails">Rastros</button><select data-m3-highlight aria-label="Modo de highlights">${MODES.map(mode=>`<option value="${mode}" ${mode===state.mode?'selected':''}>${mode}</option>`).join('')}</select><button data-m3-replay>↻ Replay</button><span class="tlm3-enhance-status">snapshot replay · apresentação apenas</span>`;overlay.appendChild(controls);controls.querySelectorAll('[data-m3-enhance]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.m3Enhance;setOverlay(key,!state[key])}));controls.querySelector('[data-m3-highlight]').addEventListener('change',event=>{state.mode=event.target.value;applyHighlightFilter()});controls.querySelector('[data-m3-replay]').addEventListener('click',playReplay)}if(pitchCard){const badge=document.createElement('span');badge.className='tlm3-replay-badge';badge.dataset.m3ReplayBadge='';badge.textContent='Replay 2D';pitchCard.appendChild(badge);const progress=document.createElement('span');progress.className='tlm3-replay-progress';progress.dataset.m3ReplayProgress='';progress.innerHTML='<i></i>';pitchCard.appendChild(progress)}setOverlay('anchors',true);setOverlay('lines',true);applyHighlightFilter();if(state.observer)state.observer.disconnect();const panel=root.querySelector('[data-m3-panel]');if(panel){state.observer=new MutationObserver(()=>applyHighlightFilter());state.observer.observe(panel,{childList:true,subtree:true})}}

const observer=new MutationObserver(()=>mount());observer.observe(document.documentElement,{childList:true,subtree:true});mount();
