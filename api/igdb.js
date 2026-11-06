// Relais vers IGDB (base de jeux vidéo de Twitch). Les identifiants restent sur le serveur :
// ils sont lus dans les variables d'environnement Vercel IGDB_CLIENT_ID et IGDB_CLIENT_SECRET.
const ENDPOINTS = new Set(['games', 'external_games', 'multiquery', 'platforms']);
let token = null, tokenExp = 0;

async function getToken(id, secret) {
  if (token && Date.now() < tokenExp - 60_000) return token;
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`, { method: 'POST' });
  if (!r.ok) throw new Error('twitch ' + r.status);
  const j = await r.json();
  token = j.access_token; tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
  return token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Méthode non autorisée');
  const id = process.env.IGDB_CLIENT_ID, secret = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secret) return res.status(503).json({ error: 'not_configured' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { endpoint, query } = body;
  if (!ENDPOINTS.has(endpoint) || typeof query !== 'string' || query.length > 6000) return res.status(400).json({ error: 'bad_request' });

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = await getToken(id, secret);
      const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: { 'Client-ID': id, Authorization: `Bearer ${t}`, Accept: 'application/json', 'Content-Type': 'text/plain' },
        body: query,
      });
      if (r.status === 401 && attempt === 0) { token = null; continue; }
      const text = await r.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(r.status).send(text);
    }
  } catch {
    return res.status(502).json({ error: 'igdb_unreachable' });
  }
}
