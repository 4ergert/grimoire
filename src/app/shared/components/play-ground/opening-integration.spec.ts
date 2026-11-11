import { TestBed } from '@angular/core/testing';
import { Chess } from 'chess.js';
import { PlayGround } from './play-ground';

describe('PlayGround opening positions', () => {
  it('tracks played moves, replay navigation and only reached training positions', async () => {
    await TestBed.configureTestingModule({ imports: [PlayGround] })
      .overrideComponent(PlayGround, { set: { template: '' } })
      .compileComponents();
    const fixture = TestBed.createComponent(PlayGround);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.game.move('e2', 'e4');
    component.game.move('e7', 'e5');
    expect(component.openingPositions()).toHaveLength(3);

    fixture.componentRef.setInput('replayPgn', '1. d4 d5 2. c4 *');
    fixture.detectChanges();
    expect(component.openingPositions()).toHaveLength(1);
    component.replayIndex.set(2);
    expect(component.openingPositions()).toHaveLength(3);
    component.replayIndex.set(0);
    expect(component.openingPositions()).toHaveLength(1);

    fixture.componentRef.setInput('trainingFolder', {
      id: 'one',
      name: 'test',
      games: [{ id: 'game', name: 'test', pgn: '1. e4 e5 2. Nf3 Nc6 *' }],
    });
    fixture.detectChanges();
    component.startTraining('w');
    expect(component.openingPositions()).toHaveLength(1);
    component.training()!.tryMove('e2', 'e4');
    expect(component.openingPositions()).toHaveLength(3);
    const current = new Chess(component.openingPositions().at(-1)!);
    expect(current.get('e5')?.color).toBe('b');
    expect(current.get('f3')).toBeUndefined();
    fixture.destroy();
  });
});
