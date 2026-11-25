import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Legal } from './pages/legal/legal';

/**
 * Application routes: the login page at the root, the three legal pages (all rendered by
 * {@link Legal}, selected through route `data`), and a catch-all redirect to the root.
 * Route titles are the English defaults; `Legal` overrides them when the language is German.
 */
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
    title: 'Legal notice | Grimoire',
  },
  {
    path: 'datenschutz',
    component: Legal,
    data: { privacy: true },
    title: 'Privacy policy | Grimoire',
  },
  {
    path: 'nutzungsbedingungen',
    component: Legal,
    data: { terms: true },
    title: 'Terms of Use | Grimoire',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
