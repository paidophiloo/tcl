import { MatchEngine as CoreMatchEngine } from './engine-v3.js';
import { contextualSkill } from './core/player-attributes.js';
import { resolveFreeKick, resolveGoalKick } from './set-pieces/set-piece-engine.js';

export * from './engine-v3.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const same=(a,b)=>String(a)===String(b);

/** Competition/presentation-safe completion layer over the causal V3 core.
 * The base engine owns football decisions. This layer owns reportable injuries,
 * richer restart semantics and the two 15-minute extra-time periods. */
export class MatchEngine extends CoreMatchEngine {
  constructor(options={}){
    super(options);
    this.reportedInjuries=new Set();
    this.extraSubGranted=false;
  }

  updateEnergy(dt){
    super.updateEnergy(dt);
    this.state.teams.forEach((team,teamIndex)=>team.players.forEach(player=>{
      if(!player.injured||this.reportedInjuries.has(String(player.id)))return;
      this.reportedInjuries.add(String(player.id));
      const severity=player.injured.severity||'minor';
      if(severity==='serious')player.stamina=Math.min(player.stamina,34);
      else if(severity==='moderate')player.stamina=Math.min(player.stamina,52);
      player.tacticalFit=Math.max(.58,player.tacticalFit-(severity==='serious'?.18:severity==='moderate'?.1:.04));
      this.addEvent('injury',teamIndex,player.id,`${player.player.name} sentiu uma lesão ${severity==='serious'?'séria':severity==='moderate'?'moderada':'leve'}.`,{severity,risk:player.injured.risk});
      if(team.ai.enabled&&!team.pendingSubstitution&&severity!=='minor'){
        const incoming=team.bench.filter(p=>!team.usedPlayerIds.includes(String(p.id))).sort((a,b)=>(b.overall??b.rating??0)-(a.overall??a.rating??0))[0];
        if(incoming)this.queueSubstitution(teamIndex,player.id,incoming.id,{source:'ai-injury'});
      }
    }));
  }

  handleFoul(defTeamIndex,defender,attacker,incident){
    const spot={x:attacker?.x??this.state.ball.x,y:attacker?.y??this.state.ball.y};
    const beforeScore=[...this.state.score];
    super.handleFoul(defTeamIndex,defender,attacker,incident);
    if(incident.penalty||this.state.score[0]!==beforeScore[0]||this.state.score[1]!==beforeScore[1])return;
    const attackIndex=1-defTeamIndex;
    const free=resolveFreeKick(this.state,attackIndex,spot,this.rng);
    this.addEvent('freeKick',attackIndex,free.taker?.id||attacker?.id||null,free.type==='direct'?'Falta em zona de chute.':'Falta cobrada para reorganizar o ataque.',{setPiece:'freeKick',freeKickType:free.type,xG:free.xG||0});
    if(free.type==='direct'){
      const team=this.state.teams[attackIndex];
      team.stats.shots+=1;
      team.stats.xG+=free.xG;
      if(free.taker){free.taker.stats.shots+=1;free.taker.stats.xG+=free.xG}
      const onTarget=Boolean(free.goal||free.onTarget);
      if(onTarget){team.stats.shotsOnTarget+=1;if(free.taker)free.taker.stats.shotsOnTarget+=1}
      if(free.goal){
        this.state.score[attackIndex]+=1;team.stats.goals+=1;if(free.taker)free.taker.stats.goals+=1;
        this.addEvent('goal',attackIndex,free.taker?.id||null,`Gol de falta de ${free.taker?.player?.name||'Touchline'}.`,{xG:free.xG,setPiece:'freeKick'});
        this.resetKickoff(defTeamIndex);
      } else if(onTarget&&free.goalkeeper){
        free.goalkeeper.stats.saves+=1;this.state.teams[defTeamIndex].stats.saves+=1;
      }
    }
  }

  finishShot(plan){
    super.finishShot(plan);
    if(!plan.goal&&!plan.onTarget){
      const defendingIndex=1-plan.teamIndex;
      const restart=resolveGoalKick(this.state,defendingIndex,this.rng);
      this.addEvent('goalKick',defendingIndex,restart.taker?.id||null,restart.short?'Tiro de meta curto.':'Tiro de meta longo.',{setPiece:'goalKick',targetId:restart.target?.id||null});
    }
  }

  processSlice(dt){
    super.processSlice(dt);
    if(this.state.phase==='extraTime'&&this.state.period===3&&this.state.clockSeconds>=105*60&&this.state.clockSeconds<120*60){
      this.state.clockSeconds=105*60;
      this.state.phase='extraTimeHalftime';
      this.state.paused=true;
      this.clock.reset();
      this.addEvent('extraTimeHalftime',null,null,'Intervalo da prorrogação.');
    }
  }

  resumeExtraTime(){
    if(this.state.phase==='extraTimeHalftime'){
      this.state.phase='extraTime';this.state.period=4;this.state.paused=false;this.resetKickoff(1);this.nextDecisionAt=this.state.clockSeconds+2.2;
      this.addEvent('extraTimeSecondHalf',null,null,'Começa o segundo tempo da prorrogação.');
      return true;
    }
    const fromRegulation=this.state.phase==='extraTimeBreak';
    const result=super.resumeExtraTime();
    if(result&&fromRegulation&&this.rules.extraTimeAdditionalSubstitution&&!this.extraSubGranted){
      this.rules.maxSubstitutions+=1;this.extraSubGranted=true;
    }
    return result;
  }

  checkInvariants(){
    const result=super.checkInvariants();
    const errors=[...result.errors];
    if(this.state.phase==='extraTimeHalftime'&&Math.abs(this.state.clockSeconds-105*60)>.001)errors.push('intervalo da prorrogação fora de 105 minutos');
    for(const team of this.state.teams){
      for(const player of team.players){
        if(player.injured&&player.stamina>100)errors.push(`condição de lesionado inválida ${player.id}`);
      }
    }
    return {ok:errors.length===0,errors};
  }
}
