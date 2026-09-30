# Pages internes — 30 septembre 2026

## Pages raccordées au routeur

- `/espace/dossiers/nouveau` : nouvelle composition en sept étapes, trois sections de formulaire, cartes sélectionnables pour les volets, niveau calculé et checklist latérale. Responsive, labels natifs, confirmation accessible via `role=status`.
- `/espace/dossiers/:id` : parcours complet en sept étapes et résumé du dossier. L’absence de raccordement backend est explicitement affichée ; aucun statut, auditeur ou échéance n’est inventé. La référence provient de la route et n’est pas considérée comme validée.

## Limites fonctionnelles

Le brouillon du formulaire est enregistré dans le localStorage de cet appareil sous `inpg.application.draft`. Il n’est pas transmis, ni partagé entre utilisateurs ou appareils. La checklist utilise encore le référentiel local existant ; ses validations fictives ne sont pas affichées. Les autres anciennes pages utilisent encore des données de démonstration et nécessitent un travail séparé de raccordement API.

## Vérifications

Compilation Angular réussie. Serveur local lancé sur `127.0.0.1:4200`. La vérification visuelle de ces deux nouvelles pages n’a pas pu être effectuée : le processus de l’outil navigateur échoue lors de l’application des permissions Windows. Les captures d’accueil présentes dans ce dossier concernent la refonte précédente, pas ces nouveaux écrans.
