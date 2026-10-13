// Enregistrement des écrans de la vidéo v2 (nouvelle version de l'application).
// Prérequis : API sur 8000 avec base vierge (superutilisateur « superadmin »), interface sur 4200, DEMO_PASSWORD dans l'environnement.
import fs from 'node:fs';
import { browser, newPage, login, Capture, click, type, moveTo, hold, scrollTo, scrollToEl, goto, reload, SHOTS, V } from './rec-lib.mjs';

const PW = process.env.DEMO_PASSWORD;
if (!PW) throw new Error('DEMO_PASSWORD manquant');
const pane = { width: 960, height: 1020, scale: 1 };
const PDFS = `${V}/pdfs`; fs.mkdirSync(PDFS, { recursive: true });

const sel = async (p, selector, label) => { await moveTo(p, selector); await hold(p, 250); await p.locator(selector).first().selectOption({ label }); await hold(p, 350); };
async function shot(name, page, fn) { const c = new Capture(page, name); await c.start(); await fn(c); await c.stop(); }
async function duo(name, left, right, fn) {
  const a = new Capture(left, name + '-L'), b = new Capture(right, name + '-R');
  await a.start(); await b.start(); await fn(a, b); await a.stop(); await b.stop();
}
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
function makePdf(title) {
  const file = `${PDFS}/${slug(title)}.pdf`;
  const stream = `BT /F1 22 Tf 60 760 Td (${slug(title).replace(/_/g, ' ')}) Tj ET`;
  fs.writeFileSync(file, `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
  return file;
}
const inDays = n => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

// 1. Portail public + inscription entreprise (avec activité)
{
  const p = await newPage();
  await goto(p, '/');
  await shot('public', p, async c => {
    await hold(p, 1500);
    await scrollTo(p, 700, 1800); await hold(p, 900); await scrollTo(p, 0, 900);
    c.mark('label'); await click(p, 'header nav a:has-text("Le Label INPG")', { after: 900 }); await hold(p, 1600);
    await scrollTo(p, 650, 1600); await hold(p, 1400); await scrollTo(p, 0, 700);
    c.mark('demarche'); await click(p, 'header nav a:has-text("Démarche")', { after: 900 }); await hold(p, 1400);
    c.mark('inscription'); await click(p, 'header a:has-text("Inscription")', { after: 900 });
    await click(p, 'label.choice:has-text("Entreprise")');
    await type(p, 'input[name=first_name]', 'Aminata', 22); await type(p, 'input[name=last_name]', 'Diallo', 22);
    await type(p, 'input[name=email]', 'a.diallo@spd.sn', 18); await type(p, 'input[name=username]', 'spd.diallo', 18);
    await type(p, 'input[name=legal_name]', 'Sénégal Pétrole Distribution', 14); await type(p, 'input[name=ninea]', '009876543', 18);
    await sel(p, 'select[name=activity]', 'Distribution');
    await moveTo(p, 'p.note'); c.mark('verif-note'); await hold(p, 1800);
    await type(p, 'input[name=password]', PW, 12); await type(p, 'input[name=confirm]', PW, 12);
    c.mark('submit'); await click(p, 'button:has-text("Créer mon compte")', { after: 900 });
    await scrollTo(p, 0, 600); await hold(p, 1800);
  });
  await p.context().close();
}

// 2. Superadministrateur : création des comptes internes, activation/désactivation
{
  const p = await newPage(); await login(p, 'superadmin'); await goto(p, '/admin/utilisateurs');
  await shot('users', p, async c => {
    await hold(p, 1000);
    const accounts = [['gest.fall', 'Gestionnaire'], ['eval.sow', 'Évaluateur'], ['audit.diop', 'Auditeur'], ['decid.ba', 'Décideur'], ['admin.ndiaye', 'Administrateur']];
    for (const [i, [u, role]] of accounts.entries()) {
      const d = i === 0 ? 45 : 10;
      c.mark('acc-' + u);
      await type(p, 'input[name=username]', u, d); await type(p, 'input[name=email]', u + '@inpg.sn', d);
      await sel(p, 'select[name=role]', role); await type(p, 'input[name=password]', PW, d / 2);
      await click(p, 'button:has-text("Créer le compte")', { after: i === 0 ? 1500 : 700 });
    }
    await hold(p, 800); c.mark('liste');
    await scrollTo(p, 0, 400); await moveTo(p, 'button:has-text("Désactiver") >> nth=1'); await hold(p, 2600);
  });
  await p.context().close();
}

// 3. Connexion d'un acteur interne
{
  const p = await newPage(); await goto(p, '/connexion');
  await shot('login', p, async () => {
    await hold(p, 800);
    await type(p, 'input[name=username]', 'gest.fall', 70); await type(p, 'input[name=password]', PW, 40);
    await click(p, 'button:has-text("Se connecter")', { after: 1200 }); await hold(p, 2200);
  });
  await p.context().close();
}

// 4. Entreprise : nouvelle demande + dépôt des pièces
const ent = await newPage(); await login(ent, 'spd.diallo');
await shot('ent-demande', ent, async c => {
  await hold(ent, 1800);
  c.mark('nouvelle'); await click(ent, '.dashboard-head a:has-text("Nouvelle demande")', { after: 900 });
  await hold(ent, 700);
  await type(ent, 'input[name=scope]', 'Dépôt de Dakar et activités de distribution', 22);
  await scrollToEl(ent, '.domain-options', 200, 800);
  c.mark('volets'); await click(ent, '.domain-options label:has-text("Sécurité")', { after: 600 });
  await click(ent, '.domain-options label:has-text("Qualité")', { after: 900 });
  await moveTo(ent, '.level-summary'); c.mark('gold'); await hold(ent, 1800);
  c.mark('checklist-api'); await scrollToEl(ent, '.summary-card', 120, 900); await moveTo(ent, '.document-list'); await hold(ent, 2600);
  await scrollToEl(ent, 'textarea[name=description]', 300, 700);
  await type(ent, 'textarea[name=description]', 'Distribution de produits pétroliers dans la région de Dakar.', 14);
  c.mark('creer'); await click(ent, 'button:has-text("Créer le brouillon")', { after: 1300 });
  c.mark('pieces'); await hold(ent, 1500);
  const n = await ent.locator('label.upload').count();
  for (let i = 0; i < n; i++) {
    const title = (await ent.locator('.documents article h3').nth(i).innerText()).trim();
    const lab = ent.locator('label.upload').nth(i);
    await lab.scrollIntoViewIfNeeded(); await moveTo(ent, lab); await hold(ent, 150);
    await ent.mouse.down(); await ent.mouse.up();
    await lab.locator('input[type=file]').setInputFiles(makePdf(title));
    await hold(ent, 520);
  }
  console.log('PIECES', n);
  c.mark('soumettre-bloque'); await scrollToEl(ent, 'footer button.button', 500, 700); await moveTo(ent, 'footer button.button'); await hold(ent, 2600);
});
const appId = ent.url().match(/dossiers\/(\d+)/)[1]; console.log('APP', appId);
await ent.context().close();

// 5. Split : gestionnaire vérifie l'organisation et valide | entreprise (rafraîchissement automatique) soumet
const G = await newPage(pane); await login(G, 'gest.fall'); await goto(G, '/admin/dossiers');
const E = await newPage(pane); await login(E, 'spd.diallo'); await goto(E, `/espace/dossiers/${appId}/documents`);
await duo('split-validation', G, E, async (cg, ce) => {
  await hold(G, 800);
  await click(G, 'a:has-text("Ouvrir")', { after: 1000 });
  cg.mark('verifier-org'); await click(G, 'button:has-text("Vérifier l’organisation")', { after: 1100 });
  cg.mark('valider');
  while (await G.locator('button:has-text("Valider")').count()) await click(G, G.locator('button:has-text("Valider")').first(), { pause: 120, after: 450 });
  await hold(G, 600); cg.mark('fin-validation');
  // l'entreprise n'a rien touché : la page se met à jour toute seule (sondage toutes les 30 s)
  ce.mark('attente');
  const banner = E.locator('.notice.changed');
  await banner.waitFor({ timeout: 45000 }).catch(() => console.log('pas de bandeau (rafraîchissement manuel)'));
  ce.mark('bandeau'); await hold(E, 1400);
  const submit = E.locator('footer button.button');
  for (let i = 0; i < 70 && !(await submit.isEnabled()); i++) await E.waitForTimeout(500);
  if (!(await submit.isEnabled())) { await reload(E); }
  await scrollToEl(E, 'footer button.button', 500, 700);
  ce.mark('soumettre'); await click(E, 'footer button.button', { after: 900 });
  await hold(E, 2200);
});

// 6. Split : gestionnaire démarre, affecte, planifie | évaluateur voit le dossier arriver
const V1 = await newPage(pane); await login(V1, 'eval.sow'); await goto(V1, '/admin/dossiers');
await duo('split-affectation', G, V1, async (cg, cv) => {
  await hold(G, 600);
  await reload(G); await hold(G, 500);
  await scrollToEl(G, 'button:has-text("Démarrer")', 400, 700);
  cg.mark('demarrer'); await click(G, 'button:has-text("Démarrer l’évaluation")', { after: 1000 });
  await scrollToEl(G, '.action-grid', 160, 700);
  cg.mark('affecter'); await sel(G, '.action-grid select >> nth=0', 'eval.sow'); await click(G, 'button:has-text("Affecter")', { after: 900 });
  cv.mark('actualiser'); await click(V1, 'button:has-text("Actualiser")', { after: 1200 }); await hold(V1, 900);
  cg.mark('planifier'); await sel(G, '.action-grid select >> nth=1', 'audit.diop');
  await click(G, 'input[type=datetime-local]', { after: 200 }); await G.fill('input[type=datetime-local]', `${inDays(7)}T09:30`); await hold(G, 500);
  await click(G, 'button:has-text("Planifier")', { after: 1000 });
  await scrollToEl(G, '.audit-block', 300, 600); await hold(G, 1800);
});

// 7. Auditeur : compte rendu d'audit
{
  const p = await newPage(); await login(p, 'audit.diop');
  await shot('auditeur', p, async c => {
    await hold(p, 1500);
    await click(p, '.dashboard-list a', { after: 1000 });
    await scrollToEl(p, '.audit-block', 300, 800);
    await type(p, 'textarea[placeholder^="Constats"]', 'Visite du dépôt de Dakar : bacs de rétention conformes, plan de prévention à compléter.', 16);
    c.mark('compte-rendu'); await click(p, 'button:has-text("Enregistrer le compte rendu")', { after: 1000 }); await hold(p, 2000);
  });
  await p.context().close();
}

// 8. Split : évaluateur crée la non-conformité (gravité, échéance) | entreprise voit « Corrections demandées »
await goto(V1, `/admin/dossiers/${appId}`);
await goto(E, '/espace/tableau-de-bord');
await duo('split-nc', V1, E, async (cv, ce) => {
  await hold(V1, 700);
  await scrollToEl(V1, '.correction', 160, 900);
  await sel(V1, '.correction select >> nth=0', 'Sécurité');
  await sel(V1, '.correction select >> nth=1', 'Majeure');
  await click(V1, '.correction input[type=date]', { after: 200 }); await V1.fill('.correction input[type=date]', inDays(30)); await hold(V1, 500);
  await type(V1, '.correction textarea', 'Le plan de prévention ne couvre pas le poste de chargement des camions-citernes.', 14);
  cv.mark('creer'); await click(V1, 'button:has-text("Créer la non-conformité")', { after: 900 });
  await scrollTo(V1, 0, 700); await hold(V1, 600);
  ce.mark('reload'); await reload(E); await hold(E, 900);
  await moveTo(E, 'a:has-text("Répondre")'); await hold(E, 2000);
});

// 9. Split : entreprise répond | évaluateur clôture et transmet en décision
await duo('split-reponse', E, V1, async (ce, cv) => {
  await hold(E, 500);
  await click(E, 'a:has-text("Répondre")', { after: 1000 });
  await hold(E, 700);
  await type(E, '.correction textarea', 'Analyse des risques du poste de chargement ajoutée au plan de prévention (version 2).', 12);
  ce.mark('transmettre'); await click(E, 'button:has-text("Transmettre la correction")', { after: 1000 }); await hold(E, 600);
  cv.mark('reload'); await reload(V1); await hold(V1, 400);
  await scrollToEl(V1, '.nc-row', 250, 700);
  cv.mark('cloturer'); await click(V1, 'button:has-text("Clôturer")', { after: 1000 });
  await scrollToEl(V1, 'button:has-text("Transmettre en décision")', 500, 800);
  cv.mark('decision'); await click(V1, 'button:has-text("Transmettre en décision")', { after: 1000 });
  await scrollTo(V1, 0, 700); await hold(V1, 1500);
});
await G.context().close(); await V1.context().close();

// 10. Décideur : volets accordés, niveau calculé, certificat
let certNumber = '';
{
  const p = await newPage(); await login(p, 'decid.ba');
  await shot('decideur', p, async c => {
    await hold(p, 1200);
    await click(p, '.dashboard-list a', { after: 1000 });
    await scrollToEl(p, 'h2:has-text("Décision")', 200, 800);
    await hold(p, 800);
    c.mark('decocher'); await click(p, 'label.chip:has-text("Qualité")', { after: 900 }); await moveTo(p, 'p:has-text("Niveau accordé")'); await hold(p, 1700);
    c.mark('recocher'); await click(p, 'label.chip:has-text("Qualité")', { after: 900 }); await hold(p, 1500);
    await type(p, 'textarea[placeholder^="Synthèse"]', 'Dossier conforme sur les volets Sécurité et Qualité.', 18);
    c.mark('emettre'); await click(p, 'button:has-text("Émettre le certificat")', { after: 1100 });
    await scrollTo(p, 0, 700); await moveTo(p, '.certificate'); c.mark('numero'); await hold(p, 2600);
    certNumber = ((await p.locator('.certificate strong').first().innerText()).match(/CERT-INPG-[0-9A-F]+/) || [''])[0];
    c.mark('registre'); await click(p, '.portal-sidebar nav a:has-text("Certificats")', { after: 1200 }); await moveTo(p, 'tbody tr'); await hold(p, 2200);
  });
  await p.context().close();
}
console.log('CERT', certNumber); fs.writeFileSync(`${V}/cert.txt`, certNumber);

// 11. Visiteur : vérification publique du certificat
{
  const p = await newPage(); await goto(p, '/verification-certificat');
  await shot('verification', p, async c => {
    await hold(p, 1200);
    await type(p, 'input[name=numero]', certNumber, 30);
    c.mark('verifier'); await click(p, 'button:has-text("Vérifier")', { after: 1200 });
    await moveTo(p, '.result'); await hold(p, 3200);
  });
  await p.context().close();
}

// 12. Entreprise : suivi du dossier certifié, certifications, fiche et invitations
await E.context().close();
const E2 = await newPage(); await login(E2, 'spd.diallo');
await shot('ent-certifie', E2, async c => {
  await hold(E2, 1600); await moveTo(E2, '.overview article:nth-child(2)'); await hold(E2, 1200);
  c.mark('suivre'); await click(E2, 'a:has-text("Suivre")', { after: 1100 });
  await scrollTo(E2, 350, 1600); await hold(E2, 1800); await scrollTo(E2, 0, 700);
  c.mark('certifications'); await click(E2, '.portal-sidebar nav a:has-text("Mes certifications")', { after: 1200 }); await moveTo(E2, '.cards article'); await hold(E2, 2400);
  c.mark('entreprise'); await click(E2, '.portal-sidebar nav a:has-text("Mon entreprise")', { after: 1200 }); await hold(E2, 1400);
  await type(E2, 'input[name=email]', 'k.sow@spd.sn', 24);
  c.mark('inviter'); await click(E2, 'button:has-text("Envoyer l’invitation")', { after: 1000 }); await hold(E2, 2200);
});

// 13. Entreprise : accès refusé à l'administration
await shot('acces-refuse', E2, async () => { await hold(E2, 700); await goto(E2, '/admin/dashboard'); await hold(E2, 3200); });
await E2.context().close();

// 14. Administrateur : tableau de bord, registre (suspendre / réactiver), référentiels
{
  const p = await newPage(); await login(p, 'admin.ndiaye');
  await shot('admin', p, async c => {
    await hold(p, 1800);
    c.mark('certificats'); await click(p, '.portal-sidebar nav a:has-text("Certificats")', { after: 1200 }); await hold(p, 900);
    c.mark('suspendre'); await click(p, 'button:has-text("Suspendre")', { after: 1300 }); await hold(p, 1200);
    c.mark('reactiver'); await click(p, 'button:has-text("Réactiver")', { after: 1300 }); await hold(p, 1200);
    c.mark('referentiels'); await click(p, '.portal-sidebar nav a:has-text("Référentiels")', { after: 1200 }); await hold(p, 1500);
    await scrollTo(p, 500, 2200); await hold(p, 1600);
  });
  await p.context().close();
}

// 15. Menus par rôle (captures fixes de la barre latérale)
fs.mkdirSync(`${SHOTS}/menus`, { recursive: true });
for (const u of ['spd.diallo', 'gest.fall', 'eval.sow', 'audit.diop', 'decid.ba', 'admin.ndiaye']) {
  const p = await newPage(); await login(p, u); await p.mouse.move(-10, -10);
  await p.evaluate(() => document.getElementById('demo-cursor')?.remove());
  await p.screenshot({ path: `${SHOTS}/menus/${u}.png`, clip: { x: 0, y: 0, width: 248, height: 576 } }); await p.context().close();
}
await browser.close();
console.log('DONE');
