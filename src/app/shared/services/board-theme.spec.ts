import { TestBed } from '@angular/core/testing';
import { BOARD_THEMES, BoardThemeService, CUSTOM_THEME_ID } from './board-theme';

describe('BoardThemeService', () => {
  beforeEach(() => localStorage.clear());

  const selectCustom = (service: BoardThemeService) => {
    while (!service.isCustom()) service.next();
  };

  it('starts with the classic theme', () => {
    expect(TestBed.inject(BoardThemeService).theme()).toBe(BOARD_THEMES[0]);
  });

  it('cycles through the themes, ends with the custom theme and wraps around', () => {
    const service = TestBed.inject(BoardThemeService);
    for (let i = 1; i < BOARD_THEMES.length; i++) {
      service.next();
      expect(service.theme().id).toBe(BOARD_THEMES[i].id);
    }
    expect(service.theme().id).toBe(CUSTOM_THEME_ID);
    service.next();
    expect(service.theme()).toBe(BOARD_THEMES[0]);
  });

  it('remembers the selected theme', () => {
    TestBed.inject(BoardThemeService).next();
    TestBed.resetTestingModule();

    expect(TestBed.inject(BoardThemeService).theme()).toBe(BOARD_THEMES[1]);
  });

  it('lets the user choose both square colors of the custom theme', () => {
    const service = TestBed.inject(BoardThemeService);
    selectCustom(service);

    service.setCustomColor('light', '#FFEEDD');
    service.setCustomColor('dark', '#102030');

    expect(service.theme()).toMatchObject({ id: CUSTOM_THEME_ID, light: '#ffeedd', dark: '#102030' });
  });

  it('remembers the custom colors and keeps them when switching themes', () => {
    const service = TestBed.inject(BoardThemeService);
    selectCustom(service);
    service.setCustomColor('dark', '#102030');
    service.next();
    expect(service.isCustom()).toBe(false);
    TestBed.resetTestingModule();

    const restored = TestBed.inject(BoardThemeService);
    selectCustom(restored);
    expect(restored.theme().dark).toBe('#102030');
  });

  it('ignores invalid colors and unreadable stored colors', () => {
    localStorage.setItem('grimoire.boardTheme.custom', '{"dark":"red","light":"#abcdef"}');
    const service = TestBed.inject(BoardThemeService);
    selectCustom(service);
    const defaults = BOARD_THEMES.find((theme) => theme.id === CUSTOM_THEME_ID)!;

    expect(service.theme().dark).toBe(defaults.dark);
    expect(service.theme().light).toBe('#abcdef');
    service.setCustomColor('dark', 'url(x)');
    service.setCustomColor('dark', '#12345');
    expect(service.theme().dark).toBe(defaults.dark);
  });
});
