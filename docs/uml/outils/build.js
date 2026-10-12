// Plateforme Label INPG — modèle UML StarUML généré à partir du code (backend/platform_api, frontend/src/app).
const { T, el, view, edge, layout, project, save } = require('./lib');

const proj = project('Plateforme Label INPG');
const model = el('UMLModel', proj, { name: 'Label INPG' });
const pkgDomain = el('UMLPackage', model, { name: 'Domaine (platform_api.models)' });
const diagrams = [];

// ------------------------------------------------------------------ helpers
const attr = (c, name, type, extra = {}) => el('UMLAttribute', c, { name, type, ...extra }, 'attributes');
const op = (c, name, params = [], ret = null) => {
  const o = el('UMLOperation', c, { name }, 'operations');
  for (const [n, t] of params) el('UMLParameter', o, { name: n, type: t, direction: 'in' }, 'parameters');
  if (ret) el('UMLParameter', o, { name: '', type: ret, direction: 'return' }, 'parameters');
  return o;
};
const enumeration = (parent, name, lits) => {
  const e = el('UMLEnumeration', parent, { name });
  for (const l of lits) el('UMLEnumerationLiteral', e, { name: l }, 'literals');
  return e;
};
const assoc = (parent, a, b, m1, m2, opts = {}) => {
  const s = el('UMLAssociation', parent, { name: opts.name || '' });
  s.end1 = new T.UMLAssociationEnd(); Object.assign(s.end1, { _id: require('./lib').ID(), _parent: s, reference: a, multiplicity: m1, name: opts.role1 || '', aggregation: opts.agg1 || 'none', navigable: true });
  s.end2 = new T.UMLAssociationEnd(); Object.assign(s.end2, { _id: require('./lib').ID(), _parent: s, reference: b, multiplicity: m2, name: opts.role2 || '', aggregation: 'none', navigable: true });
  return s;
};
const dep = (parent, a, b, name = '', stereo = null) => {
  const d = el('UMLDependency', parent, { name, source: a, target: b }, 'ownedElements');
  if (stereo) d.stereotype = stereo;
  return d;
};

