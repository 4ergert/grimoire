import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chess } from 'chess.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayGround } from '../../play-ground';
import { GameSession } from '../../sessions/game-session';
import { StockfishEngine } from './stockfish-engine';

class EngineWorker {
  static instances: EngineWorker[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  readonly postMessage = vi.fn<(command: string) => void>();
  readonly terminate = vi.fn();

  constructor(readonly url: URL) {
    EngineWorker.instances.push(this);
  }

  receive(line: string): void {
    this.onmessage?.(new MessageEvent('message', { data: line }));
  }

  boot(): void {
    this.receive('uciok');
    this.receive('readyok');
  }
}

const start = new Chess().fen();
const afterE4 = new Chess();
afterE4.move('e4');

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    }),
  });
  EngineWorker.instances = [];
  vi.stubGlobal('Worker', EngineWorker);
});

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StockfishEngine', () => {
  let engine: StockfishEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [StockfishEngine] });
    engine = TestBed.inject(StockfishEngine);
  });

  it('loads lazily and waits for the UCI and readiness handshakes', () => {
    expect(EngineWorker.instances).toHaveLength(0);
    engine.search(start, `fen ${start}`);
    const worker = EngineWorker.instances[0];
    expect(worker.url.pathname).toContain('/stockfish/stockfish-19-lite-single.js');
    expect(worker.postMessage.mock.calls).toEqual([['uci']]);
    worker.receive('uciok');
    expect(worker.postMessage.mock.calls.slice(-2)).toEqual([
      ['setoption name Hash value 16'],
      ['isready'],
    ]);
    worker.receive('readyok');
    expect(engine.ready()).toBe(true);
    expect(worker.postMessage.mock.calls.slice(-2)).toEqual([
      [`position fen ${start}`],
      ['go movetime 1000'],
    ]);
  });

  it("reports depth, SAN source moves, and evaluation from White's perspective", () => {
    engine.search(afterE4.fen(), `fen ${afterE4.fen()}`);
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('info depth 12 score cp 35 pv e7e5 g1f3');
    expect(engine.result()).toMatchObject({
      fen: afterE4.fen(),
      depth: 12,
      score: { type: 'cp', value: -35 },
      line: ['e7e5', 'g1f3'],
      bestMove: null,
    });
    worker.receive('info depth 13 score mate -3 pv e7e5');
    expect(engine.result()?.score).toEqual({ type: 'mate', value: 3 });
    worker.receive('bestmove e7e5 ponder g1f3');
    expect(engine.result()?.bestMove).toBe('e7e5');
    expect(engine.busy()).toBe(false);
  });

  it('drains stale bestmove replies and searches only the newest queued position', () => {
    engine.search(start, `fen ${start}`);
    const worker = EngineWorker.instances[0];
    worker.boot();
    engine.search(afterE4.fen(), `fen ${afterE4.fen()}`);
    const latest = new Chess();
    latest.move('d4');
    engine.search(latest.fen(), `fen ${latest.fen()}`);
    expect(worker.postMessage.mock.calls.filter(([command]) => command === 'stop')).toHaveLength(1);
    worker.receive('info depth 5 score cp 100 pv e2e4');
    expect(engine.result()).toBeNull();
    worker.receive('bestmove e2e4');
    expect(engine.result()).toBeNull();
    expect(worker.postMessage.mock.calls.slice(-2)).toEqual([
      [`position fen ${latest.fen()}`],
      ['go movetime 1000'],
    ]);
    worker.receive('bestmove d7d5');
    expect(engine.result()).toMatchObject({ fen: latest.fen(), bestMove: 'd7d5' });
  });

  it('does not publish moves after switching off, including during loading', () => {
    engine.search(start, `fen ${start}`);
    const worker = EngineWorker.instances[0];
    engine.stop();
    worker.boot();
    expect(worker.postMessage).not.toHaveBeenCalledWith('go movetime 1000');
    engine.search(start, `fen ${start}`);
    engine.stop();
    worker.receive('bestmove e2e4');
    expect(engine.result()).toBeNull();
    expect(engine.busy()).toBe(false);
  });

  it('reports load failures, terminates the worker, and supports a fresh retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    engine.search(start, `fen ${start}`);
    const worker = EngineWorker.instances[0];
    worker.onerror?.(new ErrorEvent('error'));
    expect(engine.error()).toContain('could not be loaded');
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(engine.busy()).toBe(false);
    engine.reset();
    engine.search(start, `fen ${start}`);
    expect(EngineWorker.instances).toHaveLength(2);
    EngineWorker.instances[1].boot();
    expect(engine.error()).toBe('');
    expect(engine.ready()).toBe(true);
  });

  it('reports startup and search timeouts instead of waiting indefinitely', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    engine.search(start, `fen ${start}`);
    vi.advanceTimersByTime(30000);
    expect(engine.error()).toContain('initialization timed out');
    engine.reset();
    engine.search(start, `fen ${start}`);
    EngineWorker.instances[1].boot();
    vi.advanceTimersByTime(10000);
    expect(engine.error()).toContain('did not finish');
    expect(EngineWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });

  it('reports illegal engine output instead of passing it to the board', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    engine.search(start, `fen ${start}`);
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('bestmove e2e5');
    expect(engine.error()).toContain('Invalid move');
    expect(engine.result()).toBeNull();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('terminates its worker when the owning component is destroyed', () => {
    engine.search(start, `fen ${start}`);
    const worker = EngineWorker.instances[0];
    TestBed.resetTestingModule();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

describe('Stockfish playground integration', () => {
  let fixture: ComponentFixture<PlayGround>;
  let playground: PlayGround;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlayGround] }).compileComponents();
    fixture = TestBed.createComponent(PlayGround);
    fixture.componentRef.setInput('computerGame', true);
    playground = fixture.componentInstance;
    playground.engineSideChosen.set(true);
    await fixture.whenStable();
  });

  it.each(['w', 'b'] as const)('asks for a side before starting as %s', async (color) => {
    playground.engineSideChosen.set(false);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const dialog = element.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBe(true);
    expect(EngineWorker.instances).toHaveLength(0);
    playground.select('e2');
    playground.select('e4');
    expect(playground.moveHistory()).toEqual([]);
    expect(element.querySelector<HTMLButtonElement>('.square')?.disabled).toBe(true);
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    buttons[color === 'w' ? 0 : 1].click();
    await fixture.whenStable();
    expect(element.querySelector('dialog')).toBeNull();
    expect(playground.playerColor()).toBe(color);
    expect(playground.flipped()).toBe(color === 'b');
    expect(playground.engineMode()).toBe('opponent');
    expect(playground.engineTurn()).toBe(color === 'b');
    expect(EngineWorker.instances).toHaveLength(color === 'b' ? 1 : 0);
  });

  it.each(['escape', 'back'])('returns to the menu via %s in the side dialog', async (action) => {
    playground.engineSideChosen.set(false);
    await fixture.whenStable();
    const back = vi.fn();
    playground.back.subscribe(back);
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    if (action === 'escape') dialog.dispatchEvent(new Event('cancel'));
    else dialog.querySelectorAll<HTMLButtonElement>('button')[2].click();
    expect(back).toHaveBeenCalledOnce();
    expect(EngineWorker.instances).toHaveLength(0);
  });

  it('keeps local two-player play and engine loading opt-in', () => {
    expect(EngineWorker.instances).toHaveLength(0);
    playground.select('e2');
    playground.select('e4');
    playground.select('e7');
    playground.select('e5');
    expect(playground.moveHistory()[0]).toEqual({ number: 1, white: 'e4', black: 'e5' });
  });

  it('keeps analysis always enabled in Create and disallows computer play', async () => {
    fixture.componentRef.setInput('computerGame', false);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-engine-side-dialog')).toBeNull();
    expect(element.textContent).not.toContain('Play as White');
    expect(element.textContent).not.toContain('Play as Black');
    expect(element.textContent).not.toContain('Engine off');
    expect(element.querySelector<HTMLButtonElement>('.analyse-position')?.disabled).toBe(true);
    expect(playground.engineMode()).toBe('analysis');
    expect(playground.engineAnalysis()).toBe(true);
    playground.startEngineGame('b');
    expect(playground.engineMode()).toBe('analysis');
    playground.setEngineMode('opponent');
    expect(playground.engineMode()).toBe('analysis');
    playground.setEngineMode('off');
    expect(playground.engineMode()).toBe('analysis');
    await fixture.whenStable();
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('bestmove e2e4');
    await fixture.whenStable();
    expect(playground.moveHistory()).toEqual([]);
    playground.select('e2');
    playground.select('e4');
    await fixture.whenStable();
    expect(worker.postMessage).toHaveBeenCalledWith(`position ${playground.game.enginePosition()}`);
    worker.receive('bestmove e7e5');
    await fixture.whenStable();
    expect(playground.moveHistory()[0].black).toBe('');
    playground.restart();
    await fixture.whenStable();
    expect(element.textContent).not.toContain('Play as White');
    expect(playground.engineMode()).toBe('analysis');
  });

  it('shows analysis without automatically playing the suggested move', async () => {
    playground.setEngineMode('analysis');
    await fixture.whenStable();
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('info depth 10 score cp 24 pv e2e4 e7e5');
    worker.receive('bestmove e2e4');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('+0.24');
    expect(fixture.nativeElement.textContent).toContain('Best line: e4 e5');
    expect(playground.moveHistory()).toEqual([]);
    expect(
      worker.postMessage.mock.calls.filter(([command]) => command.startsWith('go ')),
    ).toHaveLength(1);
  });

  it('shows engine errors and retries from the panel without changing the board', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    playground.setEngineMode('analysis');
    await fixture.whenStable();
    EngineWorker.instances[0].onerror?.(new ErrorEvent('error'));
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-stockfish-panel [role="alert"]')?.textContent).toContain(
      'could not be loaded',
    );
    const retry = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Retry engine',
    )!;
    retry.click();
    await fixture.whenStable();
    expect(EngineWorker.instances).toHaveLength(2);
    EngineWorker.instances[1].boot();
    EngineWorker.instances[1].receive('bestmove e2e4');
    await fixture.whenStable();
    expect(element.querySelector('app-stockfish-panel [role="alert"]')).toBeNull();
    expect(playground.moveHistory()).toEqual([]);
  });

  it.each(['w', 'b'] as const)(
    'keeps analysis enabled when starting an engine game as %s',
    async (color) => {
      playground.setEngineMode('analysis');
      playground.startEngineGame(color);
      await fixture.whenStable();
      expect(playground.engineMode()).toBe('opponent');
      expect(playground.engineAnalysis()).toBe(true);
      const worker = EngineWorker.instances[0];
      worker.boot();
      if (color === 'b') {
        worker.receive('bestmove e2e4');
        await fixture.whenStable();
        worker.receive('info depth 10 score cp -15 pv e7e5 g1f3');
        worker.receive('bestmove e7e5');
      } else {
        worker.receive('info depth 10 score cp 24 pv e2e4 e7e5');
        worker.receive('bestmove e2e4');
      }
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('Evaluation (White):');
      expect(fixture.nativeElement.textContent).toContain('Best line:');
      expect(playground.engineTurn()).toBe(false);
      expect(playground.moveHistory()).toHaveLength(color === 'b' ? 1 : 0);
      if (color === 'b') expect(playground.moveHistory()[0].black).toBe('');
    },
  );

  it('toggles analysis during an engine game without stopping the opponent', async () => {
    playground.startEngineGame('w');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const analyse = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.getAttribute('aria-label') === 'Analyse position',
    )!;
    expect(analyse.parentElement?.classList.contains('analysis-row')).toBe(true);
    expect(element.querySelector('app-game-controls .analyse-position')).toBeNull();
    expect(
      element.querySelector('app-chess-board')!.compareDocumentPosition(analyse) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(analyse.querySelector('img')?.getAttribute('src')).toBe('icon/analyse-position.png');
    expect(analyse.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(analyse.nextElementSibling?.classList.contains('analysis-summary')).toBe(true);
    expect(element.querySelector('app-stockfish-panel')?.textContent).not.toContain(
      'Analyse position',
    );
    analyse.click();
    await fixture.whenStable();
    expect(analyse.getAttribute('aria-pressed')).toBe('true');
    expect(playground.engineMode()).toBe('opponent');
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('info depth 10 score cp 24 pv e2e4 e7e5');
    worker.receive('bestmove e2e4');
    await fixture.whenStable();
    expect(playground.moveHistory()).toEqual([]);
    expect(analyse.nextElementSibling?.textContent).toContain('Evaluation (White): +0.24');
    expect(analyse.nextElementSibling?.textContent).toContain('Best line: e4 e5');
    expect(element.querySelector('app-stockfish-panel')?.textContent).not.toContain(
      'Evaluation (White):',
    );
    analyse.click();
    await fixture.whenStable();
    expect(analyse.getAttribute('aria-pressed')).toBe('false');
    expect(element.textContent).not.toContain('Evaluation (White):');
    expect(playground.engineMode()).toBe('opponent');
    playground.select('e2');
    playground.select('e4');
    await fixture.whenStable();
    worker.receive('bestmove e7e5');
    await fixture.whenStable();
    expect(playground.moveHistory()[0]).toEqual({ number: 1, white: 'e4', black: 'e5' });
    playground.setEngineMode('off');
    expect(playground.engineAnalysis()).toBe(false);
  });

  it('plays as Black after the human move and prevents input during engine turns', async () => {
    playground.startEngineGame('w');
    await fixture.whenStable();
    expect(EngineWorker.instances).toHaveLength(0);
    playground.select('e2');
    playground.select('e4');
    await fixture.whenStable();
    expect(playground.engineTurn()).toBe(true);
    playground.select('d7');
    expect(playground.selected()).toBeNull();
    expect(fixture.nativeElement.querySelector('.square').disabled).toBe(true);
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('bestmove e7e5');
    await fixture.whenStable();
    expect(playground.moveHistory()[0]).toEqual({ number: 1, white: 'e4', black: 'e5' });
    expect(playground.engineTurn()).toBe(false);
    expect(fixture.nativeElement.querySelector('.square').disabled).toBe(false);
  });

  it('plays the first move as White and restarts with the selected human side', async () => {
    playground.startEngineGame('b');
    await fixture.whenStable();
    expect(playground.flipped()).toBe(true);
    const worker = EngineWorker.instances[0];
    worker.boot();
    worker.receive('bestmove e2e4');
    await fixture.whenStable();
    expect(playground.moveHistory()[0].white).toBe('e4');
    playground.restart();
    await fixture.whenStable();
    expect(playground.playerColor()).toBe('b');
    expect(playground.engineTurn()).toBe(true);
    expect(playground.moveHistory()).toEqual([]);
  });

  it('rejects stale engine moves after restart or switching off', async () => {
    playground.startEngineGame('w');
    playground.select('e2');
    playground.select('e4');
    const old = playground.game.position();
    await fixture.whenStable();
    playground.restart();
    playground.playEngineMove({ fen: old, move: 'e7e5' });
    expect(playground.moveHistory()).toEqual([]);
    playground.setEngineMode('off');
    playground.playEngineMove({ fen: start, move: 'e2e4' });
    expect(playground.moveHistory()).toEqual([]);
  });

  it('handles engine promotion, castling, and game-over positions', async () => {
    playground.setEngineMode('opponent');
    playground.playerColor.set('b');
    const game = playground.game['game'];
    game.load('7k/P7/8/8/8/8/8/7K w - - 0 1');
    playground.game.position.set(game.fen());
    playground.playEngineMove({ fen: game.fen(), move: 'a7a8n' });
    expect(playground.game.get('a8')?.type).toBe('n');
    expect(playground.gameOver()).toBe(true);
    game.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    playground.game.position.set(game.fen());
    playground.playEngineMove({ fen: game.fen(), move: 'e1g1' });
    expect(playground.game.get('f1')?.type).toBe('r');
    game.load('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    playground.game.position.set(game.fen());
    await fixture.whenStable();
    expect(playground.gameOver()).toBe(true);
    expect(EngineWorker.instances).toHaveLength(0);
  });

  it('allows replay analysis but not engine play and hides the panel during training', async () => {
    fixture.componentRef.setInput('replayPgn', '1. e4 e5 *');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-stockfish-panel').textContent).not.toContain(
      'Play as White',
    );
    playground.setEngineMode('analysis');
    await fixture.whenStable();
    const worker = EngineWorker.instances[0];
    worker.boot();
    playground.replayIndex.set(1);
    await fixture.whenStable();
    worker.receive('bestmove e2e4');
    expect(worker.postMessage).toHaveBeenCalledWith(`position fen ${afterE4.fen()}`);
    fixture.componentRef.setInput('trainingFolder', {
      id: 'folder',
      name: 'Opening',
      games: [{ id: 'game', name: 'Line', pgn: '1. e4 e5 *' }],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-stockfish-panel')).toBeNull();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(playground.engineMode()).toBe('off');
  });

  it('preserves the full UCI move history for repetition-aware engine searches', () => {
    const game = new GameSession();
    game.move('g1', 'f3');
    game.move('g8', 'f6');
    game.move('f3', 'g1');
    game.move('f6', 'g8');
    expect(game.enginePosition()).toBe(`fen ${start} moves g1f3 g8f6 f3g1 f6g8`);
    game.reset();
    expect(game.enginePosition()).toBe(`fen ${start}`);
  });
});
