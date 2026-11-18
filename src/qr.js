/**
 * QR codes for order tickets — made on our own server (no outside service).
 * Byte mode, error correction level M (≈15 % damage tolerance), versions 1–10 (up to 213 bytes).
 * Output: SVG (for screens/printing) and PNG (for the WhatsApp receipt picture).
 */
import zlib from 'node:zlib';

// [total codewords, EC codewords per block, [[blocks, data codewords per block], ...]] for level M
const SPEC = [null,
  [26, 10, [[1, 16]]], [44, 16, [[1, 28]]], [70, 26, [[1, 44]]], [100, 18, [[2, 32]]], [134, 24, [[2, 43]]],
  [172, 16, [[4, 27]]], [196, 18, [[4, 31]]], [242, 22, [[2, 38], [2, 39]]], [292, 22, [[3, 36], [2, 37]]], [346, 26, [[4, 43], [1, 44]]]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* ---- Reed–Solomon over GF(256), polynomial 0x11D ---- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) { const next = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); } g = next; }
  return g;
}
function rsRemainder(data, n) {
  const gen = rsGenerator(n); const res = new Array(n).fill(0);
  for (const b of data) { const f = b ^ res.shift(); res.push(0); for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], f); }
  return res;
}

export function encodeQR(text) {
  const bytes = [...Buffer.from(String(text), 'utf8')];
  let ver = 1;
  for (; ver <= 10; ver++) { const dataCw = SPEC[ver][2].reduce((t, [b, d]) => t + b * d, 0); if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCw * 8) break; }
  if (ver > 10) throw new Error('Text too long for the QR code');
  const [, ecLen, groups] = SPEC[ver];
  const dataCw = groups.reduce((t, [b, d]) => t + b * d, 0);

  // data bits
  const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, dataCw * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; data.length < dataCw; p++) data.push(p % 2 ? 0x11 : 0xec);

  // blocks + error correction, interleaved
  const blocks = []; let k = 0;
  for (const [n, d] of groups) for (let i = 0; i < n; i++) { const blk = data.slice(k, k + d); k += d; blocks.push({ d: blk, e: rsRemainder(blk, ecLen) }); }
  const cw = []; const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) cw.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) cw.push(b.e[i]);

  // matrix
  const size = ver * 4 + 17;
  const M = Array.from({ length: size }, () => new Array(size).fill(false));
  const F = Array.from({ length: size }, () => new Array(size).fill(false)); // function modules
  const set = (x, y, dark) => { M[y][x] = !!dark; F[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[ver];
  for (const ay of al) for (const ax of al) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask) => {
    const dataF = (0 << 3) | mask; let rem = dataF; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((dataF << 10) | rem) ^ 0x5412; const bit = (i) => (b >>> i) & 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0); // reserve
  if (ver >= 7) {
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const bit = (b >>> i) & 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); }
  }
  // codewords, zig-zag
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && i < cw.length * 8) { M[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2, (x, y) => y % 2, (x, y) => x % 3, (x, y) => (x + y) % 3, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2,
    (x, y) => (x * y) % 2 + (x * y) % 3, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2];
  const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y) === 0) M[y][x] = !M[y][x]; };
  let best = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const s = penalty(M, size); if (s < bestScore) { bestScore = s; best = m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return { size, version: ver, modules: M };
}

function penalty(M, n) {
  let p = 0;
  const lines = [];
  for (let y = 0; y < n; y++) lines.push(M[y]);
  for (let x = 0; x < n; x++) lines.push(M.map((r) => r[x]));
  for (const L of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) { if (i < n && L[i] === L[i - 1]) run++; else { if (run >= 5) p += 3 + run - 5; run = 1; } }
    const s = L.map((v) => (v ? 1 : 0)).join('');
    for (const pat of ['10111010000', '00001011101']) { let k = s.indexOf(pat); while (k !== -1) { p += 40; k = s.indexOf(pat, k + 1); } }
  }
  let dark = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (M[y][x]) dark++;
    if (x < n - 1 && y < n - 1 && M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
  }
  p += Math.max(0, Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return p;
}

export function qrSvg(text, { margin = 4, dark = '#0e0e0e' } = {}) {
  const { size, modules } = encodeQR(text); const W = size + margin * 2; let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) d += `M${x + margin} ${y + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" shape-rendering="crispEdges"><rect width="${W}" height="${W}" fill="#fff"/><path d="${d}" fill="${dark}"/></svg>`;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** PNG picture of the QR code (white background), `scale` pixels per module. */
export function qrPng(text, { scale = 12, margin = 4 } = {}) {
  const { size, modules } = encodeQR(text); const W = (size + margin * 2) * scale;
  const raw = Buffer.alloc((W + 1) * W, 255);
  for (let py = 0; py < W; py++) {
    raw[py * (W + 1)] = 0; // filter: none
    const my = Math.floor(py / scale) - margin;
    for (let px = 0; px < W; px++) { const mx = Math.floor(px / scale) - margin; if (my >= 0 && mx >= 0 && my < size && mx < size && modules[my][mx]) raw[py * (W + 1) + 1 + px] = 0; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
