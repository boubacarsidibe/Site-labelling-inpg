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

- [ ] S1 Pièces téléchargeables sans authentification : téléchargement uniquement via l'API, avec contrôle des droits
- [ ] S2 Aucun contrôle du type de fichier : extensions et signatures PDF/PNG/JPEG vérifiées côté serveur
- [ ] S3 Limitation de connexion comptant les succès et partagée derrière un proxy : seuls les échecs comptent, `NUM_PROXIES` configurable
- [ ] S4 Compteur commun inscription/connexion : compteurs séparés
- [ ] S5 `DEBUG` activé par défaut : désactivé sauf `DJANGO_DEBUG=1`
- [ ] S6 En-têtes de sécurité et journalisation absents
- [ ] S7 NINEA modifiable par l'entreprise : lecture seule hors administration, organisation vérifiée par le gestionnaire
- [ ] S8 Pas de mot de passe oublié, e-mail non unique
- [ ] S9 Entreprise créée sans contrôle : vérification par le gestionnaire (décision)

## 2. Workflow et règles métier

- [ ] W1 Re-soumission possible en « Corrections demandées » (NC ouverte contournée)
- [ ] W2 Évaluation clôturée alors que l'audit est seulement planifié
- [ ] W3 Niveau incohérent avec les volets : niveau calculé par l'API, décision par volet
- [ ] W4 Volets et niveau non validés à la création
- [ ] W5 Modifier les volets d'un brouillon ne régénère pas la checklist
- [ ] W6 Date d'audit invalide : erreur 500
- [ ] W7 Suppression d'organisation ou de dossier certifié : erreur 500
- [ ] W8 Affectation et audit possibles sur un dossier certifié
- [ ] W9 Certificat révoqué réactivable : révocation définitive, expiration à 1 an
- [ ] W10 Affectation en double
- [ ] W11 Gravité de non-conformité libre : Mineure, Majeure ou Critique
- [ ] W12 Pièce validée redéposable par l'API
- [ ] W13 Pas de renvoi d'une réponse corrective : renvoi motivé et échéance
- [ ] W14 Dossier refusé sans suite : motif obligatoire, nouvelle demande liée
- [ ] W15 Références de non-conformité en collision : numérotation sous verrou
- [ ] W16 Code mort `can_access_application`
- [ ] W17 Pas de retrait d'affectation
- [ ] W18 Commentaire de refus de pièce figé : commentaire libre, obligatoire pour un refus
- [ ] W19 Date d'audit jamais saisie par l'interface ; compte rendu d'audit figé
- [ ] W20 Type de demande (initiale/renouvellement) et activité perdus

## 3. Synchronisation et accès simultanés

- [ ] C1 Décisions, démarrages, affectations et non-conformités simultanés : une transaction verrouillée par action, messages clairs au lieu de 500
- [ ] C2 Statut enregistré avant la création du certificat : actions atomiques
- [ ] C3 Fichiers orphelins (nouveau dépôt, suppression)
- [ ] C4 Certificat suspendu/révoqué/expiré mais dossier affiché « Certifié »
- [ ] C5 Checklist et règle des niveaux dupliquées entre interface et API : l'API devient la source unique
- [ ] C6 Droits et libellés dupliqués dans l'interface : un seul fichier de libellés, boutons selon les capacités
- [ ] C7 Pas de rafraîchissement : rafraîchissement automatique et bandeau « dossier mis à jour »
- [ ] C8 Pas d'intercepteur 401/403 ; `returnUrl` ignoré ; double appel `/auth/me/`
- [ ] C9 Compteurs en mémoire par processus : cache partagé configurable (Redis)
- [ ] C10 SQLite un seul écrivain : transactions IMMEDIATE, PostgreSQL via `DATABASE_URL`
- [ ] C11 Date d'audit sans fuseau horaire
- [ ] C12 Notifications : e-mails à chaque étape

## 4. Interface et fonctionnalités par rôle

- [ ] F1 Boutons affichés à tous les rôles : affichage selon les capacités et l'état
- [ ] F2 Listes « Affecter » et « Planifier » liées à la même variable
- [ ] F3 Statuts bruts en anglais : libellés français partout
- [ ] F4 Suivi du dossier : étapes fausses pour un dossier certifié ou refusé ; décision, historique et certificat visibles par l'entreprise
- [ ] F5 Lien « Voir le fichier » cassé
- [ ] F6 « Mon entreprise » factice : vraie fiche, membres, invitations
- [ ] F7 « Mes certifications » factice : certificats réels, expiration, renouvellement
- [ ] F8 Pages vides Évaluations, Audits, Non-conformités : vraies listes ; Référentiels éditable ; Formations retirée du menu d'administration
- [ ] F9 Tableau de bord d'administration : compteurs et « à traiter »
- [ ] F10 Liste des dossiers : nom d'entreprise, filtre par statut
- [ ] F11 Utilisateurs : liste et activation/désactivation des comptes
- [ ] F12 Vérification publique des certificats
- [ ] F13 Accès gestionnaire au registre et aux audits ; auditeur aux non-conformités
- [ ] F14 Textes incohérents (page de connexion…)
- [ ] F15 Références lisibles `INPG-AAAA-NNNN`
- [ ] F16 Composants de démonstration morts

## 5. Documentation, tests, déploiement

- [ ] D1 Docs RBAC, inscription, workflow, pages internes à jour
- [ ] D2 Tests backend pour chaque correction (y compris accès simultanés)
- [ ] D3 Tests de bout en bout de l'interface (Playwright)
- [ ] D4 CI GitHub Actions (tests backend, compilation et e2e)
- [ ] D5 Production : PostgreSQL, gunicorn, e-mails, cache, variables documentées
- [ ] D6 `package-lock.json` resynchronisé
- [ ] D7 Modèle UML mis à jour avec les nouvelles règles

## Journal

- 12/10/2026 : audit complet (technique, fonctionnel, synchronisation), décisions validées, création de ce fichier.
