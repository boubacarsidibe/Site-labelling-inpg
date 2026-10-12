// Screen-capture helpers: CDP screencast -> JPEG frames with timestamps -> CFR mp4.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const B = 'http://127.0.0.1:4200';
export const PW = process.env.DEMO_PASSWORD; // mot de passe local de démonstration, jamais versionné
export const SHOTS = '/tmp/claude-0/video/shots';
fs.mkdirSync(SHOTS, { recursive: true });

export const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const CURSOR = `
(() => {
  const install = () => {
    if (document.getElementById('demo-cursor')) return;
    const st = document.createElement('style');
    st.textContent = '#demo-cursor{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;transition:opacity .2s}'+
      '#demo-cursor .halo{position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;background:rgba(255,196,0,.28);border:2px solid rgba(255,170,0,.75);box-shadow:0 0 18px rgba(255,170,0,.45);transition:transform .15s}'+
      '#demo-cursor.down .halo{transform:scale(.7);background:rgba(255,140,0,.45)}'+
      '#demo-cursor svg{position:absolute;left:-3px;top:-2px;width:26px;height:32px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}'+
      '.demo-ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid rgba(255,150,0,.9);z-index:2147483646;pointer-events:none;animation:demoRipple .55s ease-out forwards}'+
      '@keyframes demoRipple{to{transform:scale(4.5);opacity:0}}';
    document.documentElement.appendChild(st);
    const c = document.createElement('div'); c.id = 'demo-cursor';
    c.innerHTML = '<div class="halo"></div><svg viewBox="0 0 26 32"><path d="M3 2 L3 26 L9.5 20 L14 30 L18 28.2 L13.6 18.6 L22 18.6 Z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const pos = JSON.parse(sessionStorage.getItem('demoCursor') || 'null');
    if (pos) c.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)'; else c.style.opacity = '0';
    addEventListener('mousemove', e => { c.style.opacity = '1'; c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; sessionStorage.setItem('demoCursor', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', e => { c.classList.add('down'); const r = document.createElement('div'); r.className = 'demo-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();`;

export async function newPage({ width = 1536, height = 864, scale = 1.25 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  await ctx.addInitScript(CURSOR);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p._mouse = [width / 2, height / 2];
  p._w = Math.round(width * scale); p._h = Math.round(height * scale);
  return p;
}

export async function login(p, user) {
  await p.goto(B + '/connexion', { waitUntil: 'networkidle' });
  await p.fill('input[name=username]', user); await p.fill('input[name=password]', PW);
  await p.click('button:has-text("Se connecter")');
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(600);
  if (p.url().includes('/connexion')) {
    // local login throttle (10/min/IP): wait and retry once
    console.log('login throttled for', user, '- waiting'); await p.waitForTimeout(62000);
    return login(p, user);
  }
}

// --- capture -------------------------------------------------------------
export class Capture {
  constructor(page, name) { this.page = page; this.name = name; this.frames = []; this.dir = `${SHOTS}/${name}`; }
  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true }); fs.mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    let i = 0;
    this.cdp.on('Page.screencastFrame', async f => {
      const file = `${this.dir}/${String(i++).padStart(6, '0')}.jpg`;
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      this.frames.push([file, f.metadata.timestamp]);
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: this.page._w, maxHeight: this.page._h, everyNthFrame: 1 });
    // force a first frame
    await this.page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;width:1px;height:1px;left:0;top:0;opacity:.01'; document.body.appendChild(d); setTimeout(() => d.remove(), 50); });
    await this.page.waitForTimeout(150);
    this.t0 = Date.now() / 1000;
    this.marks = [];
  }
  mark(label) { this.marks.push([label, Date.now() / 1000 - this.t0]); }
  async stop() {
    this.tEnd = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast'); await this.page.waitForTimeout(100);
    return this.encode();
  }
  encode() {
    const fr = this.frames.sort((a, b) => a[1] - b[1]);
    if (!fr.length) throw new Error('no frames for ' + this.name);
    const start = this.t0; let list = '';
    for (let k = 0; k < fr.length; k++) {
      const t = Math.max(fr[k][1], start);
      const next = k + 1 < fr.length ? Math.max(fr[k + 1][1], start) : this.tEnd;
      const d = Math.max(next - t, 0.001);
      if (next <= start) continue;
      list += `file '${fr[k][0]}'\nduration ${d.toFixed(4)}\n`;
    }
    list += `file '${fr[fr.length - 1][0]}'\n`;
    fs.writeFileSync(`${this.dir}/list.txt`, list);
    const out = `${SHOTS}/${this.name}.mp4`;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${this.dir}/list.txt`, '-vf', `scale=${this.page._w}:${this.page._h}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', out]);
    fs.writeFileSync(`${SHOTS}/${this.name}.marks.json`, JSON.stringify({ t0: this.t0, duration: this.tEnd - this.t0, marks: this.marks }));
    console.log('encoded', out, (this.tEnd - this.t0).toFixed(1) + 's', fr.length, 'frames');
    return out;
  }
}

// --- human-like interaction ---------------------------------------------
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export async function moveTo(p, target, ms = 550) {
  let x, y;
  if (Array.isArray(target)) [x, y] = target; else {
    const l = typeof target === 'string' ? p.locator(target).first() : target;
    await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox();
    x = b.x + Math.min(b.width / 2, 60); y = b.y + b.height / 2;
    if (b.width < 140) x = b.x + b.width / 2;
  }
  const [x0, y0] = p._mouse; const n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const k = ease(i / n); await p.mouse.move(x0 + (x - x0) * k, y0 + (y - y0) * k); await p.waitForTimeout(12); }
  p._mouse = [x, y];
}
export async function click(p, target, { pause = 220, after = 400 } = {}) {
  await moveTo(p, target); await p.waitForTimeout(pause);
  await p.mouse.down(); await p.waitForTimeout(70); await p.mouse.up();
  await p.waitForTimeout(after);
}
export async function type(p, target, text, delay = 38) {
  await click(p, target, { after: 150 });
  await p.keyboard.type(text, { delay });
  await p.waitForTimeout(200);
}
export async function hold(p, ms) { await p.waitForTimeout(ms); }
export async function scrollTo(p, y, ms = 900) {
  await p.evaluate(([y, ms]) => new Promise(r => {
    const s = scrollY, t0 = performance.now();
    const f = now => { const k = Math.min(1, (now - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : r(); };
    requestAnimationFrame(f);
  }), [y, ms]);
  await p.waitForTimeout(150);
}
export async function scrollToEl(p, sel, offset = 120, ms = 900) {
  const l = p.locator(sel).first();
  const y = (await l.count()) ? await l.evaluate((e, o) => e.getBoundingClientRect().top + scrollY - o, offset) : await p.evaluate(() => scrollY);
  await scrollTo(p, y, ms);
}
export async function goto(p, path) { await p.goto(B + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(400); }
export async function reload(p) { await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400); }