// ================================================================== 1. CLASSES
{
  const P = pkgDomain;
  const Role = enumeration(P, 'Role', ['ENTERPRISE', 'PROFESSIONAL', 'MANAGER', 'EVALUATOR', 'AUDITOR', 'DECISION_MAKER', 'ADMIN']);
  const AppStatus = enumeration(P, 'ApplicationStatus', ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'DECISION_PENDING', 'CERTIFIED', 'REJECTED']);
  const DocStatus = enumeration(P, 'DocumentStatus', ['MISSING', 'SUBMITTED', 'VALIDATED', 'REJECTED']);
  const AuditStatus = enumeration(P, 'AuditStatus', ['SCHEDULED', 'COMPLETED']);
  const NCStatus = enumeration(P, 'NonConformityStatus', ['OPEN', 'CORRECTED', 'VALIDATED']);
  const CertStatus = enumeration(P, 'CertificateStatus', ['VALID', 'SUSPENDED', 'REVOKED']);

  const User = el('UMLClass', P, { name: 'User', documentation: 'Utilisateur Django (django.contrib.auth). Un superutilisateur reçoit le rôle ADMIN.' });
  attr(User, 'username', 'String'); attr(User, 'email', 'String'); attr(User, 'is_active', 'Boolean'); attr(User, 'is_superuser', 'Boolean');

  const Profile = el('UMLClass', P, { name: 'AccessProfile', documentation: 'Rôle métier d\'un compte ; une entreprise est rattachée à son organisation.' });
  attr(Profile, 'role', Role);
  op(Profile, 'capabilities', [], 'String[*]');

  const Org = el('UMLClass', P, { name: 'Organization' });
  attr(Org, 'legal_name', 'String'); attr(Org, 'ninea', 'String', { isUnique: true }); attr(Org, 'activity', 'String'); attr(Org, 'address', 'String');

  const App = el('UMLClass', P, { name: 'Application', documentation: 'Dossier de demande de certification au Label INPG.' });
  attr(App, 'reference', 'String'); attr(App, 'level', 'String'); attr(App, 'status', AppStatus, { defaultValue: 'DRAFT' });
  attr(App, 'domains', 'String[*]'); attr(App, 'scope', 'String'); attr(App, 'description', 'Text'); attr(App, 'created_at', 'DateTime');
  op(App, 'submit'); op(App, 'assign', [['user_id', 'Integer']]); op(App, 'startReview');
  op(App, 'scheduleAudit', [['auditor_id', 'Integer'], ['scheduled_for', 'DateTime']]);
  op(App, 'completeAudit', [['audit_id', 'Integer'], ['summary', 'String']]);
  op(App, 'requestCorrection', [['domain', 'String'], ['description', 'String'], ['severity', 'String']]);
  op(App, 'respondCorrection', [['non_conformity_id', 'Integer'], ['response', 'String']]);
  op(App, 'validateCorrection', [['non_conformity_id', 'Integer']]);
  op(App, 'completeEvaluation'); op(App, 'decide', [['decision', 'String'], ['level', 'String'], ['note', 'String']]);

  const Assign = el('UMLClass', P, { name: 'ApplicationAssignment', documentation: 'Affectation d\'un évaluateur ou d\'un auditeur à un dossier (unique par couple).' });

  const Doc = el('UMLClass', P, { name: 'RequiredDocument' });
  attr(Doc, 'domain', 'String'); attr(Doc, 'name', 'String'); attr(Doc, 'mandatory', 'Boolean'); attr(Doc, 'status', DocStatus);
  attr(Doc, 'file', 'File'); attr(Doc, 'review_comment', 'Text'); attr(Doc, 'submitted_at', 'DateTime'); attr(Doc, 'reviewed_at', 'DateTime');
  op(Doc, 'upload', [['file', 'File']]); op(Doc, 'review', [['status', 'DocumentStatus'], ['comment', 'String']]);

  const Event = el('UMLClass', P, { name: 'WorkflowEvent', documentation: 'Journal : chaque transition est historisée avec son acteur.' });
  attr(Event, 'event_type', 'String'); attr(Event, 'note', 'Text'); attr(Event, 'created_at', 'DateTime');

  const Audit = el('UMLClass', P, { name: 'Audit' });
  attr(Audit, 'scheduled_for', 'DateTime'); attr(Audit, 'performed_at', 'DateTime'); attr(Audit, 'status', AuditStatus); attr(Audit, 'summary', 'Text');

  const NC = el('UMLClass', P, { name: 'NonConformity' });
  attr(NC, 'reference', 'String'); attr(NC, 'domain', 'String'); attr(NC, 'description', 'Text'); attr(NC, 'severity', 'String', { defaultValue: 'MAJEURE' });
  attr(NC, 'status', NCStatus); attr(NC, 'response', 'Text'); attr(NC, 'created_at', 'DateTime');

  const Cert = el('UMLClass', P, { name: 'Certificate' });
  attr(Cert, 'number', 'String'); attr(Cert, 'issued_at', 'DateTime'); attr(Cert, 'status', CertStatus);
  op(Cert, 'updateStatus', [['status', 'CertificateStatus']]);

  const a1 = assoc(P, User, Profile, '1', '0..1', { agg1: 'composite', role2: 'access_profile' });
  const a2 = assoc(P, Profile, Org, '*', '0..1', { role2: 'organization' });
  const a3 = assoc(P, Org, App, '1', '*', { role2: 'applications', nav1: 'navigable' });
  const a4 = assoc(P, App, Doc, '1', '*', { agg1: 'composite', role2: 'documents' });
  const a5 = assoc(P, App, Event, '1', '*', { agg1: 'composite', role2: 'events' });
  const a6 = assoc(P, App, Audit, '1', '*', { agg1: 'composite', role2: 'audits' });
  const a7 = assoc(P, App, NC, '1', '*', { agg1: 'composite', role2: 'non_conformities' });
  const a8 = assoc(P, App, Cert, '1', '0..1', { role2: 'certificate' });
  const a9 = assoc(P, App, Assign, '1', '*', { agg1: 'composite', role2: 'assignments' });
  const a10 = assoc(P, Assign, User, '*', '1', { role2: 'user' });
  const a11 = assoc(P, Event, User, '*', '0..1', { role2: 'actor' });
  const a12 = assoc(P, Audit, User, '*', '1', { role2: 'auditor' });

  const d = el('UMLClassDiagram', model, { name: '1. Diagramme de classes — domaine' });
  diagrams.push(d);
  const V = {};
  const place = (k, c, x, y, w) => (V[k] = view('UMLClassView', d, c, { left: x, top: y, width: w || 210, height: 60 }));
  place('User', User, 40, 40, 190);
  place('Profile', Profile, 330, 40, 220);
  place('Org', Org, 660, 40, 200);
  place('Assign', Assign, 40, 330, 190);
  place('App', App, 330, 250, 440);
  place('Cert', Cert, 870, 330, 230);
  place('Event', Event, 40, 650, 190);
  place('Doc', Doc, 270, 650, 300);
  place('Audit', Audit, 640, 650, 210);
  place('NC', NC, 900, 650, 210);
  const ev = (k, Type) => view(Type === T.UMLEnumeration ? 'UMLEnumerationView' : 'UMLEnumerationView', d, k, {});
  const E = [[Role, 1180, 40], [AppStatus, 1180, 250], [DocStatus, 1180, 450], [CertStatus, 1180, 600], [AuditStatus, 1380, 600], [NCStatus, 1380, 450]];
  for (const [e, x, y] of E) { const v = view('UMLEnumerationView', d, e, { left: x, top: y, width: 180, height: 60 }); }
  const A = (s, t, h, via) => edge('UMLAssociationView', d, s, V[t], V[h], {}, via);
  A(a1, 'User', 'Profile'); A(a2, 'Profile', 'Org'); A(a3, 'Org', 'App', [[760, 200], [700, 200]]);
  A(a4, 'App', 'Doc'); A(a5, 'App', 'Event'); A(a6, 'App', 'Audit'); A(a7, 'App', 'NC'); A(a8, 'App', 'Cert');
  A(a9, 'App', 'Assign'); A(a10, 'Assign', 'User'); A(a11, 'Event', 'User', [[20, 680], [20, 90]]); A(a12, 'Audit', 'User', [[745, 980], [10, 980], [10, 70]]);
}


