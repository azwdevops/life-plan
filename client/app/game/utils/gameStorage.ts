import type { GameState } from "../types";

const GAME_STORAGE_KEY = "life-plan-game-state";

export function saveGame(gameState: GameState): void {
  try {
    const gameData = JSON.parse(JSON.stringify(gameState)); // Deep clone
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameData));
  } catch (error) {
    console.error("Failed to save game:", error);
    // If storage is full, try to clear and save again
    if (error instanceof DOMException && error.code === 22) {
      try {
        localStorage.removeItem(GAME_STORAGE_KEY);
        localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
      } catch (retryError) {
        console.error("Failed to save game after clearing storage:", retryError);
      }
    }
  }
}

export function loadGame(): GameState | null {
  try {
    const stored = localStorage.getItem(GAME_STORAGE_KEY);
    if (!stored) return null;
    
    const gameState = JSON.parse(stored) as GameState;
    // Convert date strings back to Date objects
    return {
      ...gameState,
      startDate: new Date(gameState.startDate),
    };
  } catch (error) {
    console.error("Failed to load game:", error);
    return null;
  }
}

export function clearGame(): void {
  localStorage.removeItem(GAME_STORAGE_KEY);
}

