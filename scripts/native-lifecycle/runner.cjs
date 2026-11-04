'use strict';
const fs = require('node:fs'), path = require('node:path');

// Keep validation, action order and persisted result/state formats in one place.
module.exports = function createRunner({actions, evaluate, waitMain, prefix, scriptDir: __dirname, log}) {
const {ascend, followup, pillsAndRebirth, pillOverLimit, backpackOverLimit, armory, armoryEdited, relicPlacement, relicTakeOff, relicStandPrepare, placedRelicAura, wallUpgrade, cityLayer, ascensionQuality, innerPillPrepare, innerPillLevel, soulUpgrade, talentEffects, ascendedInnerPillLevel, basicTechnology, outfitSwap, buildingLevel, recruitTechnology, affixPrepare, affixOverLimit, sixthAffix, relicCrafting} = actions;

async function run(statePath, scenarioPath) {
  const state = JSON.parse(fs.readFileSync(statePath)), scenario = JSON.parse(fs.readFileSync(scenarioPath));
  const rel = path.relative(path.resolve(__dirname, '..'), state.dir), child = path.relative(state.dir, state.game);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep)) || !child || path.isAbsolute(child) || child.startsWith('..')) throw Error('External disposable state required');
  if (!scenario.ascend && !scenario.followup && !scenario.pills && !scenario.pillOverLimit && !scenario.backpackOverLimit && !scenario.armory && !scenario.relics && !scenario.relicTakeOff && !scenario.relicStandPrepare && !scenario.placedRelicAura && !scenario.wall && !scenario.city && !scenario.ascensionQuality && !scenario.innerPillPrepare && !scenario.innerPillLevel && !scenario.soulUpgrade && !scenario.talentEffects && !scenario.ascendedInnerPillLevel && !scenario.basicTechnology && !scenario.buildingLevel && !scenario.relicCrafting && !scenario.recruitTechnology && !scenario.affixPrepare && !scenario.affixOverLimit && !scenario.sixthAffix && !scenario.armoryEdited && !scenario.outfitSwap) throw Error('Scenario has no native follow-up actions');
  await waitMain(state);
  const result = {};
  if (scenario.ascend && !scenario.pills) result.ascend = await ascend(state, scenario);
  if (scenario.followup) result.followup = await followup(state, scenario);
  if (scenario.pills) result.pills = await pillsAndRebirth(state, scenario);
  if (scenario.pillOverLimit) result.pillOverLimit = await pillOverLimit(state, scenario);
  if (scenario.backpackOverLimit) result.backpackOverLimit = await backpackOverLimit(state, scenario);
  if (scenario.armory) result.armory = await armory(state, scenario);
  if (scenario.armoryEdited) result.armoryEdited = await armoryEdited(state, scenario);
  if (scenario.relics) result.relics = await relicPlacement(state, scenario);
  if (scenario.relicStandPrepare) result.relicStandPrepare = await relicStandPrepare(state, scenario);
  if (scenario.placedRelicAura) result.placedRelicAura = await placedRelicAura(state, scenario);
  if (scenario.relicTakeOff) result.relicTakeOff = await relicTakeOff(state);
  if (scenario.wall) result.wall = await wallUpgrade(state, scenario);
  if (scenario.city) result.city = await cityLayer(state, scenario);
  if (scenario.ascensionQuality) result.ascensionQuality = await ascensionQuality(state, scenario);
  if (scenario.innerPillPrepare) result.innerPillPrepare = await innerPillPrepare(state, scenario);
  if (scenario.innerPillLevel) result.innerPillLevel = await innerPillLevel(state, scenario);
  if (scenario.soulUpgrade) result.soulUpgrade = await soulUpgrade(state, scenario);
  if (scenario.talentEffects) result.talentEffects = await talentEffects(state, scenario);
  if (scenario.ascendedInnerPillLevel) result.ascendedInnerPillLevel = await ascendedInnerPillLevel(state, scenario);
  if (scenario.basicTechnology) result.basicTechnology = await basicTechnology(state, scenario);
  if (scenario.outfitSwap) result.outfitSwap = await outfitSwap(state, scenario);
  if (scenario.recruitTechnology) result.recruitTechnology = await recruitTechnology(state, scenario);
  if (scenario.affixPrepare) result.affixPrepare = await affixPrepare(state, scenario);
  if (scenario.affixOverLimit) result.affixOverLimit = await affixOverLimit(state, scenario);
  if (scenario.sixthAffix) result.sixthAffix = await sixthAffix(state, scenario);
  if (scenario.buildingLevel) result.buildingLevel = await buildingLevel(state, scenario);
  if (scenario.relicCrafting) result.relicCrafting = await relicCrafting(state, scenario);
  state.expected = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(state.dir, 'native-lifecycle.json'), JSON.stringify(result, null, 2));
  log('PASS: native ' + Object.keys(result).join(' and ') + ' follow-up actions');
}

return run;
};
