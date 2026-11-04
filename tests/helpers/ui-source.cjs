'use strict';
const acorn = require('../../scripts/vendor/acorn.cjs');
const {readEditorSource} = require('../../scripts/editor-source.cjs');

// Expose the closure's model only in the VM under test, independent of layout.
function uiWithModel(options) {
  const source = readEditorSource('ui', options);
  const ast = acorn.parse(source, {ecmaVersion: 2024});
  const body = ast.body[0]?.expression?.callee?.body;
  if (ast.body.length !== 1 || body?.type !== 'BlockStatement') throw Error('UI 測試需要單一 IIFE 入口');
  const at = body.end - 1;
  return source.slice(0, at) + '\nglobalThis.uiTest={get model(){return model;}};\n' + source.slice(at);
}

module.exports = {uiWithModel};
