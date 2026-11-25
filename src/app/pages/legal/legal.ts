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
export class Legal {
  readonly routeData = toSignal(inject(ActivatedRoute).data);
  private readonly i18n = inject(I18n);
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
