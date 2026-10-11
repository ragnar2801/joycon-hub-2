import type { GameDefinition } from '@joyconhub/game-sdk';

export const kartRacerMeta: Omit<GameDefinition, 'load'> = {
  id: 'kart-racer',
  title: 'Sunny Escape',
  tagline: 'Keep moving. Make your escape.',
  description:
    'Tilt to steer, blast blockages and enemy cars, and escape down a winding 3D road. Make it to the safe zone!',
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
