// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS — board & rules configuration (SINGLE SOURCE OF TRUTH)
//
// Everything about the board lives here. Change any number, name, colour or card
// text and the game follows — no logic edits needed. Positions are 0–35, clockwise
// from START, going UP the left side first (see the plan's board table).
//
// Rent seeds (per property) were generated from each tile's `price` with the
// multipliers in RENT_SEED below, then written out explicitly so you can hand-tune
// any single tile. Re-run the formula in your head as:
//   siteRent  = round10 (price × 0.10)
//   houseRent = round50([price × 0.45, price × 0.80, price × 1.20])   // 1/2/3 houses
//   hotelRent = round100(price × 1.60)
//   buildCost = round100(price × 1.20)                                // same for house & hotel
// ─────────────────────────────────────────────────────────────────────────────

export type BusinessColour = 'red' | 'blue' | 'green' | 'yellow';
export type TileType = 'corner' | 'property' | 'station' | 'utility' | 'tax' | 'card';
export type CornerKind = 'start' | 'club' | 'jail' | 'restHouse';
export type CardKind = 'chance' | 'communityChest';
export type TaxKind = 'income' | 'wealth';

export interface PropertyTile {
  pos: number;
  name: string;
  type: 'property';
  colour: BusinessColour;
  price: number;
  siteRent: number;
  houseRent: [number, number, number]; // rent with 1 / 2 / 3 houses (cumulative)
  hotelRent: number;                    // rent added by the hotel (independent of houses)
  buildCost: number;                    // cost of ONE house OR the hotel (same)
}
export interface StationTile { pos: number; name: string; type: 'station'; price: number; }
export interface UtilityTile { pos: number; name: string; type: 'utility'; price: number; }
export interface TaxTile     { pos: number; name: string; type: 'tax'; tax: TaxKind; }
export interface CardTile    { pos: number; name: string; type: 'card'; card: CardKind; }
export interface CornerTile  { pos: number; name: string; type: 'corner'; corner: CornerKind; }

export type BoardTile =
  | PropertyTile | StationTile | UtilityTile | TaxTile | CardTile | CornerTile;

// Positions of the special tiles (used by cards' "go to" outcomes).
export const POS = { START: 0, CLUB: 9, JAIL: 18, REST_HOUSE: 27, MUMBAI: 1, DARJEELING: 23 } as const;

