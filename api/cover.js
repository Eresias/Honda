// Relais d'images : récupère une couverture AniList, MangaDex, IGDB ou Steam et la renvoie avec les en-têtes
// qui permettent de l'utiliser comme texture 3D. Seuls ces sites sont acceptés.
const ALLOWED = new Set(['s4.anilist.co', 'img.anili.st', 'uploads.mangadex.org', 'images.igdb.com', 'cdn.cloudflare.steamstatic.com', 'shared.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net']);
const MAX_BYTES = 6 * 1024 * 1024;

export default async function handler(req, res) {
  const raw = Array.isArray(req.query.u) ? req.query.u[0] : req.query.u;
  let target;
  try { target = new URL(raw); } catch { return res.status(400).send('Adresse d\'image invalide'); }
  if (target.protocol !== 'https:' || !ALLOWED.has(target.hostname)) return res.status(403).send('Domaine non autorisé');

  try {
    const r = await fetch(target, { headers: { 'User-Agent': 'MyWeebrary/1.0 (bibliotheque manga 3D; honda-neon-one.vercel.app)' } });
    if (!r.ok) return res.status(r.status).send('Image introuvable');
    const type = r.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return res.status(415).send('Ce n\'est pas une image');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).send('Image trop lourde');
    res.setHeader('Content-Type', type);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000, immutable');
    return res.status(200).send(buf);
  } catch {
    return res.status(502).send('AniList ne répond pas');
  }
}
