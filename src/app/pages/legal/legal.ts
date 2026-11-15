import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegalFooter } from '../../shared/components/legal-footer/legal-footer';

@Component({
  selector: 'app-legal',
  imports: [RouterLink, LegalFooter],
  templateUrl: './legal.html',
  styleUrl: './legal.scss',
})
export class Legal {
  readonly routeData = toSignal(inject(ActivatedRoute).data);
}
