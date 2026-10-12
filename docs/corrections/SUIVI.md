# Suivi des corrections — Plateforme Label INPG

Ce fichier sert de point de reprise. Pour chaque problème relevé lors de l'audit (octobre 2026), il indique la décision prise et l'état. Il est mis à jour et commité à chaque étape sur la branche `claude/nice-hamilton-ayx5og`.

Légende : `[x]` fait et testé · `[~]` en cours · `[ ]` à faire

## Décisions validées par le porteur du projet

| Sujet | Décision |
|---|---|
| Niveau du Label | **Par volet** : le décideur coche les volets accordés, le niveau est calculé (1 = Standard, 2 = Gold, 3 = Platinum) |
| Certificat | **Validité 1 an**, statut « Expiré » automatique, **révocation définitive**, renouvellement par une nouvelle demande liée |
| Rôle Administrateur | **Inchangé** : garde tous les droits métier, y compris le cumul sur un même dossier |
| Mise à jour des écrans | **Rafraîchissement automatique** (30 s) + **e-mails** à chaque étape (console en développement, SMTP en production) |
| Modules vides | **Construits** : Évaluations, Audits, Non-conformités (listes), Mon entreprise, Mes certifications (API), Référentiels éditables. Formations reste un catalogue |
| Comptes entreprise | **Plusieurs utilisateurs**, sur invitation du titulaire |
| Base de données | **PostgreSQL via `DATABASE_URL`**, SQLite par défaut en développement |
| Comptes internes | **Liste + activation/désactivation** par le superadministrateur |
| Entreprises inscrites | **Vérification par le gestionnaire** avant la première soumission |
| Dossier refusé | **Motif obligatoire et visible**, nouvelle demande liée au dossier refusé |
| Brouillons | Visibles par l'entreprise, le gestionnaire et l'administrateur ; **le décideur ne voit pas les brouillons** |
| Non-conformités | **Échéance** et **renvoi motivé** possible d'une réponse insuffisante |

## 1. Sécurité

- [x] S1 Pièces téléchargeables sans authentification : téléchargement uniquement via l'API, avec contrôle des droits
- [x] S2 Aucun contrôle du type de fichier : extensions et signatures PDF/PNG/JPEG vérifiées côté serveur
- [x] S3 Limitation de connexion comptant les succès et partagée derrière un proxy : seuls les échecs comptent, `NUM_PROXIES` configurable
- [x] S4 Compteur commun inscription/connexion : compteurs séparés
- [x] S5 `DEBUG` activé par défaut : désactivé sauf `DJANGO_DEBUG=1`
- [x] S6 En-têtes de sécurité et journalisation absents
- [x] S7 NINEA modifiable par l'entreprise : lecture seule hors administration, organisation vérifiée par le gestionnaire
- [x] S8 Pas de mot de passe oublié, e-mail non unique
- [x] S9 Entreprise créée sans contrôle : vérification par le gestionnaire (décision)

## 2. Workflow et règles métier

- [x] W1 Re-soumission possible en « Corrections demandées » (NC ouverte contournée)
- [x] W2 Évaluation clôturée alors que l'audit est seulement planifié
- [x] W3 Niveau incohérent avec les volets : niveau calculé par l'API, décision par volet
- [x] W4 Volets et niveau non validés à la création
- [x] W5 Modifier les volets d'un brouillon ne régénère pas la checklist
- [x] W6 Date d'audit invalide : erreur 500
- [x] W7 Suppression d'organisation ou de dossier certifié : erreur 500
- [x] W8 Affectation et audit possibles sur un dossier certifié
- [x] W9 Certificat révoqué réactivable : révocation définitive, expiration à 1 an
- [x] W10 Affectation en double
- [x] W11 Gravité de non-conformité libre : Mineure, Majeure ou Critique
- [x] W12 Pièce validée redéposable par l'API
- [x] W13 Pas de renvoi d'une réponse corrective : renvoi motivé et échéance
- [x] W14 Dossier refusé sans suite : motif obligatoire, nouvelle demande liée
- [x] W15 Références de non-conformité en collision : numérotation sous verrou
- [x] W16 Code mort `can_access_application`
- [x] W17 Pas de retrait d'affectation
- [x] W18 Commentaire de refus de pièce figé : commentaire libre, obligatoire pour un refus
- [x] W19 Date d'audit jamais saisie par l'interface ; compte rendu d'audit figé
- [x] W20 Type de demande (initiale/renouvellement) et activité perdus

## 3. Synchronisation et accès simultanés

- [x] C1 Décisions, démarrages, affectations et non-conformités simultanés : une transaction verrouillée par action, messages clairs au lieu de 500
- [x] C2 Statut enregistré avant la création du certificat : actions atomiques
- [x] C3 Fichiers orphelins (nouveau dépôt, suppression)
- [x] C4 Certificat suspendu/révoqué/expiré mais dossier affiché « Certifié »
- [x] C5 Checklist et règle des niveaux dupliquées entre interface et API : l'API devient la source unique
- [x] C6 Droits et libellés dupliqués dans l'interface : un seul fichier de libellés, boutons selon les capacités
- [x] C7 Pas de rafraîchissement : rafraîchissement automatique et bandeau « dossier mis à jour »
- [x] C8 Pas d'intercepteur 401/403 ; `returnUrl` ignoré ; double appel `/auth/me/`
- [x] C9 Compteurs en mémoire par processus : cache partagé configurable (Redis)
- [x] C10 SQLite un seul écrivain : transactions IMMEDIATE, PostgreSQL via `DATABASE_URL`
- [x] C11 Date d'audit sans fuseau horaire
- [x] C12 Notifications : e-mails à chaque étape

