import { HttpErrorResponse } from '@angular/common/http';

/** Message lisible à partir d'une erreur de l'API (detail ou premier message de champ). */
export function apiError(e:unknown,fallback='Action impossible.'):string{
  if(e instanceof HttpErrorResponse){
    if(e.status===0)return 'Serveur injoignable. Vérifiez votre connexion.';
    if(e.status===403)return e.error?.detail||'Vous ne disposez pas des droits nécessaires.';
    const err=e.error;
    if(typeof err==='string'&&err.length<300)return err;
    if(err?.detail)return String(err.detail);
    if(err&&typeof err==='object'){const first=Object.values(err)[0];return Array.isArray(first)?String(first[0]):String(first);}
  }
  return fallback;
}

/** Rafraîchit une page toutes les 30 s (onglet visible uniquement) ; signale si les données ont changé. */
export class AutoRefresh{
  private timer?:ReturnType<typeof setInterval>;
  constructor(private tick:()=>void,private every=30000){}
  start(){this.stop();this.timer=setInterval(()=>{if(typeof document==='undefined'||!document.hidden)this.tick();},this.every);return this;}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
}
