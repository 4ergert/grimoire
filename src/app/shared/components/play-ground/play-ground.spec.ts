import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayGround } from './play-ground';

describe('PlayGround', () => {
  let component: PlayGround;
  let fixture: ComponentFixture<PlayGround>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayGround],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayGround);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render an 8 by 8 board with coordinates and alternating squares', () => {
    const element: HTMLElement = fixture.nativeElement;
    const squares = element.querySelectorAll<HTMLElement>('.square');

    expect(squares).toHaveLength(64);
    expect(element.querySelector('[aria-label="a8"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="h1"]')).not.toBeNull();
    expect(squares[0].classList.contains('light')).toBe(true);
    expect(squares[1].classList.contains('light')).toBe(false);
    expect(squares[8].classList.contains('light')).toBe(false);
  });

  it('should display ranks 8 to 1 on both sides of the board', () => {
    const element: HTMLElement = fixture.nativeElement;
    const labels = element.querySelectorAll('.rank-labels');

    expect(labels).toHaveLength(2);
    expect(labels[1].classList.contains('rank-labels-right')).toBe(true);
    for (const label of labels) {
      expect(Array.from(label.querySelectorAll('span'), (span) => span.textContent?.trim())).toEqual(
        ['8', '7', '6', '5', '4', '3', '2', '1'],
      );
    }
  });

  it('should display files a to h above and below the board', () => {
    const element: HTMLElement = fixture.nativeElement;
    const labels = element.querySelectorAll('.file-labels');

    expect(labels).toHaveLength(2);
    expect(labels[0].classList.contains('file-labels-top')).toBe(true);
    for (const label of labels) {
      expect(Array.from(label.querySelectorAll('span'), (span) => span.textContent?.trim())).toEqual(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      );
    }
  });
});
