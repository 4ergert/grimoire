import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Chess, Color, Square } from 'chess.js';
import { I18n, tr } from '../../i18n/i18n';
import { TranslatePipe } from '../../i18n/translate-pipe';
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
import { SettingsDialog } from './components/settings-dialog/settings-dialog';
import { GameOverDialog } from './components/game-over-dialog/game-over-dialog';
import { OpeningName } from './components/opening-name/opening-name';
import {
  EngineMode,
  EngineMove,
  StockfishPanel,
} from './components/stockfish-panel/stockfish-panel';

/**
 * Chessboard workspace that hosts three modes: free play (local or against Stockfish),
 * PGN replay and opening training. It owns the sessions and engine state, and delegates
 * rendering of the board, controls and dialogs to child components.
 */
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
    SettingsDialog,
    GameOverDialog,
    OpeningName,
    TranslatePipe,
  ],
  templateUrl: './play-ground.html',
  styleUrl: './play-ground.scss',
})
export class PlayGround {
  private readonly i18n = inject(I18n);
  /** Child engine panel; this component renders its analysis template and reads the evaluation bar values from it. */
  readonly stockfishPanel = viewChild(StockfishPanel);
  /** Whether the game is played against the engine instead of locally. */
  readonly computerGame = input(false);
  /** Whether the user is a guest (not signed in); guests cannot save games. */
  readonly guest = input(false);
  /** Whether the user has picked a side for the current engine game. */
  readonly engineSideChosen = signal(false);
  /** Whether the settings dialog is open. */
  readonly settingsOpen = signal(false);
  /** True while the side-selection dialog must be shown before an engine game starts. */
  readonly choosingEngineSide = computed(
    () => this.computerGame() && this.mode() === 'play' && !this.engineSideChosen(),
  );
  /** PGN of a saved game to replay; an empty string means no replay is requested. */
  readonly replayPgn = input('');
  /** Folder whose games are practised; when set, the component is in training mode. */
  readonly trainingFolder = input<GameFolder | null>(null);
  /** Active training round; `null` until one has started successfully. */
  readonly training = signal<TrainingSession | null>(null);
  /** Translated message of the last failed training start; empty otherwise. */
  readonly trainingError = signal('');
  /** Translated message of the last failed PGN import; empty otherwise. */
  readonly pgnImportError = signal('');
  /** Emits the PGN of the current game when the user saves it. */
  readonly saveGame = output<string>();
  /** Emits when the user leaves for the menu. */
  readonly back = output<void>();
  /** Emits when the user asks to log out. */
  readonly logout = output<void>();
  /** Whether a save request is in flight. */
  readonly pending = input(false);
  /** PGN replay state; its positions, index, moves and error are exposed below. */
  readonly replay = new ReplaySession();
  readonly replayPositions = this.replay.positions;
  readonly replayIndex = this.replay.index;
  readonly replayMoves = this.replay.moves;
  readonly replayError = this.replay.error;
  /** Whether the board is shown from Black's side. */
  readonly flipped = signal(false);
  /** Session of the free-play / engine game being played. */
  readonly game = new GameSession();
  /** `opponent` is only valid in an engine game in play mode; changed through `setEngineMode()`. */
  readonly engineMode = signal<EngineMode>('off');
  /** Whether engine analysis is shown; while the engine is the opponent it can be toggled on top. */
  readonly engineAnalysis = signal(false);
  /** Side played by the user in an engine game. */
  readonly playerColor = signal<Color>('w');
  /** Engine level (1-10) chosen for the current engine game. */
  readonly engineStrength = signal(5);
  /** Translated message of an engine move that could not be played; empty otherwise. */
  readonly engineError = signal('');
  /** Active mode: training wins over replay, which wins over free play. */
  readonly mode = computed<'play' | 'replay' | 'training'>(() =>
    this.trainingFolder()
      ? 'training'
      : this.replayPositions().length || this.replayError()
        ? 'replay'
        : 'play',
  );
  /** Local free play keeps the engine in analysis mode permanently. */
  readonly alwaysAnalyse = computed(() => !this.computerGame() && this.mode() === 'play');
  /** True after a finished engine game was opened for analysis. */
  readonly reviewing = signal(false);
  /** True once the user closed the result dialog of the current engine game. */
  readonly resultDismissed = signal(false);
  /** Whether the move timeline may be navigated (not during an active engine game). */
  readonly canNavigate = computed(
    () => this.mode() === 'play' && (!this.computerGame() || this.reviewing()),
  );
  /** Translated result summary of a finished engine game, or null while it should not be shown. */
  readonly gameResult = computed(() => {
    const outcome = this.game.outcome();
    if (
      !outcome ||
      !this.computerGame() ||
      this.mode() !== 'play' ||
      !this.engineSideChosen() ||
      this.reviewing()
    ) {
      return null;
    }
    const title = !outcome.winner
      ? tr('Draw')
      : outcome.winner === this.playerColor()
        ? tr('You win!')
        : tr('Stockfish wins');
    return {
      title: this.i18n.t(title),
      detail: this.i18n.t('{reason} · Level {level}', {
        reason: this.i18n.t(outcome.reason),
        level: this.engineStrength(),
      }),
    };
  });
  /** Whether the result dialog is visible: a result exists and was not dismissed. */
  readonly showResult = computed(() => !!this.gameResult() && !this.resultDismissed());
  /** Currently selected square, if any. */
  readonly selected = signal<Square | null>(null);
  /** Pending promotion move awaiting the choice of a piece. */
  readonly promotion = signal<{ from: Square; to: Square } | null>(null);
  /** FEN shown on the board for the active mode. */
  readonly displayPosition = computed(() => {
    const training = this.training();
    if (training) return training.position();
    if (this.trainingFolder()) return new Chess().fen();
    const positions = this.replayPositions();
    return positions.length ? positions[this.replayIndex()] : this.game.position();
  });
  /** Positions from the start up to the one on display, used to detect the opening name. */
  readonly openingPositions = computed(() => {
    const training = this.training();
    if (training) return training.positions();
    if (this.trainingFolder()) return [this.displayPosition()];
    const positions = this.replayPositions();
    return positions.length
      ? positions.slice(0, this.replayIndex() + 1)
      : this.game.positions().slice(0, this.game.cursor() + 1);
  });
  /** Piece grid of the displayed position, as returned by chess.js. */
  readonly board = computed(() => new Chess(this.displayPosition()).board());
  /** True when the engine, as the user's opponent, has to move now. */
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
  /** Argument of the UCI `position` command for the active mode: the game's move history in play mode, else the displayed FEN. */
  readonly enginePosition = computed(() =>
    this.mode() === 'play' ? this.game.enginePosition() : `fen ${this.displayPosition()}`,
  );
  /** Whether the displayed position is terminal (mate or draw). */
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
      const folder = this.trainingFolder();
      if (folder) this.setEngineMode('off');
      this.training.set(null);
      this.trainingError.set('');
      this.selected.set(null);
      this.promotion.set(null);
      if (folder) untracked(() => this.startTraining(folder.color));
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