// ================================================================== ACTEURS & CAS D'UTILISATION
const pkgUC = el('UMLPackage', model, { name: 'Cas d\'utilisation' });
const actor = (name, doc = '') => el('UMLActor', pkgUC, { name, documentation: doc });
const Visiteur = actor('Visiteur', 'Internaute non connecté.');
const Utilisateur = actor('Utilisateur authentifié', 'Tout compte connecté (session Django, cookie HttpOnly, CSRF).');
const Entreprise = actor('Entreprise', 'Rôle ENTERPRISE, rattaché à son organisation.');
const Professionnel = actor('Professionnel', 'Rôle PROFESSIONAL : aucun droit sur les dossiers.');
const Gestionnaire = actor('Gestionnaire', 'Rôle MANAGER.');
const Evaluateur = actor('Évaluateur', 'Rôle EVALUATOR : dossiers affectés uniquement.');
const Auditeur = actor('Auditeur', 'Rôle AUDITOR : dossiers affectés uniquement.');
const Decideur = actor('Décideur', 'Rôle DECISION_MAKER.');
const Admin = actor('Administrateur', 'Rôle ADMIN : toutes les capacités métier.');
const SuperAdmin = actor('Superadministrateur', 'Superutilisateur Django : crée les comptes internes, gère les certificats.');
Utilisateur.isAbstract = true;

const gen = (child, parent) => el('UMLGeneralization', child, { source: child, target: parent });
const uc = (subject, name) => { const u = el('UMLUseCase', pkgUC, { name }); u.subjects = [subject]; return u; };
const link = (a, u) => { const s = assoc(pkgUC, a, u, '', '', { nav1: 'unspecified', nav2: 'unspecified' }); return s; };
const include = (base, inc) => el('UMLInclude', base, { source: base, target: inc });
const extend = (ext, base, cond) => el('UMLExtend', ext, { source: ext, target: base, condition: cond || '' });
const note = (d, text, x, y, w, h) => view('UMLNoteView', d, null, { left: x, top: y, width: w, height: h }, { text });

// --- 2. Portail public et espace entreprise
{
  const S = el('UMLUseCaseSubject', pkgUC, { name: 'Plateforme Label INPG — portail et espace entreprise' });
  const u = {
    portail: uc(S, 'Consulter le portail public'), inscr: uc(S, 'S\'inscrire (Entreprise ou Professionnel)'),
    login: uc(S, 'Se connecter / se déconnecter'), pro: uc(S, 'Accéder à l\'espace professionnel'),
    creer: uc(S, 'Créer une demande de certification'), check: uc(S, 'Générer la checklist officielle des pièces'),
    deposer: uc(S, 'Déposer les pièces justificatives'), soumettre: uc(S, 'Soumettre le dossier'),
    repondre: uc(S, 'Répondre à une non-conformité'), suivre: uc(S, 'Suivre l\'avancement du dossier'),
  };
  const r = [link(Visiteur, u.portail), link(Visiteur, u.inscr), link(Utilisateur, u.login), link(Professionnel, u.pro),
    link(Entreprise, u.creer), link(Entreprise, u.deposer), link(Entreprise, u.soumettre), link(Entreprise, u.repondre), link(Entreprise, u.suivre)];
  const i1 = include(u.creer, u.check);
  const g1 = gen(Entreprise, Utilisateur), g2 = gen(Professionnel, Utilisateur);

  const d = el('UMLUseCaseDiagram', model, { name: '2. Cas d\'utilisation — portail et espace entreprise' }); diagrams.push(d);
  const sv = view('UMLUseCaseSubjectView', d, S, { left: 280, top: 30, width: 780, height: 820 });
  const A = {}, U = {};
  A.vis = view('UMLActorView', d, Visiteur, { left: 120, top: 80, width: 40, height: 80 });
  A.usr = view('UMLActorView', d, Utilisateur, { left: 150, top: 230, width: 40, height: 80 });
  A.pro = view('UMLActorView', d, Professionnel, { left: 40, top: 330, width: 40, height: 80 });
  A.ent = view('UMLActorView', d, Entreprise, { left: 150, top: 580, width: 40, height: 80 });
  const pos = { portail: [330, 70], inscr: [330, 150], login: [330, 240], pro: [330, 330], creer: [330, 430], check: [720, 430], deposer: [330, 520], soumettre: [330, 600], repondre: [330, 680], suivre: [330, 760] };
  for (const [k, [x, y]] of Object.entries(pos)) U[k] = view('UMLUseCaseView', d, u[k], { left: x, top: y, width: k === 'check' ? 200 : 210, height: 50 });
  const L = [['vis', 'portail'], ['vis', 'inscr'], ['usr', 'login'], ['pro', 'pro'], ['ent', 'creer'], ['ent', 'deposer'], ['ent', 'soumettre'], ['ent', 'repondre'], ['ent', 'suivre']];
  L.forEach(([a, k], i) => edge('UMLAssociationView', d, r[i], A[a], U[k]));
  edge('UMLIncludeView', d, i1, U.creer, U.check);
  edge('UMLGeneralizationView', d, g1, A.ent, A.usr);
  edge('UMLGeneralizationView', d, g2, A.pro, A.usr);
  note(d, 'Les cas de l\'espace entreprise exigent une\nsession active et un compte ENTREPRISE\nrattaché à une organisation (sinon : 403).', 1100, 520, 270, 70);
  note(d, 'La soumission est refusée tant que\nles pièces obligatoires ne sont pas\nvalidées par l\'INPG.', 1100, 610, 270, 60);
}

