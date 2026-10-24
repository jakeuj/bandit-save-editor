'use strict';
// Migration re-verification plan: which family regenerates each write group and which runner step proves each required check.
const R = require('./verification-requirements.cjs');

// Runner steps in order. A check is proven only when its step passes on every copy of the family that runs it;
// lifecycle scripts run in the listed order on copies the scenario generator marks for follow-up actions.
const steps = ['load', 'oracle', 'save', 'assert', 'reload', 'oracleCompare', 'lifecycle', 'ui'];
const growthChecks = {
  loadedIntoMainLayout: 'load', nativeSaveWritten: 'save', processRestartedAndReloaded: 'reload', allTenObservedCellsMatch: 'assert',
  originalSaveHashesUnchanged: 'assert', steamMutationsRedirectedToLocalMirror: 'assert', allThirteenTestedSourceHashesMatch: 'assert',
  realSteamInitialization: 'assert', restartUsesDifferentProcess: 'reload'
};
const nativeLifecycleChecks = {load: 'load', save: 'save', restart: 'reload', originalHashes: 'assert', nativeEffects: 'oracleCompare', lifecycle: 'lifecycle'};
const families = {
  setEquipmentLevel: {groups:['backpackSetEquipmentLevel','setEquipmentLevel'],initialProofRequired:true,oracle:'verify-set-equipment-level.cjs',lifecycle:['verify-set-level-migration-lifecycle.cjs'],checks:nativeLifecycleChecks},
  treasureLevel: {groups:['backpackTreasureLevel','treasureLevel'],initialProofRequired:true,oracle:'verify-treasure-level.cjs',lifecycle:['verify-treasure-level-migration-lifecycle.cjs'],checks:nativeLifecycleChecks},
  setEquipmentQuality: {groups:['backpackSetEquipmentQualityUpgrade','backpackSetEquipmentQualityDowngrade','setEquipmentQualityUpgrade','setEquipmentQualityDowngrade','backpackSetEquipmentLevelCrossPool','setEquipmentLevelCrossPool'],initialProofRequired:true,oracle:'verify-set-equipment-quality.cjs',lifecycle:['verify-set-equipment-quality-migration-lifecycle.cjs'],checks:nativeLifecycleChecks},
  randomCharacterTalents: {
    groups:['randomCharacterTalents','randomCharacterTalentsAscended'],
    initialProofRequired:true,
    oracle:'verify-random-character-talents.cjs', lifecycle:['verify-talents-lifecycle.cjs'],
    checks:{load:'load',save:'save',restart:'reload',originalHashes:'assert',nativeEffects:'oracleCompare',talentFormulas:'oracleCompare',aptitudeCap:'oracleCompare',numericUpdate:'lifecycle',nativeTransfer:'lifecycle',nativePrison:'lifecycle',nativeRebirth:'lifecycle',nativeDismiss:'lifecycle',stageRoundtrips:'lifecycle'}
  },
  randomCharacterSkillCaps: {
    groups:['randomCharacterSkillCaps','randomCharacterSkillCapsAscended'],
    initialProofRequired:true,
    oracle:'verify-random-character-skill-caps.cjs', lifecycle:['verify-skill-caps-lifecycle.cjs'],
    checks:{load:'load',save:'save',restart:'reload',originalHashes:'assert',nativeEffects:'oracleCompare',nativeRecruitment:'lifecycle',numericUpdate:'lifecycle',nativeSkillExperience:'lifecycle',capRemainderTiming:'lifecycle',batchCompatibility:'oracleCompare',nativeTransfer:'lifecycle',nativePrison:'lifecycle',nativeRebirth:'lifecycle',nativeDismiss:'lifecycle',stageRoundtrips:'lifecycle'}
  },

  growth: {
    groups: ['names', 'characterExperience', 'professionExperience', 'skillExperience'],
    checks: growthChecks
  },
  advanced: {
    groups: ['equipmentLevel', 'equipmentLevelAdvanced', 'professionTrainingCap', 'professionTrainingCapAdvanced', 'advancedTechnologyLevel', 'advancedTechnologyLevelAdvanced'],
    oracle: 'verify-advanced.cjs',
    lifecycle: ['verify-native-lifecycle.cjs'],
    checks: {
      ...growthChecks, advancedNormalAndOvercapNativeRoundtrip: 'reload', nativeEquipmentAndTechnologyEffectsFinite: 'oracleCompare',
      nativeEquipmentUnequipReequip: 'lifecycle', subsequentProfessionTransferAndExperience: 'lifecycle', subsequentResearchAndTrainingStartStop: 'lifecycle'
    }
  },
  batch2: {
    groups: ['equipmentAffixCoefficient', 'pillAptitudeBonus', 'pillAptitudeBonusDecimal', 'pillAptitudeBonusAscended', 'relicAttributes', 'wallEnhancementLevel', 'cityLayerLevel', 'ascensionQuality', 'backpackInnerPillLevel', 'innerPillLevel'],
    oracle: 'verify-batch2.cjs',
    // Rewash and the equip cycle reuse the replacement script; pills and rebirth follow in the native script.
    lifecycle: ['verify-affix-lifecycle.cjs', 'verify-native-lifecycle.cjs'],
    checks: {
      nativeLoad: 'load', nativeSave: 'save', stopAndRestart: 'reload', originalHashesUnchanged: 'assert', nativeEffects: 'oracleCompare',
      coreNativeAptitudeAgreement: 'oracle', nativeRewash: 'lifecycle', unequipReequip: 'lifecycle', nativePillConsumption: 'lifecycle', rebirthClears: 'lifecycle'
    }
  },
  affixReplacement: {
    groups: ['equipmentAffixReplacement'],
    oracle: 'verify-affixes.cjs',
    lifecycle: ['verify-affix-lifecycle.cjs'],
    checks: {nativeEffects: 'oracleCompare', load: 'load', save: 'save', restart: 'reload', originalHashes: 'assert', equipmentCycle: 'lifecycle', nativeWash: 'lifecycle'}
  },
  equipmentWorkflow: {
    groups: ['backpackEquipmentLevel', 'backpackEquipmentLevelAdvanced', 'backpackEquipmentAffixCoefficient', 'backpackEquipmentAffixReplacement', 'equipmentAffixInitialSelection', 'equipmentNewItemMarker'],
    oracle: 'verify-affixes.cjs',
    lifecycle: ['verify-equipment-workflow.cjs'],
    checks: {...nativeLifecycleChecks, selectionUi: 'ui'}
  },
  equipmentQuality: {
    groups: ['backpackEquipmentQualityUpgrade', 'backpackEquipmentQualityDowngrade', 'equipmentQualityUpgrade', 'equipmentQualityDowngrade'],
    oracle: 'verify-quality.cjs',
    // The formula matrix binds the quality formula hash; it compares native functions only and writes nothing.
    formulas: true,
    lifecycle: ['verify-quality-lifecycle.cjs'],
    checks: {...nativeLifecycleChecks, qualityUi: 'ui'}
  },
  randomCharacterGrowth: {
    groups: ['randomCharacterBaseAptitudes', 'randomCharacterBaseAptitudesAscended'], oracle: 'verify-random-character-growth.cjs', lifecycle: ['verify-random-character-lifecycle.cjs'],
    checks: {load:'load',save:'save',restart:'reload',originalHashes:'assert',nativeEffects:'oracleCompare',numericUpdate:'lifecycle',nativePills:'lifecycle',nativeTransfer:'lifecycle',nativePrison:'lifecycle',nativeRebirth:'lifecycle',nativeDismiss:'lifecycle',stageRoundtrips:'lifecycle'}
  }
};
const familyOf = group => Object.keys(families).find(name => families[name].groups.includes(group));

const proves = (family, check) => {
  const step = family.checks[check];
  return steps.includes(step) && !(/^oracle/.test(step) && !family.oracle) && !(step === 'lifecycle' && !family.lifecycle);
};

// Required checks that no family step would prove; empty when the suite covers every group.
// Families whose groups share a proof section jointly prove that section's checks.
function uncovered(groups) {
  const missing = [];
  for (const group of groups) {
    if (!familyOf(group)) { missing.push(group + ': no family'); continue; }
    const section = R.sectionOf(group), peers = Object.values(families).filter(f => f.groups.some(g => R.sectionOf(g) === section));
    for (const check of R.requiredChecks(group)) {
      const owners = check === R.uiChecks[group] ? [families[familyOf(group)]] : peers;
      if (!owners.some(f => proves(f, check))) missing.push(group + ': ' + check);
    }
  }
  return missing;
}

module.exports = {steps, families, familyOf, uncovered};
