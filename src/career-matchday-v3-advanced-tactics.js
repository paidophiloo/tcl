import './career-matchday-v3-advanced-tactics.css';

const SHAPES=['4-2-3-1','4-3-3','4-4-2','4-1-4-1','3-4-3','3-4-2-1','3-5-2','5-4-1','5-3-2','4-2-2-2','4-3-2-1','4-4-1-1','3-2-5','3-2-4-1','2-3-5'];
const activeEngine=()=>globalThis.__TOUCHLINE_ACTIVE_PITCH_RENDERER__?.source?.getSnapshot?globalThis.__TOUCHLINE_ACTIVE_PITCH_RENDERER__.source:null;
const userTeamIndex=engine=>engine?.getSnapshot?.().teams?.findIndex(team=>!team.ai?.enabled)??-1;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const options=(values,current)=>values.map(value=>`<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(value)}</option>`).join('');

function advancedMarkup(tactics){
  return `<section class="tlm3-advanced" data-m3-advanced>
    <h3>Fases da equipe · com bola / transição / sem bola</h3>
    <div class="tlm3-advanced-grid">
      <label>Shape com bola<select data-m3-adv="formationInPossession">${options(SHAPES,tactics.formationInPossession||tactics.formation)}</select></label>
      <label>Shape sem bola<select data-m3-adv="formationOutOfPossession">${options(SHAPES,tactics.formationOutOfPossession||tactics.formation)}</select></label>
      <label>Diretividade<select data-m3-adv="directness">${options(['Curta','Equilibrada','Direta'],tactics.directness||'Equilibrada')}</select></label>
      <label>Armadilha de pressão<select data-m3-adv="pressingTrap">${options(['Equilibrada','Por dentro','Por fora'],tactics.pressingTrap||'Equilibrada')}</select></label>
      <label>Marcação<select data-m3-adv="marking">${options(['Zona','Mista','Apertada'],tactics.marking||'Zona')}</select></label>
      <label>Entradas<select data-m3-adv="tackling">${options(['Cautelosa','Normal','Agressiva'],tactics.tackling||'Normal')}</select></label>
      <label>Distribuição do goleiro<select data-m3-adv="distribution">${options(['Curta','Mista','Longa'],tactics.distribution||'Curta')}</select></label>
      <label>Criação<select data-m3-adv="chanceCreation">${options(['Combinação curta','Infiltrações','Finalizar cedo'],tactics.chanceCreation||'Combinação curta')}</select></label>
      <label>Largura defensiva <span data-m3-adv-value="defensiveWidth">${Math.round(tactics.defensiveWidth??52)}</span><input data-m3-adv="defensiveWidth" type="range" min="20" max="90" value="${Math.round(tactics.defensiveWidth??52)}"></label>
      <label class="tlm3-switch">Contrapressão<input data-m3-adv="counterpress" type="checkbox" ${tactics.counterpress?'checked':''}></label>
      <label class="tlm3-switch">Contra-atacar<input data-m3-adv="counter" type="checkbox" ${tactics.counter?'checked':''}></label>
      <label class="tlm3-switch">Linha de impedimento<input data-m3-adv="offsideTrap" type="checkbox" ${tactics.offsideTrap?'checked':''}></label>
    </div>
    <p class="tlm3-advanced-note">Esses comandos alteram os anchors, opções, transições, pressão e risco do mesmo Match Engine. Eles não aplicam bônus secretos de ataque ou defesa.</p>
  </section>`;
}

function collect(root){
  const patch={};
  root.querySelectorAll('[data-m3-adv]').forEach(control=>{
    const key=control.dataset.m3Adv;
    patch[key]=control.type==='checkbox'?control.checked:control.type==='range'?Number(control.value):control.value;
  });
  return patch;
}

function mount(){
  const body=document.querySelector('[data-m3-command-body]');
  const apply=document.querySelector('[data-m3-apply]');
  const engine=activeEngine();
  if(!body||!apply||!engine)return;
  const index=userTeamIndex(engine);
  if(index<0)return;
  if(!body.querySelector('[data-m3-advanced]'))body.insertAdjacentHTML('beforeend',advancedMarkup(engine.getSnapshot().teams[index].pendingTactics||engine.getSnapshot().teams[index].tactics));
  body.querySelectorAll('input[data-m3-adv="defensiveWidth"]').forEach(input=>input.addEventListener('input',()=>body.querySelector('[data-m3-adv-value="defensiveWidth"]')?.replaceChildren(input.value),{once:false}));
  if(apply.dataset.advancedBound==='true')return;
  apply.dataset.advancedBound='true';
  apply.addEventListener('click',()=>{
    const liveBody=document.querySelector('[data-m3-command-body]');
    const liveEngine=activeEngine();
    const teamIndex=userTeamIndex(liveEngine);
    if(!liveBody||!liveEngine||teamIndex<0)return;
    const section=liveBody.querySelector('[data-m3-advanced]');
    if(!section)return;
    liveEngine.queueTactics(teamIndex,collect(section),{source:'user-advanced'});
  });
}

const observer=new MutationObserver(()=>mount());
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
mount();
