import { getFormation, slotGroup, slotSide } from './formations.js';
import { roleDefinition } from './role-catalog.js';
import { localPoint, worldPoint, clamp01 } from '../spatial/pitch-model.js';
import { pressRank } from '../spatial/pressure-map.js';

export const PHASE=Object.freeze({IP:'IN_POSSESSION',AT:'ATTACKING_TRANSITION',OOP:'OUT_OF_POSSESSION',DT:'DEFENSIVE_TRANSITION'});
const assignmentCache=new WeakMap();
const attackingPhase=phase=>phase===PHASE.IP||phase===PHASE.AT;
const phaseShapeName=(team,phase)=>attackingPhase(phase)?team.tactics.formationInPossession||team.tactics.formation:team.tactics.formationOutOfPossession||team.tactics.formation;

export function phaseFor(state,teamIndex){
  const owns=state.possessionTeamIndex===teamIndex;
  const age=state.clockSeconds-(state.lastPossessionChangeAt??-999);
  if(age<4.5)return owns?PHASE.AT:PHASE.DT;
  return owns?PHASE.IP:PHASE.OOP;
}

function preferredPoint(team,player,phase){
  const baseShape=getFormation(team.tactics.formation);
  const base=baseShape[player.slotIndex]||baseShape.at(-1);
  const role=roleDefinition(player.instructionRole,player.role);
  const side=slotSide(base.role),sign=side==='left'?-1:side==='right'?1:0;
  let x=base.x,y=base.y;
  if(attackingPhase(phase)){
    x+=role.ip.advance;
    y=.5+(y-.5)*(0.78+team.tactics.widthInPossession/190)+role.ip.width*sign;
    if(role.ip.run==='invert'){x=Math.max(x,.42);y=.5+(y-.5)*.32}
    if(['overlap','outside'].includes(role.ip.run)){x=Math.max(x,.56);y=.5+(y-.5)*1.1}
    if(role.ip.run==='drop')x-=.07;
    if(role.ip.run==='depth'||role.ip.run==='last-line'||role.ip.run==='beyond')x+=.06;
  }else{
    x+=(team.tactics.defensiveLine-50)/100*.1+role.oop.line;
    y=.5+(y-.5)*(0.8+team.tactics.widthOutOfPossession/200)+role.oop.width*sign;
  }
  return {x:clamp01(x),y:clamp01(y),baseRole:base.role,baseGroup:slotGroup(base.role),baseSide:side};
}

function groupAllowed(player,pref,target,phase){
  const targetGroup=slotGroup(target.role),role=String(player.instructionRole||'');
  if(pref.baseGroup==='GK')return targetGroup==='GK';
  if(targetGroup==='GK')return false;
  if(!attackingPhase(phase)){
    if(pref.baseGroup==='DEF')return targetGroup==='DEF';
    if(pref.baseGroup==='MID')return targetGroup==='MID'||(['RM','LM'].includes(pref.baseRole)&&targetGroup==='FWD');
    if(pref.baseGroup==='FWD')return targetGroup==='FWD'||['winger','insideForward','invertedWinger'].includes(role)&&targetGroup==='MID';
  }
  if(pref.baseGroup==='DEF'){
    if(['invertedFullBack','invertedWingBack','playmakingWingBack'].includes(role))return targetGroup==='DEF'||targetGroup==='MID';
    if(['wingBack','attackingWingBack','overlappingCentreBack'].includes(role))return targetGroup!=='GK';
    return targetGroup==='DEF'||(targetGroup==='MID'&&pref.x>.38);
  }
  if(pref.baseGroup==='MID')return targetGroup==='MID'||targetGroup==='FWD';
  if(pref.baseGroup==='FWD')return targetGroup==='FWD'||['falseNine','deepLyingForward','widePlaymaker','advancedPlaymaker'].includes(role)&&targetGroup==='MID';
  return true;
}

function assignmentCost(player,pref,target,phase){
  const dx=(target.x-pref.x)*1.05,dy=target.y-pref.y;
  let cost=dx*dx+dy*dy;
  if(!groupAllowed(player,pref,target,phase))cost+=4;
  const targetSide=slotSide(target.role);
  if(pref.baseSide!=='center'&&targetSide!=='center'&&pref.baseSide!==targetSide)cost+=.75;
  if(pref.baseGroup==='GK'&&target.role!=='GK')cost+=20;
  if(pref.baseGroup!=='GK'&&target.role==='GK')cost+=20;
  return cost;
}

