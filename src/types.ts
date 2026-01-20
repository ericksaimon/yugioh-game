
export enum Phase {
  DRAW = 'DRAW',
  STANDBY = 'STANDBY',
  MAIN1 = 'MAIN 1',
  BATTLE = 'BATTLE',
  MAIN2 = 'MAIN 2',
  END = 'END'
}

export enum Position {
  ATTACK = 'ATK',
  DEFENSE_FACE_UP = 'DEF_UP',
  DEFENSE_FACE_DOWN = 'DEF_DOWN'
}

export enum RPSChoice {
  ROCK = 'Pedra',
  PAPER = 'Papel',
  SCISSORS = 'Tesoura'
}

export interface YGOCard {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race: string;
  attribute?: string;
  card_images: {
    image_url: string;
    image_url_small: string;
  }[];
}

export interface CardInGame extends YGOCard {
  instanceId: string;
  currentPosition: Position;
  canAttack: boolean;
  hasActivatedEffect: boolean;
  isFaceUp: boolean;
  turnSummoned: number;
  hasChangedPositionThisTurn: boolean;
  hasAttackedThisTurn: boolean;
}

export interface PlayerState {
  id: string;
  username: string;
  lp: number;
  deck: CardInGame[];
  hand: CardInGame[];
  monsterZones: (CardInGame | null)[]; 
  spellTrapZones: (CardInGame | null)[];
  fieldZone: CardInGame | null;
  graveyard: CardInGame[];
  banished: CardInGame[];
  extraDeck: CardInGame[];
  normalSummonedThisTurn: boolean;
}

export interface DuelState {
  players: [PlayerState, PlayerState];
  turnPlayerIndex: number;
  starterPlayerIndex: number;
  currentPhase: Phase;
  turnNumber: number;
  log: string[];
  chain: any[];
  winnerId: string | null;
}
