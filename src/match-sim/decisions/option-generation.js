import { contextualSkill } from '../core/player-attributes.js';
import { roleDefinition } from '../tactics/role-catalog.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

/** Generate only actions the player can plausibly perceive right now.
 * A shot is an opportunity, not a generic option unlocked by crossing midfield. */
export function generateOptions(p){
  const role=roleDefinition(p.player.instructionRole,p.player.role);
  const vision=contextualSkill(p.player,['vision','anticipation','decisions']);
  const opts=[];
  let openProgressiveOptions=0;
  for(const mate of p.mates){
    if(mate.offside)continue;
    const visible=mate.lane.risk<.65+vision/220;
    if(!visible)continue;
    const type=mate.progress>.16&&mate.distance>.15?'throughPass':mate.distance>.36?'longPass':'pass';
    opts.push({type,target:mate.player,lane:mate.lane,progress:mate.progress,distance:mate.distance,control:mate.control});
    if(mate.progress>.08&&mate.lane.risk<.6)openProgressiveOptions++;
  }
  opts.push({type:'carry'});
  if(p.nearestDefenders[0]?.distance<8&&role.ip.carry>.55)opts.push({type:'dribble',defender:p.nearestDefenders[0].player});

  const dx=1-p.local.x;
  const lateral=Math.abs(p.local.y-.5);
  const geometricDistance=Math.hypot(dx,lateral*.72);
  const angleQuality=clamp(1-lateral*1.55,.12,1);
  const longShots=contextualSkill(p.player,['longShots','technique','composure','decisions']);
  const centralBox=p.local.x>.78&&lateral<.31;
  const edgeWindow=p.local.x>.68&&lateral<.35&&p.pressure<1.05;
  const exceptionalLongShot=p.local.x>.625&&lateral<.28&&p.pressure<.56&&longShots>=82;
  const hasShotWindow=centralBox||edgeWindow||exceptionalLongShot;
  if(hasShotWindow){
    const patiencePenalty=Math.min(.14,openProgressiveOptions*.035);
    const windowQuality=clamp((1-geometricDistance)*.56+angleQuality*.25+(1-clamp(p.pressure/1.5))*.22-patiencePenalty);
    if(windowQuality>.29)opts.push({type:'shot',windowQuality,openProgressiveOptions});
  }
  if(p.local.x<.25&&p.pressure>1.15)opts.push({type:'clearance'});
  return opts;
}
