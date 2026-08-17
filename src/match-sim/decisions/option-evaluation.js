import { contextualSkill } from '../core/player-attributes.js';
import { roleDefinition } from '../tactics/role-catalog.js';
import { goalDistance, goalAngleQuality } from '../spatial/pitch-model.js';
const clamp=(v,a=-2,b=2)=>Math.max(a,Math.min(b,v));
export function evaluateOption(p,o){
  const role=roleDefinition(p.player.instructionRole,p.player.role),t=p.team.tactics,risk=(t.passingRisk-50)/100,tempo=(t.tempo-50)/100,ment=(t.mentality-50)/100;
  if(o.type==='pass'||o.type==='throughPass'||o.type==='longPass'){
    const progress=o.progress*(1.05+risk*.55),lane=(1-o.lane.risk)*.62,control=(o.control-.5)*.48,distancePenalty=o.distance*(o.type==='longPass'?.2:.36),roleFit=(role.ip.passRisk-.5)*.36;
    return clamp(.18+progress+lane+control-distancePenalty+roleFit+tempo*.08);
  }
  if(o.type==='carry'){
    const dribble=contextualSkill(p.player,['dribbling','firstTouch','balance','decisions'])/100;
    return clamp(.12+dribble*.42+(1-p.pressure)*.28+role.ip.carry*.28+(1-p.local.x)*.1);
  }
  if(o.type==='dribble'){
    const dribble=contextualSkill(p.player,['dribbling','agility','acceleration','technique'])/100;
    return clamp(.02+dribble*.62-p.pressure*.34+role.ip.carry*.34+ment*.1);
  }
  if(o.type==='shot'){
    const d=goalDistance(p.team,p.player),angle=goalAngleQuality(p.team,p.player),finish=contextualSkill(p.player,['finishing','composure','technique','decisions'])/100;
    const shootEarly=String(t.chanceCreation||'').toLowerCase().includes('finalizar')?.1:0;
    const alternativePenalty=Math.min(.16,(o.openProgressiveOptions||0)*.04);
    return clamp((1-d)*.58+angle*.18+finish*.18-p.pressure*.24+role.ip.box*.1+ment*.07+(o.windowQuality||0)*.23+shootEarly-alternativePenalty-.5);
  }
  if(o.type==='clearance')return p.pressure>1?.72:.05;
  return 0;
}
export function rankOptions(p,options){return options.map(o=>({...o,utility:evaluateOption(p,o)})).sort((a,b)=>b.utility-a.utility)}
