import { browser, newPage, Capture, V } from './rec-lib.mjs';
// Durées (s) des cartons ; chaque carton doit couvrir sa voix off + 0,7 s.
const durs = { what: 28, levels: 21, parcours: 28, plateforme: 20, menus: 8, fiable: 22, recap: 20, end: 16 };
const only = process.argv.slice(2);
for (const [id, d] of Object.entries(durs)) {
  if (only.length && !only.includes(id)) continue;
  const p = await newPage();
  await p.goto(`file://${V}/slides/slides.html?s=${id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
  const c = new Capture(p, 'slide-' + id); await c.start();
  await p.evaluate(() => document.body.classList.remove('wait'));
  await p.waitForTimeout(d * 1000); await c.stop(); await p.context().close();
}
await browser.close();
