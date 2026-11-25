import { TestBed } from '@angular/core/testing';
import { I18n } from './i18n';

describe('I18n', () => {
  beforeEach(() => localStorage.removeItem('grimoire.language'));
  afterEach(() => localStorage.removeItem('grimoire.language'));

  it('should return the English source text and fill placeholders', () => {
    const i18n = TestBed.inject(I18n);
    i18n.setLanguage('en');
    expect(i18n.t('Language')).toBe('Language');
    expect(i18n.t('Hello {name}, {count} games', { name: 'Ada', count: 2 })).toBe(
      'Hello Ada, 2 games',
    );
  });

  it('should translate to German and fall back to the English text', () => {
    const i18n = TestBed.inject(I18n);
    i18n.setLanguage('de');
    expect(i18n.t('Language')).toBe('Sprache');
    expect(i18n.t('Some text without a translation')).toBe('Some text without a translation');
    expect(i18n.t('No translation for {name}', { name: 'Ada' })).toBe('No translation for Ada');
  });

  it('should restore the stored language', () => {
    localStorage.setItem('grimoire.language', 'de');
    expect(TestBed.inject(I18n).language()).toBe('de');
  });
});
