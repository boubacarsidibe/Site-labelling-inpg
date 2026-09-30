# Contribution

## Règles de travail

1. Créez une branche descriptive depuis `main`.
2. Gardez une modification centrée sur une user story ou une correction.
3. Exécutez les tests Django et la compilation Angular avant toute proposition.
4. Ne commitez ni secrets, ni base SQLite, ni répertoires `node_modules`.

## Conventions

- Interface et messages utilisateur en français.
- Les autorisations passent par les capacités RBAC ; ne contournez pas les guards frontend par une logique UI.
- Toute transition du workflow doit être historisée côté backend.
- Les certificats sont émis uniquement après décision autorisée.

## Commandes de contrôle

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test platform_api

cd ..\frontend
npm run build
```
