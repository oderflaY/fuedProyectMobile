import type { Routes } from '@angular/router';
import type { PestanaConfig } from '../compartido/tabs/tabs.page';
import { TabsPage } from '../compartido/tabs/tabs.page';

const pestanas: PestanaConfig[] = [
  { tab: 'inicio', icono: 'home-outline', etiqueta: 'tab_inicio' },
  { tab: 'citas', icono: 'calendar-outline', etiqueta: 'tab_citas' },
  { tab: 'historial', icono: 'document-text-outline', etiqueta: 'tab_historial' },
  { tab: 'chat', icono: 'chatbubbles-outline', etiqueta: 'tab_chat' },
  { tab: 'perfil', icono: 'person-circle-outline', etiqueta: 'tab_perfil' },
];

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    data: { pestanas },
    children: [
      { path: 'inicio', loadComponent: () => import('./inicio/inicio.page').then((m) => m.InicioPage) },
      { path: 'citas', loadComponent: () => import('../compartido/citas/citas.page').then((m) => m.CitasPage) },
      { path: 'historial', loadComponent: () => import('../compartido/expediente/expediente.page').then((m) => m.ExpedientePage) },
      { path: 'chat', loadComponent: () => import('../compartido/chat/conversaciones.page').then((m) => m.ConversacionesPage) },
      { path: 'chat/:idContraparte', loadComponent: () => import('../compartido/chat/conversacion.page').then((m) => m.ConversacionPage) },
      { path: 'perfil', loadComponent: () => import('./perfil/perfil-paciente.page').then((m) => m.PerfilPacientePage) },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },
];
