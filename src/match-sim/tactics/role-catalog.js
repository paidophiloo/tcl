import { slotGroup } from './formations.js';

const role = (id, groups, ip, oop, transition = {}) => Object.freeze({
  id,
  groups: Object.freeze(groups),
  ip: Object.freeze({ advance:0, width:0, roam:0, ballDemand:.5, passRisk:.5, carry:.5, box:.2, support:.5, run:'support', ...ip }),
  oop: Object.freeze({ line:0, width:0, press:.5, mark:.5, cover:.5, recover:.5, ...oop }),
  transition: Object.freeze({ attack:.5, defence:.5, counterpress:.5, ...transition })
});

export const ROLE_CATALOG = Object.freeze({
  goalkeeper: role('goalkeeper',['GK'],{passRisk:.25,ballDemand:.15},{press:.05,mark:.1,cover:.45},{attack:.1,defence:.6}),
  sweeperKeeper: role('sweeperKeeper',['GK'],{advance:.04,passRisk:.58,ballDemand:.3},{line:.07,press:.16,cover:.72},{attack:.28,defence:.72}),
  ballPlayingGoalkeeper: role('ballPlayingGoalkeeper',['GK'],{advance:.025,passRisk:.68,ballDemand:.46},{line:.04,cover:.62},{attack:.36,defence:.66}),

  centralDefender: role('centralDefender',['DEF'],{advance:.01,passRisk:.34,ballDemand:.34},{mark:.75,cover:.66,press:.34},{attack:.16,defence:.8}),
  stopper: role('stopper',['DEF'],{advance:.02,passRisk:.3},{line:.035,mark:.7,cover:.38,press:.76},{attack:.2,defence:.84,counterpress:.58}),
  coverDefender: role('coverDefender',['DEF'],{advance:-.01,passRisk:.28},{line:-.035,mark:.58,cover:.92,press:.2},{attack:.12,defence:.9}),
  ballPlayingDefender: role('ballPlayingDefender',['DEF'],{advance:.035,passRisk:.7,ballDemand:.63,carry:.46},{mark:.68,cover:.62,press:.32},{attack:.3,defence:.74}),
  wideCentreBack: role('wideCentreBack',['DEF'],{advance:.06,width:.14,passRisk:.5,carry:.48},{width:.08,mark:.64,cover:.62,press:.38},{attack:.37,defence:.76}),
  overlappingCentreBack: role('overlappingCentreBack',['DEF'],{advance:.11,width:.18,passRisk:.54,carry:.62,box:.32},{width:.08,mark:.55,cover:.45,press:.43},{attack:.55,defence:.64}),

  fullBack: role('fullBack',['DEF'],{advance:.07,width:.16,passRisk:.42,carry:.42,support:.62},{width:.11,mark:.72,cover:.68,press:.48},{attack:.42,defence:.8}),
  wingBack: role('wingBack',['DEF'],{advance:.13,width:.22,passRisk:.48,carry:.58,box:.24,support:.72},{width:.15,mark:.62,cover:.54,press:.58,recover:.8},{attack:.66,defence:.75}),
  attackingWingBack: role('attackingWingBack',['DEF'],{advance:.19,width:.25,passRisk:.55,carry:.72,box:.42,support:.74,run:'overlap'},{width:.16,mark:.48,cover:.42,press:.6,recover:.82},{attack:.84,defence:.62}),
  invertedFullBack: role('invertedFullBack',['DEF'],{advance:.07,width:-.22,passRisk:.52,ballDemand:.58,support:.74,run:'invert'},{width:.05,mark:.7,cover:.76,press:.48},{attack:.52,defence:.8}),
  invertedWingBack: role('invertedWingBack',['DEF'],{advance:.13,width:-.28,passRisk:.62,ballDemand:.72,carry:.52,support:.82,run:'invert'},{width:.06,mark:.58,cover:.68,press:.58},{attack:.7,defence:.72}),
  playmakingWingBack: role('playmakingWingBack',['DEF'],{advance:.11,width:.08,passRisk:.76,ballDemand:.82,carry:.42,support:.84},{mark:.56,cover:.66,press:.48},{attack:.68,defence:.7}),

  anchor: role('anchor',['MID'],{advance:-.035,width:-.05,passRisk:.3,ballDemand:.42,support:.68},{line:-.015,mark:.7,cover:.92,press:.3},{attack:.18,defence:.92}),
  holdingMidfielder: role('holdingMidfielder',['MID'],{advance:.005,width:-.03,passRisk:.38,ballDemand:.58,support:.74},{mark:.72,cover:.86,press:.4},{attack:.28,defence:.88}),
  ballWinningMidfielder: role('ballWinningMidfielder',['MID'],{advance:.025,passRisk:.34,carry:.32,support:.6},{mark:.66,cover:.5,press:.88,recover:.84},{attack:.36,defence:.88,counterpress:.9}),
  deepLyingPlaymaker: role('deepLyingPlaymaker',['MID'],{advance:.015,passRisk:.72,ballDemand:.9,carry:.3,support:.88},{mark:.52,cover:.76,press:.3},{attack:.48,defence:.72}),
  regista: role('regista',['MID'],{advance:.065,width:.02,roam:.18,passRisk:.84,ballDemand:.96,carry:.45,support:.86},{mark:.38,cover:.55,press:.34},{attack:.64,defence:.58}),
  centralMidfielder: role('centralMidfielder',['MID'],{advance:.055,passRisk:.5,ballDemand:.6,carry:.48,support:.7},{mark:.58,cover:.62,press:.52},{attack:.52,defence:.68}),
  boxToBox: role('boxToBox',['MID'],{advance:.12,roam:.12,passRisk:.48,carry:.62,box:.58,support:.68,run:'late-box'},{mark:.58,cover:.5,press:.72,recover:.9},{attack:.78,defence:.8,counterpress:.76}),
  wideCentralMidfielder: role('wideCentralMidfielder',['MID'],{advance:.08,width:.15,passRisk:.52,carry:.54,support:.72,run:'halfspace'},{width:.1,mark:.56,cover:.58,press:.56},{attack:.66,defence:.68}),
  advancedPlaymaker: role('advancedPlaymaker',['MID','FWD'],{advance:.1,roam:.12,passRisk:.86,ballDemand:.94,carry:.48,box:.3,support:.9},{mark:.34,cover:.38,press:.46},{attack:.78,defence:.46}),
  widePlaymaker: role('widePlaymaker',['MID','FWD'],{advance:.08,width:.11,roam:.1,passRisk:.82,ballDemand:.86,carry:.52,support:.84},{width:.12,mark:.42,cover:.46,press:.48},{attack:.72,defence:.52}),

  winger: role('winger',['MID','FWD'],{advance:.14,width:.28,passRisk:.48,carry:.8,box:.25,support:.68,run:'outside'},{width:.17,mark:.48,cover:.42,press:.58,recover:.7},{attack:.82,defence:.58}),
  insideForward: role('insideForward',['FWD','MID'],{advance:.16,width:-.2,passRisk:.46,carry:.78,box:.72,support:.56,run:'inside'},{width:.12,mark:.42,cover:.36,press:.62},{attack:.9,defence:.52,counterpress:.68}),
  invertedWinger: role('invertedWinger',['FWD','MID'],{advance:.12,width:-.14,passRisk:.62,carry:.76,box:.45,support:.7,run:'inside-support'},{width:.12,mark:.46,cover:.42,press:.58},{attack:.82,defence:.56}),
  shadowStriker: role('shadowStriker',['MID','FWD'],{advance:.2,width:-.05,passRisk:.42,carry:.58,box:.88,support:.48,run:'beyond'},{mark:.34,cover:.28,press:.7},{attack:.96,defence:.46,counterpress:.74}),
  halfSpaceAttacker: role('halfSpaceAttacker',['MID','FWD'],{advance:.14,width:-.1,passRisk:.62,carry:.62,box:.62,support:.7,run:'halfspace'},{mark:.42,cover:.4,press:.55},{attack:.86,defence:.54}),

  advancedForward: role('advancedForward',['FWD'],{advance:.2,passRisk:.34,carry:.68,box:.9,support:.38,run:'depth'},{mark:.2,cover:.16,press:.58},{attack:.98,defence:.35,counterpress:.6}),
  poacher: role('poacher',['FWD'],{advance:.22,width:-.08,passRisk:.22,carry:.42,box:.98,support:.24,run:'last-line'},{mark:.14,cover:.1,press:.35},{attack:1,defence:.22}),
  targetForward: role('targetForward',['FWD'],{advance:.12,width:-.06,passRisk:.36,ballDemand:.88,carry:.25,box:.82,support:.72,run:'pin'},{mark:.22,cover:.18,press:.42},{attack:.82,defence:.34}),
  deepLyingForward: role('deepLyingForward',['FWD'],{advance:.06,width:-.04,roam:.12,passRisk:.72,ballDemand:.86,carry:.52,box:.55,support:.88,run:'drop'},{mark:.25,cover:.22,press:.48},{attack:.72,defence:.4}),
  falseNine: role('falseNine',['FWD'],{advance:.015,width:-.04,roam:.2,passRisk:.8,ballDemand:.94,carry:.62,box:.42,support:.96,run:'drop'},{mark:.2,cover:.2,press:.48},{attack:.68,defence:.4}),
  pressingForward: role('pressingForward',['FWD'],{advance:.14,passRisk:.38,carry:.56,box:.76,support:.5,run:'channels'},{mark:.28,cover:.25,press:.94,recover:.74},{attack:.82,defence:.62,counterpress:.96}),
  completeForward: role('completeForward',['FWD'],{advance:.14,roam:.14,passRisk:.64,ballDemand:.78,carry:.72,box:.82,support:.72,run:'adaptive'},{mark:.24,cover:.2,press:.6},{attack:.92,defence:.46,counterpress:.62}),
  channelForward: role('channelForward',['FWD'],{advance:.18,width:.12,passRisk:.36,carry:.72,box:.72,support:.42,run:'channels'},{mark:.2,cover:.16,press:.6},{attack:.94,defence:.38,counterpress:.62})
});

