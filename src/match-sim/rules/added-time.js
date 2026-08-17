const COST=Object.freeze({goal:32,foul:15,shot:7,offside:9,corner:6,injury:48,substitution:24,varReview:52,redCard:20,penalty:32});
export function stoppageCost(reason){return COST[String(reason)]??5}
export function createAddedTimeLedger(){return {firstHalf:0,secondHalf:0,extraTimeFirst:0,extraTimeSecond:0}}
export function periodLedgerKey(phase,period){if(phase==='firstHalf'||phase==='firstHalfAdded'||period===1)return 'firstHalf';if(phase==='secondHalf'||phase==='secondHalfAdded'||period===2)return 'secondHalf';if(period===3)return 'extraTimeFirst';return 'extraTimeSecond'}
export function calculateAddedTimeSeconds(ledgerSeconds,{period=1}={}){const floor=period===1?45:period===2?90:30;const cap=period<=2?(period===1?360:540):180;return Math.min(cap,Math.ceil(Math.max(floor,Number(ledgerSeconds)||0)/15)*15)}
