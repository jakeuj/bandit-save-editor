'use strict';
const path = require('node:path');
const runtime = require('./runtime.cjs');
const createRunner = require('./runner.cjs');
const createFollowupActions = require('./followup.cjs');
const createCultivationActions = require('./cultivation.cjs');
const createEquipmentActions = require('./equipment.cjs');
const createRelicActions = require('./relics.cjs');
const createSettlementActions = require('./settlement.cjs');
const createAffixActions = require('./affixes.cjs');

/**
 * Build a fresh action set with an explicit game adapter; no native calls on construction.
 * evaluate/waitMain come from verify-game; pause/log can be replaced by synthetic tests.
 * scriptDir is the original scripts/ directory, preserving catalog and external-state paths.
 * @returns {{actions:Object,run:function(string,string):Promise<void>}} Original action names and one file runner.
 */
function createNativeLifecycle({evaluate, waitMain, pause=runtime.pause, scriptDir=path.resolve(__dirname, '..'), log=console.log}) {
  const host = {evaluate, prefix: runtime.prefix, selectFacility: runtime.selectFacility, pause, scriptDir};
  const {followup} = createFollowupActions(host);
  const {ascend, pillsAndRebirth, pillOverLimit, ascensionQuality, innerPillPrepare, soulUpgrade, talentEffects, innerPillLevel, ascendedInnerPillLevel} = createCultivationActions(host);
  const {backpackOverLimit, armory, armoryEdited, outfitSwap} = createEquipmentActions(host);
  const {relicPlacement, relicTakeOff, relicStandPrepare, placedRelicAura, relicCrafting} = createRelicActions(host);
  const {wallUpgrade, cityLayer, basicTechnology, recruitTechnology, buildingLevel} = createSettlementActions(host);
  const {affixPrepare, affixOverLimit, sixthAffix} = createAffixActions(host);
  const actions = {ascend, followup, pillsAndRebirth, pillOverLimit, backpackOverLimit, armory, armoryEdited, relicPlacement, relicTakeOff, relicStandPrepare, placedRelicAura, wallUpgrade, cityLayer, ascensionQuality, innerPillPrepare, innerPillLevel, soulUpgrade, talentEffects, ascendedInnerPillLevel, basicTechnology, outfitSwap, buildingLevel, recruitTechnology, affixPrepare, affixOverLimit, sixthAffix, relicCrafting};
  const run = createRunner({actions, evaluate, waitMain, prefix: runtime.prefix, scriptDir, log});
  return {actions, run};
}

module.exports = {createNativeLifecycle};
