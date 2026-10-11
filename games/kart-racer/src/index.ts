import type { MiniGame } from '@joyconhub/game-sdk';
import { KartRacerGame } from './game.ts';
import './style.css';

export function createGame(): MiniGame {
  return new KartRacerGame();
}
