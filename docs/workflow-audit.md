# Workflow de demande — cycle complet

Le workflow nominal est exercé dans une base Django temporaire avec les rôles Entreprise, Gestionnaire, Évaluateur, Auditeur et Décideur. Ce document décrit le contrat à maintenir ; le résultat courant doit toujours être confirmé par la suite automatisée.

| Étape | Rôle | Résultat |
|---|---|---|
| Créer un brouillon | Entreprise rattachée | Fonctionne (`DRAFT`) |
| Soumettre le dossier | Entreprise | Fonctionne si toutes les pièces obligatoires sont déposées ou déjà validées (`SUBMITTED`) |
| Affecter un évaluateur | Gestionnaire | Fonctionne |
| Planifier un auditeur avec une date future | Gestionnaire | Fonctionne |
| Lire un dossier affecté | Évaluateur / Auditeur | Fonctionne |
| Lire le dossier | Décideur | Fonctionne |
| Déposer une pièce et faire valider la pièce | Entreprise / Gestionnaire | Fonctionne |
| Démarrer / terminer une évaluation | Gestionnaire / Évaluateur | Fonctionne |
| Planifier un audit daté / consigner sa réalisation | Gestionnaire / Auditeur affecté | Fonctionne |
| Demander une correction et répondre | Évaluateur ou auditeur / Entreprise | Fonctionne |
| Valider une correction | Évaluateur ou auditeur | Fonctionne |
| Préparer et rendre une décision | Décideur | Fonctionne |
| Générer le certificat | Décideur | Fonctionne après décision favorable |

Le modèle de statut couvre `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `CORRECTION_REQUIRED`, `DECISION_PENDING`, `CERTIFIED` et `REJECTED`. Chaque transition journalise un évènement avec son acteur et une note éventuelle. Les actions sensibles restent soumises à la capacité et, selon le rôle, à l'affectation du dossier ; l'interface ne fait pas autorité.

Le test automatisé `platform_api.test_workflow_smoke.CurrentWorkflowSmokeTest` parcourt le cycle complet : dépôt, validation, soumission, affectation, évaluation, audit, correction, décision et certificat. Il doit utiliser un stockage temporaire en plus de la base de test isolée afin de ne jamais écrire dans `backend/media/`.

Les cas négatifs et contrôles complémentaires sont listés dans [validation.md](validation.md), notamment l'impossibilité de contourner une correction, l'expiration publique, l'atomicité de la décision et la confidentialité des fichiers.
