import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { sessionInterceptor } from './app/core/http.interceptor';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, { providers: [provideHttpClient(withXsrfConfiguration({cookieName:'csrftoken',headerName:'X-CSRFToken'}),withInterceptors([sessionInterceptor])),provideRouter(routes, withInMemoryScrolling({scrollPositionRestoration:'enabled',anchorScrolling:'enabled'}))] }).catch((error: unknown) => console.error(error));
