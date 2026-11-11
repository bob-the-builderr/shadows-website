// Cut the owl out of its black background.
// alpha: 1 inside the owl's closed silhouette (so dark gaps between shards stay solid, as in the art),
// soft (from brightness) in the glow around it; colour un-premultiplied there so the glow keeps its red.
//   const { cutout } = require('./cutout'); cutout(rgb Buffer, w, h, { close, t0, t1, minArea }) -> RGBA Buffer
function maxFilter(src, w, h, r, out) {            // square max (dilate) / min via negation, separable
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (src[y * w + k]) { m = 1; break; }
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (tmp[k * w + x]) { m = 1; break; }
    out[y * w + x] = m;
  }
  return out;
}
function dilate(m, w, h, r) { return maxFilter(m, w, h, r, new Uint8Array(w * h)); }
function erode(m, w, h, r) {
  const inv = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) inv[i] = 1 - m[i];
  const d = dilate(inv, w, h, r); for (let i = 0; i < d.length; i++) d[i] = 1 - d[i];
  return d;
}
function components(m, w, h, minArea) {             // drop specks
  const lab = new Int32Array(w * h), out = new Uint8Array(w * h), stack = [];
  let id = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    id++; const px = []; stack.push(s); lab[s] = id;
    while (stack.length) {
      const i = stack.pop(); px.push(i);
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X; if (m[j] && !lab[j]) { lab[j] = id; stack.push(j); }
      }
    }
    if (px.length >= minArea) for (const i of px) out[i] = 1;
  }
  return out;
}
function outside(m, w, h) {                          // background reachable from the frame border
  const o = new Uint8Array(w * h), q = [];
  const push = i => { if (!m[i] && !o[i]) { o[i] = 1; q.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  return o;
}
function cutout(rgb, w, h, o = {}) {
  const { close = 5, t0 = 6, t1 = 34, minArea = 30, ch = 3 } = o;
  const n = w * h, lum = new Uint8Array(n), m = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const k = i * ch; lum[i] = Math.max(rgb[k], rgb[k + 1], rgb[k + 2]); m[i] = lum[i] > t1 ? 1 : 0; }
  const clean = components(m, w, h, minArea);
  const closed = erode(dilate(clean, w, h, close), w, h, close);
  const out = outside(closed, w, h);
  const res = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const k = i * ch;
    let a = out[i] ? Math.min(1, Math.max(0, (lum[i] - t0) / (t1 - t0))) : 1;
    if (out[i] && !clean[i]) {                       // glow near the owl only, no stray noise far away
      a *= .85;
    }
    res[i * 4 + 3] = Math.round(a * 255);
    for (let c = 0; c < 3; c++) res[i * 4 + c] = a > .004 ? Math.min(255, Math.round(rgb[k + c] / (a < 1 ? Math.max(a, lum[i] / 255) : 1))) : 0;
  }
  // feather the inside edge by one pixel so the silhouette is not jagged
  const a2 = Buffer.from(res);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (out[i]) continue;
    let edge = 0; for (const j of [i - 1, i + 1, i - w, i + w]) if (out[j]) edge = 1;
    if (edge) a2[i * 4 + 3] = Math.max(Math.round(res[i * 4 + 3] * .5 + Math.min(255, lum[i] * 255 / t1) * .5), 0);
  }
  return a2;
}
module.exports = { cutout, dilate, erode, components, outside };
