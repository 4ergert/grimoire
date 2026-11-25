import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Chess } from 'chess.js';
import { tr } from '../../../../i18n/i18n';

/** A requested search; `fen` is the position being analysed, `position` the UCI `position` argument sent to the engine. */
interface Search {
  fen: string;
  position: string;
  skill: number;
  candidateCount: number;
  randomize: boolean;
  depth?: number;
}

/** One principal variation (MultiPV line) reported by the engine; `rank` is the 1-based MultiPV index, `score` is from White's perspective. */
export interface EngineVariation {
  rank: number;
  depth: number;
  score: { type: 'cp' | 'mate'; value: number } | null;
  line: string[];
}

/**
 * Latest engine output for one position. Scores are in centipawns (`cp`) or moves to mate
 * (`mate`) from White's perspective; moves are in UCI coordinate notation (e.g. `e2e4`, `e7e8q`).
 * `bestMove` stays `null` until the search has finished.
 */
export interface EngineResult {
  fen: string;
  depth: number;
  score: { type: 'cp' | 'mate'; value: number } | null;
  line: string[];
  bestMove: string | null;
  variations: EngineVariation[];
}

/**
 * Wraps a Stockfish Web Worker spoken to via the UCI protocol. The worker is created lazily on the
 * first search and terminated on failure, `reset()` or destruction of the injector. Only the most
 * recently requested search is kept: UCI has no request IDs, so an older search is stopped and its
 * `bestmove` discarded before the newest one starts. Provide it per component, not as a singleton.
 */
@Injectable()
export class StockfishEngine {
  private readonly document = inject(DOCUMENT);
  private worker: Worker | null = null;
  private desired: Search | null = null;
  private active: Search | null = null;
  private candidateDepth = 0;
  private readonly candidates = new Map<number, string>();
  private stopping = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** True once the engine has answered `isready` after the UCI handshake. */
  readonly ready = signal(false);
  /** True while a requested search has not yet produced its final `bestmove`. */
  readonly busy = signal(false);
  /** Translated message of the last failure; empty when healthy. Cleared by `reset()`. */
  readonly error = signal('');
  /** Latest result for the current search; cleared whenever a new search is requested or stopped. */
  readonly result = signal<EngineResult | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  /**
   * Requests a search, superseding any pending one; a running search is stopped first and the
   * engine is initialized on demand. Invalid arguments set `error` instead of throwing, and
   * no search is started while `error` is set until `reset()` is called.
   * Without `depth` the search is time-limited, otherwise it runs to the given depth.
   * @param fen - Position to analyse; used to validate engine moves and to orient scores.
   * @param position - UCI `position` argument sent to the engine (e.g. `fen <fen> moves ...`).
   * @param skill - Stockfish Skill Level, integer 0-20.
   * @param candidateCount - Number of lines (MultiPV) to compute, integer 1-5.
   * @param randomize - Pick the final move randomly among the candidates of the deepest iteration instead of the best one.
   * @param depth - Optional positive integer search depth.
   */
  search(fen: string, position: string, skill = 20, candidateCount = 1, randomize = true, depth?: number): void {
    // Validate input parameters 
    if (!Number.isInteger(skill) || skill < 0 || skill > 20) {
      this.fail(tr('Stockfish Skill Level must be an integer between 0 and 20.'));
      return;
    }
    // Validate candidate count
    if (!Number.isInteger(candidateCount) || candidateCount < 1 || candidateCount > 5) {
      this.fail(tr('Stockfish candidate count must be an integer between 1 and 5.'));
      return;
    }
    // Validate search depth
    if (depth !== undefined && (!Number.isInteger(depth) || depth < 1)) {
      this.fail(tr('Stockfish search depth must be a positive integer.'));
      return;
    }
    this.desired = { fen, position, skill, candidateCount, randomize, depth };
    this.result.set(null);
    if (this.error()) return;
    this.busy.set(true);
    if (!this.worker) {
      this.initialize();
    } else if (this.active) {
      this.stopActive();
    } else {
      this.startSearch();
    }
  }

  /** Cancels the pending and running search and clears the result; its `bestmove` is discarded. */
  stop(): void {
    this.desired = null;
    this.result.set(null);
    this.busy.set(false);
    this.stopActive();
  }

  /** Terminates the worker and clears error and result so the next `search()` starts a fresh engine. */
  reset(): void {
    this.dispose();
    this.error.set('');
    this.result.set(null);
  }

