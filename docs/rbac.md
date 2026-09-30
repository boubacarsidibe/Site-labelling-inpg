# RBAC — Label INPG

## Matrice appliquée

| Rôle | Visibilité | Actions sur l’API existante |
|---|---|---|
| Entreprise | Son organisation et ses dossiers uniquement | Modifier son organisation ; créer et modifier ses brouillons ; soumettre un dossier complet |
| Gestionnaire | Toutes les organisations et tous les dossiers | Lecture ; affecter des évaluateurs/auditeurs |
| Évaluateur | Dossiers explicitement affectés | Lecture uniquement |
| Auditeur | Dossiers explicitement affectés | Lecture uniquement |
| Décideur | Tous les dossiers | Lecture uniquement |
| Administrateur | Toutes les organisations et tous les dossiers | CRUD, affectation et soumission, sous réserve des règles métier |
| Sans rôle / anonyme | Aucun accès métier | Portail public uniquement |

Les permissions de menus `evaluations.read`, `audits.read`, `decisions.read`, `users.manage` et `referentials.manage` préparent les écrans concernés. Elles ne créent pas d’API d’évaluation, de décision ou d’administration des utilisateurs : ces fonctionnalités restent à développer. Un compte `is_staff` seul ne reçoit aucun droit. Un superutilisateur Django est administrateur.

Les rôles constituent une base conservatrice à valider avec les responsables INPG. Les entreprises sans rattachement sont refusées. Les dossiers historiques restent inaccessibles aux entreprises tant qu’un administrateur n’a pas établi le rattachement réel ; aucune attribution automatique n’est effectuée.

## Connexion et protections

- `/api/v1/auth/csrf/`, `login/`, `me/`, `logout/` ; sessions Django, cookie HttpOnly, protection CSRF y compris à la connexion et déconnexion.
- Pas de JWT ni de rôle stocké comme autorité dans le navigateur ; les capacités sont relues depuis le serveur à la navigation.
- Chaque endpoint métier vérifie ses capacités et filtre son queryset pour toutes les actions, listes et documents imbriqués inclus. Un identifiant hors périmètre produit 404.
- L’entreprise ne peut ni transférer un dossier ni modifier son statut via PATCH. Seuls les brouillons sont modifiables ; une soumission vide ou répétée est refusée.
- Les affectations ne confèrent pas de droit à un compte inactif ou sans rôle autorisé.
- Le brouillon local Angular est désormais séparé par identifiant de compte. Ce stockage reste local, non chiffré et ne constitue pas une frontière de sécurité sur un ordinateur partagé. L’ancien brouillon global est conservé mais n’est plus chargé.

## Exploitation locale

Depuis `backend` :

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Depuis `frontend` : `npm start -- --host 127.0.0.1 --port 4200`.
Le proxy Angular relaie `/api` vers le backend. Ouvrir `/connexion`. Aucun compte ni mot de passe partagé n’est créé automatiquement.

Les comptes métier sont provisionnés par un opérateur autorisé via Django (`create_user`, avec un mot de passe saisi de manière sécurisée, jamais commité). Attribution depuis le serveur :

```powershell
.\.venv\Scripts\python.exe manage.py set_role identifiant ENTERPRISE --organization 1
.\.venv\Scripts\python.exe manage.py set_role identifiant EVALUATOR
```

Le changement de rôle supprime les anciennes affectations de ce compte pour éviter un accès résiduel. Le superutilisateur ne peut pas être rétrogradé par cette commande. Pour révoquer un accès, désactiver le compte (`is_active=False`) ou supprimer son `AccessProfile` via une opération d’administration contrôlée. La révocation est effective dès la requête suivante.

`POST /api/v1/applications/<id>/assign/` avec `{"user_id": 12}` est réservé aux gestionnaires et administrateurs. La cible doit être un évaluateur/auditeur actif. Il n’existe pas encore d’interface de gestion des affectations ou des comptes.

## Vérifications et limites

17 tests Django : accès anonyme/sans rôle, isolation entreprise, IDOR, création et transfert, matrice lecture/écriture, affectations, révocation, CSRF, déconnexion, compte inactif et limitation des tentatives. Compilation Angular vérifiée ; tests navigateur non effectués (outil bloqué par les permissions Windows).

Les anciennes pages contiennent encore des données de démonstration : le RBAC ne signifie pas que leur raccordement métier est terminé. Les APIs absentes devront réutiliser la politique de refus par défaut et obtenir leurs propres tests.

Avant production : `DJANGO_DEBUG=0`, secret aléatoire `DJANGO_SECRET_KEY`, domaines et origines autorisés explicites, HTTPS, cache partagé pour le throttling, gestion du cycle de vie des comptes et journal d’audit. La limite de connexion locale (10 tentatives/minute/IP) n’est pas une protection distribuée suffisante. Ce travail n’est pas un audit de sécurité complet.

Références : [permissions DRF](https://www.django-rest-framework.org/api-guide/permissions/) et [authentification de session](https://www.django-rest-framework.org/api-guide/authentication/).
