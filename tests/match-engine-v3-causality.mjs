import assert from 'node:assert/strict';
import { MatchEngine } from '../src/match-engine.js';
import { createMvpMatchData } from '../src/mvp-data.js';

function e(homeTactics={},seed=910){
  const d=createMvpMatchData();
  return new MatchEngine({
    home:d.home,away:d.away,
    homeLineup:d.homeLineup,awayLineup:d.awayLineup,
    homeTactics:{...d.homeTactics,...homeTactics},awayTactics:d.awayTactics,
    seed,strictInvariants:true
  });
}
function establish(engine,teamIndex){
  const s=engine.getSnapshot();
  if(s.phase==='prematch') engine.start();
  s.possessionTeamIndex=teamIndex;
  s.lastPossessionChangeAt=-99;
  engine.refreshDerived();
}
function spanY(engine){
  const a=engine.getSnapshot().spatial.tactical[0].anchors;
  return Math.max(...a.map(x=>x.y))-Math.min(...a.map(x=>x.y));
}
function lineX(engine){
  const t=engine.getSnapshot().teams[0];
  const defenders=t.players.filter(p=>['RB','LB','RCB','LCB','CB','RWB','LWB'].includes(p.role));
  return defenders.reduce((s,p)=>s+(t.direction===1?p.targetX:1-p.targetX),0)/defenders.length;
}
function anchorLocalX(engine,playerId){
  engine.refreshDerived();
  const s=engine.getSnapshot(),team=s.teams[0];
  const anchor=s.spatial.tactical[0].anchors.find(a=>String(a.playerId)===String(playerId));
  assert.ok(anchor,`missing tactical anchor for ${playerId}`);
  return team.direction===1?anchor.x:1-anchor.x;
}
{
  const narrow=e({width:25,widthInPossession:25}),wide=e({width:90,widthInPossession:90});
  establish(narrow,0);establish(wide,0);
  assert.ok(spanY(wide)>spanY(narrow),'width instruction must visibly widen player anchors');
}
{
  const low=e({defensiveLine:28}),high=e({defensiveLine:86});
  establish(low,1);establish(high,1);
  low.movePlayers(.25);high.movePlayers(.25);
  assert.ok(lineX(high)>lineX(low),'higher line must move defensive line upfield');
}
{
  const false9=e(),advanced=e();
  const p0=false9.getSnapshot().teams[0].players.find(p=>p.role==='ST');
  const p1=advanced.getSnapshot().teams[0].players.find(p=>p.role==='ST');
  assert.ok(p0&&p1);
  false9.queueTactics(0,{playerRoles:{...false9.getSnapshot().teams[0].tactics.playerRoles,[p0.id]:'falseNine'}});
  advanced.queueTactics(0,{playerRoles:{...advanced.getSnapshot().teams[0].tactics.playerRoles,[p1.id]:'advancedForward'}});
  false9.applyPendingChanges();advanced.applyPendingChanges();
  assert.equal(p0.instructionRole,'falseNine');
  assert.equal(p1.instructionRole,'advancedForward');
  establish(false9,0);establish(advanced,0);
  const lf=anchorLocalX(false9,p0.id),la=anchorLocalX(advanced,p1.id);
  assert.ok(lf<la,`false nine must be deeper in established possession (${lf.toFixed(3)} vs ${la.toFixed(3)})`);
}
console.log('Match Engine V3 tactical causality: OK');