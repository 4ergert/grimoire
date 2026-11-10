import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Chess, Color } from 'chess.js';
import { EngineResult, StockfishEngine } from './stockfish-engine';

export type EngineMode = 'off' | 'analysis' | 'opponent';

export interface EngineMove {
  fen: string;
  move: string;
}

@Component({
  selector: 'app-stockfish-panel',
  providers: [StockfishEngine],
  templateUrl: './stockfish-panel.html',
  styleUrl: './stockfish-panel.scss',
})
export class StockfishPanel {
  readonly analysisView = viewChild<TemplateRef<unknown>>('analysisView');
  readonly engine = inject(StockfishEngine);
  readonly position = input.required<string>();
  readonly enginePosition = input.required<string>();
  readonly mode = input<EngineMode>('off');
  readonly analysis = input(false);
  readonly playerColor = input<Color>('w');
  readonly allowOpponent = input(true);
  readonly gameOver = input(false);
  readonly bestMove = output<EngineMove>();
  private readonly retries = signal(0);
  readonly evaluation = computed(() => {
    const score = this.engine.result()?.score;
    if (!score) return '';
    if (score.type === 'mate') {
      return score.value === 0
        ? 'Checkmate'
        : `Mate in ${Math.abs(score.value)} for ${score.value > 0 ? 'White' : 'Black'}`;
    }
    const value = score.value / 100;
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
  });
  readonly variation = computed(() => {
    const result = this.engine.result();
    if (!result || result.fen !== this.position()) return '';
    const chess = new Chess(result.fen);
    const moves = result.line.length ? result.line : result.bestMove ? [result.bestMove] : [];
    return moves
      .slice(0, 8)
      .map((move) => chess.move(move).san)
      .join(' ');
  });

  constructor() {
    effect(() => {
      const fen = this.position();
      const position = this.enginePosition();
      const mode = this.mode();
      const player = this.playerColor();
      const gameOver = this.gameOver();
      const allowOpponent = this.allowOpponent();
      const analysis = this.analysis();
      this.retries();
      const stopped =
        mode === 'off' ||
        gameOver ||
        new Chess(fen).isGameOver() ||
        (mode === 'opponent' &&
          (!allowOpponent || (new Chess(fen).turn() === player && !analysis)));
      untracked(() => {
        if (stopped) this.engine.stop();
        else this.engine.search(fen, position);
      });
    });
    effect(() => {
      const result: EngineResult | null = this.engine.result();
      if (
        result?.bestMove &&
        result.fen === this.position() &&
        this.mode() === 'opponent' &&
        this.allowOpponent() &&
        !this.gameOver() &&
        new Chess(result.fen).turn() !== this.playerColor()
      ) {
        const move = result.bestMove;
        untracked(() => this.bestMove.emit({ fen: result.fen, move }));
      }
    });
  }

  retry(): void {
    this.engine.reset();
    this.retries.update((value) => value + 1);
  }
}
