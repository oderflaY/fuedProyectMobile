import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { invitadoGuard, rolGuard } from './core/auth/guards';
import { SessionService } from './core/auth/session.service';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [invitadoGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    canMatch: [invitadoGuard],
    loadComponent: () => import('./features/auth/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'paciente',
    canMatch: [rolGuard('paciente')],
    loadChildren: () => import('./features/paciente/paciente.routes').then((m) => m.routes),
  },
  {
    path: 'medico',
    canMatch: [rolGuard('medico')],
    loadChildren: () => import('./features/medico/medico.routes').then((m) => m.routes),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => inject(SessionService).rutaInicio(),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
