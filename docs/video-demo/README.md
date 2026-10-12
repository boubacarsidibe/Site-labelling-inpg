# Vidéo de démonstration — Plateforme Label INPG

Vidéo de présentation de 4 min 56 s (1920×1080, 30 i/s, H.264 + AAC), voix off française et sous-titres incrustés.

Tous les écrans ont été filmés sur l'application de ce dépôt, lancée en local sans Docker (API Django sur `127.0.0.1:8000`, Angular sur `127.0.0.1:4200`), avec une base vierge. Le dossier suit le vrai workflow de l'API, de bout en bout. Aucune fonctionnalité absente de l'application n'est montrée. Les pages encore non raccordées sont présentées comme « à venir ».

## Rôles et codes couleur

Chaque rôle a un badge de couleur fixe en haut à gauche de l'écran, et un badge par moitié d'écran dans les écrans divisés.

| Rôle | Compte de démonstration | Couleur |
|---|---|---|
| Visiteur (non connecté) | — | turquoise |
| Entreprise | `spd.diallo` (Sénégal Pétrole Distribution) | vert |
| Gestionnaire | `gest.fall` | bleu |
| Évaluateur | `eval.sow` | violet |
| Auditeur | `audit.diop` | orange |
| Décideur | `decid.ba` | bordeaux |
| Superadministrateur | `superadmin` (superutilisateur Django) | ardoise |
| Administrateur | `admin.ndiaye` | gris |

Les comptes internes sont créés à l'écran par le superadministrateur (page Utilisateurs). Le compte Entreprise est créé par l'inscription publique. Les mots de passe sont locaux à la démonstration et ne sont pas versionnés.

## 1. Script minuté

Les timecodes sont ceux du montage final. Un fondu de 0,5 s relie chaque séquence.

