# Modèle UML — Plateforme Label INPG

Le fichier principal est [`label-inpg-complet-final.mdj`](label-inpg-complet-final.mdj). Il s'ouvre directement dans StarUML 7 avec `File > Open` (`Ctrl+O`) et contient un modèle natif modifiable, pas seulement des images.

Le modèle a été aligné sur le code Django/Angular et la documentation du dépôt le 13 octobre 2026. Le serveur reste l'autorité pour les rôles, le périmètre des objets et les transitions de workflow.

## Contenu du projet StarUML

57 diagrammes, regroupés dans le `Model Explorer` par perspective.

| Diagramme | Vue fournie |
|---|---|
| `UC-00` | hiérarchie des acteurs et généralisations des rôles |
| `UC-01` | portail public |
| `UC-02` | espace entreprise et gestion du dossier |
| `UC-03` | espace professionnel et formations |
| `UC-04` | instruction, évaluation et audit |
| `UC-05` | décision et cycle du certificat |
| `UC-06` | administration et comptes internes |
| `DM-01` | vue globale simplifiée du domaine |
| `DM-02` | identités, rôles, organisations et affectations |
| `DM-03` | dossier, référentiel documentaire et traçabilité |
| `DM-04` | audit, non-conformités et certificat |
| `DM-05` | messages et notifications |
| `DM-06` | formations et inscriptions |
| `DM-07` | énumérations (`TextChoices`) et référentiels de `catalog.py` |
| `OBJ-01` | diagramme d'objets : exemple de dossier certifié Gold |
| `SM-01` | cycle de vie d'un dossier de certification |
| `SM-02` | cycle de vie d'un certificat |
| `SM-03` | cycle de vie d'une pièce justificative |
| `SM-04` | cycle de vie d'une non-conformité |
| `SM-05` | cycle de vie d'un audit |
| `SM-06` | cycle de vie d'une inscription à une formation |
| `ACT-01` | activité complète de labellisation avec couloirs d'acteurs |
| `ACT-02` | inscription publique d'un compte |
| `ACT-03` | contrôles du dépôt sécurisé d'un justificatif |
| `ACT-04` | autorisation d'une requête API (session, capacité, périmètre, état) |
| `SEQ-01` | scénario nominal de certification |
| `SEQ-02` | demande, réponse et validation d'une correction |
| `SEQ-03` | authentification par session et protection CSRF |
| `SEQ-04` | vérification publique d'un certificat |
| `SEQ-05` | création d'un dossier et génération de la checklist |
| `SEQ-06` | contrôle documentaire et démarrage de la revue |
| `SEQ-07` | affectation, planification et réalisation d'un audit |
| `SEQ-08` | décision favorable et émission du certificat |
| `SEQ-09` | décision de rejet |
| `SEQ-10` | suspension, réactivation ou révocation |
| `SEQ-11` | inscription à une formation |
| `SEQ-12` | création d'un compte interne |
| `SEQ-13` | évènement métier et notifications |
| `SEQ-14` | messagerie liée au dossier |
| `SEQ-15` | inscription publique d'un compte |
| `SEQ-16` | dépôt sécurisé d'un justificatif |
| `SEQ-17` | rejet d'une pièce et reprise du dossier |
| `ARC-01` | vue d'ensemble technique et flux principal |
| `ARC-02` | modules du frontend Angular |
| `ARC-03` | services du backend Django |
| `ARC-04` | déploiement logique cible |
| `ARC-05` | chaîne de sécurité et contrôles RBAC |
| `PKG-01` | packages du frontend |
| `PKG-02` | points d'entrée du backend |
| `PKG-03` | domaine et persistance backend |
| `CLS-01` | contrôleurs du workflow (`ApplicationViewSet`, `RequiredDocumentViewSet`, `CertificateViewSet`) |
| `CLS-02` | contrôleurs de référentiel, formation et communication |
| `CLS-03` | sécurité, authentification et comptes |
| `CLS-04` | sérialiseurs de l'API |
| `CLS-05` | noyau du frontend Angular (service d'authentification, gardes, routes) |
| `ERD-01` | schéma relationnel : identités, organisations et dossiers |
| `ERD-02` | schéma relationnel : instruction, certificat, communication et formations |

Les diagrammes `ERD-*` utilisent l'extension ERD intégrée à StarUML : tables, colonnes, clés primaires et étrangères, cardinalités.

## Sources PlantUML

Les fichiers `.puml` restent disponibles comme sources textuelles versionnables et comme solution de secours :

| Fichier | Objectif |
|---|---|
| `01-cas-utilisation.puml` | services rendus à chaque acteur |
| `02-modele-domaine.puml` | entités métier et cardinalités |
| `03-cycle-vie-dossier.puml` | états autorisés d'un dossier |
| `04-activite-certification.puml` | processus complet de labellisation |
| `05-sequence-certification.puml` | échanges du scénario nominal |
| `06-composants.puml` | découpage Angular, Django REST et persistance |
| `07-deploiement.puml` | cible de déploiement logique |
| `08-packages.puml` | organisation du code |
| `09-sequence-correction.puml` | boucle de traitement des non-conformités |
| `10-sequence-authentification.puml` | session, CSRF, connexion et déconnexion |
| `11-cycle-vie-certificat.puml` | validité, suspension, révocation et expiration |
| `12-securite-rbac.puml` | chaîne d'autorisation et traçabilité |

## Régénération

Après une modification importante du domaine ou des workflows, mettre à jour `generate-staruml.js`, puis exécuter depuis la racine du dépôt :

```powershell
node docs/uml/generate-staruml.js
```

Le générateur vérifie l'unicité des identifiants, l'intégrité des références et le nombre de diagrammes avant d'écrire le fichier `.mdj`.

Les images de [`exports/`](exports/) se régénèrent avec la ligne de commande de StarUML (sous PowerShell, la variable `ELECTRON_RUN_AS_NODE` définie par VS Code doit être retirée) :

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "C:\Program Files\StarUML\StarUML.exe" image docs\uml\label-inpg-complet-final.mdj -f png -o "docs\uml\exports\<%=filenamify(element.name)%>.png"
```

## Règles d'interprétation

- Le Décideur rend la décision métier et gère le statut des certificats. Le rôle ADMIN n'a ni `decisions.make` ni `certificates.manage` ; seul le superutilisateur les reçoit en secours.
- L'ordre réel du workflow est : dépôt → soumission → contrôle documentaire → `start-review` → affectation et audit → corrections → `complete-evaluation` → `decide`. Le rejet d'une pièce fait passer un dossier SUBMITTED ou UNDER_REVIEW en CORRECTION_REQUIRED.
- `EXPIRED` est un statut calculé du certificat à partir de `expires_at`, pas une valeur stockée dans `Certificate.status`.
- Les choix de reverse proxy, SGBD de production et stockage distribué restent des décisions d'infrastructure à confirmer avant mise en service.
- Les diagrammes reflètent l'implémentation observée ; les écrans visibles sans API complète ne suffisent pas à déclarer une fonctionnalité terminée.