const ALIASES = new Map([
  ['goleiro','goalkeeper'],['goalkeeper','goalkeeper'],['goleiro líbero','sweeperKeeper'],['goleiro-líbero','sweeperKeeper'],['sweeper-keeper','sweeperKeeper'],
  ['ball-playing-goalkeeper','ballPlayingGoalkeeper'],['zagueiro','centralDefender'],['central-defender','centralDefender'],['stopper','stopper'],['zagueiro de cobertura','coverDefender'],['cover-defender','coverDefender'],
  ['zagueiro construtor','ballPlayingDefender'],['zagueiro construtor','ballPlayingDefender'],['ball-playing-defender','ballPlayingDefender'],['wide-centre-back','wideCentreBack'],['overlapping-centre-back','overlappingCentreBack'],
  ['lateral','fullBack'],['lateral apoio','fullBack'],['full-back','fullBack'],['ala','wingBack'],['wing-back','wingBack'],['lateral ofensivo','attackingWingBack'],['attacking-full-back','attackingWingBack'],['attacking-wingback','attackingWingBack'],
  ['lateral invertido','invertedFullBack'],['inverted-full-back','invertedFullBack'],['falseback','invertedFullBack'],['inverted-wing-back','invertedWingBack'],['playmaking-wing-back','playmakingWingBack'],
  ['volante','holdingMidfielder'],['volante protetor','anchor'],['holding-midfielder','holdingMidfielder'],['ball-winning-midfielder','ballWinningMidfielder'],['organizador recuado','deepLyingPlaymaker'],['deep-lying-playmaker','deepLyingPlaymaker'],['regista','regista'],
  ['meia área a área','boxToBox'],['área-a-área','boxToBox'],['box-to-box','boxToBox'],['number-eight','centralMidfielder'],['central-midfielder','centralMidfielder'],['wide-central-midfielder','wideCentralMidfielder'],
  ['meia criativo','advancedPlaymaker'],['advanced-playmaker','advancedPlaymaker'],['wide-playmaker','widePlaymaker'],['ponta','winger'],['ponta aberto','winger'],['touchline-winger','winger'],['ponta invertido','invertedWinger'],['inverted-winger','invertedWinger'],
  ['atacante interior','insideForward'],['inside-forward','insideForward'],['shadow-striker','shadowStriker'],['half-space-attacker','halfSpaceAttacker'],
  ['centroavante','advancedForward'],['advanced-forward','advancedForward'],['finalizador','poacher'],['poacher','poacher'],['target-forward','targetForward'],['referência','targetForward'],['deep-lying-forward','deepLyingForward'],['falso 9','falseNine'],['false-nine','falseNine'],
  ['pressing-forward','pressingForward'],['complete-forward','completeForward'],['atacante móvel','channelForward'],['channel-runner','channelForward'],['channel-forward','channelForward'],['segundo atacante','deepLyingForward']
]);