| Timecode | Visuel à l'écran | Action (clic, saisie, zoom) | Voix off | Texte à l'écran |
|---|---|---|---|---|
| 0:00 – 0:22 | Carton animé : quatre difficultés, puis titre sur photo industrielle et logo INPG | Apparition successive des cartes ; fondu vers le titre | Obtenir le Label INPG, c'est souvent des dossiers papier, des pièces envoyées par e-mail et des relances sans fin. Personne ne sait où en est une demande, ni qui doit agir. La Plateforme Label INPG réunit tout le parcours de certification dans un seul espace sécurisé. | « Dossiers papier et e-mails », « Relances sans fin », « Où en est la demande ? », « Qui doit agir ? » ; titre « Plateforme Label INPG » ; Sécurité · Qualité · Environnement |
| 0:22 – 0:47 | Schéma animé : Interface Angular 18 → API Django REST → Données centralisées | Flèches tracées l'une après l'autre ; pastilles sécurité en bas | L'interface, développée avec Angular, dialogue avec une API Django REST. C'est le serveur qui applique les règles métier et les droits de chaque rôle. Chaque action est vérifiée, puis enregistrée dans l'historique du dossier. Les connexions reposent sur des sessions sécurisées, et les pièces justificatives sont centralisées. Résultat : un même dossier, suivi de bout en bout par tous les acteurs. | Bandeau « Solution & architecture » ; « Sessions sécurisées (HttpOnly) », « Protection CSRF », « Limitation des tentatives », « Refus par défaut » |
| 0:47 – 1:08 | Portail public : accueil, Le Label INPG, Démarche, Inscription | Défilement de l'accueil ; clics dans le menu ; inscription Entreprise remplie (accéléré) ; « Créer mon compte » → « Votre compte a été créé » | Tout commence sur le portail public. On y découvre le Label, ses trois volets, Sécurité, Qualité et Environnement, la démarche et les formations. Une entreprise crée son compte en quelques secondes. Les comptes d'administration, eux, ne sont jamais ouverts à l'inscription publique. | Badge Visiteur ; bandeau « Portail public & inscription » ; « ▶▶ Accéléré » pendant la saisie |
| 1:08 – 1:26 | Page de connexion, puis tableau de bord Gestionnaire ; carton des six rôles | Saisie `gest.fall` + mot de passe ; « Se connecter » ; cartes des rôles en cascade | Chaque acteur se connecte avec son identifiant. La plateforme reconnaît son rôle et l'oriente vers son espace : entreprise, gestionnaire, évaluateur, auditeur, décideur ou superadministrateur. Chacun ne voit que les menus et les dossiers qui le concernent. | Badge Gestionnaire ; bandeau « Page de connexion » ; carton « Six rôles, un espace adapté à chacun » |
| 1:26 – 1:48 | Administration › Utilisateurs (superadministrateur), puis même page vue par un administrateur ordinaire | Création de `gest.fall` en temps réel, puis des quatre autres comptes en accéléré ; zoom sur « Création réservée au superutilisateur » | Le superadministrateur crée les comptes internes depuis la page Utilisateurs : identifiant, e-mail, rôle et mot de passe temporaire. En quelques clics, l'équipe INPG est en place. Un administrateur ordinaire, lui, consulte cette page mais ne peut pas créer de comptes : cette création est réservée au superutilisateur. | Badges Superadministrateur puis Administrateur ; message « Compte gest.fall créé avec le rôle MANAGER. » |
| 1:48 – 2:14 | Espace entreprise : tableau de bord, Nouvelle demande, Déposer les pièces | « Nouvelle demande » ; saisie du périmètre ; clic Sécurité + Qualité ; zoom sur « Niveau correspondant : Gold » ; « Créer le brouillon » ; dépôt des 6 PDF ; « Soumettre le dossier » refusé | Côté entreprise, le tableau de bord résume les démarches en cours. Sénégal Pétrole Distribution lance une nouvelle demande. Elle précise son activité et son périmètre, puis choisit deux volets : le niveau Gold est calculé automatiquement. À la création du brouillon, l'API génère la checklist officielle. L'entreprise dépose ses six pièces justificatives. Tant qu'elles ne sont pas validées, la soumission est refusée. | Badge Entreprise ; bandeau « Nouvelle demande & dépôt des pièces » ; message « Les pièces obligatoires doivent être définies et validées. » |
| 2:14 – 2:32 | **Écran divisé** : Gestionnaire (gauche) / Entreprise (droite) | Gauche : « Ouvrir » puis « Valider » ×6. Droite : actualisation, pièces « Validé », « Soumettre le dossier » → statut SUBMITTED | Place au travail d'équipe. À gauche, le gestionnaire ouvre le dossier et valide chaque pièce. À droite, l'entreprise actualise sa page : tout est validé, elle soumet son dossier. | Badges Gestionnaire / Entreprise ; bandeau « Validation des pièces → soumission du dossier » |
| 2:32 – 2:49 | **Écran divisé** : Gestionnaire / Évaluateur (liste Dossiers) | Gauche : « Démarrer l'évaluation », affectation de `eval.sow`, audit planifié pour `audit.diop`. Droite : « Aucun dossier trouvé » puis « Actualiser » → le dossier apparaît | Le gestionnaire démarre l'évaluation. Il affecte l'évaluateur, puis planifie l'audit avec l'auditeur. Le dossier apparaît alors dans leurs espaces. L'évaluateur et l'auditeur n'ont accès qu'aux dossiers qui leur sont explicitement affectés. | Badges Gestionnaire / Évaluateur ; bandeau « Démarrage de l'évaluation, affectation et audit » |
| 2:49 – 3:08 | Auditeur (plein écran), puis **écran divisé** Évaluateur / Entreprise | Auditeur : ouverture du dossier, « Marquer réalisé ». Évaluateur : volet Sécurité, description, « Créer la non-conformité ». Entreprise : actualisation → « Corrections demandées », bouton « Répondre » | Après sa visite, l'auditeur marque l'audit comme réalisé. L'évaluateur relève un écart sur le volet Sécurité et crée une non-conformité. Côté entreprise, le dossier passe en « Corrections demandées ». | Badge Auditeur ; bandeau « Non-conformité → Corrections demandées » ; badges Évaluateur / Entreprise |
| 3:08 – 3:22 | **Écran divisé** : Entreprise / Évaluateur | Entreprise : « Répondre », saisie de l'action corrective, « Transmettre la correction ». Évaluateur : actualisation, « Clôturer », « Transmettre en décision » | L'entreprise décrit son action corrective et la transmet. L'évaluateur la relit, clôture l'écart, puis transmet le dossier en décision. | Badges Entreprise / Évaluateur ; bandeau « Action corrective → clôture → décision » |
| 3:22 – 3:36 | Décideur : dossier « En décision », puis registre des certificats | Label Gold confirmé, motif saisi, « Émettre le certificat » ; zoom sur le numéro CERT-INPG-… ; menu « Certificats » | Le décideur confirme le Label Gold et émet le certificat, avec un numéro unique. Le certificat apparaît aussitôt dans le registre des certifications, consultable par le décideur. | Badge Décideur ; bandeau « Décision & certificat » |
| 3:36 – 3:56 | Gestionnaire refusé, Entreprise sur « Accès refusé », carton des menus par rôle | Le gestionnaire tente « Créer la non-conformité » → zoom sur « Vous ne disposez pas des droits nécessaires. » ; l'entreprise ouvre `/admin/dashboard` | Les droits sont contrôlés par le serveur, pas seulement par l'interface. Un gestionnaire qui tente de créer une non-conformité est refusé. Une entreprise qui saisit l'adresse de l'administration arrive sur « Accès refusé ». Et chaque rôle n'affiche que ses propres menus : le gestionnaire, l'auditeur ou le décideur ne voient pas les mêmes pages. | Bandeaux « Contrôle des droits » et « Saisie de /admin/dashboard » ; carton « Chaque rôle n'affiche que ses propres menus » (6 barres latérales réelles) |
| 3:56 – 4:17 | Entreprise : tableau de bord certifié, suivi en 7 étapes ; superadministrateur : historique, registre | Zoom sur « 1 Certification obtenue » ; « Suivre » ; défilement de l'historique ; « Suspendre » → SUSPENDED → « Réactiver » | L'entreprise retrouve son dossier certifié et suit les sept étapes de son parcours. Dans l'historique, chaque action est datée et attribuée : dépôt, validation, audit, correction, décision. Le superadministrateur tient le registre des certificats : il peut suspendre un certificat, puis le réactiver. | Badges Entreprise puis Superadministrateur ; bandeaux « Suivi du dossier certifié » et « Historique & registre des certificats » |
| 4:17 – 4:36 | Carton récapitulatif « Qui peut faire quoi ? » (6 rôles × 10 lignes) | Lignes du tableau en cascade | En résumé : l'entreprise dépose et corrige. Le gestionnaire valide et affecte. L'évaluateur et l'auditeur examinent. Le décideur certifie. Et le superadministrateur gère les comptes et le registre. Chacun à sa place, sur un même dossier. | Tableau des droits ; note « Droits vérifiés par l'API à chaque requête » |
| 4:36 – 4:56 | Vérification de certificat (« Registre non connecté »), Référentiels (module à venir), carton de fin | Défilement ; fondu vers « Prochaines étapes », puis logo | Prochaines étapes : la vérification publique des certificats, et les modules Formations et Référentiels. Plateforme Label INPG : une certification simple, traçable et sécurisée. | Bandeau « Modules à venir » ; « Plateforme Label INPG — Une certification simple, traçable et sécurisée. Réalisé par Boubacar SIDIBE » |

