const PRIORITY={goal:10,penalty:9,redCard:9,bigChance:8,shotOnTarget:6,shot:4,yellowCard:3,injury:5,substitution:2,tacticalChange:1};
export function highlightThreshold(mode='KEY'){return ({FULL:0,COMPREHENSIVE:1,EXTENDED:3,KEY:6,DYNAMIC:5})[String(mode).toUpperCase()]??6}
export function isHighlight(event,mode='KEY'){return (PRIORITY[event?.type]??0)>=highlightThreshold(mode)}
export function selectHighlights(events=[],mode='KEY'){return events.filter(e=>isHighlight(e,mode))}
