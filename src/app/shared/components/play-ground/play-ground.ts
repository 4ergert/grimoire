import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { Chess, Color, Square } from 'chess.js';
import { GameFolder } from '../../services/game-library';
import { TrainingSession } from './sessions/training-session';
import { ChessBoard } from './components/chess-board/chess-board';
import { GameSession } from './sessions/game-session';
import { ReplaySession } from './sessions/replay-session';
import { GameControls } from './components/game-controls/game-controls';
import { ReplayControls } from './components/replay-controls/replay-controls';
import { Promotion, PromotionControls } from './components/promotion-controls/promotion-controls';
import { TrainingPanel } from './components/training-panel/training-panel';
import { MoveHistory } from './components/move-history/move-history';
import { EngineSideDialog } from './components/engine-side-dialog/engine-side-dialog';
import {
  EngineMode,
  EngineMove,
  StockfishPanel,
} from './components/stockfish-panel/stockfish-panel';

@Component({
  selector: 'app-play-ground',
  imports: [
    NgTemplateOutlet,
    ChessBoard,
    GameControls,
    ReplayControls,
    PromotionControls,
    TrainingPanel,
    MoveHistory,
    StockfishPanel,
    EngineSideDialog,
  ],
  templateUrl: './play-ground.html',
  styleUrl: './play-ground.scss',
})
export class PlayGround {
  readonly stockfishPanel = viewChild(StockfishPanel);
  readonly computerGame = input(false);
  readonly engineSideChosen = signal(false);
  readonly choosingEngineSide = computed(
    () => this.computerGame() && this.mode() === 'play' && !this.engineSideChosen(),
  );
  readonly replayPgn = input('');
  readonly trainingFolder = input<GameFolder | null>(null);
  readonly training = signal<TrainingSession | null>(null);
  readonly trainingError = signal('');
  readonly saveGame = output<string>();
  readonly back = output<void>();
  readonly logout = output<void>();
  readonly pending = input(false);
  readonly replay = new ReplaySession();
  readonly replayPositions = this.replay.positions;
  readonly replayIndex = this.replay.index;
  readonly replayMoves = this.replay.moves;
  readonly replayError = this.replay.error;
  readonly flipped = signal(false);
  readonly game = new GameSession();
  readonly engineMode = signal<EngineMode>('off');
  readonly engineAnalysis = signal(false);
  readonly playerColor = signal<Color>('w');
  readonly engineError = signal('');
  readonly mode = computed<'play' | 'replay' | 'training'>(() =>
    this.trainingFolder()
      ? 'training'
      : this.replayPositions().length || this.replayError()
        ? 'replay'
        : 'play',
  );
  readonly alwaysAnalyse = computed(() => !this.computerGame() && this.mode() === 'play');
  readonly selected = signal<Square | null>(null);
  readonly promotion = signal<{ from: Square; to: Square } | null>(null);
  readonly displayPosition = computed(() => {
    const training = this.training();
    if (training) return training.position();
    if (this.trainingFolder()) return new Chess().fen();
    const positions = this.replayPositions();
    return positions.length ? positions[this.replayIndex()] : this.game.position();
  });
  readonly board = computed(() => new Chess(this.displayPosition()).board());
  readonly engineTurn = computed(() => {
    this.game.position();
    return (
      this.mode() === 'play' &&
      this.computerGame() &&
      this.engineMode() === 'opponent' &&
      this.game.turn() !== this.playerColor() &&
      !this.game.isGameOver()
    );
  });
  readonly enginePosition = computed(() =>
    this.mode() === 'play' ? this.game.enginePosition() : `fen ${this.displayPosition()}`,
  );
  readonly gameOver = computed(() => {
    this.game.position();
    return this.mode() === 'play'
      ? this.game.isGameOver()
      : new Chess(this.displayPosition()).isGameOver();
  });
  constructor() {
    effect(() => {
      if (this.alwaysAnalyse()) {
        if (this.engineMode() !== 'analysis') this.setEngineMode('analysis');
      } else if (!this.computerGame() && this.engineMode() === 'opponent') {
        this.setEngineMode('off');
      }
    });
    effect(() => {
      if (this.trainingFolder()) this.setEngineMode('off');
      this.training.set(null);
      this.trainingError.set('');
      this.selected.set(null);
      this.promotion.set(null);
    });
    effect(() => {
      const pgn = this.replayPgn();
      if (!pgn) return;
      this.setEngineMode('off');
      this.replay.load(pgn);
      this.selected.set(null);
      this.promotion.set(null);
    });
  }

