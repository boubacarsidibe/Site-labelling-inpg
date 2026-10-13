# Vidéo de démonstration — Plateforme Label INPG (v2)

Vidéo de présentation de **6:54** (1920×1080, 30 i/s, H.264 + AAC), voix off française, sous-titres incrustés et musique douce. Elle s'adresse à la direction et aux partenaires de l'INPG et **commence par expliquer la labellisation** : le Label INPG est une nouveauté lancée par l'INPG, une reconnaissance officielle de confiance (trois volets, trois niveaux, certificat d'un an), avant de montrer la plateforme.

Tous les écrans ont été filmés sur la **nouvelle version** de l'application de ce dépôt (API Django sur `127.0.0.1:8000`, Angular sur `127.0.0.1:4200`), avec une base vierge et une entreprise fictive, *Sénégal Pétrole Distribution*. Le dossier suit le vrai workflow de l'API, de bout en bout. Aucune fonction absente de l'application n'est montrée.

## Rôles et codes couleur

Chaque rôle a un badge de couleur fixe en haut à gauche, et un badge par moitié d'écran dans les écrans divisés.

| Rôle | Compte de démonstration | Couleur |
|---|---|---|
| Visiteur (non connecté) | — | turquoise |
| Entreprise | `spd.diallo` (Sénégal Pétrole Distribution) | vert |
| Gestionnaire | `gest.fall` | bleu |
| Évaluateur | `eval.sow` | violet |
| Auditeur | `audit.diop` | orange |
| Décideur | `decid.ba` | bordeaux |
| Superadministrateur | `superadmin` (superutilisateur Django) | ardoise |
| Administrateur | `admin.ndiaye` | gris |

Les comptes internes sont créés à l'écran par le superadministrateur ; le compte Entreprise l'est par l'inscription publique. Le mot de passe de démonstration est lu dans la variable d'environnement `DEMO_PASSWORD` : il n'est jamais versionné.

## 1. Script minuté

Les timecodes sont ceux du montage final (6:54). Un fondu de 0,5 s relie chaque séquence ; les passages accélérés sont signalés à l'écran par « ▶▶ Accéléré ».

