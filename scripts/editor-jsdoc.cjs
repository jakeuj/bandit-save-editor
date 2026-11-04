'use strict';

// Keep JSDoc content readable rather than implementing a second type checker.
// Named typedefs and their references are navigation metadata; runtime guards stay authoritative.
function declarations(text) {
  const names = [];
  for (const match of text.matchAll(/(?:^|\n)\s*@typedef\s+/g)) {
    let position = match.index + match[0].length;
    if (text[position] === '{') {
      let depth = 0, quote = null, escaped = false;
      for (; position < text.length; position++) {
        const character = text[position];
        if (quote) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === quote) quote = null;
        } else if (['"', "'", '`'].includes(character)) quote = character;
        else if (character === '{') depth++;
        else if (character === '}' && --depth === 0) { position++; break; }
      }
    }
    const name = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/.exec(text.slice(position));
    if (name) names.push(name[1]);
  }
  return names;
}

function indexJsdoc(entry, source, comments, locate) {
  const blocks = comments.filter(comment => comment.type === 'Block' && source.slice(comment.start, comment.start + 3) === '/**').map(comment => {
    const text = source.slice(comment.start + 3, comment.end - 2).split(/\r?\n/).map(line => line.replace(/^\s*\* ?/, '')).join('\n').trim();
    return {...comment, text, names: declarations(text)};
  });
  const types = blocks.flatMap(block => block.names.map(name => ({id: entry + ':type:' + name, entry, name, ...locate(block.start), text: block.text})));
  function forDefinition(start) {
    const block = blocks.findLast(comment => comment.end <= start);
    if (!block || block.names.length || !/^\s*(?:(?:const|let|var)\s+)?$/.test(source.slice(block.end, start))) return undefined;
    return {...locate(block.start), text: block.text};
  }
  return {types, forDefinition};
}

function referencedTypes(types, contracts, seeds = []) {
  const chosen = new Map(seeds.map(type => [type.id, type])), queue = [...contracts.map(contract => contract.text), ...seeds.map(type => type.text)];
  for (let i = 0; i < queue.length; i++) {
    const words = new Set(queue[i].match(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g) || []);
    for (const type of types) if (words.has(type.name) && !chosen.has(type.id)) { chosen.set(type.id, type); queue.push(type.text); }
  }
  return [...chosen.values()];
}

module.exports = {indexJsdoc, referencedTypes};
