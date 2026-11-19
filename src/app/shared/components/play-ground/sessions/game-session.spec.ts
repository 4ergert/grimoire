import { Chess } from 'chess.js';
import { GameSession } from './game-session';

describe('GameSession comments', () => {
  let session: GameSession;

  beforeEach(() => {
    session = new GameSession();
    session.move('e2', 'e4');
    session.move('e7', 'e5');
    session.move('g1', 'f3');
  });

  it('stores a comment per full move and removes it when emptied', () => {
    session.setComment(1, ' Open game ');
    expect(session.comments()).toEqual({ 1: 'Open game' });

    session.setComment(1, '   ');
    expect(session.comments()).toEqual({});
  });

  it('writes comments into the PGN after the last ply of each full move', () => {
    session.setComment(1, 'Open game');
    session.setComment(2, 'Developing {a} knight');

    const pgn = session.pgn();
    expect(pgn).toContain('1. e4 e5 {Open game}');
    expect(pgn).toContain('2. Nf3 {Developing (a) knight}');
  });

  it('keeps comments written in an imported PGN', () => {
    const imported = new GameSession();
    imported.loadPgn('1. e4 {King pawn} e5 {Mirrored} 2. Nf3 {Attack} *');

    expect(imported.comments()).toEqual({ 1: 'King pawn Mirrored', 2: 'Attack' });
    const reloaded = new Chess();
    reloaded.loadPgn(imported.pgn());
    expect(reloaded.getComments().map((entry) => entry.comment)).toEqual([
      'King pawn Mirrored',
      'Attack',
    ]);
  });

  it('drops comments of moves discarded by a new move', () => {
    session.setComment(1, 'Keep');
    session.setComment(2, 'Discard');
    session.navigate(2);
    session.move('b1', 'c3');

    expect(session.comments()).toEqual({ 1: 'Keep' });
  });

  it('clears comments on reset', () => {
    session.setComment(1, 'Gone');
    session.reset();

    expect(session.comments()).toEqual({});
  });
});
