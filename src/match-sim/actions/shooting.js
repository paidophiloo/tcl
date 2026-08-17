import { contextualSkill } from '../core/player-attributes.js';
import { goalDistance,goalAngleQuality,localPoint } from '../spatial/pitch-model.js';
import { pressureAtPoint } from '../spatial/pressure-map.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

/** xG describes the chance the simulation actually created. Geometry dominates;
 * finishing and goalkeeper quality adjust execution without turning a poor
 * location into a clear chance. */
export function shotQuality(state,teamIndex,shooter){
  const team=state.teams[teamIndex],opp=state.teams[1-teamIndex];
  const d=goalDistance(team,shooter),angle=goalAngleQuality(team,shooter),pressure=pressureAtPoint(opp,shooter);
  const fin=contextualSkill(shooter,['finishing','composure','technique','decisions'])/100;
  const loc=localPoint(team,shooter);
  const spatial=.009+Math.pow(clamp(1-d),2.8)*.275;
  const execution=clamp(.82+fin*.22,.9,1.06);
  const contest=clamp(1-pressure*.21,.46,1);
  const xg=clamp(spatial*angle*execution*contest,.004,.46);
  return {xg,pressure,distance:d,angle,local:loc};
}
export function planShot(state,teamIndex,shooter,rng){
  const q=shotQuality(state,teamIndex,shooter),team=state.teams[teamIndex],opp=state.teams[1-teamIndex];
  const gk=opp.players.find(p=>p.role==='GK'&&!p.redCard)||opp.players.find(p=>!p.redCard);
  const fin=contextualSkill(shooter,['finishing','composure','technique']),keep=gk?contextualSkill(gk,['goalkeeping','reflexes','positioning','oneOnOne']):55;
  const onTarget=clamp(.27+(fin-60)/195+q.xg*.42-q.pressure*.075,.19,.7);
  const onFrame=rng.chance(onTarget);
  const keeperAdjustment=clamp(.9+(fin-keep)/330,.78,1.12);
  const goalP=clamp(q.xg*keeperAdjustment,.003,.48);
  const goal=onFrame&&rng.chance(clamp(goalP/Math.max(.08,onTarget),.018,.72));
  const localTarget={x:1,y:clamp(.5+rng.range(-.11,.11),.37,.63)},to=team.direction===-1?{x:0,y:1-localTarget.y}:{x:1,y:localTarget.y};
  return {kind:'shot',shooterId:shooter.id,goalkeeperId:gk?.id||null,xG:q.xg,onTarget:onFrame,goal,to,duration:.32+rng.range(0,.18),height:rng.range(.015,.08),pressure:q.pressure};
}
