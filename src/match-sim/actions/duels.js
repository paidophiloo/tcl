import { contextualSkill } from '../core/player-attributes.js';
const sigmoid=x=>1/(1+Math.exp(-x));
export function groundDuel(attacker,defender,rng,{pressure=0}={}){const a=contextualSkill(attacker,['dribbling','agility','balance','acceleration','decisions']);const d=contextualSkill(defender,['tackling','defending','positioning','strength','decisions']);const p=Math.max(.16,Math.min(.86,.5+(a-d)/180-pressure*.025));return {attackerWins:rng.chance(p),probability:p,attack:a,defence:d}}
export function aerialDuel(a,b,rng){const av=contextualSkill(a,['aerial','jumping','strength','bravery','anticipation']);const bv=contextualSkill(b,['aerial','jumping','strength','bravery','anticipation']);const p=.2+.6*sigmoid((av-bv)/16);return {firstWins:rng.chance(p),probability:p,first:av,second:bv}}