  /** Spawns the worker, wires its handlers and starts the UCI handshake (`uci`) under a watchdog. */
  private initialize(): void {
    try {
      this.worker = new Worker(
        new URL('stockfish/stockfish-19-lite-single.js', this.document.baseURI),
      );
      this.worker.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data !== 'string') return;
        for (const line of event.data.split(/\r?\n/)) this.receive(line.trim());
      };
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.fail(tr('Stockfish could not be loaded. Check that the engine assets are available.'));
      };
      this.worker.onmessageerror = () => this.fail(tr('Stockfish returned an unreadable message.'));
      this.watchdog(30000, tr('Stockfish initialization timed out. Please try again.'));
      this.send('uci');
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : tr('Stockfish is not supported in this browser.'),
      );
    }
  }

  /**
   * Handles one UCI output line: `uciok` continues the handshake, `readyok` starts the pending
   * search, `info` lines update `result` (only for the current search) and `bestmove` finishes it.
   * A `bestmove` of an outdated search is dropped and the latest search is started instead.
   */
  private receive(line: string): void {
    if (line === 'uciok') {
      if (this.send('setoption name Hash value 16')) this.send('isready');
    } else if (line === 'readyok') {
      this.clearTimer();
      this.ready.set(true);
      this.startSearch();
    } else if (line.startsWith('info ') && this.active && this.active === this.desired) {
      const depth = /\bdepth (\d+)/.exec(line);
      const score = /\bscore (cp|mate) (-?\d+)(?!\d)/.exec(line);
      const variation = /\bpv (.+)/.exec(line);
      const multipv = /\bmultipv (\d+)/.exec(line);
      const previous = this.result();
      const side = this.active.fen.split(' ')[1] === 'w' ? 1 : -1;
      if (!variation) return;
      const moves = variation[1].split(' ');
      if (!this.validateMoves(this.active.fen, moves)) return;
      const currentDepth = depth ? Number(depth[1]) : 0;
      const rank = multipv ? Number(multipv[1]) : 1;
      if (rank < 1 || rank > this.active.candidateCount) return;
      if (variation && rank <= this.active.candidateCount && currentDepth > 0) {
        if (currentDepth > this.candidateDepth) {
          this.candidates.clear();
          this.candidateDepth = currentDepth;
        }
        if (currentDepth === this.candidateDepth) this.candidates.set(rank, moves[0]);
      }
      const updated: EngineVariation = {
        rank,
        depth: currentDepth || (previous?.depth ?? 0),
        score: score
          ? {
              type: score[1] === 'cp' ? 'cp' : 'mate',
              value: Number(score[2]) * side,
            }
          : (previous?.variations.find((entry) => entry.rank === rank)?.score ?? null),
        line: moves,
      };
      const variations = [
        ...(previous?.variations ?? []).filter((entry) => entry.rank !== rank),
        updated,
      ].sort((a, b) => a.rank - b.rank);
      const primary = variations.find((entry) => entry.rank === 1);
      this.result.set({
        fen: this.active.fen,
        depth: primary?.depth ?? 0,
        score: primary?.score ?? null,
        line: primary?.line ?? [],
        variations,
        bestMove: null,
      });
    } else if (line.startsWith('bestmove ') && this.active) {
      this.clearTimer();
      const finished = this.active;
      this.active = null;
      this.stopping = false;
      if (finished === this.desired) {
        this.desired = null;
        this.busy.set(false);
        const bestMove = line.split(' ')[1];
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) {
          this.fail(tr('Stockfish returned no legal move for this position.'));
          return;
        }
        if (!this.validateMoves(finished.fen, [bestMove])) return;
        const selectedMove = finished.randomize ? this.selectCandidate(bestMove) : bestMove;
        if (!this.validateMoves(finished.fen, [selectedMove])) return;
        this.result.update((previous) => ({
          fen: finished.fen,
          depth: previous?.depth ?? 0,
          score: previous?.score ?? null,
          line: previous?.line ?? [],
          variations: previous?.variations ?? [],
          bestMove: selectedMove,
        }));
      } else {
        this.startSearch();
      }
    }
  }

  /** Configures the engine and sends `go` for the desired search; no-op while not ready or a search is running. */
  private startSearch(): void {
    if (!this.ready() || !this.desired || this.active) return;
    this.active = this.desired;
    this.candidateDepth = 0;
    this.candidates.clear();
    if (!this.send('setoption name UCI_LimitStrength value false')) return;
    if (!this.send(`setoption name Skill Level value ${this.active.skill}`)) return;
    if (!this.send(`setoption name MultiPV value ${this.active.candidateCount}`)) return;
    if (!this.send(`position ${this.active.position}`)) return;
    this.watchdog(22222, tr('Stockfish did not finish its search. Please try again.'));
    this.send(this.active.depth === undefined ? 'go movetime 11111' : `go depth ${this.active.depth}`);
  }

  /** Picks a random move among the candidates of the deepest iteration, or `bestMove` if fewer than two exist. */
  private selectCandidate(bestMove: string): string {
    const candidates = [...this.candidates.entries()]
      .sort(([rankA], [rankB]) => rankA - rankB)
      .map(([, move]) => move);
    if (candidates.length < 2) return bestMove;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? bestMove;
  }

  /** Sends UCI `stop` to the running search (once); the resulting `bestmove` is handled in `receive()`. */
  private stopActive(): void {
    if (!this.active || this.stopping) return;
    // UCI has no request IDs: drain the old bestmove before starting the latest position.
    this.stopping = true;
    this.send('stop');
  }

  /** Posts a UCI command to the worker. @returns `false` (after failing the engine) if it could not be sent. */
  private send(command: string): boolean {
    if (!this.worker) {
      this.fail(tr('Stockfish worker is not available.'));
      return false;
    }
    try {
      this.worker.postMessage(command);
      return true;
    } catch (error) {
      this.fail(error instanceof Error ? error.message : tr('Stockfish communication failed.'));
      return false;
    }
  }

  /** Plays the UCI moves on `fen` to check they are legal. @returns `false` (after failing the engine) if any is not. */
  private validateMoves(fen: string, moves: string[]): boolean {
    try {
      const chess = new Chess(fen);
      for (const move of moves) chess.move(move);
      return true;
    } catch (error) {
      this.fail(error instanceof Error ? error.message : tr('Stockfish returned an invalid move.'));
      return false;
    }
  }

  /** (Re)arms the single timeout that fails the engine with `message` if it is not cleared in time. */
  private watchdog(milliseconds: number, message: string): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.fail(message), milliseconds);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Logs the failure, tears the worker down and exposes `message` via `error`. */
  private fail(message: string): void {
    console.error('Stockfish engine failed', message);
    this.dispose();
    this.error.set(message);
    this.result.set(null);
  }

  /** Terminates the worker and resets all search state; unlike `reset()` it keeps `error` and `result`. */
  private dispose(): void {
    this.clearTimer();
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.active = null;
    this.desired = null;
    this.candidates.clear();
    this.candidateDepth = 0;
    this.stopping = false;
    this.ready.set(false);
    this.busy.set(false);
  }
}