| Timecode | Visuel à l'écran | Action (clic, saisie, zoom) | Voix off | Texte à l'écran |
|---|---|---|---|---|
| 0:00 – 0:28 | Carton animé sur photo industrielle, logo INPG | Apparition successive : bandeau « NOUVEAU · LANCÉ PAR L’INPG », titre, définition, trois points de confiance | L'Institut National du Pétrole et du Gaz vient de lancer le Label INPG : une nouveauté pour la filière pétrolière et gazière. Un label est une reconnaissance officielle. Il atteste qu'une entreprise respecte des exigences précises, vérifiées par un tiers de confiance, ici l'INPG. Pour un client ou un partenaire, c'est un gage de confiance, simple à comprendre et facile à vérifier. | « Le Label INPG » · « Un label : une reconnaissance officielle » · « Des exigences précises », « Vérifiées par un tiers de confiance : l’INPG », « Un gage simple à comprendre, facile à vérifier » |
| 0:28 – 0:48 | Carton clair : trois volets puis trois niveaux | Cartes Sécurité, Qualité, Environnement qui se sélectionnent ; escalier Standard (1 volet), Gold (2), Platinum (3) ; pastille « 1 an » | Le Label repose sur trois volets : la Sécurité, la Qualité et l'Environnement. L'entreprise choisit ceux qu'elle souhaite faire reconnaître. Un volet obtenu donne le niveau Standard, deux volets le niveau Gold, et les trois volets le niveau Platinum. Le certificat est valable un an, puis se renouvelle. | « Trois volets, trois niveaux » · « Certificat valable 1 an puis renouvellement » |
| 0:48 – 1:16 | Frise des sept étapes | Les étapes s’allument au rythme de la voix, puis les badges des six rôles | Pour l'obtenir, l'entreprise suit un parcours en sept étapes. Elle dépose sa demande et ses preuves. Le dossier est évalué, un audit vérifie la réalité sur le terrain, puis les écarts éventuels sont corrigés. Un décideur habilité tranche, le certificat est délivré, et son suivi se poursuit dans l'année. Ce parcours engage de nombreux acteurs, côté entreprise comme côté INPG. | « Sept étapes, de la demande au suivi » · « De nombreux acteurs, côté entreprise comme côté INPG » |
| 1:16 – 1:35 | Titre sur fond industriel, quatre cartes de garanties | Dossier unique, droits par rôle, historique daté, notifications e-mail ; bandeau entreprise fictive | La Plateforme Label INPG porte ce parcours de bout en bout. Un dossier unique, des droits propres à chaque rôle, un historique daté de chaque action, et des notifications par e-mail. Voyons-la fonctionner, avec une entreprise fictive : Sénégal Pétrole Distribution. | « Plateforme Label INPG » · « Démonstration avec une entreprise fictive : Sénégal Pétrole Distribution » |
| 1:35 – 2:00 | Portail public : accueil, Le Label INPG, Démarche, Inscription | Défilement, clics dans le menu, formulaire Entreprise rempli (accéléré) avec choix de l’activité « Distribution », « Créer mon compte » | Tout commence sur le portail public. Chacun peut y découvrir le Label, ses volets et ses niveaux, ou vérifier un certificat. Une entreprise crée son compte en précisant son activité. Sa raison sociale et son NINEA seront vérifiés par l'INPG avant sa première soumission. Les comptes d'administration, eux, ne sont jamais ouverts à l'inscription publique. | Badge Visiteur · « Portail public & inscription » · « ▶▶ Accéléré » |
| 2:00 – 2:24 | Administration › Utilisateurs (superadministrateur), puis page de connexion | Création de gest.fall en temps réel puis des quatre autres comptes (accéléré), survol de « Désactiver », connexion de gest.fall | Côté INPG, le superadministrateur crée les comptes internes : gestionnaire, évaluateur, auditeur, décideur et administrateur. Il peut aussi les activer ou les désactiver. À la connexion, chacun arrive dans l'espace de son rôle. | Badges Superadministrateur puis Gestionnaire · « Utilisateurs : comptes internes » · « Connexion » |
| 2:24 – 2:55 | Espace entreprise : tableau de bord, Nouvelle demande, dépôt des pièces | Périmètre saisi, deux volets cochés → niveau Gold calculé, checklist officielle de l’API, brouillon créé, dépôt des 7 PDF, soumission bloquée | Sénégal Pétrole Distribution prépare sa demande. Elle indique son activité et son périmètre, puis choisit deux volets : le niveau Gold est calculé automatiquement. La plateforme affiche la liste officielle des pièces à fournir pour cette activité. L'entreprise crée son brouillon et dépose ses pièces, mais la soumission reste bloquée tant que l'INPG ne les a pas validées. | Badge Entreprise · « Nouvelle demande & dépôt des pièces » |
| 2:55 – 3:14 | Écran divisé Gestionnaire / Entreprise | Gauche : « Vérifier l’organisation » puis « Valider » ×7. Droite : page laissée telle quelle, le bandeau « L’INPG vient de mettre à jour ce dossier » apparaît seul (sondage 30 s), puis « Soumettre le dossier » | À gauche, le gestionnaire vérifie d'abord l'organisation, puis valide chaque pièce. À droite, la page de l'entreprise se met à jour toute seule et l'en informe. Tout est validé : elle soumet son dossier. Ainsi, aucun dossier incomplet n'atteint les évaluateurs. | Badges Gestionnaire / Entreprise · « Vérification, validation → mise à jour automatique → soumission » |
| 3:14 – 3:32 | Écran divisé Gestionnaire / Évaluateur | « Démarrer l’évaluation », affectation de eval.sow, audit planifié pour audit.diop (date et heure) ; à droite « Actualiser » : le dossier apparaît | Le gestionnaire démarre l'évaluation, affecte un évaluateur et planifie l'audit avec l'auditeur, à une date précise. Chacun est prévenu par e-mail et ne voit que les dossiers qui lui sont affectés. | Badges Gestionnaire / Évaluateur · « Démarrage de l’évaluation, affectation et audit daté » |
| 3:32 – 3:54 | Auditeur plein écran, puis écran divisé Évaluateur / Entreprise | Auditeur : compte rendu saisi et enregistré. Évaluateur : écart sur le volet Sécurité, gravité « Majeure », échéance à 30 jours ; entreprise : « Corrections demandées » | Après sa visite, l'auditeur rédige son compte rendu d'audit. L'évaluateur relève un écart sur le volet Sécurité, en précisant sa gravité et une échéance de correction. Pour l'entreprise, le dossier passe en « Corrections demandées ». | Badges Auditeur puis Évaluateur / Entreprise · « Compte rendu d’audit » · « Non-conformité (gravité, échéance) → Corrections demandées » |
| 3:54 – 4:12 | Écran divisé Entreprise / Évaluateur | Réponse corrective transmise ; l’évaluateur la clôture puis « Transmettre en décision » | L'entreprise décrit son action corrective et la transmet. L'évaluateur la relit : il peut la clôturer, ou la renvoyer avec un motif. Ici, il la clôture et transmet le dossier en décision. Chaque échange reste daté et tracé dans l'historique du dossier. | Badges Entreprise / Évaluateur · « Action corrective → clôture → décision » |
| 4:12 – 4:33 | Décideur : dossier en décision, puis registre des certificats | Décoche Qualité (niveau Standard), recoche (niveau Gold), motif, « Émettre le certificat Gold », numéro CERT-INPG-…, menu Certificats | Le décideur coche les volets accordés : le niveau du Label se calcule tout seul. Avec deux volets, c'est le Gold. Il émet le certificat, valable un an, avec un numéro unique. La décision est motivée et conservée dans l'historique. | Badge Décideur · « Décision par volets & certificat » |
| 4:33 – 4:44 | Portail public : vérification de certificat | Saisie du numéro, « Vérifier » : entreprise, niveau, volets, dates et statut « Valide » | N'importe quel partenaire peut alors vérifier ce certificat sur le portail public, à partir de son numéro : l'entreprise, le niveau, les volets et la validité sont affichés. | Badge Visiteur · « Vérification publique du certificat » |
| 4:44 – 5:02 | Espace entreprise : dossier certifié | Tableau de bord, « Suivre » (sept étapes, historique), Mes certifications (expiration, Renouveler, lien public), Mon entreprise (invitation d’un collègue) | L'entreprise retrouve son dossier certifié et suit son parcours. Son certificat indique sa date d'expiration, et elle peut préparer le renouvellement. Elle invite aussi ses collaborateurs. | Badge Entreprise · « Suivi, certifications, invitations » |
| 5:02 – 5:15 | Carton des six menus réels, puis « Accès refusé » | Barres latérales de chaque rôle ; l’entreprise saisit /admin/dashboard | Les droits sont strictement contrôlés. L'interface n'affiche que les actions permises à chaque rôle, et le serveur refuse toutes les autres. Une entreprise qui saisit l'adresse de l'administration arrive sur « Accès refusé ». | « Chaque rôle n’affiche que ses propres menus » · « Saisie de /admin/dashboard » |
| 5:15 – 5:36 | Administrateur : certificats et référentiels | Registre : Suspendre puis Réactiver ; Référentiels éditables (pièces par volet et activité) | L'administrateur suit le portefeuille depuis son tableau de bord. Il peut suspendre, réactiver ou révoquer un certificat, et il maintient les référentiels : la liste des pièces exigées pour chaque volet et chaque activité. Un certificat expire automatiquement au bout d'un an : le renouvellement passe par une nouvelle demande liée. | Badge Administrateur · « Certificats & référentiels » |
| 5:36 – 5:57 | Carton clair : fiabilité et sécurité | Quatre cartes : actions verrouillées, fichiers contrôlés, accès protégé, vérifié automatiquement | La plateforme est conçue pour un usage officiel. Les actions sont verrouillées côté serveur : deux personnes ne peuvent pas se contredire sur un même dossier. Les fichiers déposés sont contrôlés, les connexions sont protégées, et chaque parcours est vérifié par des tests automatiques. | « Conçue pour un usage officiel » |
| 5:57 – 6:19 | Carton récapitulatif « Qui peut faire quoi ? » | Lignes du tableau en cascade (6 rôles × 11 actions) | En résumé : l'entreprise dépose et corrige. Le gestionnaire vérifie et affecte. L'évaluateur et l'auditeur examinent. Le décideur certifie. L'administrateur pilote les certificats et les référentiels. Chacun à sa place, sur un même dossier. | « Droits vérifiés par l’API à chaque requête » |
| 6:19 – 6:54 | Prochaines étapes, puis logo de fin | Trois pastilles puis fondu vers le logo | Prochaines étapes : le module Formations, la mise en service pour les premières entreprises candidates, et le suivi des renouvellements. Plateforme Label INPG : une certification simple, traçable et fiable. | « Plateforme Label INPG — Une certification simple, traçable et fiable. Réalisé par Boubacar SIDIBE » |

