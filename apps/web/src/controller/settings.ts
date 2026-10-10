import { readJSON, writeJSON } from '../shared/storage.ts';

export interface ControllerSettings {
  /** degrees of tilt for full bank */
  sensitivity: number;
  invertPitch: boolean;
  invertRoll: boolean;
  /** twist the phone (gyro) for extra rudder */
  rudder: boolean;
  haptics: boolean;
}

const KEY = 'joyconhub:controller-settings';

export const DEFAULT_SETTINGS: ControllerSettings = {
  sensitivity: 35,
  invertPitch: false,
  invertRoll: false,
  rudder: false,
  haptics: true,
};

export function loadSettings(): ControllerSettings {
  return readJSON('local', KEY, DEFAULT_SETTINGS);
}

export function saveSettings(s: ControllerSettings): void {
  writeJSON('local', KEY, s);
}
