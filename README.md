# Shadows — Media & Advertising

The agency's one-page site: the Shadows owl perched on a burning branch, one tab per offshoot.
Changing tabs (scroll, swipe, keys or the tabs themselves) makes the owl spread its wings and beat
them while the next tab is laid out.

## Run it

```bash
node serve.js 5178
```

Then open http://localhost:5178. It is a static site: `index.html` and `assets/` are all a host needs.

- `?debug` turns on the testing hooks (`window.__shadows`, `window.__t` to freeze a tab change at a
  given second, `window.__slow` to slow it down).
- `?lite` shows the lightest effects level, the one weak devices step down to by themselves.
- Every tab has its own address: `#services`, `#work`, `#studio`, `#contact`.

## The owl's images

All of them come from the client's two drawings in `source/` (the perched owl and the same owl with
its wings spread), cut by `tools/build-owl.js`:

```bash
cd tools
npm install
node build-owl.js
```

It writes into `assets/`: the perched body without its folded wings (`owl-body`; where the wings lay,
the chest's chevrons carry on, lit), the shadow the folded wings cast on it, which fades as they lift
(`owl-body-gap`; over the body it gives back the perched owl exactly, and the build checks that),
the two folded wings that lift off it (`owl-fold-l`, `owl-fold-r`),
the head layer that turns toward the mouse (`owl-head`), the talons that grip the branch (`owl-talons`),
the two open wings they hand over to (`owl-wing-l`, `owl-wing-r`), and the share image (`og.jpg`).
The `-m` files are the lighter phone versions.

How the wings open, beat and fold, and how the body goes with them, is tuned by `SPREAD`, `BEAT`,
`LIFT`, `LEAN` and `RIG` in `index.html`.

## Before launch

- In `index.html`, make `og:image` an absolute address on the site's domain and add `og:url`.
- Fill in the real work, the contact buttons (email, WhatsApp) and, in the search-engine data
  (`application/ld+json`), the site's address, logo and social accounts.
