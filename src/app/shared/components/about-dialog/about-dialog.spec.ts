import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { I18n } from '../../i18n/i18n';
import { AboutDialog } from './about-dialog';

describe('AboutDialog', () => {
  let fixture: ComponentFixture<AboutDialog>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem('grimoire.language');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    await TestBed.configureTestingModule({ imports: [AboutDialog] }).compileComponents();
    TestBed.inject(I18n).setLanguage('en');
    fixture = TestBed.createComponent(AboutDialog);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    localStorage.removeItem('grimoire.language');
  });

  it('opens as a modal dialog with the about text', () => {
    const dialog = element.querySelector('dialog')!;

    expect(dialog.open).toBe(true);
    expect(element.querySelector('h2')?.textContent).toBe('About');
    expect(dialog.textContent).toContain('Grimoire is a browser-based chess app');
  });

  it('shows the German text when the language is German', async () => {
    TestBed.inject(I18n).setLanguage('de');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('h2')?.textContent).toBe('Über');
    expect(element.querySelector('dialog')?.textContent).toContain(
      'Grimoire ist eine browserbasierte Schach-Anwendung',
    );
  });

  it('emits close from the button and when the dialog is cancelled', () => {
    const closed = vi.fn();
    fixture.componentInstance.close.subscribe(closed);

    element.querySelector('button')!.click();
    element.querySelector('dialog')!.dispatchEvent(new Event('cancel'));

    expect(closed).toHaveBeenCalledTimes(2);
  });
});
