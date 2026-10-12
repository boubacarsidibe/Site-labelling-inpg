import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthService } from './services/auth.service';

/** Session expirée ou fermée dans un autre onglet : retour à la connexion, puis à la page en cours. */
export const sessionInterceptor:HttpInterceptorFn=(req,next)=>{
  const router=inject(Router);const auth=inject(AuthService);
  return next(req).pipe(tap({error:(e:unknown)=>{
    const quiet=['/auth/me/','/auth/login/','/auth/password-reset','/public/','/invitations/'].some(p=>req.url.includes(p));
    if(e instanceof HttpErrorResponse&&e.status===401&&!quiet&&!router.url.startsWith('/connexion')){
      if(auth.user())auth.expired=true;auth.user.set(null);router.navigate(['/connexion'],{queryParams:{returnUrl:router.url,expiree:1}});
    }
  }}));
};
