import React, { useMemo } from "react";
import { DuelState, Phase, Position, CardInGame, PlayerState } from "../types";
import CardVisual from "./CardVisual";

type PlayerMeta = {
  username?: string;
  teamTag?: string; // sigla
  level?: number;
  avatarGifUrl?: string;
};

interface BoardProps {
  duel: DuelState;
  inspectedCard: CardInGame | null;
  onCardInspect: (card: CardInGame) => void;
  onZoneClick: (playerIndex: number, type: string, zoneIndex: number) => void;
  onHandCardClick: (cardIndex: number) => void;
  onAdvancePhase: () => void;
  timer: number;

  // ✅ PERFIL vem do seu site (firebase/supabase), não da engine
  playerMeta?: PlayerMeta;
  opponentMeta?: PlayerMeta;
}

const genId = () => Math.random().toString(36).slice(2, 10);

// ✅ cria "cartas viradas" só pra renderizar mão quando vier apenas contagem
function makeHiddenHand(count: number): CardInGame[] {
  return Array.from({ length: Math.max(0, count || 0) }).map((_, i) => ({
    instanceId: `hidden_${i}_${genId()}`,
    name: "Hidden",
    type: "Unknown",
    desc: "",
    atk: 0,
    def: 0,
    isFaceUp: false,
    currentPosition: Position.ATTACK,
    hasAttackedThisTurn: false,
    hasChangedPositionThisTurn: false,
    hasActivatedEffect: false,
    card_images: [],
  } as any));
}

// ✅ normaliza PlayerState vindo do backend/engine
function normalizePlayer(p: any): PlayerState & {
  deckCount?: number;
  extraDeckCount?: number;
  handCount?: number;
  banishedCount?: number;
  graveyardCount?: number;
} {
  const monsterZones = Array.isArray(p?.monsterZones) ? p.monsterZones : [];
  const spellTrapZones = Array.isArray(p?.spellTrapZones) ? p.spellTrapZones : [];

  const fixedMonster = Array.from({ length: 5 }).map((_, i) => monsterZones[i] ?? null);
  const fixedST = Array.from({ length: 5 }).map((_, i) => spellTrapZones[i] ?? null);

  const graveyard = Array.isArray(p?.graveyard) ? p.graveyard : [];
  const banished = Array.isArray(p?.banished) ? p.banished : [];

  // hand pode vir como array OU só contagem
  const handArr = Array.isArray(p?.hand) ? p.hand : null;
  const handCount = typeof p?.handCount === "number" ? p.handCount : (handArr?.length ?? 0);

  // deck pode vir como array OU contagem
  const deckArr = Array.isArray(p?.deck) ? p.deck : null;
  const deckCount = typeof p?.deckCount === "number" ? p.deckCount : (deckArr?.length ?? 0);

  const extraArr = Array.isArray(p?.extraDeck) ? p.extraDeck : null;
  const extraDeckCount = typeof p?.extraDeckCount === "number" ? p.extraDeckCount : (extraArr?.length ?? 0);

  const safeHand = handArr ?? makeHiddenHand(handCount);

  const safe = {
    id: p?.id ?? genId(),
    username: p?.username ?? "Duelista",
    lp: typeof p?.lp === "number" ? p.lp : 8000,

    deck: deckArr ?? [],
    hand: safeHand,

    monsterZones: fixedMonster,
    spellTrapZones: fixedST,
    fieldZone: p?.fieldZone ?? null,

    graveyard,
    banished,
    extraDeck: extraArr ?? [],

    normalSummonedThisTurn: !!p?.normalSummonedThisTurn,

    deckCount,
    extraDeckCount,
    handCount,
    graveyardCount: typeof p?.graveyardCount === "number" ? p.graveyardCount : graveyard.length,
    banishedCount: typeof p?.banishedCount === "number" ? p.banishedCount : banished.length,
  };

  return safe as any;
}

