import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal-de',
  imports: [RouterLink],
  templateUrl: './legal-de.html',
  styleUrl: './legal-de.scss',
})
export class LegalDe {
  readonly privacy = input<boolean>(false);
  readonly terms = input<boolean>(false);
}
