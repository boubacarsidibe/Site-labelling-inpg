# Pages de l'interface

## Public

| Page | Contenu |
|---|---|
| `/`, `/label`, `/demarche`, `/acteurs`, `/formations`, `/faq`, `/contact` | Présentation du Label |
| `/verification-certificat` | Registre public : validité d'un certificat par son numéro (`?numero=`) |
| `/inscription`, `/connexion` | Création de compte (Entreprise, Professionnel) et connexion, avec retour à la page demandée |
| `/mot-de-passe-oublie`, `/reinitialisation` | Réinitialisation du mot de passe par e-mail |
| `/invitation/:jeton` | Création du compte d'un collaborateur invité |

## Espace entreprise (`/espace`)

| Page | Contenu |
|---|---|
| Tableau de bord | Dossiers et leur étape, statut réel du certificat (valide, suspendu, expiré…), alerte si l'organisation n'est pas vérifiée |
| Mon entreprise | Fiche de l'organisation, membres, invitations (titulaire) |
| Nouvelle demande | Activité, volets, niveau calculé, checklist officielle fournie par l'API ; renouvellement (`?renouvellement=`) ou suite d'un refus (`?suite=`) |
| Dossier | Étapes, historique, audit, décision et motif, certificat, lien de renouvellement |
| Pièces | Dépôt et remplacement, téléchargement, commentaires de refus, soumission |
| Non-conformités | Réponse écart par écart, gravité, échéance, motif de renvoi |
| Mes certifications | Certificats, expiration, lien de vérification publique, renouvellement |
| Formations | Catalogue (renvoie vers le portail public) |

## Administration (`/admin`)

Le menu n'affiche que les pages permises par les capacités du compte.

| Page | Contenu |
|---|---|
| Tableau de bord | Compteurs par statut (liens filtrés), dossiers « à traiter » par le rôle connecté, certificats expirant sous 90 jours |
| Dossiers | Recherche, filtre par statut, entreprise, certificat non valide signalé |
| Fiche dossier | Uniquement les actions permises au rôle **et** à l'étape : vérification de l'organisation, revue des pièces, affectation, audit (date, compte rendu), non-conformités, clôture de l'évaluation, décision par volet |
| Évaluations, Audits, Non-conformités | Listes de travail (échéances dépassées signalées) |
| Certificats | Registre, suspension, réactivation, révocation confirmée |
| Référentiels | Pièces exigées par volet et activité (administrateur) |
| Utilisateurs | Comptes internes, création et activation/désactivation (superutilisateur) |

Toutes les pages de travail se rafraîchissent toutes les 30 s ; les statuts et libellés viennent de l'API (`/api/v1/meta/` et champs `*_label`).

Les captures `accueil-*.png` de ce dossier datent de la refonte de l'accueil.