// ─── The 36 tiles, in board order ───────────────────────────────────────────
export const BOARD: BoardTile[] = [
  { pos: 0,  name: 'START',            type: 'corner',   corner: 'start' },
  { pos: 1,  name: 'Mumbai',           type: 'property', colour: 'red',    price: 8500, siteRent: 850, houseRent: [3800, 6800, 10200], hotelRent: 13600, buildCost: 10200 },
  { pos: 2,  name: 'Water Works',      type: 'utility',  price: 3200 },
  { pos: 3,  name: 'Railway',          type: 'station',  price: 9500 },
  { pos: 4,  name: 'Ahmedabad',        type: 'property', colour: 'blue',   price: 8500, siteRent: 850, houseRent: [3800, 6800, 10200], hotelRent: 13600, buildCost: 10200 },
  { pos: 5,  name: 'Income Tax',       type: 'tax',      tax: 'income' },
  { pos: 6,  name: 'Indore',           type: 'property', colour: 'green',  price: 1500, siteRent: 150, houseRent: [700, 1200, 1800],    hotelRent: 2400,  buildCost: 1800 },
  { pos: 7,  name: 'Chance',           type: 'card',     card: 'chance' },
  { pos: 8,  name: 'Jaipur',           type: 'property', colour: 'yellow', price: 3000, siteRent: 300, houseRent: [1350, 2400, 3600],   hotelRent: 4800,  buildCost: 3600 },
  { pos: 9,  name: 'CLUB',             type: 'corner',   corner: 'club' },
  { pos: 10, name: 'New Delhi',        type: 'property', colour: 'red',    price: 6000, siteRent: 600, houseRent: [2700, 4800, 7200],   hotelRent: 9600,  buildCost: 7200 },
  { pos: 11, name: 'Chandigarh',       type: 'property', colour: 'blue',   price: 2500, siteRent: 250, houseRent: [1150, 2000, 3000],   hotelRent: 4000,  buildCost: 3000 },
  { pos: 12, name: 'Electric Company', type: 'utility',  price: 2500 },
  { pos: 13, name: 'BEST',             type: 'station',  price: 3500 },
  { pos: 14, name: 'Shimla',           type: 'property', colour: 'green',  price: 2200, siteRent: 220, houseRent: [1000, 1750, 2650],   hotelRent: 3500,  buildCost: 2600 },
  { pos: 15, name: 'Amritsar',         type: 'property', colour: 'yellow', price: 3300, siteRent: 330, houseRent: [1500, 2650, 3950],   hotelRent: 5300,  buildCost: 4000 },
  { pos: 16, name: 'Community Chest',  type: 'card',     card: 'communityChest' },
  { pos: 17, name: 'Srinagar',         type: 'property', colour: 'red',    price: 5000, siteRent: 500, houseRent: [2250, 4000, 6000],   hotelRent: 8000,  buildCost: 6000 },
  { pos: 18, name: 'JAIL',             type: 'corner',   corner: 'jail' },
  { pos: 19, name: 'Agra',             type: 'property', colour: 'blue',   price: 2500, siteRent: 250, houseRent: [1150, 2000, 3000],   hotelRent: 4000,  buildCost: 3000 },
  { pos: 20, name: 'Chance',           type: 'card',     card: 'chance' },
  { pos: 21, name: 'Kanpur',           type: 'property', colour: 'green',  price: 4000, siteRent: 400, houseRent: [1800, 3200, 4800],   hotelRent: 6400,  buildCost: 4800 },
  { pos: 22, name: 'Patna',            type: 'property', colour: 'yellow', price: 2000, siteRent: 200, houseRent: [900, 1600, 2400],    hotelRent: 3200,  buildCost: 2400 },
  { pos: 23, name: 'Darjeeling',       type: 'property', colour: 'red',    price: 2500, siteRent: 250, houseRent: [1150, 2000, 3000],   hotelRent: 4000,  buildCost: 3000 },
  { pos: 24, name: 'Air India',        type: 'station',  price: 10500 },
  { pos: 25, name: 'Kolkata',          type: 'property', colour: 'blue',   price: 6500, siteRent: 650, houseRent: [2950, 5200, 7800],   hotelRent: 10400, buildCost: 7800 },
  { pos: 26, name: 'Hyderabad',        type: 'property', colour: 'green',  price: 3500, siteRent: 350, houseRent: [1600, 2800, 4200],   hotelRent: 5600,  buildCost: 4200 },
  { pos: 27, name: 'REST HOUSE',       type: 'corner',   corner: 'restHouse' },
  { pos: 28, name: 'Chennai',          type: 'property', colour: 'yellow', price: 7000, siteRent: 700, houseRent: [3150, 5600, 8400],   hotelRent: 11200, buildCost: 8400 },
  { pos: 29, name: 'Community Chest',  type: 'card',     card: 'communityChest' },
  { pos: 30, name: 'Bengaluru',        type: 'property', colour: 'red',    price: 4000, siteRent: 400, houseRent: [1800, 3200, 4800],   hotelRent: 6400,  buildCost: 4800 },
  { pos: 31, name: 'Wealth Tax',       type: 'tax',      tax: 'wealth' },
  { pos: 32, name: 'Mysore',           type: 'property', colour: 'blue',   price: 2500, siteRent: 250, houseRent: [1150, 2000, 3000],   hotelRent: 4000,  buildCost: 3000 },
  { pos: 33, name: 'Cochin',           type: 'property', colour: 'green',  price: 3000, siteRent: 300, houseRent: [1350, 2400, 3600],   hotelRent: 4800,  buildCost: 3600 },
  { pos: 34, name: 'Motor Boat',       type: 'station',  price: 5500 },
  { pos: 35, name: 'Goa',              type: 'property', colour: 'yellow', price: 4000, siteRent: 400, houseRent: [1800, 3200, 4800],   hotelRent: 6400,  buildCost: 4800 },
];

// ─── Chance / Community Chest — dice-parity outcomes ─────────────────────────
// When you land on a card tile, the DICE TOTAL that brought you there selects the
// outcome: even totals (2/4/6/8/10/12) index the `even` map, odd (3/5/7/9/11) the
// `odd` map. Effects apply automatically and are announced via the banner.
//   requiresBuildings: skipped (no charge) if the player owns no house/hotel.
export type CardOutcome =
  | { kind: 'credit'; amount: number; label: string }
  | { kind: 'debit'; amount: number; label: string; requiresBuildings?: boolean }
  | { kind: 'collectEach'; amount: number; label: string } // collect `amount` from every other player
  | { kind: 'perBuilding'; house: number; hotel: number; label: string; requiresBuildings?: boolean }
  | { kind: 'goto'; target: number; collectIfPass?: boolean; label: string };

