import { Injectable, computed, signal } from '@angular/core';

import { tr } from '../i18n/i18n';

/** A board color scheme; `dark` and `light` are CSS color values for the two square colors. */
export interface BoardTheme {
  id: string;
  name: string;
  dark: string;
  light: string;
}

/** Id of the theme whose colors the user can choose. */
export const CUSTOM_THEME_ID = 'custom';

/** All selectable themes, in the order in which {@link BoardThemeService.next} cycles through them. */
export const BOARD_THEMES: readonly BoardTheme[] = [
  { id: 'classic', name: tr('Classic'), dark: '#0000003e', light: '#fafafab0' },
  { id: 'walnut', name: tr('Walnut'), dark: '#6b4428d9', light: '#e8cfa4d9' },
  { id: 'forest', name: tr('Forest'), dark: '#3d6b45d9', light: '#e1e8c9d9' },
  { id: 'ocean', name: tr('Ocean'), dark: '#3a5a7ad9', light: '#d3e0ecd9' },
  { id: 'rose', name: tr('Rose'), dark: '#8a4a5ed9', light: '#f3dde3d9' },
  // The colors of the custom theme are replaced by the user's choice.
  { id: CUSTOM_THEME_ID, name: tr('Custom'), dark: '#7a5a3c', light: '#e9d8b4' },
];

/** Which of the two square colors of a theme is meant. */
export type SquareColor = 'dark' | 'light';

const STORAGE_KEY = 'grimoire.boardTheme';
const CUSTOM_STORAGE_KEY = 'grimoire.boardTheme.custom';
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Holds the selected board theme and the user's custom colors, persisted in `localStorage` when available. */
@Injectable({ providedIn: 'root' })
export class BoardThemeService {
  private readonly index = signal(this.restore());
  private readonly customColors = signal(this.restoreCustom());
  /** The active theme; for the custom theme, the user's colors are already applied. */
  readonly theme = computed<BoardTheme>(() => {
    const theme = BOARD_THEMES[this.index()];
    return theme.id === CUSTOM_THEME_ID ? { ...theme, ...this.customColors() } : theme;
  });
  /** Whether the custom theme is active. */
  readonly isCustom = computed(() => this.theme().id === CUSTOM_THEME_ID);

  /** Switches to the next theme, wrapping around after the last one, and persists the choice. */
  next(): void {
    const index = (this.index() + 1) % BOARD_THEMES.length;
    this.index.set(index);
    this.store(STORAGE_KEY, BOARD_THEMES[index].id);
  }

  /**
   * Sets one square color of the custom theme and persists it.
   *
   * @param color - A `#rrggbb` hex color; any other value is silently ignored.
   */
  setCustomColor(square: SquareColor, color: string): void {
    if (!COLOR_PATTERN.test(color)) return;
    this.customColors.update((colors) => ({ ...colors, [square]: color.toLowerCase() }));
    this.store(CUSTOM_STORAGE_KEY, JSON.stringify(this.customColors()));
  }

  private store(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
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

  private restoreCustom(): Record<SquareColor, string> {
    const defaults = BOARD_THEMES.find((theme) => theme.id === CUSTOM_THEME_ID)!;
    const colors = { dark: defaults.dark, light: defaults.light };
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) ?? 'null');
      if (typeof stored === 'object' && stored !== null) {
        const { dark, light } = stored as Partial<Record<SquareColor, unknown>>;
        if (typeof dark === 'string' && COLOR_PATTERN.test(dark)) colors.dark = dark;
        if (typeof light === 'string' && COLOR_PATTERN.test(light)) colors.light = light;
      }
    } catch {
      // Unreadable or unavailable storage: keep the defaults.
    }
    return colors;
  }
}
