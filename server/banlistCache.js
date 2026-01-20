const { supabase } = require("./supabase");

let cache = {
  loadedAt: 0,
  byBanlistId: new Map() // banlistId -> Map(card_id -> limit)
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function getBanlistMap(banlistId) {
  const now = Date.now();
  const has = cache.byBanlistId.has(banlistId);
  const fresh = now - cache.loadedAt < CACHE_TTL_MS;

  if (has && fresh) return cache.byBanlistId.get(banlistId);

  const { data, error } = await supabase
    .from("banlist_cards")
    .select("card_id, card_limit")
    .eq("banlist_id", banlistId);

  if (error) throw new Error("Erro lendo banlist_cards: " + error.message);

  const map = new Map();
  for (const row of data || []) map.set(Number(row.card_id), Number(row.card_limit));

  cache.loadedAt = now;
  cache.byBanlistId.set(banlistId, map);

  return map;
}

module.exports = { getBanlistMap };
