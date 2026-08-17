import { MatchEngine as CompletedV3 } from './engine-final.js';
import { HALF_SECONDS, FULL_TIME_SECONDS } from './core/simulation-clock.js';
import { updateBallFlight } from './core/ball-state.js';
import { calculateAddedTimeSeconds, createAddedTimeLedger, periodLedgerKey, stoppageCost } from './rules/added-time.js';
import { reviewableIncident, reviewIncident } from './rules/var.js';

export * from './engine-final.js';
const EPS=1e-8;

export class MatchEngine extends CompletedV3 {
  constructor(options={}){
    super(options);
    this.state.addedTime={ledger:createAddedTimeLedger(),played:{firstHalf:0,secondHalf:0,extraTimeFirst:0,extraTimeSecond:0},target:null};
    this._addedTimeBypass=false;
  }

  ledgerKey(){return periodLedgerKey(this.state.phase,this.state.period)}
  addLostTime(seconds){const key=this.ledgerKey();this.state.addedTime.ledger[key]=(this.state.addedTime.ledger[key]||0)+Math.max(0,Number(seconds)||0)}
  stoppage(reason){this.addLostTime(stoppageCost(reason));return super.stoppage(reason)}

  addEvent(type,teamIndex,playerId,description,extra={}){
    const event=super.addEvent(type,teamIndex,playerId,description,extra);
    if(type==='injury')this.addLostTime(stoppageCost('injury'));
    else if(type==='substitution')this.addLostTime(stoppageCost('substitution'));
    else if(type==='varReview')this.addLostTime(stoppageCost('varReview'));
    return event;
  }

  handleFoul(defTeamIndex,defender,attacker,incident){
    const reviewType=incident.penalty?'penalty':incident.red?'redCard':'';
    if(reviewableIncident(reviewType,this.rules)){
      const review=reviewIncident({type:reviewType,incident,inBox:incident.penalty});
      this.addEvent('varReview',null,null,review.reason,{review});
      if(review.outcome==='overturned')incident={...incident,penalty:reviewType==='penalty'?false:incident.penalty,red:reviewType==='redCard'?false:incident.red};
    }
    return super.handleFoul(defTeamIndex,defender,attacker,incident);
  }

  beginAddedTime(basePhase,baseEnd,period){
    const key=periodLedgerKey(basePhase,period),seconds=calculateAddedTimeSeconds(this.state.addedTime.ledger[key],{period});
    this.state.addedTime.played[key]=seconds;
    this.state.addedTime.target=baseEnd+seconds;
    this.state.phase=basePhase==='firstHalf'?'firstHalfAdded':'secondHalfAdded';
    this.state.paused=false;
    this.addEvent('addedTime',null,null,`${Math.ceil(seconds/60)} minuto${seconds>60?'s':''} de acréscimo.`,{seconds,period});
  }

  periodBoundary(){
    if(this._addedTimeBypass){this._addedTimeBypass=false;return super.periodBoundary()}
    if(this.state.phase==='firstHalf'&&this.state.clockSeconds>=HALF_SECONDS-EPS){this.beginAddedTime('firstHalf',HALF_SECONDS,1);return}
    if(this.state.phase==='secondHalf'&&this.state.clockSeconds>=FULL_TIME_SECONDS-EPS){this.beginAddedTime('secondHalf',FULL_TIME_SECONDS,2);return}
    return super.periodBoundary();
  }

  processAddedSlice(dt){
    const s=this.state,target=s.addedTime.target,usable=Math.min(dt,Math.max(0,target-s.clockSeconds));
    if(usable<=EPS)return this.finishAddedPeriod();
    s.clockSeconds+=usable;
    s.teams[s.possessionTeamIndex].stats.possessionSeconds+=usable;
    this.movePlayers(usable);
    this.updateEnergy(usable);
    const arrival=updateBallFlight(s.ball,usable);
    if(arrival.arrived)this.resolveBallArrival(arrival.action);
    if(!s.ball.action&&s.ball.carrierId&&s.clockSeconds>=this.nextDecisionAt)this.resolveDecision();
    this.maybeManageAi();
    if(Math.floor(s.clockSeconds*4)%4===0)this.refreshDerived();
    this.replay.push(this.presentationSnapshot());
    if(s.clockSeconds>=target-EPS)this.finishAddedPeriod();
  }

  finishAddedPeriod(){
    const first=this.state.phase==='firstHalfAdded';
    this.state.phase=first?'firstHalf':'secondHalf';
    this.state.addedTime.target=null;
    this._addedTimeBypass=true;
    return this.periodBoundary();
  }

  resumeSecondHalf(){
    if(this.state.phase==='halftime')this.state.clockSeconds=HALF_SECONDS;
    return super.resumeSecondHalf();
  }

  resumeExtraTime(){
    if(this.state.phase==='extraTimeBreak')this.state.clockSeconds=FULL_TIME_SECONDS;
    return super.resumeExtraTime();
  }

  processSlice(dt){
    if(this.state.phase==='firstHalfAdded'||this.state.phase==='secondHalfAdded')return this.processAddedSlice(dt);
    return super.processSlice(dt);
  }

  checkInvariants(){
    const base=super.checkInvariants(),errors=[...base.errors];
    if((this.state.phase==='firstHalfAdded'||this.state.phase==='secondHalfAdded')&&!Number.isFinite(this.state.addedTime.target))errors.push('alvo de acréscimo inválido');
    return {ok:errors.length===0,errors};
  }
}