// --- 3. Back-office INPG
{
  const S = el('UMLUseCaseSubject', pkgUC, { name: 'Plateforme Label INPG — back-office' });
  const u = {
    tous: uc(S, 'Consulter tous les dossiers'), valider: uc(S, 'Valider ou refuser une pièce'),
    demarrer: uc(S, 'Démarrer l\'évaluation'), affecter: uc(S, 'Affecter un évaluateur ou un auditeur'),
    planifier: uc(S, 'Planifier un audit'), affectes: uc(S, 'Consulter les dossiers affectés'),
    corriger: uc(S, 'Demander une correction (non-conformité)'), cloturer: uc(S, 'Clôturer une correction'),
    transmettre: uc(S, 'Transmettre en décision'), audit: uc(S, 'Réaliser l\'audit'),
    decider: uc(S, 'Rendre la décision de certification'), emettre: uc(S, 'Émettre le certificat'),
    registre: uc(S, 'Consulter le registre des certificats'), comptes: uc(S, 'Créer un compte interne'),
    suspendre: uc(S, 'Suspendre ou réactiver un certificat'),
  };
  const L = [[Gestionnaire, 'tous'], [Gestionnaire, 'valider'], [Gestionnaire, 'demarrer'], [Gestionnaire, 'affecter'], [Gestionnaire, 'planifier'],
    [Evaluateur, 'affectes'], [Evaluateur, 'corriger'], [Evaluateur, 'cloturer'], [Evaluateur, 'transmettre'],
    [Auditeur, 'affectes'], [Auditeur, 'audit'], [Auditeur, 'corriger'], [Auditeur, 'cloturer'],
    [Decideur, 'tous'], [Decideur, 'decider'], [Decideur, 'registre'],
    [SuperAdmin, 'comptes'], [SuperAdmin, 'suspendre'], [Admin, 'registre']];
  const r = L.map(([a, k]) => link(a, u[k]));
  const x1 = extend(u.emettre, u.decider, 'décision favorable (CERTIFIED)');
  const i1 = include(u.planifier, u.affecter);

  const d = el('UMLUseCaseDiagram', model, { name: '3. Cas d\'utilisation — back-office INPG' }); diagrams.push(d);
  view('UMLUseCaseSubjectView', d, S, { left: 280, top: 20, width: 840, height: 1080 });
  const A = new Map();
  A.set(Gestionnaire, view('UMLActorView', d, Gestionnaire, { left: 90, top: 150, width: 40, height: 80 }));
  A.set(Evaluateur, view('UMLActorView', d, Evaluateur, { left: 90, top: 470, width: 40, height: 80 }));
  A.set(Auditeur, view('UMLActorView', d, Auditeur, { left: 1220, top: 420, width: 40, height: 80 }));
  A.set(Decideur, view('UMLActorView', d, Decideur, { left: 90, top: 780, width: 40, height: 80 }));
  A.set(Admin, view('UMLActorView', d, Admin, { left: 1220, top: 830, width: 40, height: 80 }));
  A.set(SuperAdmin, view('UMLActorView', d, SuperAdmin, { left: 1220, top: 990, width: 40, height: 80 }));
  const pos = { valider: [320, 60], demarrer: [320, 130], affecter: [320, 200], planifier: [760, 200], tous: [320, 300],
    affectes: [560, 400], corriger: [560, 470], cloturer: [560, 540], audit: [800, 300], transmettre: [320, 630],
    decider: [320, 730], emettre: [760, 730], registre: [560, 850], comptes: [760, 960], suspendre: [760, 1030] };
  const U = {};
  for (const [k, [x, y]] of Object.entries(pos)) U[k] = view('UMLUseCaseView', d, u[k], { left: x, top: y, width: 220, height: 50 });
  L.forEach(([a, k], i) => edge('UMLAssociationView', d, r[i], A.get(a), U[k]));
  edge('UMLExtendView', d, x1, U.emettre, U.decider);
  edge('UMLIncludeView', d, i1, U.planifier, U.affecter);
  note(d, 'Administrateur : hérite des cas du gestionnaire,\nde l\'évaluateur, de l\'auditeur et du décideur\n(voir « Hiérarchie des acteurs »).', 1160, 30, 300, 70);
  note(d, 'Contrôle par capacités côté API :\nun identifiant hors périmètre renvoie 404,\nune action non autorisée renvoie 403.', 1160, 120, 300, 70);
}

// --- 4. Hiérarchie des acteurs
{
  const gens = [gen(Gestionnaire, Utilisateur), gen(Evaluateur, Utilisateur), gen(Auditeur, Utilisateur), gen(Decideur, Utilisateur),
    gen(Admin, Gestionnaire), gen(Admin, Evaluateur), gen(Admin, Auditeur), gen(Admin, Decideur), gen(SuperAdmin, Admin)];
  const d = el('UMLUseCaseDiagram', model, { name: '4. Hiérarchie des acteurs (rôles RBAC)' }); diagrams.push(d);
  const V = new Map();
  const put = (a, x, y) => V.set(a, view('UMLActorView', d, a, { left: x, top: y, width: 40, height: 80 }));
  put(Visiteur, 40, 40); put(Utilisateur, 520, 40);
  put(Entreprise, 120, 240); put(Professionnel, 260, 240); put(Gestionnaire, 420, 240); put(Evaluateur, 560, 240); put(Auditeur, 700, 240); put(Decideur, 840, 240);
  put(Admin, 630, 440); put(SuperAdmin, 630, 620);
  const all = [[Entreprise, Utilisateur], [Professionnel, Utilisateur]];
  // reuse generalizations created in diagram 2
  for (const g of [...Entreprise.ownedElements, ...Professionnel.ownedElements].filter(e => e instanceof T.UMLGeneralization))
    edge('UMLGeneralizationView', d, g, V.get(g.source), V.get(g.target));
  for (const g of gens) edge('UMLGeneralizationView', d, g, V.get(g.source), V.get(g.target));
  note(d, 'Inscription publique : Entreprise ou Professionnel uniquement.\nComptes internes créés par le superadministrateur\n(POST /api/v1/admin/accounts/).', 870, 430, 330, 70);
  note(d, 'Visiteur : portail public et inscription,\naucun accès métier.', 110, 60, 230, 50);
}

