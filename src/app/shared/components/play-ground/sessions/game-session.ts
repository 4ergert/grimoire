import { computed, signal } from '@angular/core';
import { Chess, Color, Move, Square } from 'chess.js';
import { tr } from '../../../i18n/i18n';

/** One full move of the history table; a side's SAN is an empty string if it has not moved yet. */
export interface GameTurn {
  /** Full-move number as it appears in the FEN of the position before the move. */
  number: number;
  /** SAN of White's move. */
  white: string;
  /** SAN of Black's move. */
  black: string;
}

/** Upper bound for the length of a stored comment, applied after normalization. */
const MAX_COMMENT_LENGTH = 500;

/** Result of a finished game. */
export interface GameOutcome {
  /** The winning color, or `null` for a draw. */
  winner: Color | null;
  /** Translated, human-readable reason such as checkmate or stalemate. */
  reason: string;
}

/** Returns the full-move number of the position a move was played from. */
function turnNumber(move: Move): number {
  return Number(move.before.split(' ')[5]);
}

/**
 * A local chess game with a navigable timeline and per-move comments.
 *
 * The timeline consists of the moves played so far plus the "redo" moves that were stepped
 * back over via {@link GameSession.navigate}. Playing a new move discards the redo moves.
 * All derived state is exposed as signals that update whenever {@link GameSession.position} changes.
 */
