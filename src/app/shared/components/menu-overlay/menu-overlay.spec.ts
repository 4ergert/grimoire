import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuOverlay } from './menu-overlay';

describe('MenuOverlay', () => {
  let component: MenuOverlay;
  let fixture: ComponentFixture<MenuOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should offer separate create and computer game actions and disable them while pending', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll('button');

    expect(Array.from(buttons, (button) => button.textContent?.trim())).toEqual([
      'Create', 'Play against Stockfish', 'Repertoire', 'Log Out',
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
    fixture.nativeElement.querySelectorAll('button')[1].click();
    expect(computer).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
  });
});
