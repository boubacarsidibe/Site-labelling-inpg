# Plateforme Label INPG

Plateforme de labellisation de l’Institut National du Pétrole et du Gaz (INPG), destinée aux entreprises de la filière pétrolière et gazière ainsi qu’aux professionnels en formation.

## Fonctionnalités

- Portail public : Label INPG, démarche, acteurs et formations.
- Portail public : vérification d’un certificat par son numéro.
- Espace entreprise : fiche entreprise et collaborateurs invités, demandes (initiale ou renouvellement), dépôt des pièces, réponses aux non-conformités, décisions et certificats.
- Back-office : tableau de bord « à traiter », vérification des entreprises, revue des pièces, affectation, audit, non-conformités avec échéances, décision par volet, registre des certificats (suspension, révocation, expiration), référentiels éditables et comptes internes.
- Synchronisation : actions verrouillées côté serveur, rafraîchissement automatique des écrans (30 s) et notifications par e-mail.
- RBAC : entreprise, professionnel, gestionnaire, évaluateur, auditeur, décideur, administrateur et superadministrateur.
- Certifications entreprise : Labels `Standard`, `Gold` et `Platinum` selon le nombre de volets accordés ; certificat valable un an.

## Architecture

| Dossier | Rôle |
|---|---|
| `frontend/` | Application Angular 18 |
| `backend/` | API Django REST Framework |
| `docs/` | User stories, RBAC et documentation du workflow |

## Démarrage local

### Prérequis

- Node.js 20 ou supérieur
- Python 3.12 ou supérieur

### API Django

Le mode développement doit être activé explicitement (`DJANGO_DEBUG=1`) : sans lui, l'API démarre en configuration de production et exige `DJANGO_SECRET_KEY`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DJANGO_DEBUG = "1"
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

Sous Linux/macOS : `export DJANGO_DEBUG=1` au lieu de `$env:DJANGO_DEBUG = "1"`.

Pour essayer tout de suite : `python manage.py seed_demo` crée un compte par rôle (`admin`, `entreprise`, `gestionnaire`, `evaluateur`, `auditeur`, `decideur`, mot de passe `Demo-Label2026!`, développement uniquement).

Le superutilisateur crée ensuite les comptes internes (gestionnaire, évaluateur, auditeur, décideur, administrateur) depuis **Administration → Utilisateurs**. En développement, les e-mails (notifications, invitations, réinitialisation de mot de passe) s'affichent dans la console du serveur.

### Interface Angular

Dans un second terminal :

```powershell
cd frontend
npm ci
npm start -- --host 127.0.0.1
```

L’interface est disponible sur `http://127.0.0.1:4200` ; le proxy Angular relaie `/api` vers `http://127.0.0.1:8000`.

## Vérifications

```powershell
# Backend : 78 tests (SQLite par défaut ; DATABASE_URL pour PostgreSQL, où le test d'accès simultanés s'exécute aussi)
cd backend
python manage.py test platform_api

# Frontend : compilation
cd frontend
npm run build

# Bout en bout : démarre une API et une interface jetables (ports 8100 et 4300), 22 scénarios
npx playwright install chromium   # une seule fois
npm run e2e
```

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute ces trois étapes, les tests backend sur PostgreSQL 16.

## Mise en production

| Variable | Rôle | Défaut |
|---|---|---|
| `DJANGO_DEBUG` | `1` en développement uniquement | `0` |
| `DJANGO_SECRET_KEY` | Clé secrète aléatoire, obligatoire si `DJANGO_DEBUG=0` | — |
| `DJANGO_ALLOWED_HOSTS` | Domaines servis, séparés par des virgules | `127.0.0.1,localhost` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Origines HTTPS de l'interface | — |
| `DATABASE_URL` | PostgreSQL, ex. `postgres://user:pass@hôte:5432/inpg` | SQLite local |
| `DJANGO_REDIS_URL` | Cache partagé (limitation des tentatives entre plusieurs processus) ; nécessite `pip install redis` | mémoire du processus |
| `DJANGO_MEDIA_ROOT` | Dossier des pièces déposées (hors de la racine web) | `backend/media` |
| `DJANGO_NUM_PROXIES` | Nombre de proxys de confiance devant l'API (Nginx = 1) | aucun |
| `FRONTEND_URL` | Adresse publique de l'interface, utilisée dans les liens des e-mails | `http://127.0.0.1:4200` |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | Serveur SMTP ; sans `EMAIL_HOST`, e-mails écrits dans la console | console |
| `DJANGO_DEFAULT_FROM_EMAIL` | Expéditeur des e-mails | `Label INPG <no-reply@inpg.sn>` |
| `DJANGO_HSTS_SECONDS`, `DJANGO_SSL_REDIRECT` | HTTPS strict et redirection | 1 an, `1` |

Exemple :

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py check --deploy
gunicorn config.wsgi --bind 127.0.0.1:8001 --workers 3
cd ../frontend && npm ci && npm run build   # servir dist/label-inpg-frontend/browser par Nginx
```

Nginx sert l'interface compilée et relaie `/api/` vers gunicorn. Les pièces déposées ne sont jamais servies directement : elles passent par `/api/v1/documents/<id>/download/`, qui contrôle les droits.

## Documentation

- [Parcours et inscriptions](docs/inscription.md)
- [RBAC](docs/rbac.md)
- [Workflow et règles métier](docs/workflow-audit.md)
- [Pages de l’interface](docs/design/pages-internes.md)
- [Suivi des corrections](docs/corrections/SUIVI.md)
- [Diagrammes UML (StarUML)](docs/uml/)
- [User stories](docs/user-stories.md)
- [Guide de contribution](CONTRIBUTING.md)

## Sécurité

Ne versionnez jamais de mots de passe, clés API, fichiers `.env`, base locale SQLite, fichiers déposés ou dépendances installées. Consultez [SECURITY.md](SECURITY.md) avant de signaler une vulnérabilité.
