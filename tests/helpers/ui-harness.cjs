'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {saveFixture} = require('./save-fixture.cjs');
const root = path.resolve(__dirname, '../..');

function setup() {
  const elements = new Map(), events = {}, windowEvents = {}, blobs = new Map();
  const downloads = [], prompts = [], revoked = [], timers = [];
  let answer = false;
  const element = () => ({
    value: '', innerHTML: '', textContent: '', dataset: {},
    classList: {toggle() {}, add() {}, remove() {}},
    setAttribute() {}, removeAttribute() {}, addEventListener() {},
    click() { if (this.download) downloads.push({name: this.download, blob: blobs.get(this.href)}); },
    close() { this.open = false; }, showModal() { this.open = true; }
  });
  const $ = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const context = {
    TextDecoder, Blob,
    URL: {
      createObjectURL(blob) { const url = `blob:test-${blobs.size}`; blobs.set(url, blob); return url; },
      revokeObjectURL(url) { revoked.push(url); blobs.delete(url); }
    },
    localStorage: {getItem: () => null},
    setTimeout(fn, ms) { if (ms === 30) queueMicrotask(fn); else timers.push({fn, ms}); return timers.length; },
    clearTimeout() {}, confirm(message) { prompts.push(message); return answer; },
    document: {getElementById: $, querySelectorAll: () => [], addEventListener: (n, f) => events[n] = f, createElement: element},
    window: {addEventListener: (n, f) => windowEvents[n] = f}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/core.js'), 'utf8')
    .replace('/*__KNOWLEDGE__*/null', fs.readFileSync(path.join(root, 'knowledge/catalog.json'), 'utf8')), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8')
    .replace('/*__KNOWLEDGE_UI__*/', 'const editingState={};function renderKnowledgeTab(){}'), context);
  const fixture = saveFixture();
  const file = (name, bytes = Buffer.from(fixture.raw)) => ({name, size: bytes.length, arrayBuffer: async () => bytes});
  const load = (name, bytes) => $('fileInput').onchange({target: {files: [file(name, bytes)]}});
  const edit = value => events.change({target: {dataset: {field: '1,2,0'}, value: String(value)}});
  const unload = () => { let prevented = false; windowEvents.beforeunload({preventDefault() { prevented = true; }}); return prevented; };
  return {$, load, file, edit, unload, fixture, prompts, downloads, revoked,
    confirm: value => { answer = value; },
    restore: () => events.click({target: {closest: () => ({dataset: {restore: '1,2,0'}})}}),
    expireDownloads: () => timers.filter(t => t.ms === 10000).forEach(t => t.fn())};
}

module.exports = {setup};
