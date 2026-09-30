# Plateforme Label INPG

Plateforme de labellisation de l’Institut National du Pétrole et du Gaz (INPG), destinée aux entreprises de la filière pétrolière et gazière ainsi qu’aux professionnels en formation.

## Fonctionnalités

- Portail public : Label INPG, démarche, acteurs et formations.
- Espace entreprise : création de demande, dépôt des documents, suivi des non-conformités et des décisions.
- Back-office : revue des dossiers, affectation, audit, corrections, décision et registre des certificats.
- RBAC : entreprise, professionnel, gestionnaire, évaluateur, auditeur, décideur, administrateur et superadministrateur.
- Certifications entreprise : Labels `Standard`, `Gold` et `Platinum`.

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

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000 --noreload
```

### Interface Angular

Dans un second terminal :

```powershell
cd frontend
npm install
npm start -- --host 127.0.0.1
```

L’interface est disponible sur `http://127.0.0.1:4200` et l’API sur `http://127.0.0.1:8000`.

## Vérifications

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe manage.py test platform_api

# Frontend
cd frontend
npm run build
```

## Documentation

- [Parcours et inscriptions](docs/inscription.md)
- [RBAC](docs/rbac.md)
- [Workflow et audit](docs/workflow-audit.md)
- [User stories](docs/user-stories.md)
- [Guide de contribution](CONTRIBUTING.md)

## Sécurité

Ne versionnez jamais de mots de passe, clés API, fichiers `.env`, base locale SQLite, fichiers déposés ou dépendances installées. Consultez [SECURITY.md](SECURITY.md) avant de signaler une vulnérabilité.
