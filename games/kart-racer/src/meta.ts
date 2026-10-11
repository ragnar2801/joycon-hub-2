import type { GameDefinition } from '@joyconhub/game-sdk';

export const kartRacerMeta: Omit<GameDefinition, 'load'> = {
  id: 'kart-racer',
  title: 'Sunny Escape',
  tagline: 'Keep moving. Make your escape.',
  description:
    'Drift for boost, collect repairs and shields, and blast your way past enemy cars on a winding 3D escape road!',
  accent: '#eaa04a',
  icon: '🏁',
  controllerLayout: {
    buttons: [
      { id: 'fire', label: 'Fire' },
      { id: 'brake', label: 'Brake / Drift' },
      { id: 'recover', label: 'Back on track' },
    ],
    showThrottle: false,
    theme: 'light',
    indicator: 'wheel',
    scoreFormat: 'time',
  },
  available: true,
};
