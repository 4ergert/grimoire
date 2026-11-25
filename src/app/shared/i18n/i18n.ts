import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DE } from './de';

export type Language = 'en' | 'de';

const STORAGE_KEY = 'grimoire.language';

/**
 * Marks an English source string for translation without translating it yet.
 * Use it where text is stored or thrown; the display translates it with the `t` pipe.
 */
export function tr(text: string): string {
  return text;
}

export type TranslationParams = Record<string, string | number>;

// English source text is the key. A missing German entry falls back to the English text.
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly document = inject(DOCUMENT);
  readonly language = signal<Language>(this.restore());

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.language();
    });
  }

  setLanguage(language: Language): void {
    this.language.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session only.
    }
  }

  t(text: string, params?: TranslationParams): string {
    const translated = this.language() === 'de' ? (DE[text] ?? text) : text;
    return params
      ? translated.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
          name in params ? String(params[name]) : placeholder,
        )
      : translated;
  }

  private restore(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'de') return stored;
    } catch {
      // Unreadable storage: fall back to the browser language.
    }
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')
      ? 'de'
      : 'en';
  }
}
