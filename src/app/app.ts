import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
/** Root component; hosts the router outlet that renders the active page. */
export class App {
  protected readonly title = signal('grimoire');
}
