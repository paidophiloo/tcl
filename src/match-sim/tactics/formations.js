const freezeShape = rows => Object.freeze(rows.map(row => Object.freeze({ ...row })));

const SHAPES = {
  '4-2-3-1': freezeShape([
    { role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    { role:'RDM',x:.40,y:.61},{role:'LDM',x:.40,y:.39},{role:'RW',x:.63,y:.82},{role:'AM',x:.61,y:.50},{role:'LW',x:.63,y:.18},{role:'ST',x:.82,y:.50}
  ]),
  '4-3-3': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    {role:'DM',x:.39,y:.50},{role:'RCM',x:.51,y:.65},{role:'LCM',x:.51,y:.35},{role:'RW',x:.74,y:.82},{role:'ST',x:.82,y:.50},{role:'LW',x:.74,y:.18}
  ]),
  '4-4-2': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    {role:'RM',x:.48,y:.84},{role:'RCM',x:.46,y:.61},{role:'LCM',x:.46,y:.39},{role:'LM',x:.48,y:.16},{role:'RST',x:.78,y:.62},{role:'LST',x:.78,y:.38}
  ]),
  '4-1-4-1': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    {role:'DM',x:.36,y:.50},{role:'RM',x:.53,y:.83},{role:'RCM',x:.51,y:.61},{role:'LCM',x:.51,y:.39},{role:'LM',x:.53,y:.17},{role:'ST',x:.80,y:.50}
  ]),
  '3-4-3': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RCB',x:.21,y:.72},{role:'CB',x:.19,y:.50},{role:'LCB',x:.21,y:.28},
    {role:'RWB',x:.45,y:.89},{role:'RCM',x:.44,y:.61},{role:'LCM',x:.44,y:.39},{role:'LWB',x:.45,y:.11},
    {role:'RW',x:.72,y:.78},{role:'ST',x:.81,y:.50},{role:'LW',x:.72,y:.22}
  ]),
  '3-4-2-1': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RCB',x:.21,y:.72},{role:'CB',x:.19,y:.50},{role:'LCB',x:.21,y:.28},
    {role:'RWB',x:.45,y:.89},{role:'RCM',x:.44,y:.61},{role:'LCM',x:.44,y:.39},{role:'LWB',x:.45,y:.11},
    {role:'RAM',x:.65,y:.65},{role:'LAM',x:.65,y:.35},{role:'ST',x:.82,y:.50}
  ]),
  '3-5-2': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RCB',x:.21,y:.72},{role:'CB',x:.19,y:.50},{role:'LCB',x:.21,y:.28},
    {role:'RWB',x:.45,y:.90},{role:'RCM',x:.47,y:.66},{role:'DM',x:.40,y:.50},{role:'LCM',x:.47,y:.34},{role:'LWB',x:.45,y:.10},
    {role:'RST',x:.77,y:.61},{role:'LST',x:.77,y:.39}
  ]),
  '5-4-1': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RWB',x:.27,y:.91},{role:'RCB',x:.19,y:.70},{role:'CB',x:.18,y:.50},{role:'LCB',x:.19,y:.30},{role:'LWB',x:.27,y:.09},
    {role:'RM',x:.48,y:.82},{role:'RCM',x:.45,y:.60},{role:'LCM',x:.45,y:.40},{role:'LM',x:.48,y:.18},{role:'ST',x:.76,y:.50}
  ]),
  '5-3-2': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RWB',x:.27,y:.91},{role:'RCB',x:.19,y:.70},{role:'CB',x:.18,y:.50},{role:'LCB',x:.19,y:.30},{role:'LWB',x:.27,y:.09},
    {role:'RCM',x:.45,y:.65},{role:'DM',x:.39,y:.50},{role:'LCM',x:.45,y:.35},{role:'RST',x:.75,y:.61},{role:'LST',x:.75,y:.39}
  ]),
  '4-2-2-2': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    {role:'RDM',x:.41,y:.61},{role:'LDM',x:.41,y:.39},{role:'RAM',x:.61,y:.68},{role:'LAM',x:.61,y:.32},{role:'RST',x:.79,y:.61},{role:'LST',x:.79,y:.39}
  ]),
  '4-3-2-1': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    {role:'RCM',x:.47,y:.67},{role:'DM',x:.40,y:.50},{role:'LCM',x:.47,y:.33},{role:'RAM',x:.66,y:.63},{role:'LAM',x:.66,y:.37},{role:'ST',x:.82,y:.50}
  ]),
  '4-4-1-1': freezeShape([
    {role:'GK',x:.06,y:.50},{role:'RB',x:.22,y:.84},{role:'RCB',x:.20,y:.61},{role:'LCB',x:.20,y:.39},{role:'LB',x:.22,y:.16},
    {role:'RM',x:.47,y:.84},{role:'RCM',x:.45,y:.61},{role:'LCM',x:.45,y:.39},{role:'LM',x:.47,y:.16},{role:'AM',x:.64,y:.50},{role:'ST',x:.81,y:.50}
  ]),
  '3-2-5': freezeShape([
    {role:'GK',x:.08,y:.50},{role:'RCB',x:.29,y:.72},{role:'CB',x:.27,y:.50},{role:'LCB',x:.29,y:.28},
    {role:'RDM',x:.48,y:.61},{role:'LDM',x:.48,y:.39},{role:'RW',x:.76,y:.91},{role:'RAM',x:.73,y:.66},{role:'ST',x:.84,y:.50},{role:'LAM',x:.73,y:.34},{role:'LW',x:.76,y:.09}
  ]),
  '3-2-4-1': freezeShape([
    {role:'GK',x:.08,y:.50},{role:'RCB',x:.29,y:.72},{role:'CB',x:.27,y:.50},{role:'LCB',x:.29,y:.28},
    {role:'RDM',x:.48,y:.61},{role:'LDM',x:.48,y:.39},{role:'RW',x:.70,y:.88},{role:'RAM',x:.68,y:.62},{role:'LAM',x:.68,y:.38},{role:'LW',x:.70,y:.12},{role:'ST',x:.84,y:.50}
  ]),
  '2-3-5': freezeShape([
    {role:'GK',x:.08,y:.50},{role:'RCB',x:.29,y:.62},{role:'LCB',x:.29,y:.38},{role:'RDM',x:.49,y:.72},{role:'DM',x:.47,y:.50},{role:'LDM',x:.49,y:.28},
    {role:'RW',x:.77,y:.92},{role:'RAM',x:.73,y:.67},{role:'ST',x:.85,y:.50},{role:'LAM',x:.73,y:.33},{role:'LW',x:.77,y:.08}
  ])
};

