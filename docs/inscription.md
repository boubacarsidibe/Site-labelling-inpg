# Inscription, invitations et mots de passe

## Inscription publique (`/inscription`)

Deux types de compte seulement : **Entreprise** et **Professionnel**. L'adresse e-mail est unique sur la plateforme.

L'inscription Entreprise crée l'organisation (raison sociale, NINEA, activité facultative) et rattache le compte comme **titulaire**. Un NINEA existant ne permet jamais de rejoindre une entreprise : seul le titulaire peut ajouter des collaborateurs, par invitation.

L'organisation déclarée n'est pas encore vérifiée. L'entreprise peut préparer ses brouillons et déposer ses pièces ; **la soumission est refusée tant qu'un gestionnaire n'a pas vérifié la raison sociale et le NINEA** (bouton « Vérifier l'organisation » sur le dossier). L'entreprise est prévenue par e-mail.

## Invitations de collaborateurs

Depuis **Mon entreprise**, le titulaire saisit l'e-mail d'un collaborateur. Un lien `/invitation/<jeton>` valable 7 jours est envoyé ; le collaborateur choisit son identifiant et son mot de passe et rejoint l'organisation avec le rôle Entreprise. Un lien utilisé ou expiré est refusé.

## Mot de passe oublié

`/mot-de-passe-oublie` envoie un lien `/reinitialisation?uid=…&token=…` valable 24 heures. La réponse est identique que l'adresse existe ou non (pas d'énumération des comptes). Les règles de robustesse s'appliquent au nouveau mot de passe.

## Comptes internes

Administrateur, gestionnaire, évaluateur, auditeur et décideur sont créés uniquement par un superutilisateur (voir [RBAC](rbac.md)). Aucune inscription publique ne donne accès au back-office.

## E-mails

En développement, ils s'affichent dans la console du serveur. En production, configurer `EMAIL_HOST` et `FRONTEND_URL` (voir le README).
