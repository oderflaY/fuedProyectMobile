import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/core/auth/auth.interceptor';
import { I18nService } from './app/core/i18n/i18n.service';
import { cargaInterceptor } from './app/core/ui/carga.interceptor';
import { registrarIconos } from './app/core/ui/iconos.constants';

// Call the element loader before the bootstrapApplication call
defineCustomElements(window);
registrarIconos();

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(withInterceptors([authInterceptor, cargaInterceptor])),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // Los textos de strings.xml deben estar listos antes de pintar la primera pantalla.
    provideAppInitializer(() => inject(I18nService).cargar()),
  ],
}).catch((err) => console.error(err));
