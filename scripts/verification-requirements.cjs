'use strict';
// Which proof section and checks open each write group. Build gating and the migration suite share this table.
const nativeLifecycle = ['load', 'save', 'restart', 'originalHashes', 'nativeEffects', 'lifecycle'];
const sections = {
  base: {
    groups: ['names', 'characterExperience', 'professionExperience', 'skillExperience', 'equipmentLevel', 'equipmentLevelAdvanced', 'professionTrainingCap', 'professionTrainingCapAdvanced', 'advancedTechnologyLevel', 'advancedTechnologyLevelAdvanced'],
    checks: ['loadedIntoMainLayout', 'nativeSaveWritten', 'processRestartedAndReloaded', 'allTenObservedCellsMatch', 'originalSaveHashesUnchanged', 'steamMutationsRedirectedToLocalMirror', 'allThirteenTestedSourceHashesMatch', 'realSteamInitialization', 'restartUsesDifferentProcess', 'advancedNormalAndOvercapNativeRoundtrip', 'nativeEquipmentAndTechnologyEffectsFinite', 'nativeEquipmentUnequipReequip', 'subsequentProfessionTransferAndExperience', 'subsequentResearchAndTrainingStartStop']
  },
  batch2: {
    groups: ['equipmentAffixCoefficient', 'pillAptitudeBonus'],
    checks: ['nativeLoad', 'nativeSave', 'stopAndRestart', 'originalHashesUnchanged', 'nativeEffects', 'coreNativeAptitudeAgreement', 'nativeRewash', 'unequipReequip', 'nativePillConsumption', 'rebirthClears']
  },
  affixReplacement: {
    groups: ['equipmentAffixReplacement'],
    checks: ['nativeEffects', 'load', 'save', 'restart', 'originalHashes', 'equipmentCycle', 'nativeWash']
  },
  equipmentWorkflow: {
    groups: ['backpackEquipmentLevel', 'backpackEquipmentAffixCoefficient', 'backpackEquipmentAffixReplacement', 'equipmentAffixInitialSelection', 'equipmentNewItemMarker'],
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
const sectionOf = group => Object.keys(sections).find(name => sections[name].groups.includes(group));
function requiredChecks(group) {
  const section = sections[sectionOf(group)];
  if (!section) throw Error('寫入群組缺少驗證需求定義：' + group);
  return uiChecks[group] ? [...section.checks, uiChecks[group]] : section.checks;
}

module.exports = {sections, uiChecks, sectionOf, requiredChecks};
