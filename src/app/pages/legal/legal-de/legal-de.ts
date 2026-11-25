import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal-de',
  imports: [RouterLink],
  templateUrl: './legal-de.html',
  styleUrl: './legal-de.scss',
})
/** German legal documents; shows the legal notice unless `privacy` or `terms` is set. */
export class LegalDe {
  /** Show the privacy policy (Datenschutzerklärung). */
  readonly privacy = input<boolean>(false);
  /** Show the terms of use (Nutzungsbedingungen). */
  readonly terms = input<boolean>(false);
}
