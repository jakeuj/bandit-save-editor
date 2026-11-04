'use strict';
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const knowledgeToken = '/*__KNOWLEDGE__*/null';
// Ordered source fragments share their entry's closure. This is source assembly,
// not a runtime module loader; browsers still receive one self-contained HTML.
const entries = {core: 'src/core.js', ui: 'src/ui.js', 'knowledge-ui': 'src/knowledge-ui.js'};
const fragments = {
  'src/core.js': [
    ['CORE_SHARED', 'src/core/shared.js'],
    ['CORE_EQUIPMENT_LEVELS', 'src/core/equipment-levels.js'],
    ['CORE_EQUIPMENT_AFFIXES', 'src/core/equipment-affixes.js'],
    ['CORE_SKILL_CAPS_TALENTS', 'src/core/skill-caps-talents.js'],
    ['CORE_APTITUDES', 'src/core/aptitudes.js'],
    ['CORE_PILLS_ASCENSION', 'src/core/pills-ascension.js'],
    ['CORE_RELICS', 'src/core/relics.js'],
    ['CORE_SETTLEMENT', 'src/core/settlement.js'],
    ['CORE_FIELDS_TRANSACTIONS', 'src/core/fields-transactions.js'],
    ['CORE_EXPERIENCE', 'src/core/experience.js'],
    ['CORE_BATCH', 'src/core/batch.js'],
    ['CORE_SERIALIZATION', 'src/core/serialization.js']
  ],
  'src/knowledge-ui.js': [
    ['KNOWLEDGE_SHARED', 'src/ui/knowledge/shared.js'],
    ['KNOWLEDGE_EDITING', 'src/ui/knowledge/editing.js'],
    ['KNOWLEDGE_AFFIXES', 'src/ui/knowledge/affixes.js'],
    ['KNOWLEDGE_QUALITY', 'src/ui/knowledge/quality.js'],
    ['KNOWLEDGE_APTITUDES', 'src/ui/knowledge/aptitudes.js'],
    ['KNOWLEDGE_SKILL_CAPS', 'src/ui/knowledge/skill-caps.js'],
    ['KNOWLEDGE_TALENTS', 'src/ui/knowledge/talents.js'],
    ['KNOWLEDGE_LISTS', 'src/ui/knowledge/lists.js']
  ],
  'src/ui.js': [
    ['UI_FILE_OPERATIONS', 'src/ui/file-operations.js'],
    ['UI_RESOURCES', 'src/ui/resources.js'],
    ['UI_REVIEW_EXPORT', 'src/ui/review-export.js'],
    ['UI_COMPARE', 'src/ui/compare.js'],
    ['UI_CUSTOM_FIELDS', 'src/ui/custom-fields.js'],
    ['KNOWLEDGE_UI', 'src/knowledge-ui.js'],
    ['PROFESSION_UI', 'src/profession-ui.js'],
    ['BATCH_UI', 'src/batch-ui.js'],
    ['RELIC_UI', 'src/relic-ui.js'],
    ['WALL_UI', 'src/wall-ui.js'],
    ['CITY_UI', 'src/city-ui.js'],
    ['TECH_UI', 'src/tech-ui.js'],
    ['BUILDING_UI', 'src/building-ui.js'],
    ['ASCENSION_UI', 'src/ascension-ui.js']
  ]
};

function readEditorSourceDetails(entry, {root = projectRoot} = {}) {
  if (!Object.hasOwn(entries, entry)) throw Error(`未知的編輯器來源入口：${entry}`);
  const file = entries[entry];
  function expand(relative) {
    const original = fs.readFileSync(path.join(root, relative), 'utf8');
    const whole = () => ({source: original, segments: original.length ? [{file: relative, sourceStart: 0, outputStart: 0, length: original.length}] : []});
    // Frozen-release overlays contain a complete standalone core, not the current fragments.
    if (relative === 'src/core.js' && original.includes(knowledgeToken) && original.includes('globalThis.SaveCore=') && !original.includes('/*__CORE_')) return whole();
    const parts = fragments[relative] || [];
    let previous = -1;
    for (const [name] of parts) {
      const token = `/*__${name}__*/`;
      if (original.split(token).length !== 2) throw Error(`${relative} 的 ${name} 組裝標記必須恰好出現一次`);
      const position = original.indexOf(token);
      if (position <= previous) throw Error(`${relative} 的 ${name} 組裝順序與清單不符`);
      previous = position;
    }
    if (!parts.length) return whole();
    const chunks = [], segments = [];
    let cursor = 0, outputStart = 0;
    function own(end) {
      if (end > cursor) {
        chunks.push(original.slice(cursor, end));
        segments.push({file: relative, sourceStart: cursor, outputStart, length: end - cursor});
        outputStart += end - cursor;
      }
    }
    for (const [name, target] of parts) {
      const token = `/*__${name}__*/`, position = original.indexOf(token), child = expand(target);
      own(position);
      chunks.push(child.source);
      segments.push(...child.segments.map(segment => ({...segment, outputStart: segment.outputStart + outputStart})));
      outputStart += child.source.length;
      cursor = position + token.length;
    }
    own(original.length);
    return {source: chunks.join(''), segments};
  }
  const result = expand(file);
  const remaining = result.source.match(/\/\*__(?!KNOWLEDGE__)[A-Z][A-Z0-9_]*__\*\//);
  if (remaining) throw Error(`編輯器來源殘留組裝標記：${remaining[0]}`);
  return result;
}

function readEditorSource(entry, options) { return readEditorSourceDetails(entry, options).source; }

function embedKnowledge(source, knowledge) {
  if (source.split(knowledgeToken).length !== 2) throw Error('核心的知識注入標記必須恰好出現一次');
  // A callback also preserves literal $& / $` / $' in game names.
  return source.replace(knowledgeToken, () => JSON.stringify(knowledge).replace(/</g, '\\u003c'));
}

module.exports = {readEditorSource, readEditorSourceDetails, embedKnowledge};
