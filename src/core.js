/* Local save editing core. All unchanged source bytes are preserved. */
/**
 * @typedef {Object} FieldDescriptor
 * @property {string} id Zero-based x,y,z coordinate key.
 * @property {string} label
 * @property {string} category
 * @property {string} entity
 * @property {'string'|'integer'|'decimal'|'boolean'|'object'} type
 * @property {boolean} known
 * @property {boolean} editable Direct setField permission; growth uses addExperience.
 * @property {string} status
 * @property {string} reason Readonly or validation explanation.
 * @property {string} description
 * @property {Array<{x:number,y:number,z:number}>} related Linked fields, never implicit writes.
 * @property {Array<{function:string,sheet:string,sid:number,actionSid:number}>} source
 */
(() => {
 'use strict';
/*__CORE_SHARED__*/
/*__CORE_EQUIPMENT_LEVELS__*/
/*__CORE_EQUIPMENT_AFFIXES__*/
/*__CORE_SKILL_CAPS_TALENTS__*/
/*__CORE_APTITUDES__*/
/*__CORE_PILLS_ASCENSION__*/
/*__CORE_RELICS__*/
/*__CORE_SETTLEMENT__*/
/*__CORE_FIELDS_TRANSACTIONS__*/
/*__CORE_EXPERIENCE__*/
/*__CORE_BATCH__*/
/*__CORE_SERIALIZATION__*/
 globalThis.SaveCore={randomCharacterSkillCapsAdvancedInfo,previewCharacterSkillCapsAdvanced,setCharacterSkillCapsAdvanced,sixthAffixInfo,previewEquipmentSixthAffix,setEquipmentSixthAffix,listPlacedRelics,placedRelicAttributesInfo,previewPlacedRelicAttributes,setPlacedRelicAttributes,buildingLevelsInfo,previewBuildingLevel,setBuildingLevel,basicTechnologiesInfo,previewBasicTechnology,setBasicTechnology,ascendedInnerPillLevelInfo,previewAscendedInnerPillLevel,setAscendedInnerPillLevel,innerPillLevelInfo,previewInnerPillLevel,setInnerPillLevel,ascensionQualityInfo,previewAscensionQuality,setAscensionQuality,cityLayersInfo,previewCityLayer,setCityLayer,wallEnhancementInfo,previewWallEnhancementLevel,setWallEnhancementLevel,relicAttributesInfo,previewRelicAttributes,setRelicAttributes,listRelics,setEquipmentLevelInfo,treasureLevelInfo,setEquipmentQualityCandidateInfo,previewSetEquipmentQualityCandidate,applySetEquipmentQualityCandidate,setEquipmentQualityCandidateEffects,randomCharacterTalentsInfo,previewCharacterTalents,setCharacterTalents,talentEffect,randomCharacterSkillCapsInfo,previewCharacterSkillCaps,setCharacterSkillCaps,skillCapAptitudeWitness,skillCapCombinations,recruitmentCombination,randomCharacterGrowthInfo,previewCharacterBaseAptitudes,setCharacterBaseAptitudes,BASICS,MATERIALS,KNOWLEDGE,SKILLS,key,exists,cell,parse,get,set,setField,resolveField,addExperience,growthInfo,experienceNeed,editingInfo,setEquipmentLevel,setProfessionTrainingCap,setAdvancedTechnologyLevel,recruitTechnologyInfo,setRecruitTechnologyLevel,affixInfo,pillInfo,setEquipmentAffixCoefficient,affixAdvancedInfo,previewEquipmentAffixCoefficientAdvanced,setEquipmentAffixCoefficientAdvanced,setPillAptitudeBonus,pillAdvancedInfo,setPillAptitudeBonusAdvanced,equipmentAffixReplacementInfo,previewEquipmentAffixReplacement,setEquipmentAffix,equipmentQualityInfo,previewEquipmentQualityChange,setEquipmentQuality,listEntities,catalogName,transaction,undo,restore,restoreAll,labelFor,diff,serialize,previewBatch,applyBatch};
})();
