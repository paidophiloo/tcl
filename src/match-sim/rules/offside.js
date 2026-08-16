import { isOffsidePosition,offsideLineForAttack } from '../spatial/offside-line.js';
export function evaluateOffside(state,teamIndex,attacker,ballAtPass){const team=state.teams[teamIndex],opp=state.teams[1-teamIndex];return {offside:isOffsidePosition(team,opp,attacker,ballAtPass),line:offsideLineForAttack(team,opp,ballAtPass),attackerId:attacker?.id||null}}
