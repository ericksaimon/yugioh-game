import React from "react";
import { CardInGame, Position } from "../types";

interface CardVisualProps {
  card: CardInGame;
  onClick?: (e: React.MouseEvent) => void;
  isOpponent?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  isHidden?: boolean;
  size?: "xs" | "sm" | "md" | "hand";
}

const CardVisual: React.FC<CardVisualProps> = ({ card, onClick, isOpponent, isHidden, size = "md" }) => {
  const pos = (card as any)?.currentPosition ?? Position.ATTACK;
  const isDefense = pos !== Position.ATTACK;
  const isHand = size === "hand";

  const isFaceUp = !!(card as any)?.isFaceUp;

  // ✅ No campo: se não estiver face-up, mostra verso.
  // ✅ Na mão: dono vê frente (mas se for hidden, força verso).
  const shouldShowBack = ((!isFaceUp && !isHand) || isHidden) === true;

  const sizeClasses: Record<string, string> = {
    xs: "w-6 aspect-[59/86]",
    sm: "w-10 md:w-12 lg:w-14 aspect-[59/86]",
    md: "w-12 md:w-14 lg:w-16 aspect-[59/86]",
    hand: "w-24 md:w-28 lg:w-32 aspect-[59/86]",
  };

  const backImg = "https://images.ygoprodeck.com/images/cards/back_high.jpg";
  const frontImg =
    (card as any)?.card_images?.[0]?.image_url ||
    (card as any)?.image_url ||
    (card as any)?.image ||
    backImg;

  const isMonster = ((card as any)?.type || "").includes("Monster");

  return (
    <div
      className={`relative cursor-pointer select-none transition-all duration-300 ${
        isDefense ? "rotate-90" : "hover:scale-105 hover:z-20"
      } ${sizeClasses[size]}`}
      onClick={onClick}
    >
      <div
        className={`w-full h-full rounded-sm shadow-2xl overflow-hidden border ${
          isOpponent ? "border-red-900/60" : "border-blue-900/60"
        } bg-gray-950`}
      >
        <div className="w-full h-full relative">
          <img
            src={shouldShowBack ? backImg : frontImg}
            alt={(card as any)?.name || "Card"}
            className="w-full h-full object-fill"
            onError={(e) => {
              (e.target as HTMLImageElement).src = backImg;
            }}
          />
        </div>
      </div>

      {/* ✅ ATK/DEF só se for monstro e face-up e não for hand */}
      {isFaceUp && isMonster && size !== "xs" && !isHand && (
        <div
          className={`absolute ${
            isDefense ? "-top-1 -right-8 rotate-[-90deg]" : "-bottom-1 -right-1"
          } bg-black/95 text-[7px] md:text-[9px] px-2 py-0.5 rounded border border-yellow-600/50 flex flex-col items-center z-10 font-mono font-bold shadow-2xl min-w-[30px]`}
        >
          <span className="text-red-500">{(card as any)?.atk ?? 0}</span>
          <div className="w-full h-[1px] bg-white/10 my-0.5"></div>
          <span className="text-blue-400">{(card as any)?.def ?? 0}</span>
        </div>
      )}

      {!!(card as any)?.hasAttackedThisTurn && !isHand && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-sm">
          <span className="text-[10px] font-black text-red-500/80 rotate-45 border-2 border-red-500/40 px-2 py-0.5 bg-black/40">
            EXPENDED
          </span>
        </div>
      )}
    </div>
  );
};

export default CardVisual;
