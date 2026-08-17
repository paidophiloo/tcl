import { contextualSkill } from '../core/player-attributes.js';
import { metricDistance } from '../spatial/pitch-model.js';

// Energy is a progressive match-load model, not a minute-based cliff. Values are
// calibrated per simulated second so a 90-minute match produces meaningful but
// plausible fatigue instead of draining the whole high-pressing team to 1%.
const LOAD=Object.freeze({
  walk:.000010,
  jog:.000038,
  run:.000082,
  sprint:.000155,
  press:.000178,
  duel:.000125,
  jump:.000105,
  dribble:.000110,
  recovery:.000145
});

export function drainEnergy(player,seconds,activity='jog',teamTactics={}){
  const stamina=contextualSkill(player,['stamina','workRate','physical'],{fatigueWeight:0});
  const resilience=.78+stamina/300;
  const pressing=(Number(teamTactics.pressing)||60)/100;
  const tempo=(Number(teamTactics.tempo)||55)/100;
  const tactical=.88+pressing*.12+tempo*.09;
  const cost=(LOAD[activity]??LOAD.jog)*Math.max(0,Number(seconds)||0)*tactical/resilience*100;
  player.stamina=Math.max(18,Math.min(100,(player.stamina??100)-cost));
  player.matchLoad=(player.matchLoad||0)+cost;
  return cost;
}

export function activityFor(player,state,teamIndex){
  const team=state.teams[teamIndex];
  const owns=state.possessionTeamIndex===teamIndex;
  const transitionAge=Math.max(0,state.clockSeconds-(state.lastPossessionChangeAt??-999));
  const distanceToBall=metricDistance(player,state.ball);
  const pressing=(Number(team.tactics?.pressing)||60)/100;
  const tempo=(Number(team.tactics?.tempo)||55)/100;
  const counterpress=Boolean(team.tactics?.counterpress);
  const speed=Math.hypot(Number(player.velocityX)||0,Number(player.velocityY)||0);

  if(!owns){
    if(transitionAge<4.5&&counterpress&&distanceToBall<18)return 'press';
    if(transitionAge<4.5&&distanceToBall<34)return 'recovery';
    const pressRadius=9+pressing*10;
    if(distanceToBall<pressRadius&&pressing>.42)return 'press';
    if(distanceToBall<34||speed>.024)return 'run';
    return 'jog';
  }

  if(String(state.ball?.carrierId)===String(player.id)){
    if(player.intention==='dribble')return 'dribble';
    return tempo>.72?'run':'jog';
  }
  if(transitionAge<4.5&&tempo>.58&&speed>.018)return 'sprint';
  if(speed>.03)return 'sprint';
  if(speed>.014)return 'run';
  return 'jog';
}
