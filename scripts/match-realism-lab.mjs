import { MatchEngine } from '../src/match-engine.js';
import { createMvpMatchData } from '../src/mvp-data.js';

const arg=(name,fallback)=>{const row=process.argv.find(v=>v.startsWith(`--${name}=`));return row?Number(row.split('=')[1]):fallback};
const matches=Math.max(1,arg('matches',100));
const seedBase=arg('seed',86000);
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
function run(seed,mutate=null){const d=createMvpMatchData();if(mutate)mutate(d);const e=new MatchEngine({home:d.home,away:d.away,homeLineup:d.homeLineup,awayLineup:d.awayLineup,homeTactics:d.homeTactics,awayTactics:d.awayTactics,seed,strictInvariants:true,aiTeamIndexes:[0,1]});e.start();e.processGameWindow(45*60);e.resumeSecondHalf();e.processGameWindow(45*60);return e.getSnapshot()}
const rows=[];for(let i=0;i<matches;i++){const s=run(seedBase+i);rows.push({home:s.score[0],away:s.score[1],goals:s.score[0]+s.score[1],shots:s.teams[0].stats.shots+s.teams[1].stats.shots,sot:s.teams[0].stats.shotsOnTarget+s.teams[1].stats.shotsOnTarget,xg:s.teams[0].stats.xG+s.teams[1].stats.xG,passes:s.teams[0].stats.passesAttempted+s.teams[1].stats.passesAttempted,cards:s.teams[0].stats.yellowCards+s.teams[1].stats.yellowCards,offsides:s.teams[0].stats.offsides+s.teams[1].stats.offsides})}
const scoreFreq={};for(const r of rows){const k=`${r.home}-${r.away}`;scoreFreq[k]=(scoreFreq[k]||0)+1}
const report={simulation:'touchline-match-sim-v3',matches,goalsPerMatch:+mean(rows.map(r=>r.goals)).toFixed(3),shotsPerMatch:+mean(rows.map(r=>r.shots)).toFixed(3),shotsOnTargetPerMatch:+mean(rows.map(r=>r.sot)).toFixed(3),xgPerMatch:+mean(rows.map(r=>r.xg)).toFixed(3),passesPerMatch:+mean(rows.map(r=>r.passes)).toFixed(1),cardsPerMatch:+mean(rows.map(r=>r.cards)).toFixed(3),offsidesPerMatch:+mean(rows.map(r=>r.offsides)).toFixed(3),homeWinRate:+(rows.filter(r=>r.home>r.away).length/matches).toFixed(3),drawRate:+(rows.filter(r=>r.home===r.away).length/matches).toFixed(3),awayWinRate:+(rows.filter(r=>r.away>r.home).length/matches).toFixed(3),zeroZeroRate:+(rows.filter(r=>r.home===0&&r.away===0).length/matches).toFixed(3),scoreFrequency:Object.fromEntries(Object.entries(scoreFreq).sort((a,b)=>b[1]-a[1]).slice(0,12))};
console.log(JSON.stringify(report,null,2));
