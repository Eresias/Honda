// Relais de secours vers l'API AniList, utilisé seulement si l'appel direct
// depuis le navigateur échoue (réseau d'entreprise, bloqueur, etc.).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Méthode non autorisée');
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (body.length > 20000) return res.status(413).send('Requête trop longue');
  try {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'MyWeebrary/1.0 (bibliotheque manga 3D; honda-neon-one.vercel.app)' },
      body,
    });
    const text = await r.text();
    const retry = r.headers.get('retry-after');
    if (retry) res.setHeader('Retry-After', retry);
    res.setHeader('Content-Type', 'application/json');
    return res.status(r.status).send(text);
  } catch {
    return res.status(502).json({ errors: [{ message: 'AniList ne répond pas' }] });
  }
}
