export interface GameInfo {
  id: string;
  name: string;
  description: string;
  players: string;
  route: string;
  status: 'active' | 'coming-soon';
  icon: 'bid-club' | 'rummy' | 'mindi';
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
    status: 'active',
    icon: 'rummy',
  },
  {
    id: 'mindi',
    name: 'Mindi',
    description: 'Capture the tens & lead your team to victory',
    players: '4 Players',
    route: '/mindi',
    status: 'coming-soon',
    icon: 'mindi',
  },
];
