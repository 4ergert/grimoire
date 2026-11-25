import {
  Component,
  InjectionToken,
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
import { I18n } from '../../../../i18n/i18n';
import { TranslatePipe } from '../../../../i18n/translate-pipe';
import { EngineResult, StockfishEngine } from './stockfish-engine';

/** Second, per-component engine instance that always analyses at full strength while the opponent engine may be weakened. */
const ANALYSIS_ENGINE = new InjectionToken<StockfishEngine>('Stockfish full-strength analysis');
/** Search depth per opponent strength level; index is `strength - 1` (levels 1-10). */
const OPPONENT_DEPTHS = [5, 6, 7, 9, 10, 12, 14, 16, 20, 26] as const;

/** `off`: engine idle; `analysis`: evaluate the position only; `opponent`: also play the side opposite to the player. */
export type EngineMode = 'off' | 'analysis' | 'opponent';

/** A move chosen by the engine for the position `fen`; `move` is in UCI coordinate notation (e.g. `e7e5`). */
export interface EngineMove {
  fen: string;
  move: string;
}

/**
 * Runs Stockfish for the board: shows the evaluation and best lines and, in opponent mode, plays
 * the side opposite to the player. Provides its own engine instances, so every panel has a separate worker.
 */
@Component({
  selector: 'app-stockfish-panel',
  providers: [StockfishEngine, { provide: ANALYSIS_ENGINE, useClass: StockfishEngine }],
  imports: [TranslatePipe],
  templateUrl: './stockfish-panel.html',
  styleUrl: './stockfish-panel.scss',
})
export class StockfishPanel {
  private static nextTooltipId = 0;
  /** Unique per panel instance, used to build unique element IDs for the variation tooltips. */
  readonly tooltipId = StockfishPanel.nextTooltipId++;
  /** Template with the analysis output, rendered by the parent elsewhere via `ngTemplateOutlet`. */
  readonly analysisView = viewChild<TemplateRef<unknown>>('analysisView');
  private readonly i18n = inject(I18n);
  /** The playing engine; at the opponent's turn it runs weakened (lower skill, limited depth) according to `strength`. */
  readonly engine = inject(StockfishEngine);
  private readonly analysisEngine = inject(ANALYSIS_ENGINE);
  /** FEN of the displayed position; engine results are only shown when they belong to it. */
  readonly position = input(new Chess().fen());
  /** UCI `position` argument for the engine (`fen <fen> [moves ...]`), which may include the move history. */
  readonly enginePosition = input.required<string>();
  readonly mode = input<EngineMode>('off');
  /** In opponent mode, additionally run the full-strength analysis engine (also on the player's turn). */
  readonly analysis = input(false);
  readonly playerColor = input<Color>('w');
  /** Opponent strength, 1 (weakest) to 10; maps to Skill Level, search depth and candidate count. */
  readonly strength = input(5);
  /** When false the engine does not play as opponent, so no search runs in opponent mode and no move is emitted. */
  readonly allowOpponent = input(true);
  /** External game-over flag: stops all searching and suppresses `bestMove`, in addition to the position itself being over. */
  readonly gameOver = input(false);
  /** Emits the engine's move once it is final for the displayed position, in opponent mode on the opponent's turn. */
  readonly bestMove = output<EngineMove>();
  /** Bumped by `retry()` so the search effect runs again with unchanged inputs. */
  private readonly retries = signal(0);
  /**
   * Result to display: the full-strength analysis engine's while the opponent is to move with
   * analysis enabled (the playing engine may be weakened), otherwise the playing engine's.
   */
  readonly analysisResult = computed(() =>
    this.mode() === 'opponent' &&
    this.analysis() &&
    new Chess(this.position()).turn() !== this.playerColor()
      ? this.analysisEngine.result()
      : this.engine.result(),
  );
  /** First engine error of the playing engine or the analysis engine; empty when neither failed. */
  readonly analysisError = computed(() => this.engine.error() || this.analysisEngine.error());
  /** `analysisResult` restricted to the displayed position, so stale results are never shown. */
  private readonly currentAnalysisResult = computed(() => {
    const result = this.analysisResult();
    return result?.fen === this.position() ? result : null;
  });
  /** Human-readable evaluation of the displayed position; empty while no result matches it. */
  readonly evaluation = computed(() =>
    this.formatEvaluation(this.currentAnalysisResult()?.score ?? undefined),
  );
  /** Short evaluation label for the board's bar (`M3`, `-M3`, or pawns with one decimal). */
  readonly barEvaluationLabel = computed(() => {
    const score = this.currentAnalysisResult()?.score;
    if (!score) return '';
    if (score.type === 'mate') {
      return score.value === 0 ? 'M0' : `${score.value > 0 ? 'M' : '-M'}${Math.abs(score.value)}`;
    }
    return (score.value / 100).toFixed(1);
  });
  /** Evaluation for the board's bar in centipawns; a mate is mapped to +/-2000, `null` without a score. */
  readonly barEvaluation = computed(() => {
    const score = this.currentAnalysisResult()?.score;
    if (!score) return null;
    return score.type === 'mate' ? Math.sign(score.value) * 2000 : score.value;
  });

  /** Formats a White-perspective score as translated text: pawns with sign, or a mate announcement. */
  private formatEvaluation(score: EngineResult['score'] | undefined): string {
    if (!score) return '';
    if (score.type === 'mate') {
      if (score.value === 0) return this.i18n.t('Checkmate');
      const moves = Math.abs(score.value);
      return score.value > 0
        ? this.i18n.t('Mate in {moves} for White', { moves })
        : this.i18n.t('Mate in {moves} for Black', { moves });
    }
    const value = score.value / 100;
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
  }
  /**
   * Top three variations of the current result as numbered SAN text: `moves` holds the first three
   * plies, `extraMoves` the next four, `fullLine` up to 16 plies.
   */
  readonly variations = computed(() => {
    const result = this.currentAnalysisResult();
    if (!result) return [];
    return result.variations.slice(0, 3).map((variation) => {
      const chess = new Chess(result.fen);
      const line = variation.line.slice(0, 16).map((move, index) => {
        const color = chess.turn();
        const number = chess.moveNumber();
        const san = chess.move(move).san;
        if (color === 'w') return `${number}.${san}`;
        return index === 0 ? `${number}... ${san}` : san;
      });
      return {
        rank: variation.rank,
        evaluation: this.formatEvaluation(variation.score),
        moves: line.slice(0, 3).join(' '),
        extraMoves: line.slice(3, 7).join(' '),
        fullLine: line.join(' '),
      };
    });
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
      const strength = this.strength();
      const opponentTurn = mode === 'opponent' && new Chess(fen).turn() !== player;
      this.retries();
      const stopped =
        mode === 'off' ||
        gameOver ||
        new Chess(fen).isGameOver() ||
        (mode === 'opponent' &&
          (!allowOpponent || (new Chess(fen).turn() === player && !analysis)));
      const candidateCount =
        opponentTurn && strength >= 1 && strength <= 5 ? Math.max(2, 6 - strength) : 1;
      const opponentDepth =
        opponentTurn && Number.isInteger(strength) && strength >= 1 && strength <= OPPONENT_DEPTHS.length
          ? OPPONENT_DEPTHS[strength - 1]
          : undefined;
      untracked(() => {
        if (stopped) this.engine.stop();
        else
          this.engine.search(
            fen,
            position,
            opponentTurn ? Math.round(((strength - 1) * 20) / 9) : 20,
            opponentTurn ? candidateCount : 3,
            opponentTurn,
            opponentDepth,
          );
        if (!stopped && opponentTurn && analysis)
          this.analysisEngine.search(fen, position, 20, 3, false);
        else this.analysisEngine.stop();
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

  /** Starts a fresh engine for both searches and re-runs the search effect, e.g. after an engine error. */
  retry(): void {
    this.engine.reset();
    this.analysisEngine.reset();
    this.retries.update((value) => value + 1);
  }
}
