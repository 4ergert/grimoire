import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Chess } from 'chess.js';

interface Search {
  fen: string;
  position: string;
  skill: number;
  candidateCount: number;
  randomize: boolean;
}

export interface EngineVariation {
  rank: number;
  depth: number;
  score: { type: 'cp' | 'mate'; value: number } | null;
  line: string[];
}

export interface EngineResult {
  fen: string;
  depth: number;
  score: { type: 'cp' | 'mate'; value: number } | null;
  line: string[];
  bestMove: string | null;
  variations: EngineVariation[];
}

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
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<EngineResult | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  search(fen: string, position: string, skill = 20, candidateCount = 1, randomize = true): void {
    if (!Number.isInteger(skill) || skill < 0 || skill > 20) {
      this.fail('Stockfish Skill Level must be an integer between 0 and 20.');
      return;
    }
    if (!Number.isInteger(candidateCount) || candidateCount < 1 || candidateCount > 5) {
      this.fail('Stockfish candidate count must be an integer between 1 and 5.');
      return;
    }
    this.desired = { fen, position, skill, candidateCount, randomize };
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

  stop(): void {
    this.desired = null;
    this.result.set(null);
    this.busy.set(false);
    this.stopActive();
  }

  reset(): void {
    this.dispose();
    this.error.set('');
    this.result.set(null);
  }

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
        this.fail('Stockfish could not be loaded. Check that the engine assets are available.');
      };
      this.worker.onmessageerror = () => this.fail('Stockfish returned an unreadable message.');
      this.watchdog(30000, 'Stockfish initialization timed out. Please try again.');
      this.send('uci');
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : 'Stockfish is not supported in this browser.',
      );
    }
  }

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
          this.fail('Stockfish returned no legal move for this position.');
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

  private startSearch(): void {
    if (!this.ready() || !this.desired || this.active) return;
    this.active = this.desired;
    this.candidateDepth = 0;
    this.candidates.clear();
    if (!this.send('setoption name UCI_LimitStrength value false')) return;
    if (!this.send(`setoption name Skill Level value ${this.active.skill}`)) return;
    if (!this.send(`setoption name MultiPV value ${this.active.candidateCount}`)) return;
    if (!this.send(`position ${this.active.position}`)) return;
    this.watchdog(10000, 'Stockfish did not finish its search. Please try again.');
    this.send('go movetime 1000');
  }

  private selectCandidate(bestMove: string): string {
    const candidates = [...this.candidates.entries()]
      .sort(([rankA], [rankB]) => rankA - rankB)
      .map(([, move]) => move);
    if (candidates.length < 2) return bestMove;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? bestMove;
  }

  private stopActive(): void {
    if (!this.active || this.stopping) return;
    // UCI has no request IDs: drain the old bestmove before starting the latest position.
    this.stopping = true;
    this.send('stop');
  }

  private send(command: string): boolean {
    if (!this.worker) {
      this.fail('Stockfish worker is not available.');
      return false;
    }
    try {
      this.worker.postMessage(command);
      return true;
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Stockfish communication failed.');
      return false;
    }
  }

  private validateMoves(fen: string, moves: string[]): boolean {
    try {
      const chess = new Chess(fen);
      for (const move of moves) chess.move(move);
      return true;
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Stockfish returned an invalid move.');
      return false;
    }
  }

  private watchdog(milliseconds: number, message: string): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.fail(message), milliseconds);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private fail(message: string): void {
    console.error('Stockfish engine failed', message);
    this.dispose();
    this.error.set(message);
    this.result.set(null);
  }

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
