# Hondana

Bibliothèque 3D de mangas et d'animes : chaque tome lu apparaît sur une étagère façon vitrine collector.

## Ce que fait le site

- Plusieurs meubles de taille fixe, côte à côte : quand un meuble est plein, le suivant se remplit.
- Seuls les tomes lus sont rangés (un objet par tome, ou par coffret de 12 épisodes pour les animes). Les séries sans tome restent accessibles depuis « Séries ».
- Note sur 10, statut (en cours, terminé, en pause, à lire, abandonné) et progression pour chaque série.
- Import de la liste MyAnimeList (fichier d'export `.xml` ou `.xml.gz`).
- Couverture de chaque série et nombre de tomes récupérés sur [AniList](https://anilist.co).
- Couverture de chaque tome récupérée sur [MangaDex](https://mangadex.org) quand on sort un tome de l'étagère.
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
| `api/mangadex.js` | Relais vers l'API MangaDex (obligatoire : MangaDex refuse les appels directs depuis un autre site) |

## Mise en ligne

Le site est hébergé sur Vercel, relié à ce dépôt GitHub. Chaque modification poussée sur la branche `main` est publiée automatiquement. Aucun réglage particulier n'est nécessaire (préréglage « Other », pas de commande de build).

## Limites connues

- AniList autorise actuellement 30 requêtes par minute : un gros import récupère ses couvertures en une à deux minutes.
- Les tranches sont générées à partir de la couverture de la série : comme en vrai, tous les tomes d'une série ont le même dos.
- MangaDex n'a pas toutes les couvertures : un tome sans couverture affiche celle de la série. Les animes n'ont pas de couverture par coffret.
- MangaDex limite son API à environ 5 requêtes par seconde ; les réponses sont gardées un jour en cache par Vercel.
