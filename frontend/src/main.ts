import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, { providers: [provideHttpClient(withXsrfConfiguration({cookieName:'csrftoken',headerName:'X-CSRFToken'})),provideRouter(routes, withInMemoryScrolling({scrollPositionRestoration:'enabled',anchorScrolling:'enabled'}))] }).catch((error: unknown) => console.error(error));