  setEngineMode(mode: EngineMode): void {
    if (this.alwaysAnalyse() && mode !== 'analysis') return;
    if (mode === 'opponent' && (!this.computerGame() || this.mode() !== 'play')) return;
    if (mode === 'analysis' && this.engineMode() === 'opponent') {
      this.engineAnalysis.update((enabled) => !enabled);
      return;
    }
    this.engineMode.set(mode);
    this.engineAnalysis.set(mode === 'analysis');
    this.engineError.set('');
    this.clearSelection();
  }

  startEngineGame(color: Color): void {
    if (!this.computerGame() || this.mode() !== 'play') return;
    const analyse = this.engineAnalysis();
    this.restart();
    this.engineSideChosen.set(true);
    this.playerColor.set(color);
    this.flipped.set(color === 'b');
    this.setEngineMode('opponent');
    this.engineAnalysis.set(analyse);
  }

  playEngineMove(result: EngineMove): void {
    if (!this.engineTurn() || result.fen !== this.game.position()) return;
    try {
      const move = new Chess(result.fen).move(result.move);
      this.game.move(move.from, move.to, move.promotion);
      this.clearSelection();
    } catch (error) {
      console.error('Stockfish move could not be played', error);
      this.engineError.set('Stockfish returned an invalid move. Return to the menu and start a new game.');
    }
  }

  startTraining(color: Color): void {
    const folder = this.trainingFolder();
    if (!folder) return;
    try {
      const session = new TrainingSession();
      session.start(folder.games, color);
      this.training.set(session);
      this.trainingError.set('');
      this.selected.set(null);
      this.promotion.set(null);
    } catch (error) {
      console.error('Training could not be started', error);
      this.trainingError.set(
        error instanceof Error ? error.message : 'Training could not be started.',
      );
    }
  }

  nextTrainingGame(): void {
    this.training()?.next();
    this.selected.set(null);
    this.promotion.set(null);
  }

  playTrainingSolution(): void {
    this.training()?.playRevealed();
    this.selected.set(null);
    this.promotion.set(null);
  }

  save(): void {
    this.saveGame.emit(this.game.pgn());
  }
  readonly moveHistory = this.game.history;
  readonly legalTargets = computed(() => {
    const square = this.selected();
    const position = this.training()?.position() ?? this.game.position();
    return square
      ? new Chess(position).moves({ square, verbose: true }).map((move) => move.to)
      : [];
  });
  readonly status = this.game.status;

  select(square: Square): void {
    if (this.choosingEngineSide()) return;
    if (this.trainingFolder()) {
      const training = this.training();
      if (!training || training.complete() || this.promotion()) return;
      const game = new Chess(training.position());
      const from = this.selected();
      const piece = game.get(square);
      if (from && from !== square && piece?.color !== training.color()) {
        const promotion = game
          .moves({ square: from, verbose: true })
          .some((move) => move.to === square && move.isPromotion());
        if (promotion) {
          this.promotion.set({ from, to: square });
        } else {
          training.tryMove(from, square);
          this.selected.set(null);
        }
      } else {
        this.selected.set(piece?.color === training.color() && square !== from ? square : null);
      }
      return;
    }
    if (
      this.replayPositions().length ||
      this.replayError() ||
      this.engineTurn() ||
      this.game.isGameOver() ||
      this.promotion()
    )
      return;
    const from = this.selected();
    if (from && this.legalTargets().includes(square)) {
      const moves = this.game.moves(from).filter((move) => move.to === square);
      if (moves.some((move) => move.isPromotion())) {
        this.promotion.set({ from, to: square });
      } else {
        this.game.move(from, square);
        this.clearSelection();
      }
      return;
    }
    const piece = this.game.get(square);
    this.selected.set(piece?.color === this.game.turn() && square !== from ? square : null);
  }

  promote(piece: Promotion): void {
    const move = this.promotion();
    if (!move) return;
    const training = this.training();
    if (training) {
      training.tryMove(move.from, move.to, piece);
      this.selected.set(null);
      this.promotion.set(null);
      return;
    }
    this.game.move(move.from, move.to, piece);
    this.clearSelection();
  }

  restart(): void {
    this.engineError.set('');
    this.replay.clear();
    this.game.reset();
    this.clearSelection();
  }

  private clearSelection(): void {
    this.selected.set(null);
    this.promotion.set(null);
  }
}
