import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Legal } from './pages/legal/legal';

export const routes: Routes = [
  {
    path: '',
    component: Login,
    pathMatch: 'full',
  },
  {
    path: 'impressum',
    component: Legal,
    data: { privacy: false },
    title: 'Impressum | Grimoire',
  },
  {
    path: 'datenschutz',
    component: Legal,
    data: { privacy: true },
    title: 'Datenschutzerklärung | Grimoire',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
