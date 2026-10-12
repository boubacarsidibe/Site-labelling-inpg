# Workflow de certification et règles métier

## Étapes du dossier

| Statut | Qui agit | Pour passer à l'étape suivante |
|---|---|---|
| Brouillon (`DRAFT`) | Entreprise | Pièces obligatoires déposées **et validées** par le gestionnaire, organisation vérifiée → **Soumettre** |
| Soumis (`SUBMITTED`) | Gestionnaire | **Démarrer l'évaluation** ; affecter un ou plusieurs évaluateurs |
| En évaluation (`UNDER_REVIEW`) | Gestionnaire, évaluateur, auditeur | Audit planifié (date obligatoire) puis compte rendu par l'auditeur ; non-conformités éventuelles |
| Corrections demandées (`CORRECTION_REQUIRED`) | Entreprise puis évaluateur | L'entreprise répond à chaque écart ; l'évaluateur clôture ou renvoie avec motif. Toutes clôturées → retour en évaluation |
| En décision (`DECISION_PENDING`) | Décideur | Accessible quand aucune non-conformité n'est ouverte, aucun audit n'est en attente et toutes les pièces sont validées |
| Certifié (`CERTIFIED`) / Refusé (`REJECTED`) | — | États finaux |

Chaque action est journalisée (acteur, date, note), affichée dans l'historique et notifiée par e-mail aux personnes concernées (entreprise, intervenants affectés).

## Règles

- **Référence** lisible `INPG-AAAA-NNNN`, unique, attribuée à la création.
- **Checklist** : calculée par l'API à partir des référentiels (volet + activité), éditables par l'administrateur. Les dossiers existants ne sont pas modifiés rétroactivement ; un brouillon est resynchronisé à chaque modification.
- **Pièces** : refuser une pièce exige un commentaire ; l'entreprise remplace alors le fichier. En phase de corrections, une pièce peut être remplacée pour apporter une preuve.
- **Non-conformités** : gravité (mineure, majeure, critique), échéance (30 jours par défaut), signalée en retard une fois dépassée ; un renvoi exige un motif visible par l'entreprise.
- **Décision** : le décideur coche les volets accordés parmi ceux demandés ; le niveau en découle (1 = Standard, 2 = Gold, 3 = Platinum). Un refus exige un motif, communiqué à l'entreprise, qui peut déposer une **nouvelle demande liée** au dossier refusé.
- **Certificat** : numéro `CERT-INPG-…`, valable **un an**, statut « Expiré » automatique à l'échéance. L'administrateur peut le suspendre, le réactiver, ou le **révoquer définitivement** (un certificat révoqué ou expiré ne peut plus redevenir valide). Le renouvellement se fait par une demande de type « Renouvellement » liée au certificat.
- **Vérification publique** : `/verification-certificat?numero=…` indique l'entreprise, le niveau, les volets, les dates et la validité à ce jour.

## Concurrence et synchronisation

Toutes les transitions s'exécutent en transaction avec verrou (`select_for_update`) et revérifient le statut sous verrou : une double soumission, deux décisions simultanées ou une action sur un dossier modifié entre-temps sont refusées proprement (400, avec un message invitant à actualiser la page) au lieu de produire une erreur 500 ou un état incohérent. Les écrans se rafraîchissent toutes les 30 s et affichent un bandeau lorsque le dossier a été modifié par quelqu'un d'autre.

## Tests

- `platform_api.test_workflow_smoke` : cycle complet par l'API.
- `platform_api.test_corrections` : une ou plusieurs vérifications par règle ci-dessus, dont l'accès simultané (PostgreSQL).
- `frontend/e2e/workflow.spec.ts` : le même parcours dans le navigateur, avec cinq acteurs dans des sessions séparées.