/** Globally assign active players to phase-shape slots. This avoids the old
 * index-to-index bug where changing 4-2-3-1 → 3-2-5 could silently map a CM
 * into a winger slot just because both happened to be array item #6. */
function phaseAssignments(team,phase){
  const active=team.players.filter(p=>!p.redCard);
  const target=getFormation(phaseShapeName(team,phase));
  const signature=[phase,team.tactics.formation,phaseShapeName(team,phase),...active.map(p=>`${p.id}:${p.role}:${p.instructionRole}`)].join('|');
  const cached=assignmentCache.get(team);
  if(cached?.signature===signature)return cached.map;
  const prefs=active.map(p=>preferredPoint(team,p,phase));
  const slots=target.slice();
  const memo=new Map();
  function solve(i,mask){
    if(i>=active.length)return {cost:0,choices:[]};
    const key=`${i}:${mask}`;if(memo.has(key))return memo.get(key);
    let best={cost:Infinity,choices:[]};
    for(let j=0;j<slots.length;j++){
      if(mask&(1<<j))continue;
      const next=solve(i+1,mask|(1<<j));
      const cost=assignmentCost(active[i],prefs[i],slots[j],phase)+next.cost;
      if(cost<best.cost)best={cost,choices:[j,...next.choices]};
    }
    memo.set(key,best);return best;
  }
  const solved=solve(0,0),map=new Map();
  active.forEach((player,i)=>map.set(String(player.id),slots[solved.choices[i]]||target[player.slotIndex]||target.at(-1)));
  assignmentCache.set(team,{signature,map});
  return map;
}

function slotFor(team,player,phase){return phaseAssignments(team,phase).get(String(player.id))||getFormation(phaseShapeName(team,phase))[player.slotIndex]||getFormation(phaseShapeName(team,phase)).at(-1)}

export function tacticalAnchor(state,teamIndex,player){
  const team=state.teams[teamIndex],phase=phaseFor(state,teamIndex),slot=slotFor(team,player,phase),role=roleDefinition(player.instructionRole,player.role),ball=localPoint(team,state.ball),ment=(team.tactics.mentality-50)/100;
  let x=slot.x,y=slot.y;
  const ip=attackingPhase(phase);
  if(ip){
    x+=role.ip.advance*.55+ment*.07;
    const sign=slotSide(slot.role)==='left'?-1:slotSide(slot.role)==='right'?1:0;
    y=.5+(y-.5)*(0.78+team.tactics.widthInPossession/185)+role.ip.width*sign*.55;
    x+=(ball.x-.5)*.04;y+=(ball.y-.5)*.055*role.ip.support;
    if(role.ip.run==='invert')y=.5+(y-.5)*.52;
    if(phase===PHASE.AT)x+=role.transition.attack*.03;
  }else{
    x+=(team.tactics.defensiveLine-50)/100*.11+role.oop.line*.6;
    const sign=slotSide(slot.role)==='left'?-1:slotSide(slot.role)==='right'?1:0;
    y=.5+(y-.5)*(0.78+team.tactics.widthOutOfPossession/185)+role.oop.width*sign*.5;
    const rank=pressRank(team,state.ball,player.id);
    if(rank<3){
      const urge=(team.tactics.pressing/100)*role.oop.press*(rank===0?1:.62);
      x+=(ball.x-x)*urge*.13;y+=(ball.y-y)*urge*.13;
    }
    if(phase===PHASE.DT&&team.tactics.counterpress){x+=(ball.x-x)*role.transition.counterpress*.055;y+=(ball.y-y)*role.transition.counterpress*.04}
  }
  const world=worldPoint(team,{x:clamp01(x),y:clamp01(y)});
  return {...world,phase,shape:phaseShapeName(team,phase),slotRole:slot.role};
}

export function tacticalShapeSnapshot(state,teamIndex){
  const team=state.teams[teamIndex],phase=phaseFor(state,teamIndex);
  return {phase,shape:phaseShapeName(team,phase),anchors:team.players.filter(p=>!p.redCard).map(p=>({playerId:p.id,...tacticalAnchor(state,teamIndex,p)}))};
}
