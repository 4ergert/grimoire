import { Injectable, computed, signal } from '@angular/core';

export interface BoardTheme {
  id: string;
  name: string;
  dark: string;
  light: string;
}

export const BOARD_THEMES: readonly BoardTheme[] = [
  { id: 'classic', name: 'Classic', dark: '#0000003e', light: '#fafafab0' },
  { id: 'walnut', name: 'Walnut', dark: '#6b4428d9', light: '#e8cfa4d9' },
  { id: 'forest', name: 'Forest', dark: '#3d6b45d9', light: '#e1e8c9d9' },
  { id: 'ocean', name: 'Ocean', dark: '#3a5a7ad9', light: '#d3e0ecd9' },
  { id: 'rose', name: 'Rose', dark: '#8a4a5ed9', light: '#f3dde3d9' },
];

const STORAGE_KEY = 'grimoire.boardTheme';

@Injectable({ providedIn: 'root' })
export class BoardThemeService {
  private readonly index = signal(this.restore());
  readonly theme = computed(() => BOARD_THEMES[this.index()]);

  next(): void {
    const index = (this.index() + 1) % BOARD_THEMES.length;
    this.index.set(index);
    try {
      localStorage.setItem(STORAGE_KEY, BOARD_THEMES[index].id);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session only.
    }
  }

  private restore(): number {
    try {
      const index = BOARD_THEMES.findIndex((theme) => theme.id === localStorage.getItem(STORAGE_KEY));
      return Math.max(0, index);
    } catch {
      return 0;
    }
  }
}
