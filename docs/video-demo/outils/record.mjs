import fs from 'node:fs';
import { browser, newPage, login, Capture, click, type, moveTo, hold, scrollTo, scrollToEl, goto, reload, SHOTS } from './rec-lib.mjs';

const only = process.argv.slice(2);
const PDF = '/tmp/claude-0/pdfs';
const PW = process.env.DEMO_PASSWORD;
const pane = { width: 960, height: 1020, scale: 1 };
const sel = async (p, selector, label) => { await moveTo(p, selector); await hold(p, 250); await p.locator(selector).first().selectOption({ label }); await hold(p, 350); };

async function shot(name, page, fn) {
  const c = new Capture(page, name); await c.start(); await fn(c); await c.stop();
}
async function duo(name, left, right, fn) {
  const a = new Capture(left, name + '-L'), b = new Capture(right, name + '-R');
  await a.start(); await b.start(); await fn(a, b); await a.stop(); await b.stop();
}

// 1. Portail public + inscription entreprise
{
  const p = await newPage();
  await goto(p, '/');
  await shot('public', p, async c => {
    await hold(p, 1500);
    await scrollTo(p, 700, 1800); await hold(p, 900); await scrollTo(p, 0, 900);
    c.mark('label'); await click(p, 'header a:has-text("Le Label INPG")', { after: 900 }); await hold(p, 1200);
    c.mark('demarche'); await click(p, 'header a:has-text("Démarche")', { after: 900 }); await hold(p, 1000);
    c.mark('formations'); await click(p, 'header a:has-text("Formations")', { after: 900 }); await hold(p, 900);
    c.mark('inscription'); await click(p, 'header a:has-text("Inscription")', { after: 800 });
    await click(p, 'label.choice:has-text("Entreprise")');
    await type(p, 'input[name=first_name]', 'Aminata', 22); await type(p, 'input[name=last_name]', 'Diallo', 22);
    await type(p, 'input[name=email]', 'a.diallo@spd.sn', 18); await type(p, 'input[name=username]', 'spd.diallo', 18);
    await type(p, 'input[name=legal_name]', 'Sénégal Pétrole Distribution', 14); await type(p, 'input[name=ninea]', '009876543', 18);
    await type(p, 'input[name=password]', PW, 12); await type(p, 'input[name=confirm]', PW, 12);
    c.mark('submit'); await click(p, 'button:has-text("Créer mon compte")', { after: 900 });
    await scrollTo(p, 0, 600); await hold(p, 1800);
  });
  await p.context().close();
}

// 2. Superadministrateur : création des comptes internes
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
    await hold(p, 1500);
  });
  await p.context().close();
  const a = await newPage(); await login(a, 'admin.ndiaye'); await goto(a, '/admin/utilisateurs');
  await shot('users-admin', a, async () => { await hold(a, 800); await moveTo(a, 'h3:has-text("Création réservée")'); await hold(a, 3500); });
  await a.context().close();
}

// 3. Connexion d'un acteur interne
{
  const p = await newPage(); await goto(p, '/connexion');
  await shot('login', p, async () => {
    await hold(p, 800);
    await type(p, 'input[name=username]', 'gest.fall', 70); await type(p, 'input[name=password]', PW, 40);
    await click(p, 'button:has-text("Se connecter")', { after: 1200 }); await hold(p, 1800);
  });
  await p.context().close();
}

// 4. Entreprise : nouvelle demande + dépôt des pièces
const ent = await newPage(); await login(ent, 'spd.diallo');
await shot('ent-demande', ent, async c => {
  await hold(ent, 1500);
  c.mark('nouvelle'); await click(ent, '.dashboard-head a:has-text("Nouvelle demande")', { after: 900 });
  await type(ent, 'input[name=scope]', 'Dépôt de Dakar et activités de distribution', 22);
  await scrollToEl(ent, '.domain-options', 200, 800);
  c.mark('volets'); await click(ent, '.domain-options label:has-text("Sécurité")', { after: 600 });
  await click(ent, '.domain-options label:has-text("Qualité")', { after: 900 });
  await moveTo(ent, '.level-summary'); c.mark('gold'); await hold(ent, 1800);
  await type(ent, 'textarea[name=description]', 'Distribution de produits pétroliers dans la région de Dakar.', 14);
  c.mark('creer'); await click(ent, 'button:has-text("Créer le brouillon")', { after: 1200 });
  c.mark('checklist'); await hold(ent, 1500);
  const files = ['Politique_HSE', 'Plan_prevention', 'Audit_interne', 'Politique_qualite', 'Procedure_controle', 'Registre_NC'];
  for (let i = 0; i < 6; i++) {
    const lab = ent.locator('label.upload').nth(i);
    await lab.scrollIntoViewIfNeeded(); await moveTo(ent, lab); await hold(ent, 200);
    await ent.mouse.down(); await ent.mouse.up();
    await lab.locator('input[type=file]').setInputFiles(`${PDF}/${files[i]}.pdf`);
    await hold(ent, 700);
  }
  c.mark('soumettre'); await click(ent, 'button:has-text("Soumettre le dossier")', { after: 900 });
  await scrollToEl(ent, '.notice', 500, 600); await hold(ent, 2200);
});
const appId = ent.url().match(/dossiers\/(\d+)/)[1]; console.log('APP', appId);
await ent.context().close();

