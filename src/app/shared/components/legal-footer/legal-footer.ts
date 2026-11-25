import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate-pipe';

@Component({
  selector: 'app-legal-footer',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './legal-footer.html',
  styleUrl: './legal-footer.scss',
})
export class LegalFooter {}
