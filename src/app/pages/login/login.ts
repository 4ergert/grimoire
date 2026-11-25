import { Component } from '@angular/core';
import { LoginOverlay } from '../../shared/components/login-overlay/login-overlay';
import { TranslatePipe } from '../../shared/i18n/translate-pipe';

@Component({
  selector: 'app-login',
  imports: [LoginOverlay, TranslatePipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {}
