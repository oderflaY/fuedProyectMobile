import type { Routes } from '@angular/router';
import type { PestanaConfig } from '../compartido/tabs/tabs.page';
import { TabsPage } from '../compartido/tabs/tabs.page';

const pestanas: PestanaConfig[] = [
  { tab: 'pacientes', icono: 'people-outline', etiqueta: 'tab_pacientes' },
  { tab: 'agenda', icono: 'calendar-outline', etiqueta: 'tab_agenda' },
  { tab: 'chat', icono: 'chatbubbles-outline', etiqueta: 'tab_chat' },
  { tab: 'perfil', icono: 'person-circle-outline', etiqueta: 'tab_perfil' },
];

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    data: { pestanas },
    children: [
      { path: 'pacientes', loadComponent: () => import('./pacientes/pacientes.page').then((m) => m.PacientesPage) },
      {
        path: 'pacientes/:idPaciente',
        loadComponent: () => import('../compartido/expediente/expediente.page').then((m) => m.ExpedientePage),
      },
      { path: 'agenda', loadComponent: () => import('../compartido/citas/citas.page').then((m) => m.CitasPage) },
      { path: 'chat', loadComponent: () => import('../compartido/chat/conversaciones.page').then((m) => m.ConversacionesPage) },
      { path: 'chat/:idContraparte', loadComponent: () => import('../compartido/chat/conversacion.page').then((m) => m.ConversacionPage) },
      { path: 'perfil', loadComponent: () => import('./perfil/perfil-medico.page').then((m) => m.PerfilMedicoPage) },
      { path: '', pathMatch: 'full', redirectTo: 'pacientes' },
    ],
  },
];