// ================================================================== SÉQUENCES
const pkgDyn = el('UMLPackage', model, { name: 'Comportement' });
const API = el('UMLClass', pkgDyn, { name: 'API Django REST', documentation: 'platform_api (DRF) : ViewSets, contrôle par capacités, journalisation.' });
const SPA = el('UMLClass', pkgDyn, { name: 'Interface Angular', documentation: 'Application Angular 18 (frontend/src/app).' });
const DB = el('UMLClass', pkgDyn, { name: 'Base de données', documentation: 'SQLite (db.sqlite3) + fichiers media/.' });

function sequence(name, title, parts, msgs, opts = {}) {
  const coll = el('UMLCollaboration', pkgDyn, { name: title });
  const inter = el('UMLInteraction', coll, { name: title });
  const d = el('UMLSequenceDiagram', inter, { name }); diagrams.push(d);
  const LV = [];
  const spacing = opts.spacing || 175, x0 = 60, top = 60;
  const height = 80 + msgs.length * (opts.step || 42) + (opts.extra || 40);
  parts.forEach(([label, typ], i) => {
    const role = el('UMLAttribute', coll, { name: label, type: typ }, 'attributes');
    const ll = el('UMLLifeline', inter, { name: label, represent: role }, 'participants');
    const w = 150;
    const v = view('UMLSeqLifelineView', d, ll, { left: x0 + i * spacing, top, width: w, height });
    v._cx = x0 + i * spacing + w / 2; v._ll = ll;
    LV.push(v);
  });
  const frame = view('UMLFrameView', d, d, { left: 20, top: 15, width: x0 + parts.length * spacing + (opts.right || 60), height: height + 70 });
  let y = top + 70;
  const msgViews = [];
  for (const m of msgs) {
    if (m.gap) { y += m.gap; continue; }
    const [from, to, text, sort] = m;
    const s = LV[from], t = LV[to];
    const msg = el('UMLMessage', inter, { name: text, source: s._ll, target: t._ll, messageSort: sort || 'synchCall' }, 'messages');
    const v = view('UMLSeqMessageView', d, msg, {});
    v.tail = s.linePart; v.head = t.linePart;
    if (from === to) {
      v.points.add(new (require('metadata-json').Graphics.Point)(s._cx, y));
      v.points.add(new (require('metadata-json').Graphics.Point)(s._cx + 40, y));
      v.points.add(new (require('metadata-json').Graphics.Point)(s._cx + 40, y + 20));
      v.points.add(new (require('metadata-json').Graphics.Point)(s._cx, y + 20));
      y += 20;
    } else {
      v.points.add(new (require('metadata-json').Graphics.Point)(s._cx, y));
      v.points.add(new (require('metadata-json').Graphics.Point)(t._cx, y));
    }
    if (sort === 'reply') v.activation.visible = false;
    v._y = y; msgViews.push(v);
    y += opts.step || 42;
  }
  for (const f of opts.fragments || []) {
    const cf = el('UMLCombinedFragment', inter, { name: f.name || '', interactionOperator: f.op }, 'fragments');
    const opd = el('UMLInteractionOperand', cf, { name: '', guard: f.guard || '' }, 'operands');
    const top = msgViews[f.from]._y - 28, bottom = msgViews[f.to]._y + 18;
    const cv = view('UMLCombinedFragmentView', d, cf, { left: LV[f.l]._cx - 70, top, width: LV[f.r]._cx - LV[f.l]._cx + 140, height: bottom - top });
    const ov = new T.UMLInteractionOperandView(); ov._id = require('./lib').ID(); ov.model = opd; ov.left = cv.left; ov.top = top + 20; ov.width = cv.width; ov.height = bottom - top - 20;
    ov.guardLabel._id = require('./lib').ID(); ov.guardLabel._parent = ov;
    cv.operandCompartment.addSubView(ov); ov._parent = cv.operandCompartment;
  }
  return d;
}

// --- 5. Authentification et contrôle d'accès
sequence('5. Séquence — connexion et contrôle d\'accès', 'Connexion', [
  ['utilisateur', Utilisateur], ['spa', SPA], ['api', API], ['bd', DB]], [
  [0, 1, 'saisir identifiant et mot de passe'],
  [1, 2, 'GET /api/v1/auth/csrf/'],
  [2, 1, 'cookie csrftoken', 'reply'],
  [1, 2, 'POST /api/v1/auth/login/ {username, password}'],
  [2, 2, 'limiter les tentatives (10/min/IP)'],
  [2, 3, 'authenticate(username, password)'],
  [3, 2, 'utilisateur actif', 'reply'],
  [2, 2, 'role(user), capabilities(user)'],
  [2, 1, 'identité {role, capabilities} + cookie de session HttpOnly', 'reply'],
  [1, 0, 'redirection vers l\'espace du rôle', 'reply'],
  { gap: 10 },
  [0, 1, 'ouvrir une page protégée'],
  [1, 2, 'GET /api/v1/auth/me/ (sessionGuard)'],
  [2, 1, 'capacités à jour', 'reply'],
  [1, 0, 'page affichée, ou « Accès refusé »', 'reply'],
], { fragments: [{ op: 'alt', guard: 'capacité requise absente → /acces-refuse', from: 12, to: 13, l: 0, r: 2 }], spacing: 230 });

