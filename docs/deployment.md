# Déploiement et configuration

Ce document décrit les prérequis minimaux pour un environnement autre que le poste de développement. Les valeurs sensibles doivent être injectées par le gestionnaire de secrets ou le service qui lance Django ; elles ne doivent jamais être commitées.

## Variables d'environnement

| Variable | Production | Rôle |
|---|---|---|
| `DJANGO_DEBUG` | `0` | Désactive le mode de développement et active les protections HTTPS configurées par le projet. |
| `DJANGO_SECRET_KEY` | obligatoire | Secret long, aléatoire et propre à l'environnement. |
| `DJANGO_ALLOWED_HOSTS` | obligatoire | Liste séparée par des virgules des noms d'hôte servis. |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | obligatoire si nécessaire | Origines HTTPS complètes, séparées par des virgules. |
| `MAX_APPLICATION_UPLOAD_BYTES` | recommandée | Quota total de justificatifs par entreprise, en octets. |
| `PUBLIC_CERTIFICATE_VERIFICATION_URL` | obligatoire | URL publique contenant `{number}`, encodée dans le QR du certificat. |

Le fichier [`.env.example`](../.env.example) sert de modèle de configuration. Django ne le charge pas automatiquement : les variables doivent être injectées par le système d'exploitation, le conteneur ou le gestionnaire de processus.

## Préparation d'une version

1. Sauvegarder la base de données et les fichiers déposés.
2. Installer les dépendances avec des versions contrôlées.
3. Vérifier que toutes les migrations présentes dans le dépôt sont incluses dans la version, puis exécuter `python manage.py migrate`.
4. Compiler l'interface avec `npm run build` et servir les fichiers produits depuis un serveur web adapté.
5. Exécuter les contrôles décrits dans [validation.md](validation.md).

## HTTPS et fichiers déposés

- Terminer TLS sur un reverse proxy ou une plateforme de déploiement maîtrisée et transmettre correctement le protocole d'origine à Django.
- Ne pas utiliser `manage.py runserver` en production.
- Ne pas publier directement `backend/media/` comme un répertoire statique. Les justificatifs d'entreprise doivent rester derrière un endpoint authentifié qui vérifie le rôle et le périmètre du dossier.
- Limiter la taille des requêtes au niveau du reverse proxy en cohérence avec la limite applicative.
- Prévoir une politique de sauvegarde, de rétention et de suppression des documents métier.

## Base de données et montée en charge

SQLite convient au développement local, pas à une exploitation multi-instance. La cible de production doit utiliser une base transactionnelle administrée et une configuration Django dédiée avant mise en service. Les mécanismes partagés tels que cache, limitation de débit et stockage de fichiers doivent eux aussi être adaptés à plusieurs processus.

## Contrôle Django de production

Depuis `backend`, avec les variables de production injectées :

```powershell
.\.venv\Scripts\python.exe manage.py check --deploy
.\.venv\Scripts\python.exe manage.py migrate --plan
```

Traiter les alertes selon l'architecture réellement déployée ; une sortie sans erreur locale ne remplace pas une revue de l'infrastructure, des sauvegardes et des droits d'accès.
