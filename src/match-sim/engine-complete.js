import { MatchEngine as RulesMatchEngine } from './engine-rules-complete.js';
export * from './engine-rules-complete.js';

/** Final public orchestration layer. Multiple UI/AI tactical panels may prepare
 * complementary changes before the next stoppage; later partial commands must
 * not erase earlier prepared instructions. */
export class MatchEngine extends RulesMatchEngine {
  queueTactics(teamIndex,patch,options={}){
    const team=this.state.teams[teamIndex];
    if(!team)return {ok:false,reason:'Equipe inválida.'};
    const merged={...(team.pendingTactics||team.tactics),...(patch||{})};
    if(patch?.playerRoles)merged.playerRoles={...((team.pendingTactics||team.tactics).playerRoles||{}),...patch.playerRoles};
    if(patch?.playerPositions)merged.playerPositions={...((team.pendingTactics||team.tactics).playerPositions||{}),...patch.playerPositions};
    return super.queueTactics(teamIndex,merged,options);
  }
}
