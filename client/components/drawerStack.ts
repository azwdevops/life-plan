type DrawerRegistration = {
  id: number;
  stackLevel: number;
  onClose: () => void;
};

let nextId = 0;
const openDrawers: DrawerRegistration[] = [];
let listenerAttached = false;

function getTopDrawer(): DrawerRegistration | undefined {
  if (openDrawers.length === 0) return undefined;
  return openDrawers.reduce((best, entry) => {
    if (entry.stackLevel > best.stackLevel) return entry;
    if (entry.stackLevel === best.stackLevel && entry.id > best.id) return entry;
    return best;
  });
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  const top = getTopDrawer();
  if (!top) return;
  event.preventDefault();
  top.onClose();
}

function syncListener() {
  if (openDrawers.length > 0 && !listenerAttached) {
    window.addEventListener("keydown", onKeyDown);
    listenerAttached = true;
    return;
  }
  if (openDrawers.length === 0 && listenerAttached) {
    window.removeEventListener("keydown", onKeyDown);
    listenerAttached = false;
  }
}

/** Registers an open drawer so Escape closes only the topmost one. Call the returned cleanup when the drawer closes/unmounts. */
export function registerDrawerStackEntry(
  stackLevel: number,
  onClose: () => void
): () => void {
  const entry: DrawerRegistration = { id: nextId++, stackLevel, onClose };
  openDrawers.push(entry);
  syncListener();
  return () => {
    const index = openDrawers.indexOf(entry);
    if (index >= 0) openDrawers.splice(index, 1);
    syncListener();
  };
}
