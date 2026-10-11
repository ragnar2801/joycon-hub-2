import type { MiniGame } from '@joyconhub/game-sdk';
import { TiltRacerGame } from './game.ts';
import './style.css';

export function createGame(): MiniGame {
  return new TiltRacerGame();
}
