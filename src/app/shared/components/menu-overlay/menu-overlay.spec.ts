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

  it('should display Play above Log Out and disable both while pending', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll('button');

    expect(buttons[0].textContent?.trim()).toBe('Play');
    expect(buttons[1].textContent?.trim()).toBe('Log Out');
    expect(buttons[0].type).toBe('button');

    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('should notify the parent when Play is clicked', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const play = vi.fn();
    component.play.subscribe(play);

    element.querySelector<HTMLButtonElement>('.play_button')!.click();
    await fixture.whenStable();

    expect(play).toHaveBeenCalledOnce();
    expect(element.querySelector('.auth_status')).not.toBeNull();
  });
});
