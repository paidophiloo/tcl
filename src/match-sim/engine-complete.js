import { MatchEngine as RulesMatchEngine } from './engine-rules-complete.js';
import { contextualSkill } from './core/player-attributes.js';
import { roleFamiliarity as roleFitScore } from './tactics/role-catalog.js';
import { resolveThrowIn } from './set-pieces/set-piece-engine.js';
export * from './engine-rules-complete.js';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const same=(a,b)=>String(a)===String(b);

/** Final public orchestration layer. Multiple UI/AI tactical panels may prepare
 * complementary changes before the next stoppage; later partial commands must
 * not erase earlier prepared instructions. Perception still runs on fixed 250 ms
 * slices; this layer only gives committed on-ball macro actions a more realistic
 * amount of time to develop before the next selection. */
export class MatchEngine extends RulesMatchEngine {
  constructor(options={}){
    super(options);
    this.state.teams.forEach(team=>team.players.forEach(player=>{
      const positions=new Set([player.player?.primaryPosition,...(player.player?.positions||[])].filter(Boolean).map(String));
      player.positionFamiliarity=positions.has(String(player.role))?1:player.tacticalFit>=.9?.92:.8;
      player.roleFamiliarity=roleFitScore(player.player,player.instructionRole,player.role);
      const sharpness=Number(player.player?.sharpness??80);
      const intelligence=contextualSkill(player,['decisions','teamwork','anticipation'],{fatigueWeight:0});
      player.tacticalFamiliarity=clamp(.68+sharpness/500+intelligence/900,.72,1.02);
      // Existing position/role fit remains dominant; tactical familiarity nudges
      // reaction/spacing quality rather than becoming an arbitrary attribute tax.
      player.tacticalFit=clamp(player.tacticalFit*(.94+player.tacticalFamiliarity*.06),.58,1.03);
    }));
  }

  queueTactics(teamIndex,patch,options={}){
    const team=this.state.teams[teamIndex];
    if(!team)return {ok:false,reason:'Equipe inválida.'};
    const merged={...(team.pendingTactics||team.tactics),...(patch||{})};
    if(patch?.playerRoles)merged.playerRoles={...((team.pendingTactics||team.tactics).playerRoles||{}),...patch.playerRoles};
    if(patch?.playerPositions)merged.playerPositions={...((team.pendingTactics||team.tactics).playerPositions||{}),...patch.playerPositions};
    return super.queueTactics(teamIndex,merged,options);
  }

  resolveDecision(){
    const before=this.state.clockSeconds;
    super.resolveDecision();
    const committedDelay=Math.max(.25,this.nextDecisionAt-before);
    this.nextDecisionAt=before+committedDelay*1.42;
  }

  resolveBallArrival(action){
    const plan=action?.outcome;
    if(plan?.kind==='pass'&&plan.receiverTeamIndex==null&&(plan.to?.y<=.012||plan.to?.y>=.988)){
      const lastTeam=this.state.ball.lastTouchTeamIndex;
      const throwTeam=lastTeam===0?1:0;
      const restart=resolveThrowIn(this.state,throwTeam,{x:plan.to.x,y:plan.to.y},this.rng);
      this.state.teams[throwTeam].stats.throwIns=(this.state.teams[throwTeam].stats.throwIns||0)+1;
      this.addEvent('throwIn',throwTeam,restart.taker?.id||null,'Lateral para recolocar a bola em jogo.',{setPiece:'throwIn',targetId:restart.target?.id||null});
      if(restart.target)this.changePossession(throwTeam,restart.target);
      else this.changePossession(throwTeam,this.state.teams[throwTeam].players.find(player=>!player.redCard));
      this.state.ball.action=null;
      this.state.activeAction=null;
      this.stoppage('throwIn');
      return;
    }
    return super.resolveBallArrival(action);
  }
}