// 5. Split : gestionnaire valide | entreprise soumet
const G = await newPage(pane); await login(G, 'gest.fall'); await goto(G, '/admin/dossiers');
const E = await newPage(pane); await login(E, 'spd.diallo'); await goto(E, `/espace/dossiers/${appId}/documents`);
await duo('split-validation', G, E, async (cg, ce) => {
  await hold(G, 800);
  await click(G, 'a:has-text("Ouvrir")', { after: 1000 });
  cg.mark('valider');
  while (await G.locator('button:has-text("Valider")').count()) await click(G, G.locator('button:has-text("Valider")').first(), { pause: 120, after: 450 });
  await hold(G, 600);
  ce.mark('reload'); await reload(E); await hold(E, 900);
  await scrollTo(E, 2000, 900);
  ce.mark('soumettre'); await click(E, 'button:has-text("Soumettre le dossier")', { after: 900 });
  await hold(E, 2200);
});

// 6. Split : gestionnaire démarre, affecte, planifie | évaluateur voit le dossier arriver
const V = await newPage(pane); await login(V, 'eval.sow'); await goto(V, '/admin/dossiers');
await duo('split-affectation', G, V, async (cg, cv) => {
  await hold(G, 600);
  await reload(G); await hold(G, 500);
  await scrollToEl(G, 'button:has-text("Démarrer")', 400, 700);
  cg.mark('demarrer'); await click(G, 'button:has-text("Démarrer l’évaluation")', { after: 1000 });
  await scrollToEl(G, '.action-grid', 160, 700);
  cg.mark('affecter'); await sel(G, '.action-grid select >> nth=0', 'eval.sow · EVALUATOR'); await click(G, 'button:has-text("Affecter")', { after: 900 });
  cv.mark('actualiser'); await click(V, 'button:has-text("Actualiser")', { after: 1200 }); await hold(V, 900);
  cg.mark('planifier'); await sel(G, '.action-grid select >> nth=1', 'audit.diop'); await click(G, 'button:has-text("Planifier")', { after: 1000 });
  await scrollToEl(G, '.audit-list', 300, 600); await hold(G, 1600);
});

// 6b. Le gestionnaire tente de créer une non-conformité (refusé par l'API)
{
  const p = await newPage(); await login(p, 'gest.fall'); await goto(p, `/admin/dossiers/${appId}`);
  await scrollToEl(p, '.correction', 200, 0);
  await shot('refus-gestionnaire', p, async () => {
    await hold(p, 600);
    await type(p, '.correction textarea', 'Écart constaté sur le registre.', 25);
    await click(p, 'button:has-text("Créer la non-conformité")', { after: 900 });
    await scrollToEl(p, '.notice.error', 450, 700); await moveTo(p, '.notice.error'); await hold(p, 2600);
  });
  await p.context().close();
}

// 7. Auditeur : audit réalisé
{
  const p = await newPage(); await login(p, 'audit.diop');
  await shot('auditeur', p, async () => {
    await hold(p, 1200);
    await click(p, '.dashboard-list a', { after: 1000 });
    await scrollToEl(p, '.audit-list', 300, 800);
    await click(p, 'button:has-text("Marquer réalisé")', { after: 900 }); await hold(p, 1800);
  });
  await p.context().close();
}

// 8. Split : évaluateur crée la non-conformité | entreprise voit "Corrections demandées"
await goto(V, `/admin/dossiers/${appId}`);
await goto(E, '/espace/tableau-de-bord');
await duo('split-nc', V, E, async (cv, ce) => {
  await hold(V, 700);
  await scrollToEl(V, '.correction', 160, 900);
  await sel(V, '.correction select', 'Sécurité');
  await type(V, '.correction textarea', 'Le plan de prévention ne couvre pas le poste de chargement des camions-citernes.', 14);
  cv.mark('creer'); await click(V, 'button:has-text("Créer la non-conformité")', { after: 900 });
  await scrollTo(V, 0, 700); await hold(V, 600);
  ce.mark('reload'); await reload(E); await hold(E, 900);
  await moveTo(E, 'a:has-text("Répondre")'); await hold(E, 2000);
});

