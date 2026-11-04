/* Local save editing core. All unchanged source bytes are preserved. */
/** @typedef {number|string|boolean|null} SaveScalar 原始 JSON 儲存格值；大型整數仍以原始文字為匯出依據。 */
/**
 * @typedef {Object} SaveCoord 零起算座標；各軸皆為非負整數。
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * @typedef {Object} SaveArray 解析後僅供讀取的遊戲資料，不可用 JSON.stringify 重建匯出。
 * @property {true} c2array
 * @property {number[]} size 三個正整數，依序為 x、y、z 尺寸。
 * @property {SaveScalar[][][]} data
 */
/**
 * @typedef {Object} SaveChange 一個待替換 token；使用具名寫入介面管理，不直接修改紀錄。
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {SaveScalar} original
 * @property {SaveScalar} value
 * @property {string} label
 * @property {string|null} operation 同筆操作的關聯標記。
 * @property {string|null} group 累計還原群組，優先於 operation。
 */
/**
 * @typedef {Object} SaveModel parse 產生的同一實例；呼叫端以公開操作修改，保留原始資料及私有狀態身分。
 * @property {string} name
 * @property {string} text 原始文字，保留 BOM、空白、指數與大型整數 literal。
 * @property {SaveArray} original 僅供讀值；不直接改 data。
 * @property {Map<string,SaveChange>} changes 以 x,y,z 字串為鍵；呼叫端僅供觀察。
 * @property {Map<string,SaveChange>[]} history 最多 100 筆快照；私有還原狀態不可用 JSON 複製。
 * @property {number} [revision] 核心維護的預覽失效版本戳。
 * @property {number} [operationCounter] 核心維護的操作編號。
 * @property {string|null} [currentOperation] 核心維護的目前操作標記。
 * @property {string|null} [currentGroup] 核心維護的目前累計群組。
 * @property {boolean} [inTransaction] 核心維護的巢狀交易狀態。
 */
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
/*__CORE_CHARACTER_APTITUDE_SOURCE__*/
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
