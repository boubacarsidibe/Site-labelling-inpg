import { request } from '@playwright/test';
import { INTERNAL, PASSWORD } from './helpers';

/** Le superutilisateur crée les comptes internes par l'API d'administration (comme en production). */
export default async function globalSetup() {
  const api = await request.newContext({ baseURL: 'http://127.0.0.1:8100' });
  await api.get('/api/v1/auth/csrf/');
  const csrf = async () => (await api.storageState()).cookies.find(c => c.name === 'csrftoken')?.value ?? '';
  const login = await api.post('/api/v1/auth/login/', { data: { username: 'e2e.root', password: PASSWORD }, headers: { 'X-CSRFToken': await csrf() } });
  if (!login.ok()) throw new Error(`Connexion du superutilisateur e2e impossible (${login.status()}).`);
  for (const [username, role] of Object.entries(INTERNAL)) {
    const r = await api.post('/api/v1/admin/accounts/', { data: { username, email: `${username}@example.test`, password: PASSWORD, role }, headers: { 'X-CSRFToken': await csrf() } });
    if (!r.ok() && r.status() !== 400) throw new Error(`Création de ${username} : ${r.status()} ${await r.text()}`);
  }
  await api.dispose();
}
