export interface GameInfo {
  id: string;
  name: string;
  description: string;
  players: string;
  route: string;
  status: 'active' | 'coming-soon';
  icon: 'bidbaazi' | 'rummy' | 'thoso';
  hasModes: boolean;  // whether the game offers selectable modes at room creation
  maxPlayers: number; // upper bound for the room's player-count slider
  hasGuide: boolean;  // whether a standalone /:game/guide page exists
}

export const GAMES: GameInfo[] = [
  {
    id: 'bidbaazi',
    name: 'BidBaazi',
    description: 'Predict your tricks & dominate the felt',
    players: '2–7 Players',
    route: '/bidbaazi',
    status: 'active',
    icon: 'bidbaazi',
    hasModes: true,
    maxPlayers: 7,
    hasGuide: true,
  },
  {
    id: 'rummy',
    name: 'Rummy',
    description: 'Form melds, minimize points & go out first',
    players: '2–6 Players',
    route: '/rummy',
    status: 'coming-soon',
    icon: 'rummy',
    hasModes: false,
    maxPlayers: 6,
    hasGuide: false,
  },
  {
    id: 'thoso',
    name: 'Thoso',
    description: 'Sweep the cards & shed your hand to win',
    players: '2–6 Players',
    route: '/thoso',
    status: 'active',
    icon: 'thoso',
    hasModes: false,
    maxPlayers: 6,
    hasGuide: true,
  },
];
