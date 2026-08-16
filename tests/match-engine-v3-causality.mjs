import assert from 'node:assert/strict';
import { MatchEngine } from '../src/match-engine.js'; import { createMvpMatchData } from '../src/mvp-data.js';
function e(homeTactics={},seed=910){const d=createMvpMatchData();return new MatchEngine({home:d.home,away:d.away,homeLineup:d.homeLineup,awayLineup:d.awayLineup,homeTactics:{...d.homeTactics,...homeTactics},awayTactics:d.awayTactics,seed,strictInvariants:true})}
function spanY(engine){const a=engine.getSnapshot().spatial.tactical[0].anchors;return Math.max(...a.map(x=>x.y))-Math.min(...a.map(x=>x.y))}
function lineX(engine){const t=engine.getSnapshot().teams[0];const defenders=t.players.filter(p=>['RB','LB','RCB','LCB','CB','RWB','LWB'].includes(p.role));return defenders.reduce((s,p)=>s+(t.direction===1?p.targetX:1-p.targetX),0)/defenders.length}
{
 const narrow=e({width:25,widthInPossession:25}),wide=e({width:90,widthInPossession:90});narrow.start();wide.start();narrow.processGameWindow(8);wide.processGameWindow(8);narrow.refreshDerived();wide.refreshDerived();assert.ok(spanY(wide)>spanY(narrow),'width instruction must visibly widen player anchors');
}
{
 const low=e({defensiveLine:28}),high=e({defensiveLine:86});low.start();high.start();low.state.possessionTeamIndex=1;high.state.possessionTeamIndex=1;low.processGameWindow(8);high.processGameWindow(8);assert.ok(lineX(high)>lineX(low),'higher line must move defensive line upfield');
}
{
 const false9=e();const advanced=e();const p0=false9.getSnapshot().teams[0].players.find(p=>p.role==='ST'),p1=advanced.getSnapshot().teams[0].players.find(p=>p.role==='ST');assert.ok(p0&&p1);false9.getSnapshot().teams[0].tactics.playerRoles[p0.id]='falseNine';advanced.getSnapshot().teams[0].tactics.playerRoles[p1.id]='advancedForward';false9.queueTactics(0,{playerRoles:false9.getSnapshot().teams[0].tactics.playerRoles});advanced.queueTactics(0,{playerRoles:advanced.getSnapshot().teams[0].tactics.playerRoles});false9.applyPendingChanges();advanced.applyPendingChanges();false9.start();advanced.start();false9.processGameWindow(12);advanced.processGameWindow(12);const lf=false9.getSnapshot().teams[0].direction===1?p0.targetX:1-p0.targetX,la=advanced.getSnapshot().teams[0].direction===1?p1.targetX:1-p1.targetX;assert.ok(lf<la,'false nine must occupy a deeper attacking position than an advanced forward');
}
console.log('Match Engine V3 tactical causality: OK');
