// Builds every owl image the site uses from the client's two drawings in ../source:
//   owl-perched.webp  the perched owl (the logo's owl)    -> body, folded wings, head layer, talons layer
//   owl-spread.webp   the same owl with its wings spread  -> the two wing layers
// and the share image (og.jpg). Run from this folder:  npm install && node build-owl.js [outdir]
// (outdir defaults to ../assets). Every number below is in the source image's own pixels.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { cutout, dilate, erode } = require('./cutout');
sharp.cache(false);

const SRC = path.join(__dirname, '..', 'source');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'assets'));
fs.mkdirSync(OUT, { recursive: true });

/* ---------- helpers ---------- */
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// a polygon as a 0..1 mask (soft-edged by blur)
async function polyMask(w, h, polys, blur = 0) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${polys.map(p =>
    `<polygon fill="#fff" points="${p.map(q => q.join(',')).join(' ')}"/>`).join('')}</svg>`);
  let s = sharp(svg); if (blur) s = s.blur(blur);
  const d = await s.extractChannel(3).raw().toBuffer();
  const m = new Float32Array(d.length); for (let i = 0; i < d.length; i++) m[i] = d[i] / 255;
  return m;
}
// everything not reachable from the border is inside (optionally not seeding from the top edge)
function fillHoles(m, w, h, top = true) {
  const o = new Uint8Array(w * h), q = [];
  const push = i => { if (!m[i] && !o[i]) { o[i] = 1; q.push(i); } };
  for (let x = 0; x < w; x++) { if (top) push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w); }
  const r = new Uint8Array(w * h); for (let i = 0; i < r.length; i++) r[i] = o[i] ? 0 : 1;
  return r;
}
// make the inside of a silhouette solid (the dark gaps between the crystal shards stop being
// see-through), within a region; a dark gap keeps its look over black, it just becomes opaque
function solidify(a, w, h, R, region, thr = 110, top = true) {
  const m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3] > thr ? 1 : 0;
  const s = fillHoles(erode(dilate(m, w, h, R), w, h, R), w, h, top);
  const soft = new Float32Array(w * h); for (let i = 0; i < s.length; i++) soft[i] = s[i];
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!s[i]) continue;
    soft[i] = Math.min(soft[i], (soft[i - 1] + soft[i + 1] + soft[i - w] + soft[i + w]) / 4 + .25);
  }
  for (let i = 0; i < s.length; i++) {
    const r = region(i % w, (i / w) | 0); if (r <= 0 || !s[i]) continue;
    const old = a[i * 4 + 3], nw = Math.max(old, Math.round(255 * Math.min(1, soft[i]) * r));
    if (nw === old) continue;
    for (let c = 0; c < 3; c++) a[i * 4 + c] = Math.round(a[i * 4 + c] * old / nw);
    a[i * 4 + 3] = nw;
  }
}
// crop an RGBA buffer, optionally multiplying its alpha by a mask, and write it (plus a phone size)
async function save(rgba, W, [x0, y0, w, h], name, { mask, q = 92, phone = .55, lossless = false } = {}) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y0 + y) * W + x0 + x, d = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) buf[d + c] = rgba[i * 4 + c];
    buf[d + 3] = Math.round(rgba[i * 4 + 3] * (mask ? mask[i] : 1));
  }
  const img = () => sharp(buf, { raw: { width: w, height: h, channels: 4 } });
  await img().webp(lossless ? { lossless: true, effort: 6 } : { quality: q, alphaQuality: 95, effort: 6 }).toFile(path.join(OUT, name + '.webp'));
  if (phone) await img().resize(Math.round(w * phone)).webp(lossless ? { lossless: true, effort: 6 } : { quality: q - 4, alphaQuality: 92, effort: 6 }).toFile(path.join(OUT, name + '-m.webp'));
  console.log(name, [x0, y0, w, h].join(','));
}

/* ---------- the perched owl ---------- */
// the head layer's outline: ear tips down to the point of the face (nothing of the body)
const HEAD = [[400, 92], [950, 92], [950, 236], [905, 236], [849, 343], [833, 350], [673, 460], [513, 350], [497, 343], [441, 236], [400, 236]];
const HEAD_BOX = [400, 92, 550, 370], REST_BOX = [330, 80, 690, 990], TALONS_BOX = [515, 832, 320, 140];
// the owl's middle: the right side is the left one mirrored about it
const MID = 673, mirror = p => p.map(([x, y]) => [2 * MID - x, y]);
// the left folded wing, from under the head's edge down to its longest feathers; the inner edge runs
// along the dark gap beside the chest, above the feathers over the foot (those stay with the body)
const FOLD = [[340, 300], [470, 300], [498, 342], [516, 352], [540, 370], [540, 400], [535, 432], [548, 500], [556, 530], [552, 560], [556, 640], [556, 692], [552, 702], [492, 738], [488, 792], [478, 806], [462, 806], [340, 806]];
const FOLD_BOX = { l: [336, 296, 226, 516], r: [2 * MID - 336 - 226, 296, 226, 516] };
// what the folded wing covers of the body: the side of the chest, which shows once the wing lifts. Its
// outline (left side, x by y) is round, narrowing toward the legs, and ends in feather tips: every
// FEATHER px down, the edge leans out by TIP px and then cuts back in.
const FLANK = [[342, 498], [400, 489], [470, 485], [550, 486], [620, 491], [690, 502], [745, 514]];
const FEATHER = 46, TIP = 13;
const CHEST_EDGE = 556;                                   // the chest's own chevrons end here (left side)
function flankEdge(y) {
  let x = FLANK[FLANK.length - 1][1];
  for (let k = 1; k < FLANK.length; k++) if (y <= FLANK[k][0]) { const [y0, x0] = FLANK[k - 1], [y1, x1] = FLANK[k]; x = x0 + (x1 - x0) * Math.max(0, (y - y0) / (y1 - y0)); break; }
  const u = (((y - 352) / FEATHER) % 1 + 1) % 1;
  return x - TIP * (u < .8 ? u / .8 : (1 - u) / .2);
}

// a pixel of an RGBA image (straight alpha) at a fractional point, interpolated premultiplied
function sample(a, W, H, x, y) {
  x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y));
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, o = [0, 0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const i = ((y0 + dy) * W + x0 + dx) * 4, al = a[i + 3] / 255 * w;
    o[0] += a[i] * al; o[1] += a[i + 1] * al; o[2] += a[i + 2] * al; o[3] += al;
  }
  return o;                                               // premultiplied rgb, alpha 0..1
}

/* the body without its folded wings, and the shadow those wings cast on it.
   With the wings open, the chest goes on to the flanks: every chevron is carried outward along its
   own arm from OPEN_EDGE (the texture is read from the chevrons' lit middles, further down the same
   arm), a little darker toward the side. That replaces both the wing and the dark gap the folded wing
   leaves beside the chest, which is its shadow. The shadow is kept as a layer of its own (gap): over
   the body it gives back the perched owl exactly, and it fades as the wing lifts. */
const OPEN_EDGE = 612;                                    // left side; inside this the chest is as drawn
function wingless(rest, W, H, foldM) {
  const body = Buffer.from(rest), gap = Buffer.alloc(W * H * 4);
  const faceLine = lx => 350 + (lx - 513) * 110 / 160;  // the head's lower edge beside the chest (under it: the head)
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0, left = x < MID, lx = left ? x : 2 * MID - x;   // lx: as if on the left
    const fm = foldM.l[i] + foldM.r[i], Oa = rest[i * 4 + 3] / 255;
    if (fm <= 0 && (lx > OPEN_EDGE || lx < 520 || y < 338 || y > 760 || Oa < .99)) continue;
    if (fm < 1 && Oa < .99) {                             // a see-through edge the folded wing half covers: as drawn,
      body[i * 4 + 3] = Math.round(255 * Oa * (1 - fm) / (1 - Oa * fm));   // so that with the wing over it, it adds up to it
      continue;
    }
    const out = flankEdge(y);
    // the chest carried outward
    const d = OPEN_EDGE - lx, xl = OPEN_EDGE + .35 * d, xs = left ? xl : 2 * MID - xl;
    const ys = Math.min(835, y + (xl - lx));               // the chevrons' arms slope at about 1:1
    let [r, g, b, a] = sample(rest, W, H, xs, ys);
    const shade = (1 - .24 * sstep(20, 126, d)) * (.72 + .28 * sstep(0, 9, lx - out));
    if (a > 0) { r = r / a * shade; g = g / a * shade; b = b / a * shade; }
    const o = i * 4, O = [rest[o], rest[o + 1], rest[o + 2]];
    // the open look: under the wing (by its mask) the flank; beside it, in its shadow, the lit chest
    const fa = a * Math.min(1, Math.max(0, (lx - out) / 1.6 + .5)) * sstep(346, 360, y);
    const v = fm < 1 ? sstep(faceLine(lx) + 2, faceLine(lx) + 14, y) * (1 - sstep(705, 735, y)) * sstep(0, 8, d) : 0;
    const na = fa * fm + Oa * (1 - fm);
    if (na < 1 / 255) { body[o + 3] = 0; continue; }
    const P = [r, g, b].map((c, k) => (c * fa * fm + (O[k] + (c - O[k]) * v) * Oa * (1 - fm)) / na);
    if (fm >= 1) {
      for (let k = 0; k < 3; k++) body[o + k] = Math.round(P[k]);
      body[o + 3] = Math.round(na * 255);
      continue;
    }
    // where any of the perched owl shows past the folded wing, the body under the shadow layer must
    // give it back exactly: never darker than drawn, and the shadow B * (1 - s) + C * s == O
    const B = P.map((c, k) => Math.max(O[k], c));
    let s = 0; for (let k = 0; k < 3; k++) if (B[k] > 0) s = Math.max(s, 1 - O[k] / B[k]);
    for (let k = 0; k < 3; k++) {
      body[o + k] = Math.round(B[k]);
      gap[o + k] = s > 0 ? Math.round(Math.max(0, O[k] - B[k] * (1 - s)) / s) : 0;
    }
    body[o + 3] = 255; gap[o + 3] = Math.round(s * 255);
  }
  return { body, gap };
}
// each foot's toes and talons, each talon on its own so the gaps between them stay open
const FOOT = [[523, 868], [560, 852], [588, 838], [616, 852], [645, 870], [646, 900], [646, 930], [630, 932], [618, 915], [618, 900], [604, 900], [604, 935], [596, 962], [578, 962], [570, 935], [570, 900], [556, 900], [556, 935], [546, 948], [530, 946], [522, 920], [522, 900]];

async function perched() {
  const { data: org, info } = await sharp(path.join(SRC, 'owl-perched.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const headPoly = await polyMask(W, H, [HEAD]);

  // head layer: the head's own cut, solid inside
  const headA = cutout(org, W, H, { close: 8, t0: 6, t1: 34, minArea: 60 });
  solidify(headA, W, H, 14, () => 1);
  await save(headA, W, HEAD_BOX, 'owl-head', { mask: headPoly, phone: 0 });

  // under the head, in the body, a dimmed blur: when the head layer turns, that is what shows
  const sil = new Uint8Array(W * H);
  for (let i = 0; i < sil.length; i++) sil[i] = headPoly[i] > .5 && headA[i * 4 + 3] > 128 ? 1 : 0;
  const wide = dilate(sil, W, H, 6);
  const blurred = await sharp(org, { raw: { width: W, height: H, channels: 3 } }).blur(Math.max(2, W / 260)).raw().toBuffer();
  const shielded = Buffer.from(org);
  for (let i = 0; i < W * H; i++) { const m = wide[i] ? headPoly[i] : 0; if (m <= 0) continue; for (let c = 0; c < 3; c++) shielded[i * 3 + c] = Math.round(org[i * 3 + c] * (1 - m) + blurred[i * 3 + c] * .28 * m); }

  // the rest body: solid below the head, but not from the toes down (the branch shows between them)
  const rest = cutout(shielded, W, H, { close: 8, t0: 6, t1: 34, minArea: 60 });
  solidify(rest, W, H, 22, (x, y) => sstep(320, 360, y) * (1 - sstep(838, 854, y)));
  for (let i = 0; i < W * H; i++) if (sil[i]) rest[i * 4 + 3] = 255;

  // the folded wings, each its own layer that lifts off the body and opens; and the body under them
  const foldM = { l: await polyMask(W, H, [FOLD], .8), r: await polyMask(W, H, [mirror(FOLD)], .8) };
  for (const s of ['l', 'r']) await save(rest, W, FOLD_BOX[s], 'owl-fold-' + s, { mask: foldM[s], q: 92 });
  const { body, gap } = wingless(rest, W, H, foldM);
  // check: body, its shadow and the folded wings, laid over each other, give back the perched owl
  let worst = 0; const off = {};
  for (let i = 0; i < W * H; i++) {
    const o = i * 4, fa = rest[o + 3] / 255 * (foldM.l[i] + foldM.r[i]), ga = gap[o + 3] / 255;
    let A = body[o + 3] / 255; const c = [0, 1, 2].map(k => body[o + k] * A);
    for (let k = 0; k < 3; k++) c[k] = gap[o + k] * ga + c[k] * (1 - ga); A = ga + A * (1 - ga);
    for (let k = 0; k < 3; k++) c[k] = rest[o + k] * fa + c[k] * (1 - fa); A = fa + A * (1 - fa);
    let e = Math.abs(A - rest[o + 3] / 255) * 255;
    for (let k = 0; k < 3; k++) e = Math.max(e, Math.abs(c[k] - rest[o + k] * rest[o + 3] / 255));
    worst = Math.max(worst, e);
    if (e > 8) { const b = `${Math.floor(i % W / 25) * 25},${Math.floor(i / W / 25) * 25}`; off[b] = (off[b] || 0) + 1; }
  }
  const bad = Object.entries(off).sort((a, b) => b[1] - a[1]);
  console.log('perched owl rebuilt from its layers, worst difference:', worst.toFixed(1), '/ 255;',
    bad.length ? 'off by more than 8 at (x,y: px) ' + bad.slice(0, 8).map(e => e.join(': ')).join('  ') : 'none off by more than 8');
  await save(body, W, REST_BOX, 'owl-body', { q: 92 });
  await save(gap, W, REST_BOX, 'owl-body-gap', { lossless: true });

  // the talons layer, in front of the branch
  const plain = cutout(org, W, H, { close: 6, t0: 6, t1: 34, minArea: 30 });
  const feet = await polyMask(W, H, [FOOT, FOOT.map(([x, y]) => [1350 - x, y])], 1.2);
  await save(plain, W, TALONS_BOX, 'owl-talons', { mask: feet, phone: 0 });
}

/* ---------- the wings, from the spread owl ---------- */
const AXIS = 836.7;                                      // the spread owl's middle
const WING = [[0, 110], [588, 110], [590, 240], [655, 300], [700, 380], [706, 470], [662, 560], [602, 592], [0, 592]];
async function wings() {
  const { data: org, info } = await sharp(path.join(SRC, 'owl-spread.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const a = cutout(org, W, H, { close: 6, t0: 6, t1: 34, minArea: 40 });
  // the wings' roots, next to the body, are solid crystal
  solidify(a, W, H, 10, (x, y) => (1 - sstep(330, 400, Math.abs(x - AXIS))) * sstep(200, 240, y) * (1 - sstep(560, 600, y)), 70, false);
  for (const [name, poly, box] of [['l', WING, [19, 140, 694, 454]], ['r', WING.map(([x, y]) => [2 * AXIS - x, y]), [961, 140, 692, 454]]]) {
    await save(a, W, box, 'owl-wing-' + name, { mask: await polyMask(W, H, [poly], 2), q: 90 });
  }
}

/* ---------- the share image (1200 x 630) ---------- */
async function share() {
  const W = 1200, H = 630;
  const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
    <radialGradient id="g" cx="50%" cy="42%" r="55%"><stop offset="0" stop-color="#5a0610" stop-opacity=".55"/><stop offset=".6" stop-color="#2a0307" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#91081a" stop-opacity=".45"/><stop offset=".35" stop-color="#91081a" stop-opacity="0"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#f)"/></svg>`);
  const owl = await sharp(path.join(SRC, 'owl-spread.webp')).resize({ height: 470 }).png().toBuffer({ resolveWithObject: true });
  const mark = await sharp(path.join(OUT, 'wordmark.webp')).resize({ height: 78 }).png().toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#050506' } })
    .composite([{ input: glow, left: 0, top: 0 }, { input: owl.data, left: Math.round((W - owl.info.width) / 2), top: 18, blend: 'screen' },
                { input: mark.data, left: Math.round((W - mark.info.width) / 2), top: 505 }])
    .jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(OUT, 'og.jpg'));
  console.log('og.jpg');
}

(async () => {
  await perched();
  await wings();
  if (fs.existsSync(path.join(OUT, 'wordmark.webp'))) await share();
})();