## 4. Interface et fonctionnalités par rôle

- [x] F1 Boutons affichés à tous les rôles : affichage selon les capacités et l'état
- [x] F2 Listes « Affecter » et « Planifier » liées à la même variable
- [x] F3 Statuts bruts en anglais : libellés français partout
- [x] F4 Suivi du dossier : étapes fausses pour un dossier certifié ou refusé ; décision, historique et certificat visibles par l'entreprise
- [x] F5 Lien « Voir le fichier » cassé
- [x] F6 « Mon entreprise » factice : vraie fiche, membres, invitations
- [x] F7 « Mes certifications » factice : certificats réels, expiration, renouvellement
- [x] F8 Pages vides Évaluations, Audits, Non-conformités : vraies listes ; Référentiels éditable ; Formations retirée du menu d'administration
- [x] F9 Tableau de bord d'administration : compteurs et « à traiter »
- [x] F10 Liste des dossiers : nom d'entreprise, filtre par statut
- [x] F11 Utilisateurs : liste et activation/désactivation des comptes
- [x] F12 Vérification publique des certificats
- [x] F13 Accès gestionnaire au registre et aux audits ; auditeur aux non-conformités
- [x] F14 Textes incohérents (page de connexion…)
- [x] F15 Références lisibles `INPG-AAAA-NNNN`
- [x] F16 Composants de démonstration morts

## 5. Documentation, tests, déploiement

- [x] D1 Docs RBAC, inscription, workflow, pages internes à jour
- [x] D2 Tests backend pour chaque correction (y compris accès simultanés)
- [x] D3 Tests de bout en bout de l'interface (Playwright)
- [x] D4 CI GitHub Actions (tests backend, compilation et e2e)
- [x] D5 Production : PostgreSQL, gunicorn, e-mails, cache, variables documentées
- [x] D6 `package-lock.json` resynchronisé
- [x] D7 Modèle UML mis à jour avec les nouvelles règles

## Journal

- 12/10/2026 : 45 tests dédiés aux corrections (`test_corrections.py`), 70/70 sur SQLite et PostgreSQL (test d'accès simultanés compris). Sur le serveur réel : 0 erreur 500 sous accès simultanés (22 avant). `[~]` = API prête, écran à faire. **Reste : interface Angular (F*, C5–C8), e2e, CI, docs, UML.**

- 12/10/2026 : backend réécrit (modèles + migrations 0006/0007, réglages, workflow verrouillé, téléchargement protégé, e-mails, invitations, mot de passe oublié, comptes, référentiel, listes audits/NC, vérification publique). Tests existants adaptés (25/25). **Reste : tests dédiés à chaque correction, puis interface.**

- 12/10/2026 : audit complet (technique, fonctionnel, synchronisation), décisions validées, création de ce fichier.
- 12/10/2026 : interface Angular reprise : intercepteur 401 avec `returnUrl`, rafraîchissement 30 s avec bandeau, libellés et valeurs de référence servis par l'API (`/meta/`), boutons selon capacités et statut, console d'administration réelle (tableau de bord, dossiers filtrables, évaluations, audits, non-conformités avec échéances, registre des certificats, référentiels éditables, comptes), pages publiques mot de passe oublié / réinitialisation / invitation / vérification de certificat, Mon entreprise et Mes certifications réelles, composants factices supprimés. `ng build` sans erreur ; parcours vérifié dans le navigateur pour chaque rôle (aucune erreur API). **Reste : e2e (D3), CI (D4), docs (D1, D5), UML (D7).**
- 12/10/2026 : tests e2e Playwright (`frontend/e2e`, `npm run e2e`) : 15 scénarios dont le parcours complet à 5 acteurs (inscription → certificat Standard vérifiable). Correctif trouvé grâce à eux : l'API répondait 403 au lieu de 401 sans session, l'interface ne pouvait donc pas détecter l'expiration (classe `SessionAuth`).
- 12/10/2026 : CI GitHub Actions (`.github/workflows/ci.yml`) : tests backend sur PostgreSQL 16 + migrations à jour + `check --deploy`, compilation Angular, puis e2e Playwright.
- 12/10/2026 : documentation à jour : README (développement avec `DJANGO_DEBUG=1`, tests, e2e, variables de production, gunicorn/Nginx), `rbac.md`, `inscription.md`, `workflow-audit.md`, `design/pages-internes.md`.
- 12/10/2026 : modèle UML StarUML régénéré (`docs/uml`) : nouvelles classes et énumérations, cas d'utilisation (vérification de certificat, invitations, référentiels, comptes), session expirée, états du certificat avec expiration, déploiement de production. Contrôle : 2 841 éléments, 0 référence non résolue.
