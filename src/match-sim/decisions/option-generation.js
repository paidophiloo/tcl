import { contextualSkill } from '../core/player-attributes.js';
import { roleDefinition } from '../tactics/role-catalog.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

/** Generate only actions the player can plausibly perceive right now.
 * A shot exists only when the geometry, pressure and alternatives form a real
 * shooting window. Crossing midfield never unlocks a generic shot action. */
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
  const angleQuality=clamp(1-lateral*1.62,.08,1);
  const longShots=contextualSkill(p.player,['longShots','technique','composure','decisions']);
  const pressure=p.pressure;

  const clearCloseRange=p.local.x>.885&&lateral<.22&&pressure<1.22;
  const genuineBoxWindow=p.local.x>.805&&lateral<.285&&pressure<.84;
  const edgeWindow=p.local.x>.72&&lateral<.26&&pressure<.50;
  const exceptionalLongShot=p.local.x>.655&&lateral<.21&&pressure<.34&&longShots>=85;
  const hasShotWindow=clearCloseRange||genuineBoxWindow||edgeWindow||exceptionalLongShot;

  if(hasShotWindow){
    const alternativePenalty=Math.min(.2,openProgressiveOptions*.045);
    const pressureQuality=1-clamp(pressure/1.25);
    const windowQuality=clamp((1-geometricDistance)*.55+angleQuality*.27+pressureQuality*.28-alternativePenalty);
    const threshold=clearCloseRange?.36:genuineBoxWindow?.43:edgeWindow?.5:.56;
    if(windowQuality>threshold)opts.push({type:'shot',windowQuality,openProgressiveOptions});
  }

  if(p.local.x<.25&&p.pressure>1.15)opts.push({type:'clearance'});
  return opts;
}