export class GameSession {
  private game = new Chess();
  /** Moves stepped back over that can still be replayed, in playing order. */
  private readonly redoMoves: Move[] = [];
  private readonly commentStore = signal<Record<number, string>>({});
  /** Comments keyed by full-move number. */
  readonly comments = this.commentStore.asReadonly();
  /** FEN of the current position; changing it invalidates all derived signals. */
  readonly position = signal(this.game.fen());
  /** Number of moves currently applied, i.e. the current index on the timeline. */
  readonly cursor = computed(() => {
    this.position();
    return this.game.history().length;
  });
  /** SAN of every move on the timeline, including those that can be redone. */
  readonly timelineMoves = computed(() => {
    this.position();
    return [
      ...this.game.history({ verbose: true }).map((move) => move.san),
      ...this.redoMoves.map((move) => move.san),
    ];
  });
  /** FEN after each timeline index, starting with the initial position (so one more entry than moves). */
  readonly positions = computed(() => {
    this.position();
    const moves = this.game.history({ verbose: true });
    const positions = [moves[0]?.before ?? this.game.fen(), ...moves.map((move) => move.after)];
    const replay = new Chess(this.game.fen());
    for (const move of this.redoMoves) {
      positions.push(
        replay.move({ from: move.from, to: move.to, promotion: move.promotion }).after,
      );
    }
    return positions;
  });
  /** Position of the current cursor as an engine command fragment: `fen <start> [moves <uci...>]`. Excludes redo moves. */
  readonly enginePosition = computed(() => {
    this.position();
    const moves = this.game.history({ verbose: true });
    const start = moves[0]?.before ?? this.game.fen();
    const line = moves.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`).join(' ');
    return `fen ${start}${line ? ` moves ${line}` : ''}`;
  });
  /** Turns grouped by full-move number, plus the 1-based timeline index (ply) of each side's move. */
  private readonly historyDetails = computed(() => {
    this.position();
    const turns: GameTurn[] = [];
    const plys: { white: number | null; black: number | null }[] = [];
    const moves = [...this.game.history({ verbose: true }), ...this.redoMoves];
    moves.forEach((move, index) => {
      const number = Number(move.before.split(' ')[5]);
      let turn = turns[turns.length - 1];
      if (!turn || turn.number !== number) {
        turn = { number, white: '', black: '' };
        turns.push(turn);
        plys.push({ white: null, black: null });
      }
      if (move.color === 'w') {
        turn.white = move.san;
        plys[plys.length - 1].white = index + 1;
      } else {
        turn.black = move.san;
        plys[plys.length - 1].black = index + 1;
      }
    });
    return { turns, plys };
  });
  /** Full timeline (including redo moves) as turns for the history table. */
  readonly history = computed(() => this.historyDetails().turns);
  /** For each entry of {@link GameSession.history}, the 1-based ply of White's and Black's move, or `null` if absent. Usable with {@link GameSession.navigate}. */
  readonly historyPlys = computed(() => this.historyDetails().plys);
  /** Reactive PGN of the whole timeline, also refreshed when comments change. */
  readonly pgnText = computed(() => {
    this.position();
    this.commentStore();
    return this.pgn();
  });
  /** Result of the current position, or `null` while the game is still running. */
  readonly outcome = computed<GameOutcome | null>(() => {
    this.position();
    if (!this.game.isGameOver()) return null;
    if (this.game.isCheckmate()) {
      return { winner: this.game.turn() === 'w' ? 'b' : 'w', reason: tr('Checkmate') };
    }
    if (this.game.isStalemate()) return { winner: null, reason: tr('Stalemate') };
    if (this.game.isInsufficientMaterial()) {
      return { winner: null, reason: tr('Insufficient material') };
    }
    if (this.game.isThreefoldRepetition()) {
      return { winner: null, reason: tr('Threefold repetition') };
    }
    return { winner: null, reason: tr('Fifty-move rule') };
  });
  /** Translated status line: side to move, check, or the final result. */
  readonly status = computed(() => {
    this.position();
    const white = this.game.turn() === 'w';
    if (this.game.isCheckmate()) {
      return white ? tr('Checkmate! Black wins.') : tr('Checkmate! White wins.');
    }
    if (this.game.isStalemate()) return tr('Draw by stalemate.');
    if (this.game.isInsufficientMaterial()) return tr('Draw by insufficient material.');
    if (this.game.isThreefoldRepetition()) return tr('Draw by threefold repetition.');
    if (this.game.isDrawByFiftyMoves()) return tr('Draw by the fifty-move rule.');
    if (this.game.isCheck()) return white ? tr('White to move - Check!') : tr('Black to move - Check!');
    return white ? tr('White to move.') : tr('Black to move.');
  });

  /** Returns the piece on the square in the current position, or `undefined` if it is empty. */
  get(square: Square) {
    return this.game.get(square);
  }
  /** Returns the side to move in the current position. */
  turn() {
    return this.game.turn();
  }
  /** Returns whether the current position is final (checkmate or any kind of draw). */
  isGameOver() {
    return this.game.isGameOver();
  }
  /** Returns the legal moves of the piece on the given square. */
  moves(square: Square) {
    return this.game.moves({ square, verbose: true });
  }
  /**
   * Plays a move at the current cursor, discarding any redo moves and the comments of discarded turns.
   *
   * @param promotion - Piece to promote to, required for promoting pawn moves.
   * @throws If the move is illegal (propagated from chess.js).
   */
  move(from: Square, to: Square, promotion?: string): void {
    this.pruneComments();
    this.game.move({ from, to, promotion });
    this.redoMoves.length = 0;
    this.position.set(this.game.fen());
  }
  /**
   * Replaces the game with the one described by the PGN, importing its comments per full move.
   * Several comments within one turn are merged. The session is left unchanged if parsing fails.
   *
   * @throws If the PGN cannot be parsed (propagated from chess.js).
   */
  loadPgn(pgn: string): void {
    const game = new Chess();
    game.loadPgn(pgn);
    const byFen = new Map(game.getComments().map(({ fen, comment }) => [fen, comment]));
    const comments: Record<number, string> = {};
    for (const move of game.history({ verbose: true })) {
      const text = byFen.get(move.after);
      if (!text) continue;
      const number = turnNumber(move);
      const comment = this.normalizeComment(comments[number] ? `${comments[number]} ${text}` : text);
      if (comment) comments[number] = comment;
    }
    this.game = game;
    this.redoMoves.length = 0;
    this.commentStore.set(comments);
    this.position.set(game.fen());
  }
  /** Sets the comment of a full move; text that is empty after normalization removes it. */
  setComment(turn: number, text: string): void {
    const comment = this.normalizeComment(text);
    this.commentStore.update((comments) => {
      const next = { ...comments };
      if (comment) next[turn] = comment;
      else delete next[turn];
      return next;
    });
  }
  /**
   * Moves the cursor to a timeline index by undoing or redoing moves.
   *
   * @param index - Number of moves to be applied; clamped to the timeline and truncated to an integer.
   */
  navigate(index: number): void {
    const target = Math.max(0, Math.min(this.timelineMoves().length, Math.trunc(index)));
    while (this.game.history().length > target) {
      const move = this.game.undo();
      if (move) this.redoMoves.unshift(move);
    }
    while (this.game.history().length < target) {
      const move = this.redoMoves.shift();
      if (!move) break;
      this.game.move({ from: move.from, to: move.to, promotion: move.promotion });
    }
    this.position.set(this.game.fen());
  }
  /** Restarts from the initial position, dropping all moves, redo moves and comments. */
  reset(): void {
    this.game.reset();
    this.redoMoves.length = 0;
    this.commentStore.set({});
    this.position.set(this.game.fen());
  }
  /** Exports the whole timeline (including redo moves) as PGN with comments and a computed result header. */
  pgn(): string {
    const moves = [...this.game.history({ verbose: true }), ...this.redoMoves];
    if (!moves.length) {
      this.game.setHeader('Event', 'Grimoire local game');
      this.game.setHeader('Result', '*');
      return this.game.pgn();
    }
    // The export covers the whole timeline, including moves currently stepped back over.
    const comments = this.commentStore();
    const annotated = new Chess(moves[0].before);
    for (const [key, value] of Object.entries(this.game.getHeaders())) {
      annotated.setHeader(key, value);
    }
    moves.forEach((move, index) => {
      annotated.move({ from: move.from, to: move.to, promotion: move.promotion });
      if (move.color === 'w' && index < moves.length - 1) return;
      const comment = comments[turnNumber(move)];
      if (comment) annotated.setComment(comment);
    });
    annotated.setHeader('Event', 'Grimoire local game');
    annotated.setHeader(
      'Result',
      annotated.isCheckmate()
        ? annotated.turn() === 'w'
          ? '0-1'
          : '1-0'
        : annotated.isDraw()
          ? '1/2-1/2'
          : '*',
    );
    return annotated.pgn();
  }

  // Comments belong to whole moves of the current line; moves discarded by a new move lose theirs.
  private pruneComments(): void {
    const last = this.game.history({ verbose: true }).at(-1);
    const lastTurn = last ? turnNumber(last) : 0;
    this.commentStore.update((comments) =>
      Object.fromEntries(Object.entries(comments).filter(([turn]) => Number(turn) <= lastTurn)),
    );
  }

  /** Makes text safe for a PGN comment: no braces, collapsed whitespace, trimmed and length-limited. */
  private normalizeComment(text: string): string {
    return text
      .replace(/\{/g, '(')
      .replace(/\}/g, ')')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_COMMENT_LENGTH);
  }
}
