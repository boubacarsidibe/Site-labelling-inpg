# Checklist de validation

Cette checklist évite de figer un nombre de tests : la suite doit découvrir et exécuter tous les tests présents au moment de la livraison.

## Contrôles automatisés

Depuis la racine du dépôt :

```powershell
# Cohérence du schéma et migrations applicables
.\backend\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
.\backend\.venv\Scripts\python.exe backend\manage.py migrate --plan

# Suite backend complète
.\backend\.venv\Scripts\python.exe backend\manage.py test platform_api

# Contrôles de déploiement (avec les variables de production injectées)
.\backend\.venv\Scripts\python.exe backend\manage.py check --deploy

# Contrôle TypeScript et compilation frontend
Set-Location frontend
npm test
npm run build
```

`npm test` exécute le contrôle de compilation TypeScript/Angular sans émission de fichiers. `npm run build` vérifie ensuite le bundle de production. Ces contrôles ne remplacent pas encore une suite E2E navigateur.

## Scénarios métier à couvrir

- un utilisateur anonyme ne peut lire ni dossier, ni justificatif, ni notification ;
- une entreprise ne voit que son organisation, ses dossiers, ses certificats et ses inscriptions ;
- une affectation n'accorde l'accès qu'aux rôles prévus et aux dossiers concernés ;
- chaque transition de dossier refuse un statut source invalide et journalise l'acteur ;
- une correction ouverte ne peut pas être contournée par une nouvelle soumission ;
- le changement d'activité ou de volets recalcule la checklist sans exposer de document hors périmètre ;
- la décision et la création du certificat sont atomiques ;
- un certificat expiré n'est pas présenté comme valide ;
- les téléchargements PDF et justificatifs appliquent les mêmes règles d'accès que l'API ;
- les fichiers refusés par type, signature ou taille ne sont pas conservés ;
- les inscriptions aux formations respectent leurs transitions et leur propriétaire.

## Vérifications manuelles

- navigation au clavier, focus visible et textes lisibles aux largeurs mobile, tablette et bureau ;
- absence de débordement horizontal et de contenu coupé sur les pages publiques et authentifiées ;
- affichage explicite des erreurs réseau et des listes réellement vides ;
- retour vers l'URL initialement demandée après connexion ;
- cohérence des menus avec les capacités renvoyées par `/api/v1/auth/me/` ;
- vérification publique d'un certificat actif, expiré, révoqué et inconnu ;
- lisibilité du PDF avec accents et textes longs, et correspondance du QR avec l'URL de vérification.

## Hygiène avant livraison

```powershell
git status --short
git ls-files --others --exclude-standard
```

Les migrations et tout composant importé par le routeur doivent être versionnés. Les bases SQLite, fichiers déposés, environnements virtuels, sorties de compilation et captures temporaires doivent rester ignorés. Ne supprimez jamais un fichier non suivi sans avoir confirmé qu'il n'appartient pas à un autre travail en cours.
