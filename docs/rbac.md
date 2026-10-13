# RBAC — Label INPG

Le serveur est l'autorité pour les rôles et capacités. L'interface masque les fonctions indisponibles pour améliorer l'expérience, mais ce masquage ne constitue jamais un contrôle de sécurité.

## Responsabilités

| Rôle | Périmètre attendu | Responsabilité principale |
|---|---|---|
| Professionnel | Son compte et ses inscriptions | Consulter les formations et demander une inscription. |
| Entreprise | Son organisation et ses propres objets métier | Gérer ses brouillons, justificatifs, réponses aux corrections, certificats et inscriptions. |
| Gestionnaire | Portefeuille opérationnel | Examiner les dossiers, valider les pièces, affecter un évaluateur, démarrer la revue et planifier un audit avec un auditeur. |
| Évaluateur | Dossiers qui lui sont affectés | Réaliser l'évaluation et demander ou valider des corrections dans son périmètre. |
| Auditeur | Dossiers qui lui sont affectés | Réaliser les audits et demander ou valider des non-conformités dans son périmètre. |
| Décideur | Dossiers prêts pour décision | Rendre une décision et gérer le statut du certificat sans administrer les comptes ou référentiels. |
| Administrateur | Administration fonctionnelle | Gérer les objets, formations et référentiels prévus par ses capacités, sans hériter implicitement des actes réservés à une autre responsabilité. |
| Superutilisateur | Exploitation exceptionnelle | Créer les comptes internes et conserver les droits sensibles de secours ; ses actions doivent rester rares et tracées. |

La matrice exécutable se trouve dans `backend/platform_api/access.py`. Toute évolution d'une capacité doit être accompagnée d'un test d'autorisation positif et négatif, puis reportée dans ce document.

## Règles invariantes

- Un utilisateur non authentifié n'accède qu'aux endpoints explicitement publics.
- Un compte inactif, sans profil exploitable ou sans rattachement obligatoire est refusé.
- Chaque endpoint métier vérifie sa capacité et filtre son queryset ; un identifiant hors périmètre ne doit révéler ni l'existence ni les métadonnées de l'objet.
- Les affectations n'accordent des droits qu'au rôle attendu et au dossier concerné.
- Le rôle et les capacités sont relus depuis le serveur ; aucune valeur conservée dans le navigateur ne fait autorité.
- Les justificatifs sont téléchargés via `/api/v1/documents/<id>/download/` après contrôle du dossier parent. Le répertoire `media` n'est pas une route publique.
- Une transition de workflow contrôle à la fois la capacité, le rôle ou l'affectation et le statut source.

## Authentification et provisionnement

L'API utilise les sessions Django et la protection CSRF :

- `/api/v1/auth/csrf/`
- `/api/v1/auth/login/`
- `/api/v1/auth/me/`
- `/api/v1/auth/logout/`

Le cookie de session est HttpOnly. Les origines de confiance et les cookies sécurisés doivent être configurés pour l'environnement de production comme décrit dans [deployment.md](deployment.md).

Un superutilisateur crée les comptes Gestionnaire, Évaluateur, Auditeur et Décideur via `POST /api/v1/admin/accounts/`. Il n'existe aucune inscription publique permettant d'obtenir ces rôles. Le détail du parcours figure dans [inscription.md](inscription.md).

## Vérification

Ne figez pas un nombre de tests dans cette documentation. Exécutez la suite complète et les scénarios d'isolation décrits dans [validation.md](validation.md). Les tests doivent notamment couvrir l'anonymat, l'isolation inter-entreprises, les identifiants hors périmètre, les affectations, la révocation, les téléchargements et toutes les transitions sensibles.
