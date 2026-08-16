import { contextualSkill } from '../core/player-attributes.js';
import { pointSegmentDistance, metricDistance } from './pitch-model.js';
export function inspectPassingLane(from,to,opponent){let risk=0;let best=null;for(const defender of opponent.players||[]){if(defender.redCard)continue;const lane=pointSegmentDistance(defender,from,to);if(lane.t<.06||lane.t>.98||lane.distance>.11)continue;const anticipation=contextualSkill(defender,['interceptions','anticipation','positioning','acceleration'])/100;const proximity=Math.exp(-lane.distance*22);const contribution=proximity*anticipation*(.55+Math.sin(Math.PI*lane.t)*.55);risk+=contribution;if(!best||contribution>best.contribution)best={player:defender,contribution,lane}}
 return {risk:Math.max(0,Math.min(1.45,risk)),blocker:best?.player||null,clearance:best?best.lane.distance:1,distance:metricDistance(from,to)};
}
export function passingLaneScore(from,to,opponent){const lane=inspectPassingLane(from,to,opponent);return Math.max(0,1-lane.risk*.7)}
