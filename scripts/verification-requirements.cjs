'use strict';
// Which proof section and checks open each write group. Build gating and the migration suite share this table.
const nativeLifecycle = ['load', 'save', 'restart', 'originalHashes', 'nativeEffects', 'lifecycle'];
const sections = {
  setEquipmentLevel: {groups:['backpackSetEquipmentLevel','setEquipmentLevel'],perGroup:true,checks:nativeLifecycle},
  treasureLevel: {groups:['backpackTreasureLevel','treasureLevel'],perGroup:true,checks:nativeLifecycle},
  setEquipmentQuality: {groups:['backpackSetEquipmentQualityUpgrade','backpackSetEquipmentQualityDowngrade','setEquipmentQualityUpgrade','setEquipmentQualityDowngrade','backpackSetEquipmentLevelCrossPool','setEquipmentLevelCrossPool'],perGroup:true,checks:nativeLifecycle},
  randomCharacterTalents: {
    groups: ['randomCharacterTalents', 'randomCharacterTalentsAscended'], perGroup: true,
    checks: ['load','save','restart','originalHashes','nativeEffects','talentFormulas','aptitudeCap','numericUpdate','nativeTransfer','nativePrison','nativeRebirth','nativeDismiss','stageRoundtrips']
  },
  randomCharacterSkillCaps: {
    groups: ['randomCharacterSkillCaps', 'randomCharacterSkillCapsAscended'], perGroup: true,
    checks: ['load','save','restart','originalHashes','nativeEffects','nativeRecruitment','numericUpdate','nativeSkillExperience','capRemainderTiming','batchCompatibility','nativeTransfer','nativePrison','nativeRebirth','nativeDismiss','stageRoundtrips']
  },
  randomCharacterGrowth: {
    groups: ['randomCharacterBaseAptitudes', 'randomCharacterBaseAptitudesAscended'], perGroup: true,
    checks: ['load', 'save', 'restart', 'originalHashes', 'nativeEffects', 'numericUpdate', 'nativePills', 'nativeTransfer', 'nativePrison', 'nativeRebirth', 'nativeDismiss', 'stageRoundtrips']
  },
  base: {
    groups: ['names', 'characterExperience', 'professionExperience', 'skillExperience', 'equipmentLevel', 'equipmentLevelAdvanced', 'professionTrainingCap', 'professionTrainingCapAdvanced', 'advancedTechnologyLevel', 'advancedTechnologyLevelAdvanced'],
    checks: ['loadedIntoMainLayout', 'nativeSaveWritten', 'processRestartedAndReloaded', 'allTenObservedCellsMatch', 'originalSaveHashesUnchanged', 'steamMutationsRedirectedToLocalMirror', 'allThirteenTestedSourceHashesMatch', 'realSteamInitialization', 'restartUsesDifferentProcess', 'advancedNormalAndOvercapNativeRoundtrip', 'nativeEquipmentAndTechnologyEffectsFinite', 'nativeEquipmentUnequipReequip', 'subsequentProfessionTransferAndExperience', 'subsequentResearchAndTrainingStartStop']
  },
  batch2: {
    groups: ['equipmentAffixCoefficient', 'pillAptitudeBonus', 'pillAptitudeBonusDecimal', 'pillAptitudeBonusAscended', 'relicAttributes', 'wallEnhancementLevel', 'cityLayerLevel', 'ascensionQuality', 'backpackInnerPillLevel', 'innerPillLevel', 'ascendedInnerPillLevel', 'basicTechnologyLevel', 'buildingLevel', 'placedRelicAttributes', 'pillAptitudeBonusAdvanced', 'recruitTechnologyAdvanced', 'equipmentAffixCoefficientAdvanced', 'equipmentSixthAffix'],
    checks: ['nativeLoad', 'nativeSave', 'stopAndRestart', 'originalHashesUnchanged', 'nativeEffects', 'coreNativeAptitudeAgreement', 'nativeRewash', 'unequipReequip', 'nativePillConsumption', 'rebirthClears']
  },
  affixReplacement: {
    groups: ['equipmentAffixReplacement'],
    checks: ['nativeEffects', 'load', 'save', 'restart', 'originalHashes', 'equipmentCycle', 'nativeWash']
  },
  equipmentWorkflow: {
    groups: ['backpackEquipmentLevel', 'backpackEquipmentLevelAdvanced', 'backpackEquipmentAffixCoefficient', 'backpackEquipmentAffixReplacement', 'equipmentAffixInitialSelection', 'equipmentNewItemMarker'],
    checks: nativeLifecycle,
    perGroup: true
  },
  equipmentQuality: {
    groups: ['backpackEquipmentQualityUpgrade', 'backpackEquipmentQualityDowngrade', 'equipmentQualityUpgrade', 'equipmentQualityDowngrade'],
    checks: nativeLifecycle,
    perGroup: true
  }
};
// Game UI evidence that native calls cannot provide.
const uiChecks = {
  equipmentAffixInitialSelection: 'selectionUi',
  backpackEquipmentQualityUpgrade: 'qualityUi',
  backpackEquipmentQualityDowngrade: 'qualityUi',
  equipmentQualityUpgrade: 'qualityUi',
  equipmentQualityDowngrade: 'qualityUi'
};
// Event functions that render the UI each check observed. A later build may carry the UI proof forward only when
// the digest of exactly these events is unchanged; called functions outside the list are not covered.
const uiEvents = {
  selectionUi: [780562691790658, 619743323262026],
  qualityUi: [680719446639986, 538305116886112, 589712995086958, 910195347276964, 713681756866045, 780562691790658, 619743323262026]
};
// Problem with a group's recorded UI evidence for the given game version, or null when it is acceptable.
function uiEvidenceProblem(group, record, gameVersion) {
  const check = uiChecks[group], e = record?.uiEvidence;
  if (!check) return null;
  if (!e || e.gameVersion !== gameVersion || JSON.stringify(e.eventSids) !== JSON.stringify(uiEvents[check]) || !/^[0-9a-f]{64}$/.test(e.eventDigest || '')) return 'UI 證據缺少相符的事件摘要';
  if (e.source === 'native') return null;
  if (e.source === 'carried' && e.carriedFrom?.eventDigest === e.eventDigest && e.carriedFrom.gameVersion && e.carriedFrom.gameVersion !== gameVersion) return null;
  return 'UI 證據來源無效';
}
const sectionOf = group => Object.keys(sections).find(name => sections[name].groups.includes(group));
function requiredChecks(group) {
  const section = sections[sectionOf(group)];
  if (!section) throw Error('寫入群組缺少驗證需求定義：' + group);
  return uiChecks[group] ? [...section.checks, uiChecks[group]] : section.checks;
}

module.exports = {sections, uiChecks, uiEvents, uiEvidenceProblem, sectionOf, requiredChecks};
