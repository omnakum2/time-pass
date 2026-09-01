export interface GameInfo {
  id: string;
  name: string;
  description: string;
  players: string;
  route: string;
  status: 'active' | 'coming-soon';
  icon: 'bid-club' | 'rummy' | 'thoso';
  hasModes: boolean;  // whether the game offers selectable modes at room creation
  maxPlayers: number; // upper bound for the room's player-count slider
}

export const GAMES: GameInfo[] = [
  {
    id: 'bid-club',
    name: 'Bid Club',
    description: 'Predict your tricks & dominate the felt',
    players: '2–7 Players',
    route: '/bid-club',
    status: 'active',
    icon: 'bid-club',
    hasModes: true,
    maxPlayers: 7,
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
  },
];
