# Sécurité

Pour signaler une vulnérabilité, contactez l’administrateur technique de la plateforme INPG de manière privée. Ne publiez pas de secret, de donnée entreprise ou de preuve d’accès dans une issue publique.

Les comptes internes sont créés par un superadministrateur. Les rôles et permissions sont documentés dans [docs/rbac.md](docs/rbac.md).

Les justificatifs, certificats non publics et données d'entreprise doivent rester derrière les contrôles d'authentification et de périmètre de l'API. Ne publiez pas directement le répertoire `backend/media/`.

Avant déploiement, appliquez [la configuration de production](docs/deployment.md) et exécutez [la checklist de validation](docs/validation.md). Une compilation réussie ne remplace pas la revue des secrets, sauvegardes, journaux, droits d'accès et règles de conservation.
