# Hondana

Bibliothèque 3D de mangas et d'animes : chaque tome lu apparaît sur une étagère façon vitrine collector.

## Ce que fait le site

- Plusieurs meubles de taille fixe, côte à côte : quand un meuble est plein, le suivant se remplit.
- Seuls les tomes lus sont rangés (un objet par tome, ou par coffret de 12 épisodes pour les animes). Les séries sans tome restent accessibles depuis « Séries ».
- Note sur 10, statut (en cours, terminé, en pause, à lire, abandonné) et progression pour chaque série.
- Import de la liste MyAnimeList (fichier d'export `.xml` ou `.xml.gz`).
- Couverture de chaque série et nombre de tomes récupérés sur [AniList](https://anilist.co).
- Couverture de chaque tome récupérée sur [MangaDex](https://mangadex.org) quand on sort un tome de l'étagère.
- Mangas : tomes lus et tomes possédés sont suivis séparément. Les tomes possédés mais pas encore lus sont rangés en retrait, dans l'ombre, et la fiche d'une série indique les tomes qui restent à acheter.
- Depuis « Séries », la bibliothèque peut être téléchargée en `.json` et restaurée.
- L'étagère 3D n'est redessinée que lorsque quelque chose bouge, pour ménager la batterie.
- Comptes sans mot de passe (lien de connexion par e-mail) : la bibliothèque est enregistrée dans le compte et se retrouve sur tous les appareils.
- Page publique en lecture seule à l'adresse `/u/pseudo`, que l'on peut rendre privée.
- Sans compte, la bibliothèque reste enregistrée dans le navigateur ; elle est versée dans le compte à la première connexion.

## Organisation des fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `style.css` | Mise en page et couleurs de l'interface |
| `app.js` | Étagère 3D, import MAL, appels AniList |
| `vendor/three.min.js` | Moteur 3D (three.js r128) |
| `api/cover.js` | Relais d'images AniList, nécessaire pour les utiliser en 3D |
| `api/anilist.js` | Relais de secours vers l'API AniList |
| `config.js` | Adresse et clé publique du projet Supabase (vide = comptes désactivés) |
| `vendor/supabase.js` | Bibliothèque Supabase (comptes et base de données) |
| `supabase/schema.sql` | Tables et règles d'accès à créer dans Supabase |
| `vercel.json` | Redirige `/u/pseudo` vers la page |
| `api/mangadex.js` | Relais vers l'API MangaDex (obligatoire : MangaDex refuse les appels directs depuis un autre site) |

## Mise en ligne

Le site est hébergé sur Vercel, relié à ce dépôt GitHub. Chaque modification poussée sur la branche `main` est publiée automatiquement. Aucun réglage particulier n'est nécessaire (préréglage « Other », pas de commande de build).

## Mise en service des comptes (Supabase)

1. Créer un projet sur supabase.com.
2. SQL Editor : coller et exécuter `supabase/schema.sql`.
3. Authentication → URL Configuration : Site URL = adresse du site, et ajouter `adresse-du-site/**` aux Redirect URLs.
4. Copier le Project URL et la clé publishable (ou anon) dans `config.js`.

## Limites connues

- L'envoi d'e-mails intégré à Supabase est limité à quelques e-mails par heure : brancher un service d'envoi (SMTP) avant d'ouvrir le site au public.
- Le projet Supabase gratuit se met en pause après une semaine sans activité.

- AniList autorise actuellement 30 requêtes par minute : un gros import récupère ses couvertures en une à deux minutes.
- Les tranches sont générées à partir de la couverture de la série : comme en vrai, tous les tomes d'une série ont le même dos.
- MangaDex n'a pas toutes les couvertures : un tome sans couverture affiche celle de la série. Les animes n'ont pas de couverture par coffret.
- MangaDex limite son API à environ 5 requêtes par seconde ; les réponses sont gardées un jour en cache par Vercel.
