// Lets the currently-mounted screen handle the hardware/gesture back button
// itself (e.g. closing an open form, or going from a detail view back to a
// list) before App.tsx falls through to its own route-history navigation.
// Only one screen is ever mounted at a time, so a single slot is enough.
let handler: (() => boolean) | null = null;

export function setScreenBackHandler(fn: () => boolean): void {
  handler = fn;
}

export function clearScreenBackHandler(fn: () => boolean): void {
  if (handler === fn) handler = null;
}

export function runScreenBackHandler(): boolean {
  return handler ? handler() : false;
}
