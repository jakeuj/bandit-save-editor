'use strict';
// Read only the requested ZIP members. No images/audio/runtime extraction is needed for static planning.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const {createHash} = require('node:crypto');
const files = ['data.json', 'scripts/c3runtime.js', ...['cl','js','zy','sx','wp','kj','jz','rw','tf','ss','lw','yx','tz'].map(n => n + '.json')];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function external(dir) {
  const resolved = fs.realpathSync(dir), rel = path.relative(path.resolve(__dirname, '..'), resolved);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep))) throw Error('Artifacts must stay outside the repo');
  return resolved;
}
function members(file, names) {
  const fd = fs.openSync(file, 'r');
  const read = (n, at) => { const b = Buffer.alloc(n); if (fs.readSync(fd, b, 0, n, at) !== n) throw Error('Incomplete ZIP'); return b; };
  try {
    const size = fs.fstatSync(fd).size, tail = read(Math.min(size, 65557), Math.max(0, size - 65557));
    let end = tail.length - 22;
    for (; end >= 0; end--) if (tail.readUInt32LE(end) === 0x06054b50 && end + 22 + tail.readUInt16LE(end + 20) === tail.length) break;
    if (end < 0 || tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6)) throw Error('Unsupported ZIP directory');
    const number64 = (b, at) => { const n = b.readBigUInt64LE(at); if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('ZIP member is too large'); return Number(n); };
    let count = tail.readUInt16LE(end + 10), offset = tail.readUInt32LE(end + 16);
    if (count === 65535 || offset === 0xffffffff) {
      const locator = read(20, size - tail.length + end - 20);
      if (locator.readUInt32LE(0) !== 0x07064b50 || locator.readUInt32LE(4) || locator.readUInt32LE(16) !== 1) throw Error('Invalid ZIP64 locator');
      const record = read(56, number64(locator, 8));
      if (record.readUInt32LE(0) !== 0x06064b50 || record.readUInt32LE(16) || record.readUInt32LE(20)) throw Error('Invalid ZIP64 directory');
      count = number64(record, 32); offset = number64(record, 48);
    }
    const entries = new Map(); let at = offset;
    for (let i = 0; i < count; i++) {
      const h = read(46, at); if (h.readUInt32LE(0) !== 0x02014b50) throw Error('Invalid ZIP directory');
      const n = h.readUInt16LE(28), name = read(n, at + 46).toString('utf8').replace(/\\/g, '/');
      if (entries.has(name)) throw Error('Duplicate ZIP member: ' + name);
      const entry = {flags: h.readUInt16LE(8), method: h.readUInt16LE(10), size: h.readUInt32LE(24), packed: h.readUInt32LE(20), offset: h.readUInt32LE(42)};
      const extra = read(h.readUInt16LE(30), at + 46 + n);
      for (let x = 0; x + 4 <= extra.length; x += 4 + extra.readUInt16LE(x + 2)) if (extra.readUInt16LE(x) === 1) {
        let p = x + 4;
        for (const key of ['size','packed','offset']) if (entry[key] === 0xffffffff) { entry[key] = number64(extra, p); p += 8; }
        break;
      }
      entries.set(name, entry);
      at += 46 + n + h.readUInt16LE(30) + h.readUInt16LE(32);
    }
    const selected = names || [...entries.keys()].filter(n => !n.endsWith('/')), result = new Map();
    for (const name of selected) {
      if (path.posix.isAbsolute(name) || name.split('/').some(p => p === '..' || p.includes(':'))) throw Error('Unsafe ZIP member');
      const e = entries.get(name); if (!e) throw Error('Missing ZIP member: ' + name);
      if (e.flags & 1 || ![0,8].includes(e.method) || e.size > 256 * 1024 * 1024) throw Error('Unsupported ZIP member: ' + name);
      const h = read(30, e.offset); if (h.readUInt32LE(0) !== 0x04034b50) throw Error('Invalid ZIP member');
      const b = read(e.packed, e.offset + 30 + h.readUInt16LE(26) + h.readUInt16LE(28));
      const bytes = e.method === 8 ? zlib.inflateRawSync(b, {maxOutputLength: e.size + 1}) : b;
      if (bytes.length !== e.size) throw Error('Incomplete ZIP member: ' + name);
      result.set(name, bytes);
    }
    return result;
  } finally { fs.closeSync(fd); }
}
function prepare(packagePath, artifacts, {full = false} = {}) {
  const input = path.resolve(packagePath), file = fs.statSync(input).isDirectory() ? path.join(input, 'package.nw') : input;
  const hash = sha(fs.readFileSync(file)), dir = path.join(external(artifacts), 'source-' + hash + (full ? '-full' : '-static'));
  const stamp = path.join(dir, 'source-cache.json');
  if (fs.existsSync(stamp)) {
    const saved = JSON.parse(fs.readFileSync(stamp));
    if (saved.packageHash === hash && Object.entries(saved.files).every(([name,h]) => fs.existsSync(path.join(dir,name)) && sha(fs.readFileSync(path.join(dir,name))) === h)) return {source: dir, packageHash: hash, reused: true};
  }
  const entries = members(file, full ? null : files);
  fs.mkdirSync(dir, {recursive: true});
  for (const [name, bytes] of entries) { const dest = path.join(dir, name); fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.writeFileSync(dest, bytes); }
  fs.writeFileSync(stamp, JSON.stringify({packageHash: hash, files: Object.fromEntries([...entries].map(([n,b]) => [n,sha(b)]))}));
  return {source: dir, packageHash: hash, reused: false};
}
module.exports = {files, external, members, prepare};
