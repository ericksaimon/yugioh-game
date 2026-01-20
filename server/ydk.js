const fs = require("fs");
const path = require("path");

function buildYdkText(deckName, mainIds, extraIds) {
  const lines = [];
  lines.push(`#created by DuelNexus`);
  lines.push(`#deck name: ${deckName}`);
  lines.push(`#main`);
  for (const id of mainIds) lines.push(String(id));
  lines.push(`#extra`);
  for (const id of extraIds) lines.push(String(id));
  lines.push(`!side`);
  return lines.join("\n");
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeYdkFiles({ roomId, p1, p2 }) {
  const outDir = path.join(process.cwd(), "server", "generated_decks", roomId);
  ensureDir(outDir);

  const p1Path = path.join(outDir, `${roomId}_P1_${sanitize(p1.username)}.ydk`);
  const p2Path = path.join(outDir, `${roomId}_P2_${sanitize(p2.username)}.ydk`);

  fs.writeFileSync(p1Path, buildYdkText(`${roomId} - ${p1.username}`, p1.main, p1.extra), "utf8");
  fs.writeFileSync(p2Path, buildYdkText(`${roomId} - ${p2.username}`, p2.main, p2.extra), "utf8");

  return { outDir, p1Path, p2Path };
}

function sanitize(s) {
  return String(s || "user").replace(/[^\w\-]+/g, "_").slice(0, 24);
}

module.exports = { writeYdkFiles };