// 9. Split : entreprise répond | évaluateur clôture et transmet en décision
await duo('split-reponse', E, V, async (ce, cv) => {
  await hold(E, 500);
  await click(E, 'a:has-text("Répondre")', { after: 1000 });
  await type(E, '.correction textarea', 'Analyse des risques du poste de chargement ajoutée au plan de prévention (version 2).', 12);
  ce.mark('transmettre'); await click(E, 'button:has-text("Transmettre la correction")', { after: 1000 }); await hold(E, 600);
  cv.mark('reload'); await reload(V); await hold(V, 400);
  await scrollToEl(V, '.nc-row', 250, 700);
  cv.mark('cloturer'); await click(V, 'button:has-text("Clôturer")', { after: 1000 });
  await scrollToEl(V, 'button:has-text("Transmettre en décision")', 500, 800);
  cv.mark('decision'); await click(V, 'button:has-text("Transmettre en décision")', { after: 1000 });
  await scrollTo(V, 0, 700); await hold(V, 1500);
});
await G.context().close(); await V.context().close();

// 10. Décideur : émission du certificat
{
  const p = await newPage(); await login(p, 'decid.ba');
  await shot('decideur', p, async c => {
    await hold(p, 900);
    await click(p, '.dashboard-list a', { after: 1000 });
    await scrollToEl(p, 'h2:has-text("Décision et Label")', 200, 800);
    await moveTo(p, 'label:has-text("Label INPG") select'); await hold(p, 700);
    await type(p, 'textarea', 'Dossier conforme sur les volets Sécurité et Qualité.', 18);
    c.mark('emettre'); await click(p, 'button:has-text("Émettre le certificat")', { after: 1000 });
    await scrollTo(p, 0, 700); await moveTo(p, '.certificate'); c.mark('numero'); await hold(p, 2200);
    c.mark('registre'); await click(p, 'nav a:has-text("Certificats")', { after: 1200 }); await moveTo(p, 'tbody tr'); await hold(p, 2200);
  });
  await p.context().close();
}

// 11. Entreprise : accès refusé à l'administration
await shot('acces-refuse', E, async () => {
  await hold(E, 900); await goto(E, '/admin/dashboard'); await hold(E, 2800);
});

// 12. Entreprise : dossier certifié et suivi
await E.context().close();
{
  const p = await newPage(); await login(p, 'spd.diallo');
  await shot('ent-certifie', p, async c => {
    await hold(p, 1500); await moveTo(p, '.overview article:nth-child(2)'); await hold(p, 1200);
    c.mark('suivre'); await click(p, 'a:has-text("Suivre")', { after: 1100 });
    await scrollTo(p, 350, 1600); await hold(p, 1800);
  });
  await p.context().close();
}

// 13. Superadministrateur : historique + registre (suspendre / réactiver)
{
  const p = await newPage(); await login(p, 'superadmin'); await goto(p, `/admin/dossiers/${appId}`);
  await shot('historique', p, async () => {
    await hold(p, 900); await moveTo(p, 'h2:has-text("Historique")'); await hold(p, 500);
    await scrollTo(p, 900, 3500); await hold(p, 900); await scrollTo(p, 1800, 3000); await hold(p, 900);
  });
  await goto(p, '/admin/certificats');
  await shot('registre', p, async c => {
    await hold(p, 1000);
    c.mark('suspendre'); await click(p, 'button:has-text("Suspendre")', { after: 1200 }); await hold(p, 1200);
    c.mark('reactiver'); await click(p, 'button:has-text("Réactiver")', { after: 1200 }); await hold(p, 1500);
  });
  await goto(p, '/admin/referentiels');
  await shot('referentiels', p, async () => { await hold(p, 2500); });
  await p.context().close();
}

// 14. Pages publiques non raccordées
{
  const p = await newPage(); await goto(p, '/verification-certificat');
  await shot('verification', p, async () => { await hold(p, 800); await scrollToEl(p, 'h2', 200, 700); await hold(p, 2000); });
  await p.context().close();
}

// 15. Menus par rôle (captures fixes)
fs.mkdirSync(`${SHOTS}/menus`, { recursive: true });
for (const u of ['spd.diallo', 'gest.fall', 'eval.sow', 'audit.diop', 'decid.ba', 'superadmin']) {
  const p = await newPage(); await login(p, u); await p.mouse.move(-10, -10);
  await p.evaluate(() => document.getElementById('demo-cursor')?.remove());
  await p.screenshot({ path: `${SHOTS}/menus/${u}.png` }); await p.context().close();
}
await browser.close();
console.log('DONE');
