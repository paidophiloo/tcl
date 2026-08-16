export const PITCH_LENGTH_M=105; export const PITCH_WIDTH_M=68;
export const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
export function localPoint(team,point){return team.direction===-1?{x:1-point.x,y:1-point.y}:{x:point.x,y:point.y}}
export function worldPoint(team,point){return team.direction===-1?{x:1-point.x,y:1-point.y}:{x:point.x,y:point.y}}
export function metricDistance(a,b){return Math.hypot((a.x-b.x)*PITCH_LENGTH_M,(a.y-b.y)*PITCH_WIDTH_M)}
export function normalizedDistance(a,b){return Math.hypot((a.x-b.x)*1.05,a.y-b.y)}
export function pointSegmentDistance(point,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=point.x-a.x,wy=point.y-a.y;const len=vx*vx+vy*vy||1e-9;const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/len));const x=a.x+t*vx,y=a.y+t*vy;return {distance:Math.hypot((point.x-x)*1.05,point.y-y),t,x,y}}
export function inPenaltyArea(team,point){const p=localPoint(team,point);return p.x>.84&&Math.abs(p.y-.5)<.295}
export function goalDistance(team,point){const p=localPoint(team,point);return Math.hypot((1-p.x)*1.05,(p.y-.5)*.68)}
export function goalAngleQuality(team,point){const p=localPoint(team,point);const dx=Math.max(.01,1-p.x),dy=Math.abs(p.y-.5);return Math.max(.12,Math.min(1,1-dy*1.5-dx*.12))}
export function zoneOf(team,point){const p=localPoint(team,point);const third=p.x<.34?'defensive':p.x<.67?'middle':'attacking';const lane=p.y<.22?'leftWide':p.y<.42?'leftHalf':p.y<.58?'central':p.y<.78?'rightHalf':'rightWide';return {third,lane,local:p}}
