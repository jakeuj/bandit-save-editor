#!/usr/bin/env node
'use strict';
const path = require('node:path');
const {buildInspection, queryInspection} = require('./editor-inspection.cjs');
const {suggestChecks, changedReport, testCandidates} = require('./editor-check-plan.cjs');

const help = `即時編輯器導覽（讀目前來源，不執行測試或遊戲）
  npm run inspect:editor -- --symbol setCharacterSkillCaps
  npm run inspect:editor -- --symbol SkillCapsRequest
  npm run --silent inspect:editor -- --family randomCharacterSkillCaps --json
  npm run inspect:editor -- --group randomCharacterSkillCapsAdvanced
  npm run inspect:editor -- --file src/core/skill-caps-talents.js
  npm run inspect:editor -- --changed [--base HEAD | --staged] [--json]
  npm run verify:architecture
符號／family／旗標／檔案擇一；動態及間接引用明示限制，測試清單為靜態候選。
機器讀取 JSON 時加 npm 的 --silent，避免 npm 標題混入 stdout。`;

function parseArguments(argv) {
  const result = {}, values = new Set(['--symbol', '--family', '--group', '--file', '--base']);
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i], key = argument.slice(2);
    if (!values.has(argument) && !['--json', '--changed', '--staged', '--verify', '--help'].includes(argument)) throw Error('未知參數：' + argument);
    if (Object.hasOwn(result, key)) throw Error('參數重複：' + argument);
    if (values.has(argument)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error(argument + ' 缺少值');
      result[key] = argv[++i];
    } else result[key] = true;
  }
  if (result.help) return result;
  const selectors = ['symbol', 'family', 'group', 'file', 'changed', 'verify'].filter(name => result[name] !== undefined);
  if (selectors.length !== 1) throw Error('請選擇一種查詢，或使用 --help');
  if ((result.base !== undefined || result.staged) && !result.changed) throw Error('--base／--staged 僅用於 --changed');
  if (result.base !== undefined && result.staged) throw Error('--base 與 --staged 不能一起使用');
  return result;
}
const at = row => row.file + ':' + row.line + ':' + row.column;
const shellArgument = value => /^[\w./:@=-]+$/.test(value) ? value : "'" + value.replaceAll("'", "''") + "'";
function formatReport(report) {
  const lines = [];
  if (report.files) lines.push('變更檔案：' + report.files.length, ...report.files.map(file => '  ' + file));
  if (report.snapshotTree) lines.push('暫存快照：' + report.snapshotTree);
  lines.push('定義：' + report.definitions.length);
  for (const row of report.definitions.slice(0, 25)) lines.push('  ' + row.id + ' → ' + at(row));
  if (report.definitions.length > 25) lines.push('  其餘定義可用 --json 查看');
  if (report.definitions.length === 1 && report.definitions[0].contract) lines.push('介面契約：\n' + report.definitions[0].contract.text);
  if (report.contractTypes?.length) {
    lines.push('契約型別：' + report.contractTypes.length);
    for (const type of report.contractTypes) lines.push('  ' + type.name + ' → ' + at(type));
    if (!report.definitions.length && report.contractTypes.length === 1) lines.push(report.contractTypes[0].text);
  }
  lines.push('直接相依／被引用位置：' + report.dependencies.length + '／' + report.dependents.length);
  for (const row of report.dependencies.slice(0, 12)) lines.push('  ' + (row.from || '(初始化)') + ' → ' + row.to + ' @ ' + at(row));
  lines.push('Family：' + (report.families.map(f => f.name).join('、') || '未定位'), '旗標：' + (report.groups.map(g => g.name + (g.enabled ? '（開）' : '（關）')).join('、') || '未定位'));
  if (report.testCandidates) lines.push('靜態測試候選：' + report.testCandidates.length + '（完整清單見 --json）');
  lines.push('建議檢查（僅列出）：');
  for (const check of report.suggestedChecks) lines.push('  ' + (check.kind === 'manual' ? check.instruction : [check.command, ...check.args].map(shellArgument).join(' ')) + ' — ' + (check.reason || check.coverage));
  for (const guide of report.guides || []) lines.push('指引：' + guide);
  for (const diagnostic of report.diagnostics) lines.push('錯誤 [' + diagnostic.code + '] ' + at(diagnostic) + ' ' + diagnostic.message);
  for (const limitation of report.limitations.slice(0, 15)) lines.push('限制 [' + limitation.code + '] ' + (limitation.file ? at(limitation) + ' ' : '') + limitation.message);
  if (report.limitations.length > 15) lines.push('其餘 ' + (report.limitations.length - 15) + ' 項限制見 --json');
  return lines.join('\n');
}

function run(argv, {root = path.resolve(__dirname, '..'), stdout = console.log, stderr = console.error} = {}) {
  let options;
  try {
    options = parseArguments(argv);
    if (options.help) { stdout(help); return 0; }
    let report;
    if (options.changed) report = changedReport({root, ...(options.base !== undefined ? {base: options.base} : {}), staged: !!options.staged});
    else {
      const index = buildInspection({root});
      if (options.verify) report = {definitions: index.definitions.map(({start, end, ...d}) => d), dependencies: index.references, dependents: [], families: index.families, groups: index.groups, suggestedChecks: [], diagnostics: index.diagnostics, limitations: index.limitations, guides: ['docs/maintenance/core.md#來源組裝與責任分檔']};
      else {
        const query = Object.fromEntries(['symbol', 'family', 'group', 'file'].filter(name => options[name] !== undefined).map(name => [name, options[name]]));
        report = queryInspection(index, query);
        report.testCandidates = report.definitions.length ? testCandidates(index, new Set(report.publicExports), report.limitations) : [];
        report.suggestedChecks = report.definitions.length ? suggestChecks(index, {ids: report.definitions.map(d => d.id), files: [...new Set(report.definitions.map(d => d.file))]}) : [];
      }
    }
    if (options.verify) report.status = report.diagnostics.length ? 'failed' : 'passed-static-checks';
    const verificationSummary = () => ['架構靜態檢查：' + (report.diagnostics.length ? '失敗' : '通過（分析限制仍須核對）'), '定義／family／旗標：' + report.definitions.length + '／' + report.families.length + '／' + report.groups.length, ...report.diagnostics.map(d => '錯誤 [' + d.code + '] ' + at(d) + ' ' + d.message), ...report.limitations.map(l => '限制 [' + l.code + '] ' + at(l) + ' ' + l.message)].join('\n');
    stdout(options.json ? JSON.stringify(report, null, 2) : options.verify ? verificationSummary() : formatReport(report));
    return report.diagnostics.length ? 1 : 0;
  } catch (error) {
    if (options?.json || argv.includes('--json')) stdout(JSON.stringify({error: error.message, diagnostics: [], limitations: ['無法完成這次查詢，請採完整驗證']}, null, 2));
    else stderr(error.message + '\n使用 --help 查看查詢方式。');
    return 1;
  }
}

if (require.main === module) process.exitCode = run(process.argv.slice(2));
module.exports = {run, parseArguments, formatReport};
