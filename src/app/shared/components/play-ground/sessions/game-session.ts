import { computed, signal } from '@angular/core';
import { Chess, Move, Square } from 'chess.js';

export interface GameTurn {
  number: number;
  white: string;
  black: string;
}

const MAX_COMMENT_LENGTH = 500;

function turnNumber(move: Move): number {
  return Number(move.before.split(' ')[5]);
}

export class GameSession {
  private game = new Chess();
  private readonly redoMoves: Move[] = [];
  private readonly commentStore = signal<Record<number, string>>({});
  readonly comments = this.commentStore.asReadonly();
  readonly position = signal(this.game.fen());
  readonly cursor = computed(() => {
    this.position();
    return this.game.history().length;
  });
  readonly timelineMoves = computed(() => {
    this.position();
    return [
      ...this.game.history({ verbose: true }).map((move) => move.san),
      ...this.redoMoves.map((move) => move.san),
    ];
  });
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
  readonly enginePosition = computed(() => {
    this.position();
    const moves = this.game.history({ verbose: true });
    const start = moves[0]?.before ?? this.game.fen();
    const line = moves.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`).join(' ');
    return `fen ${start}${line ? ` moves ${line}` : ''}`;
  });
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
  readonly history = computed(() => this.historyDetails().turns);
  readonly historyPlys = computed(() => this.historyDetails().plys);
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

  get(square: Square) {
    return this.game.get(square);
  }
  turn() {
    return this.game.turn();
  }
  isGameOver() {
    return this.game.isGameOver();
  }
  moves(square: Square) {
    return this.game.moves({ square, verbose: true });
  }
  move(from: Square, to: Square, promotion?: string): void {
    this.pruneComments();
    this.game.move({ from, to, promotion });
    this.redoMoves.length = 0;
    this.position.set(this.game.fen());
  }
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
  setComment(turn: number, text: string): void {
    const comment = this.normalizeComment(text);
    this.commentStore.update((comments) => {
      const next = { ...comments };
      if (comment) next[turn] = comment;
      else delete next[turn];
      return next;
    });
  }
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
  reset(): void {
    this.game.reset();
    this.redoMoves.length = 0;
    this.commentStore.set({});
    this.position.set(this.game.fen());
  }
  pgn(): string {
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
    return this.pgnWithComments();
  }

  private pgnWithComments(): string {
    const comments = this.commentStore();
    const moves = this.game.history({ verbose: true });
    if (!moves.length || !Object.keys(comments).length) return this.game.pgn();
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

  private normalizeComment(text: string): string {
    return text
      .replace(/\{/g, '(')
      .replace(/\}/g, ')')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_COMMENT_LENGTH);
  }
}