Voix off : 794 mots, une seule voix française féminine (ElevenLabs « Perle »), ralentie à 95 % pour un débit posé. Sous-titres français synchronisés sur la voix. Musique instrumentale, atténuée automatiquement sous la voix.

## 2. Plans d'écran enregistrés, dans l'ordre

L'ordre suit l'état réel du dossier : chaque plan dépend du précédent. Base vierge, superutilisateur `superadmin` créé avec `createsuperuser`.

| # | Plan | Rôle connecté | Vue | Contenu |
|---|---|---|---|---|
| 1 | `public` | Visiteur | Plein écran | Accueil, Le Label INPG, Démarche, inscription Entreprise avec activité |
| 2 | `users` | Superadministrateur | Plein écran | Création des comptes gest.fall, eval.sow, audit.diop, decid.ba, admin.ndiaye ; « Désactiver » |
| 3 | `login` | Gestionnaire | Plein écran | Connexion de gest.fall |
| 4 | `ent-demande` | Entreprise | Plein écran | Nouvelle demande (Sécurité + Qualité = Gold), checklist de l'API, brouillon, dépôt des 7 pièces, soumission bloquée |
| 5 | `split-validation` | Gestionnaire + Entreprise | Écran divisé | Vérification de l'organisation, validation des pièces / bandeau automatique, soumission |
| 6 | `split-affectation` | Gestionnaire + Évaluateur | Écran divisé | Démarrer l'évaluation, affecter, planifier l'audit daté / le dossier apparaît |
| 7 | `auditeur` | Auditeur | Plein écran | Compte rendu d'audit |
| 8 | `split-nc` | Évaluateur + Entreprise | Écran divisé | Non-conformité (gravité, échéance) / « Corrections demandées » |
| 9 | `split-reponse` | Entreprise + Évaluateur | Écran divisé | Réponse corrective / clôture et transmission en décision |
| 10 | `decideur` | Décideur | Plein écran | Volets accordés, niveau calculé, certificat, registre |
| 11 | `verification` | Visiteur | Plein écran | Vérification publique du numéro de certificat |
| 12 | `ent-certifie` | Entreprise | Plein écran | Suivi en sept étapes, Mes certifications, Mon entreprise, invitation |
| 13 | `acces-refuse` | Entreprise | Plein écran | `/admin/dashboard` → « Accès refusé » |
| 14 | `admin` | Administrateur | Plein écran | Certificats (suspendre, réactiver), Référentiels |
| 15 | `menus` | Les 6 rôles | Captures fixes | Barre latérale réelle de chaque rôle |