Voix off : 598 mots, voix féminine française « Perle » (ElevenLabs v4), ralentie à 95 % pour un débit posé. Sous-titres français synchronisés sur la voix. Musique instrumentale douce, atténuée automatiquement sous la voix.

## 2. Plans d'écran à enregistrer, dans l'ordre

L'ordre suit l'état réel du dossier : chaque plan dépend du précédent. Base vierge, superutilisateur `superadmin` créé avec `createsuperuser`.

| # | Plan | Rôle connecté | Vue | Contenu |
|---|---|---|---|---|
| 1 | `public` | Visiteur | Plein écran | Accueil (défilement), Le Label INPG, Démarche, Formations, Inscription Entreprise « Sénégal Pétrole Distribution » |
| 2 | `users` | Superadministrateur | Plein écran | Création des comptes gest.fall, eval.sow, audit.diop, decid.ba, admin.ndiaye |
| 3 | `users-admin` | Administrateur | Plein écran | Page Utilisateurs : « Création réservée au superutilisateur » |
| 4 | `login` | Gestionnaire | Plein écran | Connexion de gest.fall → tableau de bord vide |
| 5 | `ent-demande` | Entreprise | Plein écran | Nouvelle demande (Sécurité + Qualité = Gold), brouillon, dépôt des 6 pièces, soumission refusée |
| 6 | `split-validation` | Gestionnaire + Entreprise | Écran divisé | Validation des 6 pièces / soumission du dossier |
| 7 | `split-affectation` | Gestionnaire + Évaluateur | Écran divisé | Démarrer l'évaluation, affecter, planifier l'audit / le dossier apparaît chez l'évaluateur |
| 8 | `refus-gestionnaire` | Gestionnaire | Plein écran | Tentative de non-conformité refusée par l'API |
| 9 | `auditeur` | Auditeur | Plein écran | Dossier affecté, « Marquer réalisé » |
| 10 | `split-nc` | Évaluateur + Entreprise | Écran divisé | Non-conformité créée / dossier en « Corrections demandées » |
| 11 | `split-reponse` | Entreprise + Évaluateur | Écran divisé | Réponse corrective / clôture et transmission en décision |
| 12 | `decideur` | Décideur | Plein écran | Émission du certificat Gold, registre |
| 13 | `acces-refuse` | Entreprise | Plein écran | `/admin/dashboard` → « Accès refusé » |
| 14 | `ent-certifie` | Entreprise | Plein écran | Tableau de bord certifié, suivi en 7 étapes |
| 15 | `historique` | Superadministrateur | Plein écran | Historique complet du dossier |
| 16 | `registre` | Superadministrateur | Plein écran | Suspendre puis réactiver le certificat |
| 17 | `referentiels` | Superadministrateur | Plein écran | Module Référentiels (à venir) |
| 18 | `verification` | Visiteur | Plein écran | Vérification de certificat (« Registre non connecté ») |
| 19 | `menus` | Les 6 rôles | Captures fixes | Barre latérale de chaque rôle, pour le carton « Contrôle d'accès » |

