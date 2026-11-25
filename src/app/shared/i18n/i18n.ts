import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DE } from './de';

/** Supported UI languages: English (source text) and German. */
export type Language = 'en' | 'de';

const STORAGE_KEY = 'grimoire.language';

/**
 * Marks an English source string for translation without translating it yet.
 * Use it where text is stored or thrown; the display translates it with the `t` pipe.
 */
export function tr(text: string): string {
  return text;
}

/** Values substituted for `{name}` placeholders in a translated string. */
export type TranslationParams = Record<string, string | number>;

// English source text is the key. A missing German entry falls back to the English text.
/** Holds the current UI language (persisted in local storage) and translates English source strings. */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly document = inject(DOCUMENT);
  /** Current language; initialised from storage, else the browser language, else English. */
  readonly language = signal<Language>(this.restore());

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.language();
    });
  }

  /** Sets the language and remembers it in local storage; if storage is unavailable it only applies to this session. */
  setLanguage(language: Language): void {
    this.language.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session only.
    }
  }

  /**
   * Translates an English source string into the current language, reading the language signal
   * so reactive callers update on change.
   * @param text - English source text, used as the lookup key; returned unchanged if there is no German entry.
   * @param params - Values for `{name}` placeholders; placeholders without a matching key are left as is.
   */
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