Cartons animés : `what`, `levels`, `parcours`, `plateforme`, `menus`, `fiable`, `recap`, `end` (fichier `outils/slides.html`).

## 3. Refaire la vidéo

Prérequis : Node.js avec `playwright`, `ffmpeg`, Python 3 avec `numpy`, le paquet système `libttspico-utils` (voix gratuite de secours), les polices Inter.

```bash
# API sur base vierge (DJANGO_DEBUG=1, DATABASE_URL sqlite), superutilisateur « superadmin », interface sur :4200
export DEMO_PASSWORD='…'            # jamais versionné
export VIDEO_DIR=/chemin/de/travail # contient slides/ (slides.html + inpg-logo.svg et label-hero.png copiés de frontend/src/assets), audio/, shots/
cd docs/video-demo/outils
python3 tts.py                      # voix de secours gratuite (SVOX Pico) à partir de vo.json
node record.mjs                     # écrans de l'application
node rec-slides.mjs                 # cartons animés
python3 music.py 470 && ffmpeg -i $VIDEO_DIR/audio/music_raw.wav -ar 48000 $VIDEO_DIR/audio/music.wav
python3 compose.py all              # montage, sous-titres, mixage -> $VIDEO_DIR/Label-INPG-demo.mp4
```

`vo.json` contient le texte de la voix off (sous-titres compris) ; `tts.py` y applique une petite correction de prononciation (sigles, mots anglais) sans changer les sous-titres.

## Notes

- **Voix** : voix premium ElevenLabs « Perle » (modèle eleven_v4), générée segment par segment à partir de `vo.json` (`audio/s01.mp3` … `s18.mp3`, `s16b.mp3`). `tts.py` (SVOX Pico, gratuit) reste disponible en secours : il produit les mêmes fichiers dans `audio/`, puis `compose.py all` reconstruit la vidéo.
- **Temps réel** : l'application met à jour les écrans toutes les 30 s (sondage) et prévient par un bandeau ; la vidéo montre ce bandeau tel quel, sans prétendre à une diffusion instantanée.
- **E-mails** : les notifications partent par e-mail (console en développement) ; elles ne sont pas filmées.
- **Formations** : l'espace entreprise propose le catalogue ; le suivi des inscriptions n'existe pas encore (« Prochaines étapes »).
