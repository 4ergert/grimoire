import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18n, TranslationParams } from './i18n';

// Impure so the text updates when the language changes; the lookup is a cheap map access.
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(text: string | null | undefined, params?: TranslationParams): string {
    return text ? this.i18n.t(text, params) : '';
  }
}
