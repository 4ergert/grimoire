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

const ANALYSIS_ENGINE = new InjectionToken<StockfishEngine>('Stockfish full-strength analysis');
const OPPONENT_DEPTHS = [5, 6, 7, 9, 10, 12, 14, 16, 20, 26] as const;

export type EngineMode = 'off' | 'analysis' | 'opponent';

export interface EngineMove {
  fen: string;
  move: string;
}

@Component({
  selector: 'app-stockfish-panel',
  providers: [StockfishEngine, { provide: ANALYSIS_ENGINE, useClass: StockfishEngine }],
  imports: [TranslatePipe],
  templateUrl: './stockfish-panel.html',
  styleUrl: './stockfish-panel.scss',
})
export class StockfishPanel {
  private static nextTooltipId = 0;
  readonly tooltipId = StockfishPanel.nextTooltipId++;
  readonly analysisView = viewChild<TemplateRef<unknown>>('analysisView');
  private readonly i18n = inject(I18n);
  readonly engine = inject(StockfishEngine);
  private readonly analysisEngine = inject(ANALYSIS_ENGINE);
  readonly position = input(new Chess().fen());
  readonly enginePosition = input.required<string>();
  readonly mode = input<EngineMode>('off');
  readonly analysis = input(false);
  readonly playerColor = input<Color>('w');
  readonly strength = input(5);
  readonly allowOpponent = input(true);
  readonly gameOver = input(false);
  readonly bestMove = output<EngineMove>();
  private readonly retries = signal(0);
  readonly analysisResult = computed(() =>
    this.mode() === 'opponent' &&
    this.analysis() &&
    new Chess(this.position()).turn() !== this.playerColor()
      ? this.analysisEngine.result()
      : this.engine.result(),
  );
  readonly analysisError = computed(() => this.engine.error() || this.analysisEngine.error());
  private readonly currentAnalysisResult = computed(() => {
    const result = this.analysisResult();
    return result?.fen === this.position() ? result : null;
  });
  readonly evaluation = computed(() =>
    this.formatEvaluation(this.currentAnalysisResult()?.score ?? undefined),
  );
  readonly barEvaluationLabel = computed(() => {
    const score = this.currentAnalysisResult()?.score;
    if (!score) return '';
    if (score.type === 'mate') {
      return score.value === 0 ? 'M0' : `${score.value > 0 ? 'M' : '-M'}${Math.abs(score.value)}`;
    }
    return (score.value / 100).toFixed(1);
  });
  readonly barEvaluation = computed(() => {
    const score = this.currentAnalysisResult()?.score;
    if (!score) return null;
    return score.type === 'mate' ? Math.sign(score.value) * 2000 : score.value;
  });

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

  retry(): void {
    this.engine.reset();
    this.analysisEngine.reset();
    this.retries.update((value) => value + 1);
  }
}
