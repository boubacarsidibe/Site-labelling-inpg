# API Label INPG

API Django REST Framework de la plateforme Label INPG. Elle porte l'authentification de session, le RBAC, les organisations, demandes, justificatifs, évaluations, audits, corrections, décisions, certificats, formations, référentiels, messages et notifications.

## Démarrage local

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000 --noreload
```

Le serveur de développement sert uniquement à un usage local. Consultez [la documentation de déploiement](../docs/deployment.md) et [la checklist de validation](../docs/validation.md) avant toute mise en production.

## Vérifications

```powershell
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py test platform_api
```

Les fichiers de migration font partie du code source : une migration appliquée localement mais absente de la livraison rend le schéma impossible à reproduire.