## Écarts par rapport au brief initial

Le brief décrivait une autre application (monitoring réseau de l'EPT). Il a été transposé à la Plateforme Label INPG, la seule application présente dans ce dépôt.

- **Pas de temps réel.** L'application n'utilise pas de WebSocket : l'autre rôle voit le changement **après actualisation** de sa page. La vidéo le montre tel quel (clic « Actualiser » ou rechargement), sans prétendre à une diffusion instantanée.
- **Pas d'e-mail ni de rapport PDF/CSV.** Ces fonctions n'existent pas. La traçabilité est montrée par l'historique du dossier et le registre des certificats.
- **Pages non montrées.** « Mon entreprise », « Mes certifications » et « Formations » de l'espace entreprise affichent encore des données fictives (`MockDataService`, par exemple un certificat CERT-INPG-2025-012 inexistant). Elles sont écartées pour ne pas présenter de fausses données. Les pages Évaluations, Audits, Non-conformités, Formations et Référentiels de l'administration sont des modules annoncés. Référentiels et la vérification publique apparaissent dans la conclusion comme « à venir ».
- **Crédits.** Le nom de Boubacar SIDIBE vient de l'historique Git. Le second auteur du brief initial (monitoring EPT) n'a pas été repris faute de lien avec ce projet. À ajuster si nécessaire dans `outils/slides.html`.

## Correctif appliqué pour le tournage

L'historique des dossiers affichait `<function event at 0x…>` au lieu du type d'évènement : l'aide `event()` de `backend/platform_api/views.py` enregistrait la fonction elle-même. Le correctif est commité avec un test de non-régression. L'historique affiche aussi désormais des libellés français (« Pièce validée », « Audit planifié », etc.).

## Reproduire la vidéo

Les scripts sont dans [`outils/`](outils/) :

1. Lancer l'API et l'interface en local (voir le README racine). Base vierge, puis `createsuperuser --username superadmin` avec un mot de passe local, exporté dans `DEMO_PASSWORD` : les scripts le lisent pour tous les comptes. Il n'est jamais versionné.
2. `node record.mjs` : rejoue tout le scénario dans Chromium (Playwright), avec un curseur à halo, et capture chaque plan en 1920×1080 via le screencast CDP. Prévoir Playwright 1.56 et des PDF de test dans `/tmp/claude-0/pdfs`. Les chemins de travail sont en tête des scripts.
3. `node rec-slides.mjs` : enregistre les cartons animés de `slides.html`. Placer à côté `inpg-logo.svg` et `label-hero.png` (copiés de `frontend/src/assets`) ainsi que les barres latérales `menu-<compte>.png`, découpées dans les captures du plan 19.
4. `python3 music.py` : synthétise la musique de fond.
5. Voix off : les 15 segments de `vo.json`, en MP3, dans `audio/s01.mp3` … `s15.mp3`.
6. `python3 compose.py all` : vitesses, écrans divisés, zooms, badges, bandeaux, sous-titres, fondus, mixage et encodage final.
