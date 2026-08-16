import { contextualSkill } from '../core/player-attributes.js'; import { metricDistance } from './pitch-model.js';
function arrival(player,point){const d=metricDistance(player,point);const pace=contextualSkill(player,['pace','acceleration','agility'])/100;const reaction=(100-contextualSkill(player,['anticipation','decisions','concentration']))/500;return reaction+d/(4.4+pace*3.1)}
export function pitchControlAt(state,point){const best=state.teams.map(team=>Math.min(...team.players.filter(p=>!p.redCard).map(p=>arrival(p,point))));const delta=best[1]-best[0];const p0=1/(1+Math.exp(-delta*2.2));return {team0:p0,team1:1-p0,arrival:best,contested:Math.abs(delta)<.35}}
export function controlForTeam(state,teamIndex,point){const c=pitchControlAt(state,point);return teamIndex===0?c.team0:c.team1}
