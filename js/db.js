// Firebase для меню и кассы. Библиотеки грузятся только когда нужны.
import { firebaseConfig } from './firebase-config.js?v=e4622669';

const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
let appPromise;

function app() {
  appPromise ||= import(V + 'firebase-app.js').then((m) => m.initializeApp(firebaseConfig));
  return appPromise;
}

export async function firestore() {
  const [a, f] = await Promise.all([app(), import(V + 'firebase-firestore.js')]);
  return { f, db: f.getFirestore(a) };
}

export async function authApi() {
  const [a, m] = await Promise.all([app(), import(V + 'firebase-auth.js')]);
  return { m, auth: m.getAuth(a) };
}