export const FORMATIONS = Object.freeze(SHAPES);
export const FORMATION_NAMES = Object.freeze(Object.keys(SHAPES).filter(name => !['3-2-5','3-2-4-1','2-3-5'].includes(name)));

export const POSITION_GROUP = Object.freeze({
  GK:'GK', RB:'DEF', RCB:'DEF', CB:'DEF', LCB:'DEF', LB:'DEF', RWB:'DEF', LWB:'DEF',
  RDM:'MID', LDM:'MID', DM:'MID', RCM:'MID', CM:'MID', LCM:'MID', RM:'MID', LM:'MID', AM:'MID', RAM:'MID', LAM:'MID',
  RW:'FWD', LW:'FWD', RST:'FWD', ST:'FWD', LST:'FWD'
});

export function getFormation(name = '4-2-3-1') {
  return FORMATIONS[name] || FORMATIONS['4-2-3-1'];
}

export function slotGroup(role) {
  return POSITION_GROUP[role] || 'MID';
}

export function slotSide(role) {
  if (/^(R|.*R$)/.test(role) || ['RB','RWB','RM','RW','RAM','RCM','RDM','RCB','RST'].includes(role)) return 'right';
  if (/^(L|.*L$)/.test(role) || ['LB','LWB','LM','LW','LAM','LCM','LDM','LCB','LST'].includes(role)) return 'left';
  return 'center';
}
