# Inscription et comptes

L'inscription publique et le provisionnement des comptes internes sont deux parcours séparés.

## Inscription publique

Les liens `/inscription` et `/connexion` restent distincts. L'inscription publique accepte uniquement les profils Entreprise et Professionnel : aucun champ transmis par le navigateur ne permet d'obtenir un rôle interne ou un statut de superutilisateur.

- Une entreprise nouvellement inscrite obtient sa propre organisation.
- Un NINEA déjà enregistré ne rattache jamais automatiquement un nouveau compte à l'organisation existante.
- La déclaration saisie lors de l'inscription ne vaut pas vérification de l'identité juridique.
- Un professionnel n'obtient aucun droit sur les organisations ou dossiers de certification.
- Aucun compte par défaut ni mot de passe partagé n'est créé par le projet.

## Comptes internes

Les comptes internes ne disposent d'aucune inscription publique. Un superutilisateur les crée via `POST /api/v1/admin/accounts/` avec `username`, `email`, `password` et l'un des rôles autorisés : `MANAGER`, `EVALUATOR`, `AUDITOR` ou `DECISION_MAKER`. La protection CSRF s'applique. L'endpoint ne permet de créer ni un administrateur, ni un superutilisateur.

Le premier superutilisateur est créé de façon interactive sur le serveur :

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
```

La commande `set_role` sert uniquement aux opérations explicitement prévues par sa propre liste de rôles ; elle ne doit pas contourner le provisionnement ou la séparation des responsabilités. Après toute création ou modification de compte, vérifier les capacités réellement renvoyées par `/api/v1/auth/me/`.

## Cycle de vie

La création d'un compte n'est qu'une étape du contrôle d'accès. L'exploitation doit aussi prévoir la vérification de l'adresse électronique si elle est requise, la désactivation, la révocation des affectations, la rotation des mots de passe et la traçabilité des changements de rôle. Désactiver un compte (`is_active=False`) révoque son accès dès les requêtes suivantes.
