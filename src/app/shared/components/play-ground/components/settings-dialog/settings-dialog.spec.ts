import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BoardThemeService } from '../../../../services/board-theme';
import { SettingsDialog } from './settings-dialog';

describe('SettingsDialog', () => {
  let fixture: ComponentFixture<SettingsDialog>;
  let element: HTMLElement;
  let themes: BoardThemeService;

  const swatches = () => element.querySelectorAll<HTMLInputElement>('.preview input[type="color"]');

  beforeEach(async () => {
    localStorage.clear();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    await TestBed.configureTestingModule({ imports: [SettingsDialog] }).compileComponents();
    themes = TestBed.inject(BoardThemeService);
    fixture = TestBed.createComponent(SettingsDialog);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'));

  const openCustom = () => {
    while (!themes.isCustom()) themes.next();
    fixture.detectChanges();
  };

  it('offers no color pickers for the predefined themes', () => {
    expect(swatches()).toHaveLength(0);
    expect(element.querySelector('.preview')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('offers a color picker on every preview square of the custom theme', () => {
    openCustom();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Custom');
    expect(Array.from(swatches(), (input) => input.getAttribute('aria-label'))).toEqual([
      'Color of the light squares',
      'Color of the dark squares',
      'Color of the dark squares',
      'Color of the light squares',
    ]);
    expect(element.querySelector('.preview')?.hasAttribute('aria-hidden')).toBe(false);
    expect(element.querySelector('.hint')).not.toBeNull();
  });

  it('applies a picked color to both squares of that kind', () => {
    openCustom();
    const [light, dark, darkAgain, lightAgain] = Array.from(swatches());

    light.value = '#112233';
    light.dispatchEvent(new Event('input'));
    dark.value = '#445566';
    dark.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(themes.theme()).toMatchObject({ light: '#112233', dark: '#445566' });
    expect(lightAgain.value).toBe('#112233');
    expect(darkAgain.value).toBe('#445566');
    expect(
      element.querySelector<HTMLElement>('.preview')!.style.getPropertyValue('--preview-light'),
    ).toBe('#112233');
  });
});
