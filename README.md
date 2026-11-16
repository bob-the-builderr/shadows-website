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
The `-m` files are half-size versions, used only on phones with a low-density screen (on any sharper
screen the owl gets more screen pixels than they have).

The page draws every image with its smaller copies (mipmaps), premultiplied and slightly sharpened
(`LOD` in `index.html`), so the crystal edges stay crisp and don't shimmer when the owl is drawn
smaller than its images, which it is on nearly every screen.

How the wings open, beat and fold, and how the body goes with them, is tuned by `SPREAD`, `BEAT`,
`LIFT`, `LEAN` and `RIG` in `index.html`.

The home-screen icon (`assets/apple-touch-icon.png`, the owl's head from `source/logo.png`) is built by
`node build-icons.js` in the same folder.

## If something fails

- A page opened in a tab that isn't on screen yet is laid out once it gets a size, not before.
- If the script fails before the page has opened, a small safety net at the top of `index.html` shows
  the content plainly, with tabs and links that still switch sections.
- With JavaScript off, every section is shown one under the other.
- three.js is loaded from cdnjs with an `integrity` hash: if the file were ever altered, the browser
  refuses it and the page goes on without the owl.

## Preview

A preview for the client is published with GitHub Pages from `main`:
https://bob-the-builderr.github.io/shadows-website/ (every push to `main` updates it within a minute
or two). It asks search engines not to index it (`<meta name="robots" content="noindex">`).

## Before launch

Still waiting on the client's details:

- **Contact buttons** (`#p4` in `index.html`): the email address (`mailto:`) and the WhatsApp number
  (`https://wa.me/<number in international format, digits only>`). Until then they lead nowhere.
- **Domain**: remove the `noindex` line, point `og:url` and `og:image` at the domain, add
  `<link rel="canonical">`, add `robots.txt` and `sitemap.xml`, and a `CNAME` file if it is served by
  GitHub Pages.
- **Search-engine data** (`application/ld+json`): the site's address, logo, email and social accounts
  (`sameAs`).
- **Work**: the Work tab asks visitors to request the portfolio; add real projects there if the client
  wants them public.
