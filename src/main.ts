import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
// Polyfill para global
(window as any).global = window;

// Opcional: Polyfill para process si es necesario
(window as any).process = { env: {} };
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
