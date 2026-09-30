# Inscription et comptes internes

Deux liens distincts dans l’en-tête : `/inscription` et `/connexion`.

Inscription publique : uniquement Entreprise et Professionnel. Un professionnel ne possède aucun droit sur les dossiers ou organisations. Une entreprise nouvellement inscrite obtient sa propre organisation ; un NINEA existant ne permet jamais de rejoindre une entreprise sans intervention administrative. La déclaration d’entreprise n’est pas une vérification de son identité juridique. La vérification d’e-mail et le module de formation ne sont pas encore implémentés.

Les comptes internes (administrateur, gestionnaire, évaluateur, auditeur, décideur) sont créés exclusivement par un superutilisateur connecté via `POST /api/v1/admin/accounts/`, avec `username`, `email`, `password` et `role`. La protection CSRF s’applique. Aucun champ envoyé ne permet de créer un nouveau superutilisateur. Un administrateur ordinaire reçoit 403. Aucune inscription publique administrative n’existe.

Le superutilisateur initial se crée par la commande interactive Django `manage.py createsuperuser` sur le serveur. Aucun compte par défaut n’est créé. La commande `set_role` est désormais réservée aux profils Entreprise/Professionnel : l’ancien exemple EVALUATOR de `rbac.md` est remplacé par ce parcours superutilisateur. L’interface de création des comptes internes reste à construire ; l’endpoint est disponible et testé.
