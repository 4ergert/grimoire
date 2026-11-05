import { Component, computed, effect, input, output, signal } from '@angular/core';
import { Chess, Color, PieceSymbol, Square, SQUARES } from 'chess.js';
import { GameFolder } from '../../services/game-library';
import { TrainingSession } from './training-session';

type Promotion = 'q' | 'r' | 'b' | 'n';

@Component({
  selector: 'app-play-ground',
  imports: [],
  templateUrl: './play-ground.html',
  styleUrl: './play-ground.scss',
})
export class PlayGround {
  readonly replayPgn = input('');
  readonly trainingFolder = input<GameFolder | null>(null);
  readonly training = signal<TrainingSession | null>(null);
  readonly trainingError = signal('');
  readonly saveGame = output<string>();
  readonly back = output<void>();
  readonly replayPositions = signal<string[]>([]);
  readonly replayIndex = signal(0);
  readonly replayMoves = signal<string[]>([]);
  readonly replayError = signal('');
  readonly ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  readonly files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  readonly squares = SQUARES;
  private readonly game = new Chess();
  private readonly position = signal(this.game.fen());
  readonly selected = signal<Square | null>(null);
  readonly promotion = signal<{ from: Square; to: Square } | null>(null);
  readonly promotions: readonly Promotion[] = ['q', 'r', 'b', 'n'];
  readonly pieceNames: Record<PieceSymbol, string> = {
    k: 'King',
    q: 'Queen',
    r: 'Rook',
    b: 'Bishop',
    n: 'Knight',
    p: 'Pawn',
  };
  readonly board = computed(() => {
    const training = this.training();
    if (training) return new Chess(training.position()).board();
    if (this.trainingFolder()) return new Chess().board();
    const positions = this.replayPositions();
    return new Chess(positions.length ? positions[this.replayIndex()] : this.position()).board();
  });
  constructor() {
    effect(() => {
      this.trainingFolder();
      this.training.set(null);
      this.trainingError.set('');
      this.selected.set(null);
      this.promotion.set(null);
    });
    effect(() => {
      const pgn = this.replayPgn();
      if (!pgn) return;
      try {
        const replay = new Chess();
        replay.loadPgn(pgn);
        const moves = replay.history({ verbose: true });
        this.replayPositions.set([
          moves[0]?.before ?? replay.fen(),
          ...moves.map((move) => move.after),
        ]);
        this.replayMoves.set(moves.map((move) => move.san));
        this.replayIndex.set(0);
        this.selected.set(null);
        this.promotion.set(null);
        this.replayError.set('');
      } catch (error) {
        console.error('PGN replay could not be loaded', error);
        this.replayError.set('This saved PGN could not be loaded.');
        this.replayPositions.set([]);
      }
    });
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
    this.game.setHeader('Event', 'Grimoire local game');
    this.game.setHeader(
      'Result',
      this.game.isCheckmate()
        ? this.game.turn() === 'w'
          ? '0-1'
          : '1-0'
        : this.game.isDraw()
          ? '1/2-1/2'
          : '*',
    );
    this.saveGame.emit(this.game.pgn());
  }
  readonly moveHistory = computed(() => {
    this.position();
    const turns: { number: number; white: string; black: string }[] = [];
    for (const move of this.game.history({ verbose: true })) {
      const number = Number(move.before.split(' ')[5]);
      let turn = turns[turns.length - 1];
      if (!turn || turn.number !== number) {
        turn = { number, white: '', black: '' };
        turns.push(turn);
      }
      if (move.color === 'w') {
        turn.white = move.san;
      } else {
        turn.black = move.san;
      }
    }
    return turns;
  });
  readonly legalTargets = computed(() => {
    const square = this.selected();
    const position = this.training()?.position() ?? this.position();
    return square
      ? new Chess(position).moves({ square, verbose: true }).map((move) => move.to)
      : [];
  });
  readonly status = computed(() => {
    this.position();
    const player = this.game.turn() === 'w' ? 'White' : 'Black';
    if (this.game.isCheckmate())
      return `Checkmate! ${player === 'White' ? 'Black' : 'White'} wins.`;
    if (this.game.isStalemate()) return 'Draw by stalemate.';
    if (this.game.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (this.game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (this.game.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.';
    return `${player} to move${this.game.isCheck() ? ' - Check!' : '.'}`;
  });

  pieceGlyph(type: PieceSymbol, color: Color): string {
    const glyphs = {
      w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
      b: { k: '\u265a', q: '\u265b', r: '\u265c', b: '\u265d', n: '\u265e', p: '\u265f' },
    };
    return glyphs[color][type];
  }

  select(square: Square): void {
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
      this.game.isGameOver() ||
      this.promotion()
    )
      return;
    const from = this.selected();
    if (from && this.legalTargets().includes(square)) {
      const moves = this.game
        .moves({ square: from, verbose: true })
        .filter((move) => move.to === square);
      if (moves.some((move) => move.isPromotion())) {
        this.promotion.set({ from, to: square });
      } else {
        this.game.move({ from, to: square });
        this.updatePosition();
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
    this.game.move({ ...move, promotion: piece });
    this.updatePosition();
  }

  restart(): void {
    this.replayPositions.set([]);
    this.replayMoves.set([]);
    this.replayError.set('');
    this.game.reset();
    this.updatePosition();
  }

  private updatePosition(): void {
    this.position.set(this.game.fen());
    this.selected.set(null);
    this.promotion.set(null);
  }
}
