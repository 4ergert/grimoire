import { Component, inject } from '@angular/core';
import { I18n } from '../../i18n/i18n';
import { TranslatePipe } from '../../i18n/translate-pipe';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss',
})
/** Control that switches the UI language between English and German. */
export class LanguageSwitcher {
  readonly i18n = inject(I18n);

  // A press anywhere on the switcher (including its buttons, via bubbling) flips the language.
  /** Switches to German if the current language is English, otherwise to English. */
  toggle(): void {
    this.i18n.setLanguage(this.i18n.language() === 'de' ? 'en' : 'de');
  }
}
