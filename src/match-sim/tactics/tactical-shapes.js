import { getFormation, slotGroup, slotSide } from './formations.js';
import { roleDefinition } from './role-catalog.js';
import { localPoint, worldPoint, clamp01, metricDistance } from '../spatial/pitch-model.js';

export const PHASE=Object.freeze({IP:'IN_POSSESSION',AT:'ATTACKING_TRANSITION',OOP:'OUT_OF_POSSESSION',DT:'DEFENSIVE_TRANSITION'});
const assignmentCache=new WeakMap();
const pressureRankCache=new WeakMap();
const attackingPhase=phase=>phase===PHASE.IP||phase===PHASE.AT;
const phaseShapeName=(team,phase)=>attackingPhase(phase)?team.tactics.formationInPossession||team.tactics.formation:team.tactics.formationOutOfPossession||team.tactics.formation;

export function phaseFor(state,teamIndex){
  const owns=state.possessionTeamIndex===teamIndex;
  const age=state.clockSeconds-(state.lastPossessionChangeAt??-999);
  if(age<4.5)return owns?PHASE.AT:PHASE.DT;
  return owns?PHASE.IP:PHASE.OOP;
}

/** Assignment preference is structural and role-driven. Team width/line sliders
 * deliberately do NOT participate here: otherwise changing a slider can remap
 * players to different phase slots and cancel the very spatial effect the user
 * asked for. Sliders are applied only after semantic slot assignment. */
function preferredPoint(team,player,phase){
  const baseShape=getFormation(team.tactics.formation);
  const base=baseShape[player.slotIndex]||baseShape.at(-1);
  const role=roleDefinition(player.instructionRole,player.role);
  const side=slotSide(base.role),sign=side==='left'?-1:side==='right'?1:0;
  let x=base.x,y=base.y;
  if(attackingPhase(phase)){
    x+=role.ip.advance;
    y=.5+(y-.5)+role.ip.width*sign;
    if(role.ip.run==='invert'){x=Math.max(x,.42);y=.5+(y-.5)*.32}
    if(['overlap','outside'].includes(role.ip.run)){x=Math.max(x,.56);y=.5+(y-.5)*1.1}
    if(role.ip.run==='drop')x-=.07;
    if(role.ip.run==='depth'||role.ip.run==='last-line'||role.ip.run==='beyond')x+=.06;
  }else{
    x+=role.oop.line;
    y=.5+(y-.5)+role.oop.width*sign;
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

function cachedPressRank(state,teamIndex,playerId){
  let entry=pressureRankCache.get(state);
  if(!entry||entry.clock!==state.clockSeconds){entry={clock:state.clockSeconds,maps:[null,null]};pressureRankCache.set(state,entry)}
  if(!entry.maps[teamIndex]){
    const team=state.teams[teamIndex];
    const ranked=team.players.filter(player=>!player.redCard).map(player=>({id:String(player.id),distance:metricDistance(player,state.ball)})).sort((a,b)=>a.distance-b.distance);
    entry.maps[teamIndex]=new Map(ranked.map((row,index)=>[row.id,index]));
  }
  return entry.maps[teamIndex].get(String(playerId))??99;
}

function slotFor(team,player,phase){return phaseAssignments(team,phase).get(String(player.id))||getFormation(phaseShapeName(team,phase))[player.slotIndex]||getFormation(phaseShapeName(team,phase)).at(-1)}

function applyWidth(baseY, roleWidth, sideSign, widthInstruction, roleWeight){
  // Role positioning establishes the semantic lane first; team width then
  // expands/contracts the whole shape around the centre line. Applying role
  // width after team width caused both narrow and wide shapes to saturate at
  // the touchlines, making the user's width instruction visually meaningless.
  const semanticY=clamp01(baseY+roleWidth*sideSign*roleWeight);
  const scale=.78+widthInstruction/185;
  return clamp01(.5+(semanticY-.5)*scale);
}

export function tacticalAnchor(state,teamIndex,player){
  const team=state.teams[teamIndex],phase=phaseFor(state,teamIndex),slot=slotFor(team,player,phase),role=roleDefinition(player.instructionRole,player.role),ball=localPoint(team,state.ball),ment=(team.tactics.mentality-50)/100;
  let x=slot.x,y=slot.y;
  const ip=attackingPhase(phase);
  if(ip){
    x+=role.ip.advance*.55+ment*.07;
    const sign=slotSide(slot.role)==='left'?-1:slotSide(slot.role)==='right'?1:0;
    y=applyWidth(y,role.ip.width,sign,team.tactics.widthInPossession,.55);
    x+=(ball.x-.5)*.04;y+=(ball.y-.5)*.055*role.ip.support;
    if(role.ip.run==='invert')y=.5+(y-.5)*.52;
    if(phase===PHASE.AT)x+=role.transition.attack*.03;
  }else{
    x+=(team.tactics.defensiveLine-50)/100*.11+role.oop.line*.6;
    const sign=slotSide(slot.role)==='left'?-1:slotSide(slot.role)==='right'?1:0;
    y=applyWidth(y,role.oop.width,sign,team.tactics.widthOutOfPossession,.5);
    const rank=cachedPressRank(state,teamIndex,player.id);
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
