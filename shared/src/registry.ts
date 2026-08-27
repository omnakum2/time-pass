export interface GameInfo {
  id: string;
  name: string;
  description: string;
  players: string;
  route: string;
  status: 'active' | 'coming-soon';
  icon: 'bid-club' | 'rummy' | 'thoso';
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
  },
  {
    id: 'rummy',
    name: 'Rummy',
    description: 'Form melds, minimize points & go out first',
    players: '2–6 Players',
    route: '/rummy',
    status: 'coming-soon',
    icon: 'rummy',
  },
  {
    id: 'thoso',
    name: 'Thoso',
    description: 'Sweep the cards & shed your hand to win',
    players: '2–4 Players',
    route: '/thoso',
    status: 'coming-soon',
    icon: 'thoso',
  },
];
