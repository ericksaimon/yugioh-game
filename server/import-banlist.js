require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseLflistConf(content) {
  // Formato típico:
  // !name ...
  // # comments
  // [some section]
  // 12345678 1
  // 99999999 0
  const lines = content.split(/\r?\n/);
  const rows = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("!")) continue;
    if (line.startsWith("[")) continue;

    // captura "id limit"
    const m = line.match(/^(\d+)\s+([0-3])$/);
    if (!m) continue;

    rows.push({ card_id: Number(m[1]), limit: Number(m[2]) });
  }

  return rows;
}

async function upsertBanlistCards(banlistId, cards) {
  // Apaga e reinsere (simples e confiável)
  const del = await supabase.from("banlist_cards").delete().eq("banlist_id", banlistId);
  if (del.error) throw del.error;

  // insert em lotes
  const batchSize = 2000;
  for (let i = 0; i < cards.length; i += batchSize) {
    const slice = cards.slice(i, i + batchSize).map((c) => ({
      banlist_id: banlistId,
      card_id: c.card_id,
      limit: c.limit
    }));

    const ins = await supabase.from("banlist_cards").insert(slice);
    if (ins.error) throw ins.error;
  }
}

(async () => {
  const filePath = process.env.BANLIST_TCG_PATH;
  if (!filePath) throw new Error("BANLIST_TCG_PATH nao definido no .env");

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error("Banlist nao encontrada: " + abs);

  const content = fs.readFileSync(abs, "utf8");
  const cards = parseLflistConf(content);

  console.log("Lidos:", cards.length, "registros da banlist");

  // garante banlist tcg
  const up = await supabase.from("banlists").upsert([{ id: "tcg", name: "TCG (ProjectIgnis/EDOPro)", is_active: true }]);
  if (up.error) throw up.error;

  await upsertBanlistCards("tcg", cards);

  console.log("✅ Banlist TCG importada no Supabase com sucesso.");
})().catch((e) => {
  console.error("❌ Erro importando banlist:", e);
  process.exit(1);
});
