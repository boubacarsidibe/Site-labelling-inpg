# RBAC — Label INPG

Les droits sont des **capacités** définies à un seul endroit : `backend/platform_api/access.py` (`CAPABILITIES`). L'API les vérifie sur chaque action ; l'interface les lit via `GET /api/v1/auth/me/` pour afficher menus et boutons, sans copie locale des rôles.

## Matrice

| Rôle | Dossiers visibles | Actions |
|---|---|---|
| Entreprise | Ceux de son organisation | Modifier sa fiche (raison sociale et NINEA en lecture seule une fois déclarés) ; créer, modifier, supprimer et soumettre ses brouillons ; déposer les pièces ; répondre aux non-conformités ; consulter ses certificats ; voir les membres. Le **titulaire** invite des collaborateurs (`members.invite`) |
| Professionnel | Aucun | Espace professionnel uniquement |
| Gestionnaire | Tous, brouillons compris | Vérifier une organisation, revoir les pièces, démarrer l'évaluation, affecter/retirer un évaluateur, planifier un audit, consulter audits, non-conformités et registre |
| Évaluateur | Ceux qui lui sont affectés | Signaler, clôturer ou renvoyer une non-conformité ; clôturer l'évaluation |
| Auditeur | Ceux qui lui sont affectés | Rédiger le compte rendu de **ses** audits ; signaler une non-conformité |
| Décideur | Tous **sauf les brouillons** | Décider (volets accordés ou refus motivé) |
| Administrateur | Tous | Toutes les actions métier (peut cumuler les rôles sur un dossier), gérer les certificats (suspendre, réactiver, révoquer), éditer les référentiels, lister les comptes |
| Superutilisateur | Tous | Celles de l'administrateur + créer les comptes internes, activer/désactiver un compte |
| Anonyme / sans rôle | — | Portail public et vérification de certificat |

Une entreprise sans organisation, un compte inactif ou un `is_staff` sans profil n'ont aucun droit. Un identifiant hors périmètre renvoie 404.

## Session et protections

- Sessions Django (cookie HttpOnly) et CSRF, y compris à la connexion. Sans session, l'API répond **401** ; l'interface renvoie alors vers `/connexion?returnUrl=…&expiree=1` puis revient à la page demandée. Un manque de droits répond **403** (page « Accès refusé »).
- Limitation des tentatives (cache partagé via `DJANGO_REDIS_URL` en production) : 10 échecs de connexion par minute et par IP (les connexions réussies ne comptent pas), 10 inscriptions par heure, 5 demandes de réinitialisation par heure, 20 acceptations d'invitation par heure, 60 vérifications publiques par minute.
- Pièces déposées : PDF, PNG ou JPEG authentiques (signature vérifiée), 10 Mo maximum, téléchargées uniquement via `/api/v1/documents/<id>/download/` après contrôle des droits.
- Toutes les actions du workflow s'exécutent dans une transaction avec verrou sur le dossier : deux personnes agissant en même temps ne peuvent pas produire un état incohérent (test d'accès simultanés sur PostgreSQL).

## Comptes

- Superutilisateur initial : `python manage.py createsuperuser` sur le serveur. Aucun compte ni mot de passe par défaut.
- Comptes internes : écran **Administration → Utilisateurs** (ou `POST /api/v1/admin/accounts/`), réservé au superutilisateur. Activation/désactivation : `POST /api/v1/admin/accounts/<id>/set-active/` ; impossible sur soi-même ou sur un superutilisateur. La désactivation coupe l'accès dès la requête suivante.
- `manage.py set_role` reste disponible pour rattacher un compte Entreprise ou Professionnel depuis le serveur ; il supprime les anciennes affectations du compte.

Les tests sont dans `backend/platform_api/tests.py`, `test_registration.py` et `test_corrections.py`.