  /**
   * Switches the engine mode. Requests that conflict with the current context are ignored:
   * local play is always analysis, and opponent mode needs an engine game in play mode.
   * Requesting analysis while the engine is the opponent only toggles the analysis overlay.
   */
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

  /**
   * Restarts the game and starts playing against the engine; ignored outside an engine game in play mode.
   * @param color - Side played by the user.
   * @param strength - Engine level; defaults to the current one.
   */
  startEngineGame(color: Color, strength = this.engineStrength()): void {
    if (!this.computerGame() || this.mode() !== 'play') return;
    const analyse = this.engineAnalysis();
    this.restart();
    this.engineSideChosen.set(true);
    this.playerColor.set(color);
    this.engineStrength.set(strength);
    this.flipped.set(color === 'b');
    this.setEngineMode('opponent');
    this.engineAnalysis.set(analyse);
  }

  /** Discards the current engine game and returns to the side-selection dialog. */
  chooseNewEngineGame(): void {
    this.setEngineMode('off');
    this.restart();
    this.engineSideChosen.set(false);
  }

  /** Closes the result dialog and opens the finished engine game in analysis mode. */
  analyseFinishedGame(): void {
    this.resultDismissed.set(true);
    this.reviewing.set(true);
    this.engineMode.set('analysis');
    this.engineAnalysis.set(true);
    this.engineError.set('');
    this.clearSelection();
  }

