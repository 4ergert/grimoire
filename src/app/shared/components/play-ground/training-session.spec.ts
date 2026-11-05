import { vi } from 'vitest';
import { Chess } from 'chess.js';
import { TrainingSession } from './training-session';

describe('TrainingSession', () => {
  const games = [
    { id: 'one', name: 'Hidden opening', pgn: '1. e4 e5 2. Nf3 Nc6 *' },
    { id: 'two', name: 'Other opening', pgn: '1. d4 d5 *' },
    { id: 'three', name: 'Third opening', pgn: '1. c4 e5 *' },
  ];

  it('should reject deviations without moving, then play the automatic reply', () => {
    const session = new TrainingSession();
    session.start([games[0]], 'w');
    const initial = session.position();
    expect(session.tryMove('d2', 'd4')).toBe(false);
    expect(session.position()).toBe(initial);
    expect(session.mistakes()).toBe(1);
    expect(session.tryMove('e2', 'e4')).toBe(true);
    expect(session.ply()).toBe(2);
    expect(new Chess(session.position()).get('e5')?.color).toBe('b');
    session.tryMove('g1', 'f3');
    expect(session.complete()).toBe(true);
    expect(session.roundComplete()).toBe(true);
  });

  it('should play the opening move for Black and count help only once per move', () => {
    const session = new TrainingSession();
    session.start([games[0]], 'b');
    expect(session.ply()).toBe(1);
    session.hint();
    session.hint();
    expect(session.hintSquare()).toBe('e7');
    expect(session.hints()).toBe(1);
    session.reveal();
    session.reveal();
    expect(session.revealedMove()).toBe('e5');
    expect(session.shownMoves()).toBe(1);
    session.playRevealed();
    expect(session.ply()).toBe(3);
    expect(session.hintSquare()).toBeNull();
    expect(session.revealedMove()).toBe('');
    session.tryMove('b8', 'c6');
    expect(session.roundComplete()).toBe(true);
  });

  it('should shuffle a copy, cover each game once and reset round scores', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const session = new TrainingSession();
      session.start(games, 'w');
      expect(games.map((game) => game.id)).toEqual(['one', 'two', 'three']);
      const openings: string[] = [];
      for (let i = 0; i < games.length; i++) {
        expect(session.gameIndex()).toBe(i);
        session.reveal();
        openings.push(session.revealedMove());
        while (!session.complete()) {
          session.reveal();
          session.playRevealed();
        }
        session.next();
      }
      expect(new Set(openings).size).toBe(3);
      expect(openings).toEqual(['d4', 'c4', 'e4']);
      expect(session.roundComplete()).toBe(true);
      session.start(games, 'b');
      expect(session.shownMoves()).toBe(0);
      expect(session.gameIndex()).toBe(0);
    } finally {
      random.mockRestore();
    }
  });

  it('should preserve promotion choices and handle setup positions', () => {
    const session = new TrainingSession();
    session.start(
      [
        {
          id: 'promotion',
          name: 'Promotion',
          pgn: '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=N *',
        },
      ],
      'w',
    );
    expect(session.tryMove('a7', 'a8', 'q')).toBe(false);
    expect(session.tryMove('a7', 'a8', 'n')).toBe(true);
    expect(session.complete()).toBe(true);
    expect(new Chess(session.position()).get('a8')?.type).toBe('n');
  });

  it('should fail explicitly on invalid, empty or untrainable games', () => {
    const session = new TrainingSession();
    expect(() => session.start([], 'w')).toThrow('no games');
    expect(() => session.start([{ id: 'x', name: 'Bad', pgn: '1. e9' }], 'w')).toThrow();
    expect(() => session.start([{ id: 'x', name: 'Empty', pgn: '*' }], 'w')).toThrow();
    expect(() => session.start([{ id: 'x', name: 'White only', pgn: '1. e4 *' }], 'b')).toThrow(
      'chosen color',
    );
  });
});
