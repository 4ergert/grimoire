import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { MenuOverlay } from './menu-overlay';
import { afterEach, vi } from 'vitest';

describe('MenuOverlay', () => {
  let component: MenuOverlay;
  let fixture: ComponentFixture<MenuOverlay>;

  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) { this.open = true; }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) { this.open = false; }),
    });
    await TestBed.configureTestingModule({
      imports: [MenuOverlay],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers working legal links for verified and unverified users', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    for (const verified of [true, false]) {
      fixture.componentRef.setInput('emailVerified', verified);
      await fixture.whenStable();
      const links: NodeListOf<HTMLAnchorElement> =
        fixture.nativeElement.querySelectorAll('nav[aria-label="Legal information"] a');
      expect(Array.from(links, (link) => [link.textContent?.trim(), link.getAttribute('href')]))
        .toEqual([['Legal notice', '/impressum'], ['Privacy policy', '/datenschutz']]);
      for (const [index, path] of ['/impressum', '/datenschutz'].entries()) {
        links[index].click();
        const target = navigate.mock.calls.at(-1)?.[0];
        expect(target).toBeDefined();
        expect(typeof target === 'string' ? target : router.serializeUrl(target!)).toBe(path);
      }
    }
    expect(navigate).toHaveBeenCalledTimes(4);
  });

  it('should offer separate create and computer game actions and disable them while pending', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>('.menu_button');

    expect(Array.from(buttons, (button) => button.textContent?.trim())).toEqual([
      'Create', 'Repertoire', 'Play against Stockfish', 'Settings', 'Log Out',
    ]);
    expect(buttons[0].type).toBe('button');

    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    expect(Array.from(buttons).every((button) => button.disabled)).toBe(true);
  });

  it('should notify the parent when Play is clicked', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const play = vi.fn();
    component.play.subscribe(play);

    element.querySelector<HTMLButtonElement>('.menu_button')!.click();
    await fixture.whenStable();

    expect(play).toHaveBeenCalledOnce();
    expect(element.querySelector('.auth_status')).not.toBeNull();
  });

  it('should emit only the computer action for Play against Stockfish', () => {
    const computer = vi.fn();
    const play = vi.fn();
    component.computer.subscribe(computer);
    component.play.subscribe(play);
    fixture.nativeElement.querySelectorAll('.menu_button')[2].click();
    expect(computer).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
  });

  it('opens settings and clears the deletion form when closing', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const dialog = element.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBe(false);
    element.querySelectorAll<HTMLButtonElement>('.menu_button')[3].click();
    expect(dialog.open).toBe(true);
    const deletion = dialog.querySelector<HTMLDetailsElement>('details')!;
    deletion.open = true;
    const password = dialog.querySelector<HTMLInputElement>('input')!;
    password.value = 'test-password';
    dialog.querySelector<HTMLButtonElement>('dialog > button')!.click();
    expect(dialog.open).toBe(false);
    expect(password.value).toBe('');
    expect(deletion.open).toBe(false);
  });

  it('prevents closing settings while deletion is pending', async () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal();
    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();
    const event = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
  });
});
