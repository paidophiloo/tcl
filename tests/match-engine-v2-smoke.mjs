// Historical filename retained because CI and external scripts already call it.
// It validates the public V3 facade, then runs causal, statistical and Match Day gates.
import './match-engine-v3-causality.mjs';
import './match-engine-v3-realism.mjs';
import './matchday-v3-ui-smoke.mjs';
import assert from 'node:assert/strict';
import { DECISION_SLICE_SECONDS, MatchEngine, MAX_SUBSTITUTION_WINDOWS, SIMULATION_VERSION, calculateTeamProfile } from '../src/match-engine.js';
import { createMvpMatchData } from '../src/mvp-data.js';

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