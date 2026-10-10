import type { MiniGame } from '@joyconhub/game-sdk';
import { SkyTiltGame } from './game.ts';

export { skyTiltMeta } from './meta.ts';

export function createGame(): MiniGame {
  return new SkyTiltGame();
}
