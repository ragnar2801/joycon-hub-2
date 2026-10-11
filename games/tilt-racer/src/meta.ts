import type { GameDefinition } from '@joyconhub/game-sdk';

export const tiltRacerMeta: Omit<GameDefinition, 'load'> = {
  id: 'tilt-racer',
  title: 'Tilt Racer',
  tagline: 'A little car. A sunny circuit.',
  description:
    'Tilt to steer around a bright oval track. Finish three laps and beat your best time.',
  accent: '#55bfa3',
  icon: '🏎️',
  controllerLayout: {
    buttons: [{ id: 'recover', label: 'Back on track' }],
    showThrottle: true,
    scoreFormat: 'time',
  },
  available: true,
};
