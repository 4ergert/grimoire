import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { I18n } from '../../shared/i18n/i18n';
import { Legal } from './legal';

describe('Legal pages', () => {
  it('should allow public navigation between both drafts and link back to login', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/impressum', Legal);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Legal notice');
    expect(harness.routeNativeElement?.textContent).toContain('unreviewed draft');
    expect(document.title).toBe('Legal notice | Grimoire');
    expect(harness.routeNativeElement?.querySelector('.draft')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Third-party material');
    expect(
      harness.routeNativeElement?.querySelector(
        'a[href="https://creativecommons.org/licenses/by-sa/3.0/"]',
      ),
    ).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('a[href="stockfish/Copying.txt"]'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/"]')).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelectorAll('app-legal-footer a'),
    ).toHaveLength(3);

    await harness.navigateByUrl('/datenschutz', Legal);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      'Privacy policy',
    );
    expect(harness.routeNativeElement?.textContent).toContain('ALL-INKL');
    expect(harness.routeNativeElement?.textContent).toContain('full IP addresses');
    expect(harness.routeNativeElement?.textContent).toContain('no later than seven days');
    expect(harness.routeNativeElement?.textContent).toContain('Article 6(1)(f) GDPR');
    expect(harness.routeNativeElement?.textContent).toContain('Firebase');
    expect(harness.routeNativeElement?.textContent).toContain('Cloud Data Processing Addendum');
    expect(harness.routeNativeElement?.textContent).toContain('contracting entity');
    expect(harness.routeNativeElement?.textContent).toContain('Standard Contractual Clauses');
    expect(
      harness.routeNativeElement?.querySelector(
        'a[href="https://firebase.google.com/terms/subprocessors"]',
      ),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('heartbeat information');
    expect(harness.routeNativeElement?.textContent).toContain('fixed general deletion period');
    expect(harness.routeNativeElement?.textContent).toContain('website data');
    expect(harness.routeNativeElement?.textContent).toContain('no consent banner is shown');
    expect(document.title).toBe('Privacy policy | Grimoire');
    expect(harness.routeNativeElement?.textContent).toContain('automatic deletion due to inactivity');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Signing out alone does not delete the account.',
    );
    expect(harness.routeNativeElement?.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('a[href="https://www.ldi.nrw.de/kontakt"]'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('.draft')).toBeNull();

    await harness.navigateByUrl('/nutzungsbedingungen', Legal);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Terms of Use');
    expect(harness.routeNativeElement?.textContent).toContain('currently offered free of charge');
    expect(harness.routeNativeElement?.textContent).toContain('guest mode without an account');
    expect(harness.routeNativeElement?.textContent).toContain('Mandatory consumer protection rights');
  });

  describe('in German', () => {
    beforeEach(() => {
      localStorage.removeItem('grimoire.language');
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      TestBed.inject(I18n).setLanguage('de');
    });

    afterEach(() => {
      TestBed.inject(I18n).setLanguage('en');
      localStorage.removeItem('grimoire.language');
    });

    it('should show the German legal notice, privacy policy and terms and switch back', async () => {
      const harness = await RouterTestingHarness.create();
      const text = () => harness.routeNativeElement?.textContent ?? '';
      const link = (selector: string) => harness.routeNativeElement?.querySelector(selector);

      await harness.navigateByUrl('/impressum', Legal);
      expect(link('h1')?.textContent).toBe('Impressum');
      expect(document.title).toBe('Impressum | Grimoire');
      expect(link('[role="note"]')?.textContent).toContain(
        'Dieser Text ist ein Entwurf und wurde nicht rechtlich geprüft.',
      );
      expect(text()).toContain('Entwurf, zuletzt aktualisiert: 22. November 2026');
      expect(text()).toContain('Zurück zu Grimoire');
      expect(text()).toContain('Betreiber von Grimoire');
      expect(text()).toContain('Material Dritter');
      expect(text()).not.toContain('Prüfung vor der Veröffentlichung');
      expect(text()).not.toContain('Third-party material');
      expect(link('a[href="mailto:julian.konken@gmx.net"]')).not.toBeNull();
      expect(link('a[href="https://creativecommons.org/licenses/by-sa/3.0/"]')).not.toBeNull();
      expect(link('a[href="stockfish/Copying.txt"]')).not.toBeNull();
      expect(link('a[href="/"]')).not.toBeNull();

      await harness.navigateByUrl('/datenschutz', Legal);
      expect(link('h1')?.textContent).toBe('Datenschutzerklärung');
      expect(document.title).toBe('Datenschutzerklärung | Grimoire');
      expect(text()).toContain('Verantwortlicher');
      expect(text()).toContain('Auftragsverarbeitungsvertrag');
      expect(text()).toContain('Art. 6 Abs. 1 lit. f DSGVO');
      expect(text()).toContain('Standardvertragsklauseln');
      expect(text()).toContain('Aufsichtsbehörde');
      expect(text()).toContain('Das bloße Abmelden löscht das Konto nicht.');
      expect(link('a[href^="mailto:"]')).not.toBeNull();
      expect(link('a[href="https://www.ldi.nrw.de/kontakt"]')).not.toBeNull();
      expect(link('a[href="https://firebase.google.com/terms/subprocessors"]')).not.toBeNull();
      expect(link('a[href="/nutzungsbedingungen"]')).not.toBeNull();

      await harness.navigateByUrl('/nutzungsbedingungen', Legal);
      expect(link('h1')?.textContent).toBe('Nutzungsbedingungen');
      expect(document.title).toBe('Nutzungsbedingungen | Grimoire');
      expect(text()).toContain('derzeit unentgeltlich');
      expect(text()).toContain('Gastmodus ohne Konto');
      expect(text()).toContain('Zwingende Verbraucherschutzrechte bleiben unberührt');
      expect(link('a[href="mailto:julian.konken@gmx.net"]')).not.toBeNull();

      TestBed.inject(I18n).setLanguage('en');
      harness.detectChanges();
      expect(link('h1')?.textContent).toBe('Terms of Use');
      expect(document.title).toBe('Terms of Use | Grimoire');
      expect(text()).toContain('Back to Grimoire');
      expect(text()).toContain('Mandatory consumer protection rights');
      expect(text()).not.toContain('Zwingende Verbraucherschutzrechte');
    });
  });
});
