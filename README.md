# Hondana

Bibliothèque 3D de mangas et d'animes : chaque tome lu apparaît sur une étagère façon vitrine collector.

## Ce que fait le site

- Étagère 3D qu'on fait défiler, un objet par tome (manga) ou par coffret de 12 épisodes (anime).
- Note sur 10, statut (en cours, terminé, en pause, à lire, abandonné) et progression pour chaque série.
- Import de la liste MyAnimeList (fichier d'export `.xml` ou `.xml.gz`).
- Couvertures et nombre de tomes récupérés automatiquement sur [AniList](https://anilist.co).
- La bibliothèque est enregistrée dans le navigateur de chaque visiteur (pas encore de comptes).

## Organisation des fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `style.css` | Mise en page et couleurs de l'interface |
| `app.js` | Étagère 3D, import MAL, appels AniList |
| `vendor/three.min.js` | Moteur 3D (three.js r128) |
| `api/cover.js` | Relais d'images AniList, nécessaire pour les utiliser en 3D |
| `api/anilist.js` | Relais de secours vers l'API AniList |

## Mise en ligne

Le site est hébergé sur Vercel, relié à ce dépôt GitHub. Chaque modification poussée sur la branche `main` est publiée automatiquement. Aucun réglage particulier n'est nécessaire (préréglage « Other », pas de commande de build).

## Limites connues

- AniList autorise actuellement 30 requêtes par minute : un gros import récupère ses couvertures en une à deux minutes.
- AniList fournit une couverture par série, pas par tome. Les tranches sont générées à partir de cette couverture.
