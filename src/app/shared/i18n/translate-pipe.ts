import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18n, TranslationParams } from './i18n';

// Impure so the text updates when the language changes; the lookup is a cheap map access.
/** Pipe `t` that translates English source text via {@link I18n}, with optional `{name}` params. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  /** Returns the translation of `text`, or an empty string for empty, `null` or `undefined` input. */
  transform(text: string | null | undefined, params?: TranslationParams): string {
    return text ? this.i18n.t(text, params) : '';
  }
}
