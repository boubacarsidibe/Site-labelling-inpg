# Test du workflow de demande — cycle complet

Test exécuté dans une base Django temporaire le 30 septembre 2026, avec les rôles Entreprise, Gestionnaire, Évaluateur, Auditeur et Décideur.

| Étape | Rôle | Résultat |
|---|---|---|
| Créer un brouillon | Entreprise rattachée | Fonctionne (`DRAFT`) |
| Soumettre le dossier | Entreprise | Fonctionne seulement si les pièces requises sont déjà `VALIDATED` (`SUBMITTED`) |
| Affecter un évaluateur/auditeur | Gestionnaire | Fonctionne |
| Lire un dossier affecté | Évaluateur / Auditeur | Fonctionne |
| Lire le dossier | Décideur | Fonctionne |
| Déposer une pièce et faire valider la pièce | Entreprise / Gestionnaire | Fonctionne |
| Démarrer / terminer une évaluation | Gestionnaire / Évaluateur | Fonctionne |
| Planifier ou consigner un audit | Gestionnaire / Auditeur | Fonctionne |
| Demander une correction et répondre | Évaluateur ou auditeur / Entreprise | Fonctionne |
| Valider une correction | Évaluateur ou auditeur | Fonctionne |
| Préparer et rendre une décision | Décideur | Fonctionne |
| Générer le certificat | Décideur | Fonctionne après décision favorable |

Le modèle de statut couvre désormais `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `CORRECTION_REQUIRED`, `DECISION_PENDING`, `CERTIFIED` et `REJECTED`. Chaque transition journalise un évènement avec son acteur et une note éventuelle. Le superutilisateur, qui porte le rôle `ADMIN`, peut exécuter toutes les transitions sans affectation préalable.

Le test automatisé `platform_api.test_workflow_smoke.CurrentWorkflowSmokeTest` parcourt le cycle complet : dépôt, validation, soumission, affectation, évaluation, audit, correction, décision et certificat. Il utilise des fichiers temporaires et une base de test isolée.
