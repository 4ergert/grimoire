import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chess, Square } from 'chess.js';
import { vi } from 'vitest';
import { ChessBoard } from './chess-board';

describe('ChessBoard drag and drop', () => {
  let fixture: ComponentFixture<ChessBoard>;
  let component: ChessBoard;
  let selections: Square[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ChessBoard] }).compileComponents();
    fixture = TestBed.createComponent(ChessBoard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('position', new Chess().fen());
    selections = [];
    component.squareSelected.subscribe((square) => selections.push(square));
    fixture.detectChanges();
  });

  const square = (name: Square): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-square="${name}"]`);

  function pointer(type: string, target: Element, x: number, y: number): void {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, button: 0, isPrimary: true, clientX: x, clientY: y }),
    );
  }

  // The parent confirms the first drag step by selecting the piece, as PlayGround does.
  function select(name: Square, targets: Square[]): void {
    fixture.componentRef.setInput('selected', name);
    fixture.componentRef.setInput('targets', targets);
    fixture.detectChanges();
  }

  it('drops a dragged piece onto a legal target square', () => {
    vi.spyOn(component, 'squareAtPoint').mockReturnValue('e4');
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointermove', square('e2'), 20, -20);
    expect(selections).toEqual(['e2']);

    select('e2', ['e3', 'e4']);
    pointer('pointermove', square('e2'), 30, -60);
    expect(component.dragSquare()).toBe('e2');
    expect(square('e2').querySelector<HTMLElement>('.piece')!.style.transform).toContain('translate');

    pointer('pointerup', square('e2'), 30, -60);
    expect(selections).toEqual(['e2', 'e4']);
    expect(component.dragSquare()).toBeNull();
    expect(square('e2').querySelector<HTMLElement>('.piece')!.style.transform).toBe('');
    expect(component.drops()).toBe(1);
  });

  it('ignores drops outside the legal targets and keeps the piece selected', () => {
    vi.spyOn(component, 'squareAtPoint').mockReturnValue('e5');
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointermove', square('e2'), 20, -20);
    select('e2', ['e3', 'e4']);
    pointer('pointermove', square('e2'), 30, -60);
    pointer('pointerup', square('e2'), 30, -60);

    expect(selections).toEqual(['e2']);
    expect(component.drops()).toBe(0);
  });

  it('does not toggle the selection with the click that ends a drag', () => {
    vi.spyOn(component, 'squareAtPoint').mockReturnValue('e2');
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointermove', square('e2'), 20, -20);
    select('e2', ['e3', 'e4']);
    pointer('pointermove', square('e2'), 30, -60);
    pointer('pointerup', square('e2'), 30, -60);
    square('e2').click();

    expect(selections).toEqual(['e2']);
  });

  it('keeps a plain click working', () => {
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointerup', square('e2'), 0, 0);
    square('e2').click();

    expect(selections).toEqual(['e2']);
    expect(component.dragSquare()).toBeNull();
  });

  it('does not drag a piece that the selected piece can capture', () => {
    select('d1', ['e2']);
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointermove', square('e2'), 30, 30);

    expect(selections).toEqual([]);
    expect(component.dragSquare()).toBeNull();
  });

  it('does not start a drag from an empty square or while disabled', () => {
    pointer('pointerdown', square('e4'), 0, 0);
    pointer('pointermove', square('e4'), 30, 30);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointermove', square('e2'), 30, 30);

    expect(selections).toEqual([]);
  });

  it('cancels a drag without moving', () => {
    pointer('pointerdown', square('e2'), 0, 0);
    pointer('pointermove', square('e2'), 20, -20);
    select('e2', ['e3', 'e4']);
    pointer('pointermove', square('e2'), 30, -60);
    pointer('pointercancel', square('e2'), 30, -60);

    expect(component.dragSquare()).toBeNull();
    expect(square('e2').querySelector<HTMLElement>('.piece')!.style.transform).toBe('');
    expect(selections).toEqual(['e2']);
  });
});
