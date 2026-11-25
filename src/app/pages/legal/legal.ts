import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegalFooter } from '../../shared/components/legal-footer/legal-footer';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { I18n } from '../../shared/i18n/i18n';
import { LegalDe } from './legal-de/legal-de';

@Component({
  selector: 'app-legal',
  imports: [RouterLink, LegalFooter, LanguageSwitcher, LegalDe],
  templateUrl: './legal.html',
  styleUrl: './legal.scss',
})
/**
 * Legal page shared by the legal notice, privacy policy and terms of use routes.
 * The route `data` flags (`privacy`, `terms`) select which document is shown.
 */
export class Legal {
  /** Data of the active route; `undefined` until the first emission. */
  readonly routeData = toSignal(inject(ActivatedRoute).data);
  private readonly i18n = inject(I18n);
  /** Whether the current UI language is German, which selects the German legal texts. */
  readonly german = computed(() => this.i18n.language() === 'de');
  private readonly title = inject(Title);

  constructor() {
    // The route title is the English default; this keeps the document title in step with the language.
    effect(() => {
      const data = this.routeData();
      this.title.setTitle(
        this.german()
          ? `${data?.['privacy'] ? 'Datenschutzerklärung' : data?.['terms'] ? 'Nutzungsbedingungen' : 'Impressum'} | Grimoire`
          : `${data?.['privacy'] ? 'Privacy policy' : data?.['terms'] ? 'Terms of Use' : 'Legal notice'} | Grimoire`,
      );
    });
  }
}
