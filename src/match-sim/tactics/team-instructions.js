const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const MENTALITY={Defensiva:30,Cautelosa:40,Equilibrada:50,Positiva:62,Ofensiva:75,VeryAttacking:88};
const IP_DEFAULT={'4-2-3-1':'3-2-4-1','4-3-3':'3-2-5','4-4-2':'2-3-5','4-1-4-1':'3-2-5','3-4-3':'3-2-5','3-4-2-1':'3-2-5','3-5-2':'3-2-5','5-4-1':'3-2-5','5-3-2':'3-2-5','4-2-2-2':'2-3-5','4-3-2-1':'3-2-5','4-4-1-1':'2-3-5'};
const OOP_DEFAULT={'3-4-3':'5-4-1','3-4-2-1':'5-4-1','3-5-2':'5-3-2'};
export const DEFAULT_TACTICS=Object.freeze({formation:'4-2-3-1',formationInPossession:'3-2-4-1',formationOutOfPossession:'4-4-2',mentality:50,width:55,widthInPossession:58,widthOutOfPossession:50,defensiveLine:55,blockHeight:55,pressing:60,tempo:55,passingRisk:50,directness:50,counterpress:true,counter:true,defensiveWidth:52,pressingTrap:'Equilibrada',tackling:'Normal',marking:'Zona',offsideTrap:false,distribution:'Curta',chanceCreation:'Combinação curta',attackingFocus:'Equilibrado',freedom:'Equilibrada',playerRoles:{},playerPositions:{}});
function mentalityValue(v){if(Number.isFinite(Number(v)))return clamp(v);return MENTALITY[String(v)]??50}
function directness(v){if(Number.isFinite(Number(v)))return clamp(v);return ({Curta:30,Equilibrada:50,Direta:76})[String(v)]??50}
export function normalizeTeamInstructions(input={}){
 const formation=String(input.formation||DEFAULT_TACTICS.formation);
 const mentality=mentalityValue(input.mentality);
 const width=clamp(input.width??55);
 const defensiveLine=clamp(input.defensiveLine??55);
 const pressing=clamp(input.pressingIntensity??input.pressing??60);
 const tempo=clamp(input.tempo??55);
 const passingRisk=clamp(input.passingRisk??(input.chanceCreation==='Infiltrações'?62:input.chanceCreation==='Finalizar cedo'?68:50));
 const counterpress=input.counterpress!=null?Boolean(input.counterpress):String(input.afterLoss||'').toLowerCase().includes('contrapress');
 const counter=input.counter!=null?Boolean(input.counter):String(input.afterWin||'').toLowerCase().includes('contra');
 return {...DEFAULT_TACTICS,...input,formation,formationInPossession:String(input.formationInPossession||IP_DEFAULT[formation]||formation),formationOutOfPossession:String(input.formationOutOfPossession||OOP_DEFAULT[formation]||formation),mentality,width,widthInPossession:clamp(input.widthInPossession??width),widthOutOfPossession:clamp(input.widthOutOfPossession??input.defensiveWidth??width),defensiveLine,blockHeight:clamp(input.blockHeight??(input.defensiveShape==='Bloco alto'?72:input.defensiveShape==='Bloco baixo'?34:defensiveLine)),pressing,tempo,passingRisk,directness:directness(input.directness??input.buildUp),counterpress,counter,defensiveWidth:clamp(input.defensiveWidth??width),offsideTrap:Boolean(input.offsideTrap),playerRoles:{...(input.roles||{}),...(input.playerRoles||{})},playerPositions:{...(input.playerPositions||{})}};
}
export function tacticalRiskProfile(t){const n=normalizeTeamInstructions(t);return {verticality:clamp((n.directness+n.passingRisk)/2)/100,urgency:clamp((n.tempo+n.mentality)/2)/100,press:clamp(n.pressing)/100,line:clamp(n.defensiveLine)/100,widthIp:clamp(n.widthInPossession)/100,widthOop:clamp(n.widthOutOfPossession)/100}}
