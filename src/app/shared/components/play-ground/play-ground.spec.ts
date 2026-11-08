import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayGround } from './play-ground';
import { Square } from 'chess.js';
import { vi } from 'vitest';

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

  it('should toggle the burger menu, restart the game and forward logout', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const menu = element.querySelector<HTMLDetailsElement>('app-game-controls details')!;
    const trigger = menu.querySelector('summary')!;
    const buttons = Array.from(menu.querySelectorAll('button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Menu', 'New game', 'Log Out',
    ]);
    expect(menu.open).toBe(false);
    trigger.click();
    expect(menu.open).toBe(true);
    trigger.click();
    expect(menu.open).toBe(false);

    move('e2', 'e4');
    await fixture.whenStable();
    trigger.click();
    buttons[1].click();
    await fixture.whenStable();
    expect(component.moveHistory()).toHaveLength(0);
    expect(menu.open).toBe(false);

    const logout = vi.fn();
    component.logout.subscribe(logout);
    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();
    expect(buttons[2].disabled).toBe(true);
    fixture.componentRef.setInput('pending', false);
    await fixture.whenStable();
    trigger.click();
    buttons[2].click();
    expect(logout).toHaveBeenCalledOnce();
    expect(menu.open).toBe(false);
  });

  it('should save from a native button in the move history header only outside replay', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('.move-history-header button')!;
    const saved = vi.fn();
    component.saveGame.subscribe(saved);

    expect(button.textContent).toContain('Save game');
    expect(button.hasAttribute('custom-button')).toBe(false);
    expect(button.disabled).toBe(true);
    expect(element.querySelector('app-game-controls')?.textContent).not.toContain('Save game');

    move('e2', 'e4');
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    button.click();
    expect(saved).toHaveBeenCalledWith(expect.stringContaining('1. e4'));

    component.promotion.set({ from: 'a7', to: 'a8' });
    await fixture.whenStable();
    expect(button.disabled).toBe(true);

    fixture.componentRef.setInput('replayPgn', saved.mock.calls[0][0]);
    await fixture.whenStable();
    expect(element.querySelector('.move-history-header button')).toBeNull();
  });

  it('should display the live game status directly below the board', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const board = element.querySelector('app-chess-board')!;
    const row = board.nextElementSibling!;
    const status = row.querySelector('.game-status')!;

    expect(row.classList.contains('game-status-row')).toBe(true);
    expect(status.classList.contains('game-status')).toBe(true);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('White to move.');
    expect(element.querySelector('app-game-controls [role="status"]')).toBeNull();

    move('e2', 'e4');
    await fixture.whenStable();
    expect(status.textContent).toContain('Black to move.');
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
    component.game['game'].load(fen);
    component.game.position.set(component.game['game'].fen());
  }

  it('should flip coordinates and pieces while preserving correct move input', async () => {
    const element: HTMLElement = fixture.nativeElement;
    const flip = element.querySelector<HTMLButtonElement>('button[aria-label="Flip board"]')!;
    expect(flip.textContent?.trim()).toBe('\u21bb');
    expect(flip.previousElementSibling?.classList.contains('game-status')).toBe(true);
    expect(flip.getAttribute('aria-pressed')).toBe('false');
    flip.click();
    await fixture.whenStable();
    expect(flip.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.square')?.getAttribute('data-square')).toBe('h1');
    expect(
      Array.from(element.querySelectorAll('.file-labels-top span'), (span) =>
        span.textContent?.trim(),
      ),
    ).toEqual(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
    expect(
      Array.from(element.querySelectorAll('.rank-labels-right span'), (span) =>
        span.textContent?.trim(),
      ),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    element.querySelector<HTMLButtonElement>('[data-square="e2"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-square="e4"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-square="e4"] .piece')).not.toBeNull();
    expect(component.moveHistory()[0].white).toBe('e4');
    flip.click();
    await fixture.whenStable();
    expect(element.querySelector('.square')?.getAttribute('data-square')).toBe('a8');
    expect(component.board()[4][4]?.color).toBe('w');
  });

  it('should animate moves in the flipped board direction', async () => {
    const element: HTMLElement = fixture.nativeElement;
    component.flipped.set(true);
    await fixture.whenStable();
    const board = element.querySelector<HTMLElement>('.chessboard')!;
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({
      ...board.getBoundingClientRect(),
      width: 400,
    });
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    try {
      move('e2', 'e4');
      await fixture.whenStable();
      expect(animate).toHaveBeenCalledWith(
        [
          { transform: 'translate(0px, -100px)', zIndex: '2' },
          { transform: 'translate(0, 0)', zIndex: '2' },
        ],
        expect.objectContaining({ duration: 260 }),
      );
    } finally {
      fixture.destroy();
      if (original) Object.defineProperty(HTMLElement.prototype, 'animate', original);
      else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    }
  });

  it('should train a folder without revealing the game name or move list', async () => {
    fixture.componentRef.setInput('trainingFolder', {
      id: 'folder',
      name: 'Spanish',
      games: [{ id: 'game', name: 'Secret variation', pgn: '1. e4 e5 2. Nf3 Nc6 *' }],
    });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const click = async (label: string) => {
      const button = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === label,
      )!;
      button.click();
      await fixture.whenStable();
    };
    expect(element.querySelector('.move-history')).toBeNull();
    expect(element.textContent).not.toContain('Secret variation');
    await click('Train White');
    move('d2', 'd4');
    await fixture.whenStable();
    expect(component.training()?.mistakes()).toBe(1);
    expect(component.board()[6][3]?.type).toBe('p');
    await click('Hint');
    expect(
      element.querySelector('[aria-label="e2 White Pawn"]')?.classList.contains('hint-square'),
    ).toBe(true);
    expect(element.querySelectorAll('.legal-target')).toHaveLength(0);
    await click('Show move');
    expect(element.textContent).toContain('Saved move: e4');
    await click('Play shown move');
    expect(component.board()[3][4]?.color).toBe('b');
    move('g1', 'f3');
    await fixture.whenStable();
    expect(element.textContent).toContain('Round complete!');
    await click('Restart round');
    expect(component.training()?.ply()).toBe(0);
    expect(component.training()?.mistakes()).toBe(0);
  });

  it('should export PGN and replay all positions without changing the saved game', async () => {
    move('e2', 'e4');
    move('e7', 'e5');
    const saved = vi.fn();
    component.saveGame.subscribe(saved);
    component.save();
    const pgn: string = saved.mock.calls[0][0];
    expect(pgn).toContain('1. e4 e5');
    expect(pgn).toContain('[Result "*"]');
    fixture.componentRef.setInput('replayPgn', pgn);
    await fixture.whenStable();
    expect(component.replayMoves()).toEqual(['e4', 'e5']);
    expect(component.board()[6][4]?.type).toBe('p');
    const element: HTMLElement = fixture.nativeElement;
    const next = Array.from(element.querySelectorAll<HTMLButtonElement>('nav button')).find(
      (button) => button.textContent?.trim() === 'Next',
    )!;
    next.click();
    await fixture.whenStable();
    expect(component.board()[4][4]?.color).toBe('w');
    component.select('d2');
    expect(component.selected()).toBeNull();
    next.click();
    await fixture.whenStable();
    expect(component.board()[3][4]?.color).toBe('b');
    expect(next.disabled).toBe(true);
    const previous = Array.from(element.querySelectorAll<HTMLButtonElement>('nav button')).find(
      (button) => button.textContent?.trim() === 'Previous',
    )!;
    previous.click();
    await fixture.whenStable();
    expect(component.board()[1][4]?.color).toBe('b');
    expect(component.board()[4][4]?.color).toBe('w');
    component.restart();
    expect(component.replayPositions()).toEqual([]);
    expect(component.moveHistory()).toEqual([]);
  });

  it('should replay a saved setup position including castling', async () => {
    position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    move('e1', 'g1');
    const saved = vi.fn();
    component.saveGame.subscribe(saved);
    component.save();
    fixture.componentRef.setInput('replayPgn', saved.mock.calls[0][0]);
    await fixture.whenStable();
    expect(component.board()[7][4]?.type).toBe('k');
    component.replayIndex.set(1);
    expect(component.board()[7][6]?.type).toBe('k');
    expect(component.board()[7][5]?.type).toBe('r');
  });

  it('should record legal moves by turn and clear the rendered history on restart', async () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.move-history')?.textContent).toContain('No moves yet.');
    component.select('e2');
    component.select('e5');
    expect(component.moveHistory()).toEqual([]);
    move('e2', 'e4');
    expect(component.moveHistory()).toEqual([{ number: 1, white: 'e4', black: '' }]);
    move('e7', 'e5');
    move('g1', 'f3');
    await fixture.whenStable();
    const rows = element.querySelectorAll('.move-history tbody tr');
    expect(
      Array.from(rows, (row) => Array.from(row.children, (cell) => cell.textContent?.trim())),
    ).toEqual([
      ['1.', 'e4', 'e5'],
      ['2.', 'Nf3', ''],
    ]);
    component.restart();
    await fixture.whenStable();
    expect(component.moveHistory()).toEqual([]);
    expect(element.querySelector('.move-history table')).toBeNull();
  });

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
    expect(component.moveHistory()[2].white).toBe('exd6');
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
    expect(component.moveHistory()).toEqual([{ number: 1, white: 'O-O', black: 'O-O-O' }]);
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
    expect(
      Array.from(element.querySelectorAll('.promotion button'), (button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['Queen', 'Rook', 'Bishop', 'Knight', 'Cancel']);
    expect(component.board()[1][0]?.type).toBe('p');
    expect(component.moveHistory()).toEqual([]);
    component.select('h1');
    expect(component.promotion()).toEqual({ from: 'a7', to: 'a8' });
    component.promote('n');
    expect(component.board()[0][0]?.type).toBe('n');
    expect(component.promotion()).toBeNull();
    expect(component.moveHistory()[0].white).toBe('a8=N');
  });

  it('should report checkmate, stop play and restart', () => {
    move('f2', 'f3');
    move('e7', 'e5');
    move('g2', 'g4');
    move('d8', 'h4');
    expect(component.status()).toBe('Checkmate! Black wins.');
    expect(component.moveHistory()[1].black).toBe('Qh4#');
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
