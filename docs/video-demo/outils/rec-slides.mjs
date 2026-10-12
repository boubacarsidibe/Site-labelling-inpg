import { browser, newPage, Capture } from './rec-lib.mjs';
const durs = { hook: 22, archi: 26, roles: 9.5, menus: 7.5, recap: 19, end: 15 };
const only = process.argv.slice(2);
for (const [id, d] of Object.entries(durs)) {
  if (only.length && !only.includes(id)) continue;
  const p = await newPage();
  await p.goto(`file:///tmp/claude-0/video/slides/slides.html?s=${id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
  const c = new Capture(p, 'slide-' + id); await c.start();
  await p.evaluate(() => document.body.classList.remove('wait'));
  await p.waitForTimeout(d * 1000); await c.stop(); await p.context().close();
}
await browser.close();
