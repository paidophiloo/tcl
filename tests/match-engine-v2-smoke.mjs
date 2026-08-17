// Historical filename retained because CI and external scripts already call it.
// It validates the public V3 facade and runs causal, statistical and Match Day gates.
import assert from 'node:assert/strict';
import { DECISION_SLICE_SECONDS, MatchEngine, MAX_SUBSTITUTION_WINDOWS, SIMULATION_VERSION, calculateTeamProfile } from '../src/match-engine.js';
import { createMvpMatchData } from '../src/mvp-data.js';

async function gate(label,path){
  try{
    await import(path);
    console.log(`::notice file=tests/match-engine-v2-smoke.mjs,line=1,title=V3 gate passed::${label}`);
  }catch(error){
    const message=String(error?.stack||error?.message||error).replace(/\r?\n/g,' | ').slice(0,3500);
    console.log(`::error file=tests/match-engine-v2-smoke.mjs,line=1,title=V3 gate failed - ${label}::${message}`);
    throw error;
  }
}

await gate('tactical causality','./match-engine-v3-causality.mjs');
await gate('statistical realism','./match-engine-v3-realism.mjs');
await gate('top-down Match Day UI','./matchday-v3-ui-smoke.mjs');

function makeEngine({seed=2718,homeTactics={},awayTactics={},requiresWinner=false,aiTeamIndexes=[]}={}){const d=createMvpMatchData();return new MatchEngine({home:d.home,away:d.away,homeLineup:d.homeLineup,awayLineup:d.awayLineup,homeTactics:{...d.homeTactics,...homeTactics},awayTactics:{...d.awayTactics,...awayTactics},seed,realDurationSeconds:120,requiresWinner,aiTeamIndexes,strictInvariants:true})}
const stamina=t=>t.players.reduce((s,p)=>s+p.stamina,0)/t.players.length;
assert.equal(SIMULATION_VERSION,'touchline-match-sim-v3');assert.equal(DECISION_SLICE_SECONDS,.25);assert.equal(MAX_SUBSTITUTION_WINDOWS,3);
{
 const e=makeEngine();e.start();e.processGameWindow(20);const before=e.getSnapshot().clockSeconds;e.setPaused(true);e.tick(1/30);assert.equal(e.getSnapshot().clockSeconds,before);e.setPaused(false);e.processGameWindow(.25);assert.ok(e.getSnapshot().clockSeconds>before);
}
{
 const a=makeEngine({seed:404}),b=makeEngine({seed:404});a.start();b.start();a.processGameWindow(900);for(let i=0;i<90;i++)b.processGameWindow(10);assert.deepEqual(a.getSnapshot().score,b.getSnapshot().score);assert.equal(a.getSnapshot().teams[0].stats.passesAttempted,b.getSnapshot().teams[0].stats.passesAttempted);assert.equal(a.getSnapshot().teams[1].stats.shots,b.getSnapshot().teams[1].stats.shots);
}
{
 // Playback speed is presentation throughput only. Equivalent real-time input
 // at 1x and 4x must consume the same fixed 250 ms simulation slices.
 const one=makeEngine({seed:7331}),four=makeEngine({seed:7331});one.start();four.start();one.setSpeed(1);four.setSpeed(4);for(let i=0;i<400;i++){one.tick(.05);four.tick(.0125)}assert.equal(one.getSnapshot().clockSeconds,four.getSnapshot().clockSeconds);assert.deepEqual(one.getSnapshot().score,four.getSnapshot().score);assert.equal(one.getSnapshot().teams[0].stats.passesAttempted,four.getSnapshot().teams[0].stats.passesAttempted);assert.equal(one.getSnapshot().teams[1].stats.shots,four.getSnapshot().teams[1].stats.shots);
}
{
 // One formation may deliberately become a different shape with and without
 // the ball; phase changes must expose those named structures to presentation.
 const e=makeEngine({homeTactics:{formation:'4-2-3-1',formationInPossession:'3-2-5',formationOutOfPossession:'4-4-2'}});e.start();const s=e.getSnapshot();s.clockSeconds=20;s.possessionTeamIndex=0;s.lastPossessionChangeAt=0;e.refreshDerived();assert.equal(s.spatial.tactical[0].phase,'IN_POSSESSION');assert.equal(s.spatial.tactical[0].shape,'3-2-5');s.possessionTeamIndex=1;s.lastPossessionChangeAt=0;e.refreshDerived();assert.equal(s.spatial.tactical[0].phase,'OUT_OF_POSSESSION');assert.equal(s.spatial.tactical[0].shape,'4-4-2');
}
{
 const high=makeEngine({homeTactics:{pressing:92,tempo:78,counterpress:true}}),low=makeEngine({homeTactics:{pressing:22,tempo:42,counterpress:false}});high.start();low.start();high.processGameWindow(900);low.processGameWindow(900);assert.ok(stamina(high.getSnapshot().teams[0])<stamina(low.getSnapshot().teams[0]));
}
{
 const d=createMvpMatchData(),controlled=calculateTeamProfile(d.home,d.homeLineup,{...d.homeTactics,mentality:34,pressing:35,tempo:42,passingRisk:35,counterpress:false}),aggressive=calculateTeamProfile(d.home,d.homeLineup,{...d.homeTactics,mentality:78,pressing:88,tempo:82,passingRisk:72,counterpress:true});assert.ok(aggressive.attackIntent>controlled.attackIntent);assert.ok(aggressive.pressIntensity>controlled.pressIntensity);
}
{
 const e=makeEngine();e.start();const team=e.getSnapshot().teams[0];for(let w=0;w<3;w++){const out=team.players.find(p=>p.role!=='GK'&&!team.substitutedOutIds.includes(String(p.id))),inc=team.bench.find(p=>!team.usedPlayerIds.includes(String(p.id)));assert.ok(out&&inc);assert.equal(e.queueSubstitution(0,out.id,inc.id).ok,true);e.applyPendingChanges()}assert.equal(team.substitutionWindowsUsed,3);const out=team.players.find(p=>p.role!=='GK'),inc=team.bench.find(p=>!team.usedPlayerIds.includes(String(p.id)));assert.equal(e.queueSubstitution(0,out.id,inc.id).ok,false);
}
{
 const e=makeEngine();e.start();e.state.clockSeconds=45*60;e.periodBoundary();assert.equal(e.getSnapshot().phase,'firstHalfAdded');assert.ok(e.getSnapshot().addedTime.played.firstHalf>=45);e.processGameWindow(600);assert.equal(e.getSnapshot().phase,'halftime');const team=e.getSnapshot().teams[0],out=team.players.find(p=>p.role!=='GK'),inc=team.bench.find(p=>!team.usedPlayerIds.includes(String(p.id)));assert.equal(e.queueSubstitution(0,out.id,inc.id).ok,true);e.applyPendingChanges({halftime:true});assert.equal(team.substitutionsUsed,1);assert.equal(team.substitutionWindowsUsed,0);
}
{
 const league=makeEngine({requiresWinner:false});league.start();league.state.score=[0,0];league.finishMatch();assert.equal(league.getSnapshot().shootout,null);const cup=makeEngine({requiresWinner:true});cup.start();cup.state.score=[0,0];cup.finishMatch();assert.ok(cup.getSnapshot().shootout);assert.notEqual(cup.getSnapshot().shootout.goals[0],cup.getSnapshot().shootout.goals[1]);
}
console.log('Match Engine V3 compatibility smoke: OK');