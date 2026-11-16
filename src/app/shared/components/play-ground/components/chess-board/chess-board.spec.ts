import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chess } from 'chess.js';
import { ChessBoard } from './chess-board';

describe('ChessBoard analysis bar', () => {
  let fixture: ComponentFixture<ChessBoard>;
  let component: ChessBoard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ChessBoard] }).compileComponents();
    fixture = TestBed.createComponent(ChessBoard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('position', new Chess().fen());
  });

  it('shows a white advantage and the current evaluation', () => {
    fixture.componentRef.setInput('evaluation', 400);
    fixture.componentRef.setInput('evaluationLabel', '+4.00');
    fixture.detectChanges();

    expect(component.whiteAdvantage()).toBeGreaterThan(50);
    expect(fixture.nativeElement.querySelector('.analysis-bar').getAttribute('aria-label'))
      .toBe('Stockfish evaluation +4.00');
    expect(fixture.nativeElement.querySelector('.analysis-score').textContent.trim()).toBe('+4.00');
  });

  it('keeps the bar balanced when no evaluation is available', () => {
    fixture.detectChanges();

    expect(component.whiteAdvantage()).toBe(50);
    expect(fixture.nativeElement.querySelector('.analysis-bar').getAttribute('aria-label'))
      .toBe('Stockfish evaluation unavailable');
    expect(fixture.nativeElement.querySelector('.black-advantage').style.height).toBe('50%');
  });
});
