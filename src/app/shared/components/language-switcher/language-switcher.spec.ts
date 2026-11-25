import { TestBed } from '@angular/core/testing';
import { I18n } from '../../i18n/i18n';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => localStorage.removeItem('grimoire.language'));
  afterEach(() => localStorage.removeItem('grimoire.language'));

  it('should switch the language, remember it and mark the active button', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    const i18n = TestBed.inject(I18n);
    i18n.setLanguage('en');
    await fixture.whenStable();
    const [en, de] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(de.getAttribute('aria-pressed')).toBe('false');

    de.click();
    await fixture.whenStable();
    expect(i18n.language()).toBe('de');
    expect(localStorage.getItem('grimoire.language')).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(de.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.indicator-de')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="group"]').getAttribute('aria-label')).toBe(
      'Sprache',
    );

    en.click();
    await fixture.whenStable();
    expect(i18n.language()).toBe('en');

    en.click();
    await fixture.whenStable();
    expect(i18n.language()).toBe('de');

    (fixture.nativeElement.querySelector('.language-switcher') as HTMLElement).click();
    await fixture.whenStable();
    expect(i18n.language()).toBe('en');
  });
});
