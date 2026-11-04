import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayGround } from './play-ground';
import { Square } from 'chess.js';

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
    expect(element.querySelector('[aria-label^="a8 "]')).not.toBeNull();
    expect(element.querySelector('[aria-label^="h1 "]')).not.toBeNull();
    expect(squares[0].classList.contains('light')).toBe(true);
    expect(squares[1].classList.contains('light')).toBe(false);
    expect(squares[8].classList.contains('light')).toBe(false);
  });

  function move(from: Square, to: Square): void {
    component.select(from);
    component.select(to);
  }

  function position(fen: string): void {
    component['game'].load(fen);
    component['position'].set(component['game'].fen());
  }

  it('should start with 32 pieces and White to move', () => {
    expect(fixture.nativeElement.querySelectorAll('.piece')).toHaveLength(32);
    expect(component.status()).toBe('White to move.');
  });

  it('should mark legal destinations, reject illegal moves and alternate turns', async () => {
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('[aria-label="e2 White Pawn"]')!.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('.legal-target')).toHaveLength(2);
    expect(component.legalTargets()).toEqual(expect.arrayContaining(['e3', 'e4']));
    component.select('e5');
    expect(component.board()[6][4]?.type).toBe('p');
    move('e2', 'e4');
    expect(component.board()[4][4]?.color).toBe('w');
    expect(component.board()[6][4]).toBeNull();
    expect(component.status()).toBe('Black to move.');
    component.select('d2');
    expect(component.selected()).toBeNull();
  });

  it('should capture en passant', () => {
    move('e2', 'e4');
    move('a7', 'a6');
    move('e4', 'e5');
    move('d7', 'd5');
    move('e5', 'd6');
    expect(component.board()[2][3]?.color).toBe('w');
    expect(component.board()[3][3]).toBeNull();
  });

  it('should castle and move the rook with the king', () => {
    position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    move('e1', 'g1');
    expect(component.board()[7][6]?.type).toBe('k');
    expect(component.board()[7][5]?.type).toBe('r');
    expect(component.board()[7][7]).toBeNull();
    move('e8', 'c8');
    expect(component.board()[0][2]?.type).toBe('k');
    expect(component.board()[0][3]?.type).toBe('r');
  });

  it('should disallow castling through check and moves exposing the king', () => {
    position('k4r2/8/8/8/8/8/8/4K2R w K - 0 1');
    component.select('e1');
    expect(component.legalTargets()).not.toContain('g1');
    position('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
    component.select('e2');
    expect(component.legalTargets()).not.toContain('d2');
  });

  it('should offer all four promotion pieces and apply the chosen piece', async () => {
    position('7k/P7/8/8/8/8/8/7K w - - 0 1');
    move('a7', 'a8');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.promotion button')).toHaveLength(5);
    expect(component.promotions).toEqual(['q', 'r', 'b', 'n']);
    expect(component.board()[1][0]?.type).toBe('p');
    component.select('h1');
    expect(component.promotion()).toEqual({ from: 'a7', to: 'a8' });
    component.promote('n');
    expect(component.board()[0][0]?.type).toBe('n');
    expect(component.promotion()).toBeNull();
  });

  it('should report checkmate, stop play and restart', () => {
    move('f2', 'f3');
    move('e7', 'e5');
    move('g2', 'g4');
    move('d8', 'h4');
    expect(component.status()).toBe('Checkmate! Black wins.');
    component.select('e2');
    expect(component.selected()).toBeNull();
    component.restart();
    expect(component.status()).toBe('White to move.');
    expect(component.board().flat().filter(Boolean)).toHaveLength(32);
  });

  it('should report check, stalemate and insufficient material', () => {
    position('7k/8/8/8/8/8/7r/7K w - - 0 1');
    expect(component.status()).toBe('White to move - Check!');
    position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(component.status()).toBe('Draw by stalemate.');
    position('7k/8/8/8/8/8/8/K7 w - - 0 1');
    expect(component.status()).toBe('Draw by insufficient material.');
  });

  it('should detect repetition and the fifty-move rule', () => {
    for (let repetition = 0; repetition < 2; repetition++) {
      move('g1', 'f3');
      move('g8', 'f6');
      move('f3', 'g1');
      move('f6', 'g8');
    }
    expect(component.status()).toBe('Draw by threefold repetition.');
    position('7k/8/8/8/8/8/8/KR6 w - - 100 51');
    expect(component.status()).toBe('Draw by the fifty-move rule.');
  });

  it('should display ranks 8 to 1 on both sides of the board', () => {
    const element: HTMLElement = fixture.nativeElement;
    const labels = element.querySelectorAll('.rank-labels');

    expect(labels).toHaveLength(2);
    expect(labels[1].classList.contains('rank-labels-right')).toBe(true);
    for (const label of labels) {
      expect(
        Array.from(label.querySelectorAll('span'), (span) => span.textContent?.trim()),
      ).toEqual(['8', '7', '6', '5', '4', '3', '2', '1']);
    }
  });

  it('should display files a to h above and below the board', () => {
    const element: HTMLElement = fixture.nativeElement;
    const labels = element.querySelectorAll('.file-labels');

    expect(labels).toHaveLength(2);
    expect(labels[0].classList.contains('file-labels-top')).toBe(true);
    for (const label of labels) {
      expect(
        Array.from(label.querySelectorAll('span'), (span) => span.textContent?.trim()),
      ).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    }
  });
});