export const PLAYER_ROLE_OPTIONS = Object.freeze(Object.keys(ROLE_CATALOG));

export function canonicalRole(value, slotRole = 'CM') {
  const key = String(value || '').trim();
  if (ROLE_CATALOG[key]) return key;
  const alias = ALIASES.get(key.toLowerCase());
  if (alias) return alias;
  return defaultRoleForSlot(slotRole);
}

export function defaultRoleForSlot(slotRole) {
  const group = slotGroup(slotRole);
  if (group === 'GK') return 'goalkeeper';
  if (group === 'DEF') return ['RB','LB','RWB','LWB'].includes(slotRole) ? 'fullBack' : 'centralDefender';
  if (group === 'FWD') return ['RW','LW'].includes(slotRole) ? 'winger' : 'advancedForward';
  if (['DM','RDM','LDM'].includes(slotRole)) return 'holdingMidfielder';
  if (['AM','RAM','LAM'].includes(slotRole)) return 'advancedPlaymaker';
  if (['RM','LM'].includes(slotRole)) return 'wideCentralMidfielder';
  return 'centralMidfielder';
}

export function roleDefinition(value, slotRole = 'CM') {
  return ROLE_CATALOG[canonicalRole(value, slotRole)] || ROLE_CATALOG[defaultRoleForSlot(slotRole)];
}

export function roleFamiliarity(player = {}, roleId, slotRole) {
  const canonical = canonicalRole(roleId, slotRole);
  const roles = (player.roles || []).map(value => canonicalRole(value, slotRole));
  const positions = new Set([player.primaryPosition, ...(player.positions || [])].filter(Boolean).map(value => String(value).toUpperCase()));
  const group = slotGroup(slotRole);
  const playerGroup = String(player.group || player.positionGroup || '').toUpperCase();
  const positionFit = positions.has(slotRole) ? 1 : playerGroup.includes(group) || (group === 'MID' && /MID/.test(playerGroup)) || (group === 'DEF' && /DEF/.test(playerGroup)) || (group === 'FWD' && /(FWD|OFF)/.test(playerGroup)) ? .92 : slotRole === 'GK' ? .38 : .78;
  const roleFit = roles.includes(canonical) ? 1.02 : roles.some(item => ROLE_CATALOG[item]?.groups.some(g => ROLE_CATALOG[canonical]?.groups.includes(g))) ? .95 : .88;
  return Math.max(.62, Math.min(1.03, positionFit * roleFit));
}
