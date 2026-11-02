import { Component } from '@angular/core';
import { LoginOverlay } from '../../shared/components/login-overlay/login-overlay';

@Component({
  selector: 'app-login',
  imports: [LoginOverlay],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {}