// --- 6. Cycle de certification
sequence('6. Séquence — cycle de certification d\'un dossier', 'Certification', [
  ['entreprise', Entreprise], ['gestionnaire', Gestionnaire], ['auditeur', Auditeur], ['évaluateur', Evaluateur], ['décideur', Decideur], ['api', API]], [
  [0, 5, 'POST /applications/ {volets, périmètre}'],
  [5, 5, 'créer le brouillon + checklist (RequiredDocument)'],
  [5, 0, 'dossier DRAFT', 'reply'],
  { gap: 14 },
  [0, 5, 'POST /documents/{id}/upload/ (fichier ≤ 10 Mo)'],
  [1, 5, 'POST /documents/{id}/review/ {VALIDATED}'],
  [0, 5, 'POST /applications/{id}/submit/'],
  [5, 0, 'SUBMITTED', 'reply'],
  [1, 5, 'POST start-review/'],
  [1, 5, 'POST assign/ {user_id : évaluateur}'],
  [1, 5, 'POST schedule-audit/ {auditor_id}'],
  [2, 5, 'POST complete-audit/ {audit_id, summary}'],
  { gap: 14 },
  [3, 5, 'POST request-correction/ {domain, description}'],
  [5, 3, 'CORRECTION_REQUIRED (NC-1-001)', 'reply'],
  [0, 5, 'POST respond-correction/ {response}'],
  [3, 5, 'POST validate-correction/'],
  [3, 5, 'POST complete-evaluation/'],
  [5, 3, 'DECISION_PENDING', 'reply'],
  [4, 5, 'POST decide/ {CERTIFIED, level : Gold}'],
  [5, 5, 'créer Certificate (CERT-INPG-…)'],
  [5, 4, 'CERTIFIED + numéro de certificat', 'reply'],
], { fragments: [
  { op: 'loop', guard: 'pour chaque pièce obligatoire', from: 3, to: 4, l: 0, r: 5 },
  { op: 'opt', guard: 'écart constaté', from: 11, to: 14, l: 0, r: 5 }], spacing: 180, step: 40, right: 200, extra: 60 });

// ================================================================== ÉTATS
function stateMachine(name, title, states, initial, trans, finals = []) {
  const sm = el('UMLStateMachine', pkgDyn, { name: title });
  const reg = el('UMLRegion', sm, {}, 'regions');
  const d = el('UMLStatechartDiagram', sm, { name }); diagrams.push(d);
  const S = {}, V = {};
  const ini = el('UMLPseudostate', reg, { kind: 'initial' }, 'vertices');
  V.__init = view('UMLPseudostateView', d, ini, { left: initial[1], top: initial[2], width: 20, height: 20 });
  S.__init = ini;
  for (const [k, label, x, y, w] of states) { S[k] = el('UMLState', reg, { name: label }, 'vertices'); V[k] = view('UMLStateView', d, S[k], { left: x, top: y, width: w || 170, height: 50 }); }
  for (const [k, x, y] of finals) { S[k] = el('UMLFinalState', reg, {}, 'vertices'); V[k] = view('UMLFinalStateView', d, S[k], { left: x, top: y, width: 26, height: 26 }); }
  for (const [a, b, trig, guard, effect, via] of trans) {
    const t = el('UMLTransition', reg, { source: S[a], target: S[b], guard: guard || '', kind: 'external' }, 'transitions');
    if (trig) el('UMLEvent', t, { name: trig, kind: 'anyReceive' }, 'triggers');
    if (effect) el('UMLOpaqueBehavior', t, { name: effect }, 'effects');
    edge('UMLTransitionView', d, t, V[a], V[b], {}, via);
  }
  return d;
}

// --- 7. États du dossier
stateMachine('7. États-transitions — dossier de certification', 'Statut du dossier (Application.status)', [
  ['draft', 'Brouillon (DRAFT)', 280, 60, 180], ['sub', 'Soumis (SUBMITTED)', 280, 230, 180], ['rev', 'En évaluation (UNDER_REVIEW)', 260, 400, 220],
  ['cor', 'Corrections demandées (CORRECTION_REQUIRED)', 660, 400, 300], ['dec', 'En décision (DECISION_PENDING)', 260, 580, 220],
  ['cert', 'Certifié (CERTIFIED)', 120, 780, 180], ['rej', 'Refusé (REJECTED)', 540, 780, 170]], ['__init', 350, 10],
  [['__init', 'draft', 'créer la demande', '', ''],
   ['draft', 'sub', 'submit', 'pièces obligatoires validées', ''],
   ['sub', 'rev', 'start-review', '', ''],
   ['rev', 'cor', 'request-correction', '', 'créer une non-conformité', [[620, 410]]],
   ['cor', 'rev', 'validate-correction', 'toutes les NC clôturées', '', [[620, 450]]],
   ['cor', 'sub', 'submit', 'pièces obligatoires validées', '', [[810, 255]]],
   ['rev', 'dec', 'complete-evaluation', 'aucune NC ouverte', ''],
   ['dec', 'cert', 'decide(CERTIFIED)', 'niveau ∈ {Standard, Gold, Platinum}', 'émettre le certificat'],
   ['dec', 'rej', 'decide(REJECTED)', '', ''],
   ['cert', 'f1', '', '', ''], ['rej', 'f2', '', '', '']],
  [['f1', 197, 900], ['f2', 612, 900]]);

