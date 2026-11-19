import { TestBed } from '@angular/core/testing';
import { BOARD_THEMES, BoardThemeService } from './board-theme';

describe('BoardThemeService', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the classic theme', () => {
    expect(TestBed.inject(BoardThemeService).theme()).toBe(BOARD_THEMES[0]);
  });

  it('cycles through the themes and wraps around', () => {
    const service = TestBed.inject(BoardThemeService);
    for (let i = 1; i < BOARD_THEMES.length; i++) {
      service.next();
      expect(service.theme()).toBe(BOARD_THEMES[i]);
    }
    service.next();
    expect(service.theme()).toBe(BOARD_THEMES[0]);
  });

  it('remembers the selected theme', () => {
    TestBed.inject(BoardThemeService).next();
    TestBed.resetTestingModule();

    expect(TestBed.inject(BoardThemeService).theme()).toBe(BOARD_THEMES[1]);
  });
});