const Board: React.FC<BoardProps> = ({
  duel,
  inspectedCard,
  onCardInspect,
  onZoneClick,
  onHandCardClick,
  onAdvancePhase,
  playerMeta,
  opponentMeta,
}) => {
  const isPlayerTurn = duel.turnPlayerIndex === 0;
  const zoneDim = "w-10 md:w-12 lg:w-14 aspect-[59/86]";

  const player = useMemo(() => normalizePlayer(duel.players?.[0]), [duel.players]);
  const opponent = useMemo(() => normalizePlayer(duel.players?.[1]), [duel.players]);

  // ✅ mão do player: se vier cartas reais, mostra frente; se vier só contagem, mostra backs (mas clicável)
  const playerHand = player.hand ?? [];
  const opponentHandCount =
    typeof (opponent as any).handCount === "number" ? (opponent as any).handCount : (opponent.hand?.length ?? 0);

  const renderProfile = (meta?: PlayerMeta, fallbackName?: string, side: "player" | "opp" = "player") => {
    const name = meta?.username || fallbackName || "Duelista";
    const tag = meta?.teamTag ? `[${meta.teamTag}]` : "";
    const lvl = typeof meta?.level === "number" ? `LV ${meta.level}` : "";

    return (
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl overflow-hidden border ${side === "opp" ? "border-red-500/20" : "border-blue-500/20"} bg-black/40`}>
          {meta?.avatarGifUrl ? (
            <img src={meta.avatarGifUrl} className="w-full h-full object-cover" alt="avatar" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-white/20 font-bold">GIF</div>
          )}
        </div>

        <div className="leading-tight">
          <div className={`text-[11px] font-black tracking-widest uppercase ${side === "opp" ? "text-red-400/80" : "text-blue-400/80"}`}>
            {name} <span className="text-white/20">{tag}</span>
          </div>
          <div className="text-[10px] text-white/25 font-mono">{lvl}</div>
        </div>
      </div>
    );
  };

  const renderPile = (label: string, count: number, color: "blue" | "red" | "yellow", bgUrl?: string) => {
    const border =
      color === "blue" ? "border-blue-500/15" : color === "red" ? "border-red-500/15" : "border-yellow-500/15";
    const header =
      color === "blue" ? "bg-blue-900/60" : color === "red" ? "bg-red-900/60" : "bg-yellow-900/60";

    return (
      <div className={`field-zone ${zoneDim} rounded relative flex items-center justify-center overflow-hidden border ${border} bg-black/20`}>
        <div className={`absolute top-0 inset-x-0 text-[7px] font-black text-center ${header} uppercase py-0.5 z-10`}>
          {label}
        </div>
        {bgUrl ? (
          <div className="absolute inset-0 opacity-25 bg-cover bg-center" style={{ backgroundImage: `url('${bgUrl}')` }} />
        ) : null}
        <div className="absolute bottom-0 inset-x-0 text-[8px] text-center font-black z-10 bg-black/60">{count}</div>
      </div>
    );
  };

  const renderSideZones = (p: PlayerState & any, pIdx: number, isRight: boolean) => {
    const isOwner = pIdx === 0;

    return (
      <div className={`flex flex-col gap-5 ${isOwner ? "justify-start" : "justify-end"}`}>
        {/* Field zone (lado esquerdo no seu layout) */}
        {!isRight && (
          <div
            className={`field-zone ${zoneDim} rounded relative border border-green-500/10 bg-green-950/10 cursor-pointer`}
            onClick={() => onZoneClick(pIdx, "field", 0)}
          >
            <div className="absolute top-0 inset-x-0 text-[7px] font-black text-center bg-green-900/40 uppercase py-0.5">
              FIELD
            </div>
            {p.fieldZone ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <CardVisual
                  size="sm"
                  card={p.fieldZone}
                  isOpponent={!isOwner}
                  onClick={() => onCardInspect(p.fieldZone!)}
                />
              </div>
            ) : (
              <div className="w-full h-full border-2 border-dashed border-white/5 flex items-center justify-center text-[8px] font-bold opacity-10 uppercase">
                FIELD
              </div>
            )}
          </div>
        )}

        {/* Right side: GY / Deck / Extra / Banished */}
        {isRight && (
          <>
            {/* GY */}
            <div
              className={`field-zone ${zoneDim} rounded relative flex items-center justify-center overflow-visible bg-blue-950/10 cursor-pointer`}
              onClick={() => onZoneClick(pIdx, "gy", 0)}
            >
              <div className="absolute top-0 inset-x-0 text-[7px] font-black text-center bg-blue-900/60 uppercase py-0.5 z-10">
                GY
              </div>

              {p.graveyard?.length > 0 ? (
                <CardVisual
                  size="sm"
                  card={p.graveyard[p.graveyard.length - 1]}
                  isOpponent={!isOwner}
                  onClick={() => onCardInspect(p.graveyard[p.graveyard.length - 1])}
                />
              ) : (
                <div className="w-full h-full border-2 border-dashed border-white/5 flex items-center justify-center text-[8px] font-bold opacity-10 uppercase">
                  GY
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 text-[8px] text-center font-bold z-10 bg-black/60">
                {p.graveyard?.length ?? p.graveyardCount ?? 0}
              </div>
            </div>

            {/* Deck */}
            {renderPile("DECK", p.deck?.length ?? p.deckCount ?? 0, isOwner ? "blue" : "red", "https://images.ygoprodeck.com/images/cards/back_high.jpg")}

            {/* Extra */}
            {renderPile("EX", p.extraDeck?.length ?? p.extraDeckCount ?? 0, "yellow", "https://images.ygoprodeck.com/images/cards/back_high.jpg")}

            {/* Banished */}
            {renderPile("BAN", p.banished?.length ?? p.banishedCount ?? 0, "yellow")}
          </>
        )}
      </div>
    );
  };

  const renderZonesRow = (pIdx: number, zoneType: "monster" | "st") => {
    const p = pIdx === 0 ? player : opponent;
    const zones = zoneType === "monster" ? p.monsterZones : p.spellTrapZones;

    return (
      <div className="flex gap-6">
        {zones.map((c: any, i: number) => (
          <div
            key={`${zoneType}_${pIdx}_${i}`}
            className={`field-zone ${zoneDim} rounded cursor-pointer flex items-center justify-center border border-white/5 bg-white/[0.02]`}
            onClick={() => onZoneClick(pIdx, zoneType === "monster" ? "monster" : "st", i)}
          >
            {c ? (
              <CardVisual
                size="sm"
                card={c}
                isOpponent={pIdx === 1}
                onClick={() => onCardInspect(c)}
              />
            ) : (
              <div className="w-full h-full border-2 border-dashed border-white/5 opacity-10" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex bg-[#010103] text-white overflow-hidden select-none">
      {/* LEFT INSPECTOR */}
      <div className="w-64 bg-black/95 border-r border-white/10 p-4 flex flex-col gap-4 z-50 shadow-2xl">
        <h2 className="cinzel text-yellow-500 text-xs font-black border-b border-yellow-500/20 pb-2 uppercase tracking-widest">
          Visualizer
        </h2>

        {inspectedCard ? (
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="w-full aspect-[59/86] rounded-lg border border-white/10 overflow-hidden shadow-2xl">
              <img
                src={inspectedCard.card_images?.[0]?.image_url || "https://images.ygoprodeck.com/images/cards/back_high.jpg"}
                className="w-full h-full object-fill"
                alt="Inspect"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <h3 className="font-black text-blue-400 text-sm mb-1 uppercase leading-tight">
                {inspectedCard.name}
              </h3>

              <div className="flex gap-2 text-[9px] font-bold mb-3 flex-wrap">
                {inspectedCard.attribute && (
                  <span className="bg-blue-900/40 px-2 py-0.5 rounded border border-blue-500/20 uppercase">
                    {inspectedCard.attribute}
                  </span>
                )}
                {inspectedCard.race && (
                  <span className="bg-gray-800 px-2 py-0.5 rounded border border-white/10 uppercase">
                    {inspectedCard.race}
                  </span>
                )}
              </div>

              {typeof inspectedCard.atk === "number" && (
                <div className="flex gap-4 font-mono text-xs font-black bg-black/50 p-2 rounded border border-white/5 mb-3">
                  <span className="text-red-500">ATK {inspectedCard.atk}</span>
                  <span className="text-blue-500">DEF {inspectedCard.def ?? 0}</span>
                </div>
              )}

              <p className="text-[10px] text-white/70 leading-relaxed italic bg-white/5 p-3 rounded">
                {inspectedCard.desc || ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/10 text-[10px] italic text-center px-4 uppercase tracking-tighter">
            Select a card to view details
          </div>
        )}
      </div>

      {/* BOARD */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* TOP BAR PROFILES */}
        <div className="absolute top-4 left-6 right-6 z-50 flex items-center justify-between">
          {renderProfile(opponentMeta, opponent.username, "opp")}
          {renderProfile(playerMeta, player.username, "player")}
        </div>

        {/* OPPONENT FIELD */}
        <div className="flex gap-6 p-6 rounded-2xl bg-white/[0.01] border border-white/5">
          {renderSideZones(opponent as any, 1, false)}

          <div className="flex flex-col gap-6">
            {/* Spell/Trap row */}
            {renderZonesRow(1, "st")}
            {/* Monster row */}
            {renderZonesRow(1, "monster")}
          </div>

          {renderSideZones(opponent as any, 1, true)}
        </div>

        {/* HUD */}
        <div className="flex items-center gap-16 py-8 z-30 scale-90">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-red-500/50 mb-1 tracking-widest uppercase">Opponent</span>
            <div className="text-red-500 font-black text-6xl italic font-mono drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              {opponent.lp}
            </div>

            {/* ✅ mão oponente (backs) */}
            <div className="mt-2 text-[10px] text-white/20 font-mono">
              HAND: {opponentHandCount}
            </div>
          </div>

          <div className="flex flex-col items-center bg-black/90 px-8 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-yellow-500 font-black text-[11px] uppercase tracking-[0.3em] mb-2">
              {duel.currentPhase}
            </div>

            {isPlayerTurn && !["DRAW", "STANDBY"].includes(duel.currentPhase as any) && (
              <button
                onClick={onAdvancePhase}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-[9px] rounded-full font-black uppercase transition-all shadow-lg active:scale-95"
              >
                Pass Phase
              </button>
            )}

            <div className="mt-2 font-mono text-[9px] text-white/30 uppercase">Turn: {duel.turnNumber}</div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-blue-500/50 mb-1 tracking-widest uppercase">Player</span>
            <div className="text-blue-500 font-black text-6xl italic font-mono drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              {player.lp}
            </div>
            <div className="mt-2 text-[10px] text-white/20 font-mono">
              HAND: {playerHand.length}
            </div>
          </div>
        </div>

        {/* PLAYER FIELD */}
        <div className="flex gap-6 p-6 rounded-2xl bg-white/[0.01] border border-white/5">
          {renderSideZones(player as any, 0, false)}

          <div className="flex flex-col gap-6">
            {/* Monster row */}
            {renderZonesRow(0, "monster")}
            {/* Spell/Trap row */}
            {renderZonesRow(0, "st")}
          </div>

          {renderSideZones(player as any, 0, true)}
        </div>

        {/* ✅ PLAYER HAND */}
        <div className="absolute bottom-4 left-6 flex h-44 z-40">
          <div className="flex h-full items-end pb-4">
            {playerHand.map((card: any, i: number) => (
              <div
                key={card?.instanceId || `${i}_${genId()}`}
                className="transition-all duration-300 relative group origin-bottom"
                style={{ marginLeft: i === 0 ? "0" : "-45px" }}
              >
                <div className="group-hover:-translate-y-20 group-hover:scale-125 transition-transform duration-300">
                  <CardVisual
                    size="hand"
                    card={card}
                    // Se for mão "fake" (hidden), mostra verso
                    isHidden={card?.name === "Hidden"}
                    onClick={() => onHandCardClick(i)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ OPONENT HAND (backs) no topo, só visual */}
        <div className="absolute top-24 left-6 flex h-20 z-30 opacity-80">
          <div className="flex h-full items-start">
            {Array.from({ length: Math.min(opponentHandCount, 10) }).map((_, i) => (
              <div key={`opp_hand_${i}`} style={{ marginLeft: i === 0 ? "0" : "-35px" }}>
                <CardVisual
                  size="sm"
                  card={{
                    instanceId: `opp_hidden_${i}`,
                    name: "Hidden",
                    type: "Unknown",
                    desc: "",
                    isFaceUp: false,
                    currentPosition: Position.ATTACK,
                    card_images: [],
                  } as any}
                  isOpponent
                  isHidden
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Board;
