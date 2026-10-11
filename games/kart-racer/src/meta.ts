import type { GameDefinition } from '@joyconhub/game-sdk';

export const kartRacerMeta: Omit<GameDefinition, 'load'> = {
  id: 'kart-racer',
  title: 'Sunny Escape',
  tagline: 'Keep moving. Make your escape.',
  description:
    'Tilt your phone to steer a 3D kart down a winding escape route. Reach the safe zone before time runs out.',
  accent: '#eaa04a',
  icon: '🏁',
  controllerLayout: {
    buttons: [
      { id: 'fire', label: 'Fire' },
      { id: 'brake', label: 'Brake' },
      { id: 'recover', label: 'Back on track' },
    ],
    showThrottle: false,
    theme: 'light',
    indicator: 'wheel',
    scoreFormat: 'time',
  },
  available: true,
};
