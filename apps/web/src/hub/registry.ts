import type { GameDefinition } from '@joyconhub/game-sdk';
import { skyTiltMeta } from '@joyconhub/sky-tilt/meta';
import { tiltRacerMeta } from '@joyconhub/tilt-racer/meta';
import { kartRacerMeta } from '@joyconhub/kart-racer/meta';

/** Every game in the hub. Add a game: create games/<name>, then add one entry here. */
export const GAMES: GameDefinition[] = [
  { ...skyTiltMeta, load: () => import('@joyconhub/sky-tilt') },
  { ...tiltRacerMeta, load: () => import('@joyconhub/tilt-racer') },
  { ...kartRacerMeta, load: () => import('@joyconhub/kart-racer') },
  {
    id: 'marble-maze',
    title: 'Marble Maze',
    tagline: 'Tilt the board',
    description: 'Roll a marble through twisting mazes without dropping it into the holes.',
    accent: '#3fa9ff',
    icon: '🌀',
    controllerLayout: { buttons: [], showThrottle: false },
    available: false,
  },
  {
    id: 'fishing',
    title: 'Fishing Frenzy',
    tagline: 'Cast with a flick',
    description: 'Flick your wrist to cast, twist to reel in. How big can you catch?',
    accent: '#4dff88',
    icon: '🎣',
    controllerLayout: { buttons: [], showThrottle: false },
    available: false,
  },
];

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
