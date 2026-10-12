# Modèle UML StarUML — Plateforme Label INPG

Le fichier **[`label-inpg.mdj`](label-inpg.mdj)** s'ouvre dans StarUML avec *File → Open*. Il contient 10 diagrammes, tous tirés du code réel (mis à jour le 12/10/2026 après les corrections) (`backend/platform_api`, `frontend/src/app`) :

| # | Diagramme | Contenu | Aperçu |
|---|---|---|---|
| 1 | Classes — domaine | 12 classes et 8 énumérations de `models.py` (dont `Invitation`, `RequirementTemplate`, renouvellement et dossier précédent), avec multiplicités, compositions, attributs dérivés (`is_verified`, `effective_status`) et opérations du workflow | [PNG](apercus/01-classes.png) |
| 2 | Cas d'utilisation — portail et espace entreprise | Visiteur (vérification de certificat, invitation), Utilisateur authentifié (mot de passe oublié), Entreprise (invitation de collaborateurs) ; « include » checklist, « extend » renouvellement | [PNG](apercus/02-cas-utilisation-portail-entreprise.png) |
| 3 | Cas d'utilisation — back-office INPG | Vérification des organisations, revue, affectation, audit, non-conformités, décision, registre, référentiels, comptes internes ; « extend » vers l'émission du certificat | [PNG](apercus/03-cas-utilisation-back-office.png) |
| 4 | Hiérarchie des acteurs | Généralisations des rôles RBAC (l'administrateur hérite des quatre rôles métier) | [PNG](apercus/04-hierarchie-acteurs.png) |
| 5 | Séquence — connexion et contrôle d'accès | CSRF, login, limitation des échecs, capacités, garde de route Angular (`alt` 403), session expirée (`opt` 401 et retour à la page) | [PNG](apercus/05-sequence-connexion.png) |
| 6 | Séquence — cycle de certification | Du brouillon au certificat avec les vrais endpoints (vérification de l'organisation, audit daté, NC avec gravité et échéance, décision par volets, e-mails) ; fragments `loop` et `opt` | [PNG](apercus/06-sequence-certification.png) |
| 7 | États-transitions — dossier | Les 7 statuts de `Application.status` avec événements, gardes (organisation vérifiée, audits réalisés…) et effets (niveau calculé, motif de refus) | [PNG](apercus/07-etats-dossier.png) |
| 8 | États-transitions — certificat | Valide ↔ Suspendu ; Révoqué définitif ; Expiré au bout d'un an (statut calculé), renouvellement par un nouveau dossier | [PNG](apercus/08-etats-certificat.png) |
| 9 | Activité — processus de certification | 5 couloirs (Entreprise, Gestionnaire, Auditeur, Évaluateur, Décideur), décisions, fork/join | [PNG](apercus/09-activite-certification.png) |
| 10 | Déploiement | Production : Nginx + gunicorn/Django, PostgreSQL et fichiers, Redis et SMTP ; note sur la configuration de développement | [PNG](apercus/10-deploiement.png) |

Tous les diagrammes sont aussi réunis dans [`label-inpg-diagrammes.pdf`](label-inpg-diagrammes.pdf).

## Comment le fichier a été produit

Le modèle est construit avec `metadata-json`, le moteur open source de StarUML (même auteur, même métamodèle). Chaque élément et chaque vue est créé avec les classes de StarUML, puis le moteur calcule la géométrie (tailles, compartiments, ancrages des liens) avant l'écriture du `.mdj`. Les aperçus PNG et PDF sont rendus par ce même moteur.

Le fichier est contrôlé avant livraison : 2 841 éléments, identifiants uniques, toutes les références `$ref` résolues.

Le format suit le métamodèle StarUML 2/3, que StarUML 4 à 6 ouvrent sans conversion. Les diagrammes restent entièrement modifiables : déplacer, renommer, ajouter des éléments.

## Régénérer

```bash
cd docs/uml/outils
npm init -y && npm i metadata-json --ignore-scripts   # le module natif canvas n'est pas nécessaire
node build.js ../label-inpg.mdj                        # construit le modèle
python3 validate.py ../label-inpg.mdj                  # identifiants et références
node render.js ../label-inpg.mdj ../label-inpg-diagrammes.pdf   # aperçu PDF (polices Liberation)
```
