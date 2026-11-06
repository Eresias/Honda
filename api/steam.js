// Ludothèque Steam d'un profil public. La clé est lue dans la variable d'environnement STEAM_API_KEY.
// On accepte l'identifiant à 17 chiffres, le pseudo d'URL ou l'adresse complète du profil.
export default async function handler(req, res) {
  const key = process.env.STEAM_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });
  let raw = String((Array.isArray(req.query.profile) ? req.query.profile[0] : req.query.profile) || '').trim();
  if (!raw || raw.length > 200) return res.status(400).json({ error: 'missing_profile' });

  let steamid = null, vanity = null;
  const m = raw.match(/steamcommunity\.com\/(profiles|id)\/([^/?#]+)/i);
  if (m) { if (m[1].toLowerCase() === 'profiles') steamid = m[2]; else vanity = m[2]; }
  else if (/^\d{17}$/.test(raw)) steamid = raw;
  else vanity = raw;

  try {
    if (!steamid) {
      const r = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`);
      const j = await r.json();
      if (!j.response || j.response.success !== 1) return res.status(404).json({ error: 'profile_not_found' });
      steamid = j.response.steamid;
    }
    if (!/^\d{17}$/.test(steamid)) return res.status(404).json({ error: 'profile_not_found' });
    const r = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`);
    if (!r.ok) return res.status(502).json({ error: 'steam_error' });
    const j = await r.json();
    const games = j.response && j.response.games;
    // profil privé : Steam répond sans liste de jeux
    if (!games) return res.status(403).json({ error: 'private_profile' });
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({
      steamid,
      games: games.map(g => ({ appid: g.appid, name: g.name, minutes: g.playtime_forever || 0 })),
    });
  } catch {
    return res.status(502).json({ error: 'steam_unreachable' });
  }
}
