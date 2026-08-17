import { contextualSkill } from '../core/player-attributes.js';
import { aerialDuel } from '../actions/duels.js';
import { goalDistance, localPoint, metricDistance } from '../spatial/pitch-model.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

export function chooseSetPieceTaker(team,type='corner'){
  const keys=type==='penalty'?['penalties','finishing','composure']:
    type==='freeKick'?['setPieces','technique','longShots','composure']:
    type==='throwIn'?['throwing','decisions','strength']:
    ['crossing','setPieces','technique'];
  return team.players.filter(p=>!p.redCard&&!p.injured).sort((a,b)=>contextualSkill(b,keys)-contextualSkill(a,keys))[0]||null;
}

export function resolveCorner(state,teamIndex,rng){
  const team=state.teams[teamIndex],opp=state.teams[1-teamIndex],taker=chooseSetPieceTaker(team,'corner');
  const attackers=team.players.filter(p=>!p.redCard&&!p.injured&&p.id!==taker?.id).sort((a,b)=>contextualSkill(b,['aerial','jumping','strength','anticipation'])-contextualSkill(a,['aerial','jumping','strength','anticipation']));
  const defenders=opp.players.filter(p=>!p.redCard&&p.role!=='GK').sort((a,b)=>contextualSkill(b,['aerial','jumping','positioning','bravery'])-contextualSkill(a,['aerial','jumping','positioning','bravery']));
  const a=attackers[0],d=defenders[0];if(!a||!d)return {won:false,taker};
  const duel=aerialDuel(a,d,rng);return {won:duel.firstWins,attacker:a,defender:d,taker,duel,xG:duel.firstWins?clamp(.055+(contextualSkill(a,['heading','aerial','composure'])-65)/700,.035,.18):0};
}

export function resolveFreeKick(state,teamIndex,spot,rng){
  const team=state.teams[teamIndex],opp=state.teams[1-teamIndex],taker=chooseSetPieceTaker(team,'freeKick');
  if(!taker)return {type:'short',taker:null,spot};
  const distance=goalDistance(team,spot);const metres=distance*105;
  const directRange=metres<=34;
  const setSkill=contextualSkill(taker,['setPieces','technique','longShots','composure'])/100;
  if(directRange){
    const gk=opp.players.find(p=>p.role==='GK'&&!p.redCard),keeping=gk?contextualSkill(gk,['goalkeeping','reflexes','positioning'])/100:.65;
    const angle=Math.max(.3,1-Math.abs(localPoint(team,spot).y-.5)*1.15);
    const xG=clamp(.025+(34-metres)/190*angle+setSkill*.045-keeping*.025,.015,.19);
    return {type:'direct',taker,spot,xG,goal:rng.chance(xG),onTarget:rng.chance(clamp(.32+setSkill*.28,.35,.68)),goalkeeper:gk||null};
  }
  const targets=team.players.filter(p=>!p.redCard&&!p.injured&&p.id!==taker.id).sort((a,b)=>contextualSkill(b,['aerial','offBall','anticipation'])-contextualSkill(a,['aerial','offBall','anticipation']));
  const target=targets[0]||null;return {type:'cross',taker,target,spot,xG:target?.08:0};
}

export function resolveThrowIn(state,teamIndex,spot,rng){
  const team=state.teams[teamIndex],taker=team.players.filter(p=>!p.redCard&&!p.injured).sort((a,b)=>metricDistance(a,spot)-metricDistance(b,spot))[0]||null;
  const candidates=team.players.filter(p=>!p.redCard&&!p.injured&&p.id!==taker?.id).sort((a,b)=>metricDistance(a,spot)-metricDistance(b,spot));
  const target=candidates.slice(0,4).sort((a,b)=>contextualSkill(b,['firstTouch','decisions','strength'])-contextualSkill(a,['firstTouch','decisions','strength']))[0]||null;
  return {type:'throwIn',taker,target,spot,successful:Boolean(target)&&rng.chance(clamp(.72+(contextualSkill(taker||target,['decisions','strength'])-65)/250,.62,.94))};
}

export function resolveGoalKick(state,teamIndex,rng){
  const team=state.teams[teamIndex],gk=team.players.find(p=>p.role==='GK'&&!p.redCard)||team.players.find(p=>!p.redCard),short=String(team.tactics?.distribution||'Curta').toLowerCase().includes('curt');
  const candidates=team.players.filter(p=>!p.redCard&&p.id!==gk?.id).filter(p=>short?['Defence','Midfield'].includes(p.positionGroup):true);
  const target=candidates.sort((a,b)=>short?metricDistance(a,gk)-metricDistance(b,gk):contextualSkill(b,['aerial','strength','firstTouch'])-contextualSkill(a,['aerial','strength','firstTouch']))[0]||null;
  return {type:'goalKick',taker:gk,target,short,successful:Boolean(target)&&rng.chance(short?.94:.65)};
}
