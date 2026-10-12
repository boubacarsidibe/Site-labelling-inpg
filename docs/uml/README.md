# Modèle UML StarUML — Plateforme Label INPG

Le fichier **[`label-inpg.mdj`](label-inpg.mdj)** s'ouvre dans StarUML avec *File → Open*. Il contient 10 diagrammes, tous tirés du code réel (`backend/platform_api`, `frontend/src/app`) :

| # | Diagramme | Contenu | Aperçu |
|---|---|---|---|
| 1 | Classes — domaine | 10 classes et 6 énumérations de `models.py`, avec multiplicités, compositions et opérations du workflow (`submit`, `assign`, `decide`…) | [PNG](apercus/01-classes.png) |
| 2 | Cas d'utilisation — portail et espace entreprise | Visiteur, Utilisateur authentifié, Entreprise, Professionnel ; « include » vers la checklist générée par l'API | [PNG](apercus/02-cas-utilisation-portail-entreprise.png) |
| 3 | Cas d'utilisation — back-office INPG | Gestionnaire, Évaluateur, Auditeur, Décideur, Administrateur, Superadministrateur ; « extend » vers l'émission du certificat | [PNG](apercus/03-cas-utilisation-back-office.png) |
| 4 | Hiérarchie des acteurs | Généralisations des rôles RBAC (l'administrateur hérite des quatre rôles métier) | [PNG](apercus/04-hierarchie-acteurs.png) |
| 5 | Séquence — connexion et contrôle d'accès | CSRF, login, limitation des tentatives, capacités, garde de route Angular, fragment `alt` | [PNG](apercus/05-sequence-connexion.png) |
| 6 | Séquence — cycle de certification | De la création du brouillon au certificat, avec les vrais endpoints de l'API ; fragments `loop` et `opt` | [PNG](apercus/06-sequence-certification.png) |
| 7 | États-transitions — dossier | Les 7 statuts de `Application.status` avec événements, gardes et effets | [PNG](apercus/07-etats-dossier.png) |
| 8 | États-transitions — certificat | Valide ↔ Suspendu, puis Révoqué | [PNG](apercus/08-etats-certificat.png) |
| 9 | Activité — processus de certification | 5 couloirs (Entreprise, Gestionnaire, Auditeur, Évaluateur, Décideur), décisions, fork/join | [PNG](apercus/09-activite-certification.png) |
| 10 | Déploiement | Poste utilisateur, serveur d'application (Angular + Django/DRF), stockage (SQLite + fichiers) | [PNG](apercus/10-deploiement.png) |

Tous les diagrammes sont aussi réunis dans [`label-inpg-diagrammes.pdf`](label-inpg-diagrammes.pdf).

## Comment le fichier a été produit

Le modèle est construit avec `metadata-json`, le moteur open source de StarUML (même auteur, même métamodèle). Chaque élément et chaque vue est créé avec les classes de StarUML, puis le moteur calcule la géométrie (tailles, compartiments, ancrages des liens) avant l'écriture du `.mdj`. Les aperçus PNG et PDF sont rendus par ce même moteur.

Le fichier est contrôlé avant livraison : 2 428 éléments, identifiants uniques, toutes les références `$ref` résolues.

Le format suit le métamodèle StarUML 2/3, que StarUML 4 à 6 ouvrent sans conversion. Les diagrammes restent entièrement modifiables : déplacer, renommer, ajouter des éléments.

## Régénérer

```bash
cd docs/uml/outils
npm init -y && npm i metadata-json --ignore-scripts   # le module natif canvas n'est pas nécessaire
node build.js ../label-inpg.mdj                        # construit le modèle
python3 validate.py ../label-inpg.mdj                  # identifiants et références
node render.js ../label-inpg.mdj ../label-inpg-diagrammes.pdf   # aperçu PDF (polices Liberation)
```
