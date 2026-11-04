import { Component } from '@angular/core';

@Component({
  selector: 'app-play-ground',
  imports: [],
  templateUrl: './play-ground.html',
  styleUrl: './play-ground.scss',
})
export class PlayGround {
  readonly ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  readonly files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
}