// --- 8. États du certificat
stateMachine('8. États-transitions — certificat', 'Statut du certificat (Certificate.status)', [
  ['valid', 'Valide (VALID)', 120, 140, 170], ['susp', 'Suspendu (SUSPENDED)', 460, 140, 190], ['rev', 'Révoqué (REVOKED)', 290, 330, 180]], ['__init', 195, 40],
  [['__init', 'valid', 'decide(CERTIFIED)', '', 'numéro CERT-INPG-…'],
   ['valid', 'susp', 'update-status(SUSPENDED)', '', '', [[375, 150]]],
   ['susp', 'valid', 'update-status(VALID)', '', '', [[375, 185]]],
   ['valid', 'rev', 'update-status(REVOKED)', '', ''],
   ['susp', 'rev', 'update-status(REVOKED)', '', ''],
   ['rev', 'fin', '', '', '']],
  [['fin', 367, 470]]);

// ================================================================== 9. ACTIVITÉ
{
  const act = el('UMLActivity', pkgDyn, { name: 'Processus de certification au Label INPG' });
  const d = el('UMLActivityDiagram', act, { name: '9. Activité — processus de certification' }); diagrams.push(d);
  const lanes = ['Entreprise', 'Gestionnaire', 'Auditeur', 'Évaluateur', 'Décideur'];
  const LW = 230, LX = 20, LT = 20, LH = 1180;
  const P = {}, PV = {};
  lanes.forEach((n, i) => { P[n] = el('UMLActivityPartition', act, { name: n }, 'groups'); PV[n] = view('UMLSwimlaneView', d, P[n], { left: LX + i * LW, top: LT, width: LW, height: LH }); });
  const N = {}, NV = {};
  const cx = (lane) => LX + lanes.indexOf(lane) * LW + LW / 2;
  const node = (k, type, lane, label, y, w = 170, h = 44) => {
    N[k] = el(type, P[lane], { name: label }, 'nodes');
    const vt = type === 'UMLAction' ? 'UMLActionView' : 'UMLControlNodeView';
    const ww = vt === 'UMLActionView' ? w : (type === 'UMLDecisionNode' || type === 'UMLMergeNode' ? 30 : (type.includes('Fork') || type.includes('Join') ? 160 : 24));
    const hh = vt === 'UMLActionView' ? h : (type === 'UMLDecisionNode' || type === 'UMLMergeNode' ? 30 : (type.includes('Fork') || type.includes('Join') ? 8 : 24));
    NV[k] = view(vt, d, N[k], { left: cx(lane) - ww / 2, top: y, width: ww, height: hh });
    NV[k].containerView = PV[lane]; PV[lane].containedViews.push(NV[k]);
  };
  node('start', 'UMLInitialNode', 'Entreprise', '', 60);
  node('creer', 'UMLAction', 'Entreprise', 'Créer la demande (volets, périmètre)', 110);
  node('deposer', 'UMLAction', 'Entreprise', 'Déposer les pièces justificatives', 190);
  node('verif', 'UMLAction', 'Gestionnaire', 'Vérifier chaque pièce', 270);
  node('dpieces', 'UMLDecisionNode', 'Gestionnaire', '', 350);
  node('soumettre', 'UMLAction', 'Entreprise', 'Soumettre le dossier', 420);
  node('demarrer', 'UMLAction', 'Gestionnaire', 'Démarrer l\'évaluation', 500);
  node('affecter', 'UMLAction', 'Gestionnaire', 'Affecter l\'évaluateur et planifier l\'audit', 570);
  node('fork', 'UMLForkNode', 'Auditeur', '', 650);
  node('audit', 'UMLAction', 'Auditeur', 'Réaliser l\'audit sur site', 690);
  node('evaluer', 'UMLAction', 'Évaluateur', 'Évaluer le dossier', 690);
  node('join', 'UMLJoinNode', 'Évaluateur', '', 770);
  node('decart', 'UMLDecisionNode', 'Évaluateur', '', 810);
  node('nc', 'UMLAction', 'Évaluateur', 'Créer une non-conformité', 880);
  node('repondre', 'UMLAction', 'Entreprise', 'Décrire l\'action corrective', 880);
  node('cloturer', 'UMLAction', 'Évaluateur', 'Clôturer la non-conformité', 960);
  node('transmettre', 'UMLAction', 'Évaluateur', 'Transmettre en décision', 1040);
  node('decider', 'UMLAction', 'Décideur', 'Rendre la décision', 1040);
  node('ddec', 'UMLDecisionNode', 'Décideur', '', 1110);
  node('emettre', 'UMLAction', 'Décideur', 'Émettre le certificat (Label)', 1150, 170, 40);
  node('fin', 'UMLActivityFinalNode', 'Décideur', '', 1150);
  NV.fin.left = cx('Décideur') + 100;  NV.emettre.left = cx('Décideur') - 110;
  node('refus', 'UMLActivityFinalNode', 'Gestionnaire', '', 1150);
  const flow = (a, b, guard = '', via = null) => {
    const f = el('UMLControlFlow', act, { source: N[a], target: N[b], guard }, 'edges');
    edge('UMLControlFlowView', d, f, NV[a], NV[b], {}, via);
  };
  flow('start', 'creer'); flow('creer', 'deposer'); flow('deposer', 'verif', '', [[cx('Entreprise'), 292]]);
  flow('verif', 'dpieces');
  flow('dpieces', 'deposer', 'pièce refusée', [[cx('Gestionnaire'), 212]]);
  flow('dpieces', 'soumettre', 'toutes validées', [[cx('Entreprise'), 365]]);
  flow('soumettre', 'demarrer', '', [[cx('Gestionnaire'), 442]]);
  flow('demarrer', 'affecter'); flow('affecter', 'fork', '', [[cx('Auditeur'), 592]]);
  flow('fork', 'audit'); flow('fork', 'evaluer', '', [[cx('Évaluateur'), 654]]);
  flow('audit', 'join', '', [[cx('Auditeur'), 774]]); flow('evaluer', 'join');
  flow('join', 'decart');
  flow('decart', 'nc', 'écart constaté');
  flow('nc', 'repondre');
  flow('repondre', 'cloturer', '', [[cx('Entreprise'), 982]]);
  flow('cloturer', 'decart', '', [[cx('Évaluateur') + 105, 982], [cx('Évaluateur') + 105, 825]]);
  flow('decart', 'transmettre', 'dossier conforme', [[cx('Évaluateur') - 100, 825], [cx('Évaluateur') - 100, 1062]]);
  flow('transmettre', 'decider');
  flow('decider', 'ddec');
  flow('ddec', 'emettre', 'favorable', [[cx('Décideur') - 25, 1125]]);
  flow('ddec', 'refus', 'défavorable (REJECTED)', [[cx('Gestionnaire'), 1125]]);
  flow('emettre', 'fin');
}

