/** Whole-screen stage mode: normalize persisted flag and clear it on summon hide. */

export const normalizeWholeScreen = (v) => v === true;

/** If mode is on, turn it off on the config object. Returns whether it changed. */
export function clearWholeScreenOnHide(config) {
  if (!normalizeWholeScreen(config?.wholeScreen)) return false;
  config.wholeScreen = false;
  return true;
}