export interface CardDeck { even: Record<number, CardOutcome>; odd: Record<number, CardOutcome>; }

export const CHANCE: CardDeck = {
  even: {
    2:  { kind: 'debit',  amount: 2000, label: 'Share-market loss' },
    4:  { kind: 'debit',  amount: 1000, label: 'Fine - driving under influence' },
    6:  { kind: 'debit',  amount: 1500, label: 'House repairs', requiresBuildings: true },
    8:  { kind: 'debit',  amount: 3000, label: 'Fire in godown', requiresBuildings: true },
    10: { kind: 'goto',   target: POS.JAIL,       label: 'Go to Jail' },
    12: { kind: 'goto',   target: POS.REST_HOUSE, label: 'Go to Rest House' },
  },
  odd: {
    3:  { kind: 'credit', amount: 2500, label: 'Lottery prize' },
    5:  { kind: 'credit', amount: 1000, label: 'Crossword prize' },
    7:  { kind: 'credit', amount: 2000, label: 'Jackpot' },
    9:  { kind: 'goto',   target: POS.CLUB, label: 'Go to Club - miss your next turn' }, // CLUB is the one corner no other card uses (JAIL/REST HOUSE already appear)
    11: { kind: 'credit', amount: 3000, label: 'Best export performance' },
  },
};

export const COMMUNITY_CHEST: CardDeck = {
  even: {
    2:  { kind: 'collectEach', amount: 500,  label: 'Birthday - ₹500 from each player' },
    4:  { kind: 'credit',      amount: 2500, label: 'Reality-TV 1st prize' },
    6:  { kind: 'credit',      amount: 2000, label: 'Income-tax refund' },
    8:  { kind: 'goto',        target: POS.REST_HOUSE, label: 'Go to Rest House' },
    10: { kind: 'credit',      amount: 1500, label: 'Shares interest' },
    12: { kind: 'credit',      amount: 3000, label: 'Stock sale' },
  },
  odd: {
    3:  { kind: 'goto',        target: POS.JAIL, label: 'Go to Jail' },
    5:  { kind: 'debit',       amount: 1000, label: 'School & medical fees' },
    7:  { kind: 'debit',       amount: 2000, label: 'Marriage celebration' },
    9:  { kind: 'perBuilding', house: 50, hotel: 100, label: 'General repairs', requiresBuildings: true },
    11: { kind: 'debit',       amount: 1500, label: 'Insurance premium' },
  },
};

// ─── Global rules (all editable) ─────────────────────────────────────────────
export interface BusinessGlobals {
  startingCash: number;
  startBonus: number;              // collected on passing/landing START
  incomeTaxPerProperty: number;    // Income Tax = this × count of CITY properties you own
  wealthTaxPerBuilding: number;    // Wealth Tax  = this × count of buildings (house/hotel) you own
  jailFine: number;                // paid on landing JAIL; turn is NOT skipped
  stationRent: [number, number, number, number]; // rent by how many of the 4 stations you own
  utilityMultiplier: { one: number; both: number }; // rent = dice × (own one → one, own both → both)
  mortgageRate: number;            // land mortgage payout = price × this
  unmortgageInterest: number;      // repay payout × (1 + this)
  maxHouses: number;               // houses before/besides the hotel
  buildColourThreshold: number;    // own this many of a colour to unlock building
  rejectCooldownMs: number;        // after a rejected offer, wait this long before re-offering the SAME player
}

export const GLOBALS: BusinessGlobals = {
  startingCash: 15000,
  startBonus: 1500,
  incomeTaxPerProperty: 200,
  wealthTaxPerBuilding: 1000,
  jailFine: 200,
  stationRent: [1000, 2000, 4000, 8000],
  utilityMultiplier: { one: 4, both: 10 },
  mortgageRate: 0.5,
  unmortgageInterest: 0.1,
  maxHouses: 3,
  buildColourThreshold: 3,
  rejectCooldownMs: 5 * 60 * 1000,
};

// Reference only — the multipliers used to seed the per-tile rents above.
export const RENT_SEED = { site: 0.10, house: [0.45, 0.80, 1.20], hotel: 1.60, build: 1.20 } as const;