// ================================================================== 10. DÉPLOIEMENT
{
  const pkgDep = el('UMLPackage', model, { name: 'Déploiement' });
  const n1 = el('UMLNode', pkgDep, { name: 'Poste utilisateur' });
  const n2 = el('UMLNode', pkgDep, { name: 'Serveur d\'application' });
  const n3 = el('UMLNode', pkgDep, { name: 'Stockage' });
  const nav = el('UMLArtifact', pkgDep, { name: 'Navigateur web + SPA Angular 18' });
  const ng = el('UMLArtifact', pkgDep, { name: 'Serveur Angular (proxy /api → 8000)' });
  const dj = el('UMLArtifact', pkgDep, { name: 'API Django 5.1 + DRF (platform_api)' });
  const sq = el('UMLArtifact', pkgDep, { name: 'db.sqlite3' });
  const md = el('UMLArtifact', pkgDep, { name: 'media/documents/ (pièces déposées)' });
  const p1 = el('UMLCommunicationPath', pkgDep, { name: 'HTTPS (session + CSRF)' });
  p1.end1 = new T.UMLAssociationEnd(); Object.assign(p1.end1, { _id: require('./lib').ID(), _parent: p1, reference: n1 });
  p1.end2 = new T.UMLAssociationEnd(); Object.assign(p1.end2, { _id: require('./lib').ID(), _parent: p1, reference: n2 });
  const p2 = el('UMLCommunicationPath', pkgDep, { name: 'ORM Django / système de fichiers' });
  p2.end1 = new T.UMLAssociationEnd(); Object.assign(p2.end1, { _id: require('./lib').ID(), _parent: p2, reference: n2 });
  p2.end2 = new T.UMLAssociationEnd(); Object.assign(p2.end2, { _id: require('./lib').ID(), _parent: p2, reference: n3 });
  const d = el('UMLDeploymentDiagram', model, { name: '10. Déploiement' }); diagrams.push(d);
  const v1 = view('UMLNodeView', d, n1, { left: 40, top: 60, width: 260, height: 200 });
  const v2 = view('UMLNodeView', d, n2, { left: 420, top: 60, width: 320, height: 260 });
  const v3 = view('UMLNodeView', d, n3, { left: 860, top: 60, width: 280, height: 260 });
  const art = (a, x, y, w, c) => { const v = view('UMLArtifactView', d, a, { left: x, top: y, width: w, height: 50 }); v.containerView = c; c.containedViews.push(v); return v; };
  art(nav, 60, 150, 220, v1); art(ng, 440, 140, 280, v2); art(dj, 440, 230, 280, v2); art(sq, 880, 140, 240, v3); art(md, 880, 230, 240, v3);
  edge('UMLCommunicationPathView', d, p1, v1, v2); edge('UMLCommunicationPathView', d, p2, v2, v3);
  note(d, 'Développement : ng serve (127.0.0.1:4200) relaie /api vers runserver (127.0.0.1:8000).\nProduction : DJANGO_DEBUG=0, DJANGO_SECRET_KEY aléatoire, HTTPS, hôtes et origines CSRF explicites.', 40, 360, 720, 50);
}

module.exports = { proj, model, diagrams, el, view, edge, T, attr, op };
if (require.main === module) {
  for (const d of diagrams) layout(d);
  console.log('saved', save(proj, process.argv[2] || 'out.mdj'));
}
