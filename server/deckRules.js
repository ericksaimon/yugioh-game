const { supabase } = require("./supabase");
const { getBanlistMap } = require("./banlistCache");

function normalizeDeckArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(x => ({
      card_id: Number(x.card_id),
      qty: Number(x.qty)
    }))
    .filter(x => Number.isFinite(x.card_id) && x.card_id > 0 && Number.isFinite(x.qty) && x.qty > 0);
}

function countCopies(main, extra) {
  const map = new Map();
  for (const c of [...main, ...extra]) {
    map.set(c.card_id, (map.get(c.card_id) || 0) + c.qty);
  }
  return map; // card_id -> total qty
}

async function fetchPrices(cardIds) {
  if (!cardIds.length) return new Map();

  const { data, error } = await supabase
    .from("card_prices")
    .select("card_id, wizard_cost, dragons_cost, name")
    .in("card_id", cardIds);

  if (error) throw new Error("Erro lendo card_prices: " + error.message);

  const map = new Map();
  for (const row of data || []) {
    map.set(Number(row.card_id), {
      wizard_cost: Number(row.wizard_cost || 0),
      dragons_cost: Number(row.dragons_cost || 0),
      name: row.name || null
    });
  }
  return map;
}

/**
 * validateDeck({
 *   deck: { main: [{card_id, qty}], extra: [{card_id, qty}] },
 *   room: { wizard_limit: number|null, banlist_id: 'tcg' },
 *   options: { blockIfMissingPrice: true }
 * })
 */
async function validateDeck({ deck, room, options }) {
  const errors = [];
  const blockIfMissingPrice = options?.blockIfMissingPrice ?? true;

  const main = normalizeDeckArray(deck?.main);
  const extra = normalizeDeckArray(deck?.extra);

  const mainCount = main.reduce((a, c) => a + c.qty, 0);
  const extraCount = extra.reduce((a, c) => a + c.qty, 0);

  if (mainCount < 40 || mainCount > 60) {
    errors.push(`Main Deck inválido: ${mainCount} cartas (deve ser 40 a 60).`);
  }
  if (extraCount < 0 || extraCount > 15) {
    errors.push(`Extra Deck inválido: ${extraCount} cartas (deve ser 0 a 15).`);
  }

  // Banlist
  const banlistId = room?.banlist_id || "tcg";
  const banMap = await getBanlistMap(banlistId);

  const copies = countCopies(main, extra);

  for (const [cardId, qtyTotal] of copies.entries()) {
    const limit = banMap.has(cardId) ? banMap.get(cardId) : 3;

    if (limit === 0) errors.push(`Carta BANIDA na banlist (${banlistId}): card_id ${cardId}.`);
    if (qtyTotal > limit) errors.push(`Cópias acima do permitido: card_id ${cardId} = ${qtyTotal} (limite ${limit}).`);
  }

  // Preços (WizardMoney)
  const allIds = [...copies.keys()];
  const priceMap = await fetchPrices(allIds);

  let wizardTotal = 0;
  const missingPrice = [];

  for (const [cardId, qtyTotal] of copies.entries()) {
    const p = priceMap.get(cardId);
    if (!p) {
      missingPrice.push(cardId);
      continue;
    }
    // Se quiser bloquear carta com custo 0 também, mude aqui:
    // if (p.wizard_cost <= 0) missingPrice.push(cardId);
    wizardTotal += (p.wizard_cost || 0) * qtyTotal;
  }

  if (missingPrice.length > 0 && blockIfMissingPrice) {
    errors.push(`Deck bloqueado: ${missingPrice.length} carta(s) sem preço em card_prices. Ex: ${missingPrice.slice(0, 10).join(", ")}${missingPrice.length > 10 ? "..." : ""}`);
  }

  const limit = room?.wizard_limit;
  if (typeof limit === "number") {
    if (wizardTotal > limit) {
      errors.push(`Deck acima do limite WizardMoney: ${wizardTotal} (limite ${limit}).`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    meta: { mainCount, extraCount, wizardTotal, banlistId, wizardLimit: limit ?? null }
  };
}

module.exports = { validateDeck };