  /** Closes the result dialog and saves the finished game. */
  saveFinishedGame(): void {
    this.resultDismissed.set(true);
    this.save();
  }

  /**
   * Plays the engine's reply on the board. The result is dropped if it is no longer the
   * engine's turn or was computed for a different position; an unplayable move sets an error.
   */
  playEngineMove(result: EngineMove): void {
    if (!this.engineTurn() || result.fen !== this.game.position()) return;
    try {
      const move = new Chess(result.fen).move(result.move);
      this.game.move(move.from, move.to, move.promotion);
      this.clearSelection();
    } catch (error) {
      console.error('Stockfish move could not be played', error);
      this.engineError.set(
        tr('Stockfish returned an invalid move. Return to the menu and start a new game.'),
      );
    }
  }

  /**
   * Starts a training round over the games of the current folder.
   * @param color - Side the user practises; failures are reported through `trainingError`.
   */
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
        error instanceof Error ? error.message : tr('Training could not be started.'),
      );
    }
  }

  /** Advances training to the next game of the round. */
  nextTrainingGame(): void {
    this.training()?.next();
    this.selected.set(null);
    this.promotion.set(null);
  }

  /** Plays the move the user asked to have revealed. */
  playTrainingSolution(): void {
    this.training()?.playRevealed();
    this.selected.set(null);
    this.promotion.set(null);
  }

  /** Emits the current game as PGN through `saveGame`. */
  save(): void {
    this.saveGame.emit(this.game.pgn());
  }
  /** Replaces the current game with the given PGN; invalid input sets `pgnImportError`. */
  importPgn(pgn: string): void {
    try {
      this.game.loadPgn(pgn);
      this.pgnImportError.set('');
      this.clearSelection();
    } catch (error) {
      console.error('PGN could not be imported', error);
      this.pgnImportError.set(tr('This PGN could not be loaded.'));
    }
  }
  readonly moveHistory = this.game.history;
  readonly comments = this.game.comments;
  /** PGN offered for export: the replayed game in replay mode, otherwise the current game. */
  readonly exportPgn = computed(() =>
    this.mode() === 'replay' ? this.replayPgn() : this.game.pgnText(),
  );
  /** Stores the comment of a full move (turn) of the current game. */
  setComment(event: { turn: number; text: string }): void {
    this.game.setComment(event.turn, event.text);
  }
  /** Destination squares of the legal moves from the selected square. */
  readonly legalTargets = computed(() => {
    const square = this.selected();
    const position = this.training()?.position() ?? this.game.position();
    return square
      ? new Chess(position).moves({ square, verbose: true }).map((move) => move.to)
      : [];
  });
  readonly status = this.game.status;

  /**
   * Handles a click on a square: selects a piece, or moves the selected piece there.
   * Ignored while choosing the engine side, replaying, or when it is not the user's turn.
   * Moves that need a promotion choice are parked in `promotion`; in training mode the
   * move is checked against the saved line instead of being played directly.
   */
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

  /** Completes the pending promotion move with the chosen piece. */
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

  /** Resets the game, replay and engine/result state to a fresh start. */
  restart(): void {
    this.engineError.set('');
    this.reviewing.set(false);
    this.resultDismissed.set(false);
    this.replay.clear();
    this.game.reset();
    this.clearSelection();
  }

  /** Deselects the square and drops any pending promotion. */
  private clearSelection(): void {
    this.selected.set(null);
    this.promotion.set(null);
  }
}
