import type { GameDefinition } from '@joyconhub/game-sdk';

/** Card + controller metadata; kept separate so the hub can list the game without loading Three.js. */
export const skyTiltMeta: Omit<GameDefinition, 'load'> = {
  id: 'sky-tilt',
  title: 'Sky Tilt',
  tagline: 'Tilt your phone to fly',
  description:
    'Bank and climb through golden rings over an endless low-poly island. Every ring buys you time. Hold Boost to go faster.',
  accent: '#ffb547',
  icon: '✈️',
  controllerLayout: {
    buttons: [{ id: 'boost', label: 'Boost' }],
    showThrottle: true,
  },
  available: true,
};
