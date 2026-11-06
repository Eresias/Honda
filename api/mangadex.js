// Relais vers l'API MangaDex. MangaDex n'accepte pas les appels venant directement
// d'un autre site : le navigateur passe donc par ici. Seules deux recherches sont permises.
const PATHS = { manga: '/manga', cover: '/cover' };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Méthode non autorisée');
  const url = new URL(req.url, 'http://local');
  const path = PATHS[url.searchParams.get('path')];
  if (!path) return res.status(400).json({ errors: [{ detail: 'Recherche non autorisée' }] });
  url.searchParams.delete('path');
  const qs = url.searchParams.toString();
  if (qs.length > 2000) return res.status(414).send('Requête trop longue');

  try {
    const r = await fetch(`https://api.mangadex.org${path}?${qs}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Hondana/0.3 (bibliotheque manga 3D; honda-neon-one.vercel.app)' },
    });
    const text = await r.text();
    const retry = r.headers.get('retry-after');
    if (retry) res.setHeader('Retry-After', retry);
    res.setHeader('Content-Type', 'application/json');
    // les réponses sont gardées un jour par Vercel pour ménager MangaDex
    if (r.ok) res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(r.status).send(text);
  } catch {
    return res.status(502).json({ errors: [{ detail: 'MangaDex ne répond pas' }] });
  }
}
