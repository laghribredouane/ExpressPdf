import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { assertNonDisposableEmail } from './utils/disposableEmails';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.acls',
  'https://www.googleapis.com/auth/calendar.acls.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly',
  'https://www.googleapis.com/auth/calendar.events.public.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-pdfexpress-3615fe36-84be-47ad-96c8-b0d3caa8c7e4';
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
for (const scope of WORKSPACE_SCOPES) {
  googleProvider.addScope(scope);
}

// Cache the Google Workspace OAuth access token strictly in memory (never localStorage/sessionStorage).
let cachedAccessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token;
  tokenListeners.forEach((listener) => listener(token));
}

export function subscribeWorkspaceToken(
  listener: (token: string | null) => void
): () => void {
  tokenListeners.add(listener);
  listener(cachedAccessToken);
  return () => {
    tokenListeners.delete(listener);
  };
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearWorkspaceAccessToken() {
  setCachedAccessToken(null);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    setCachedAccessToken(null);
  }
});

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken ?? null;
  setCachedAccessToken(token);
  return { user: result.user, accessToken: token };
}

export async function registerWithEmail(params: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ user: User; verificationSent: boolean }> {
  const cleanName = params.displayName.trim().slice(0, 120);
  const cleanEmail = params.email.trim().slice(0, 254);

  if (!cleanName) {
    throw new Error('Veuillez saisir votre nom complet.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Veuillez saisir une adresse e-mail valide.');
  }
  assertNonDisposableEmail(cleanEmail);
  if (params.password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    cleanEmail,
    params.password
  );

  await updateProfile(credential.user, { displayName: cleanName });

  let verificationSent = false;
  try {
    await sendEmailVerification(credential.user);
    verificationSent = true;
  } catch {
    verificationSent = false;
  }

  return { user: credential.user, verificationSent };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const cleanEmail = email.trim().slice(0, 254);
  const credential = await signInWithEmailAndPassword(
    auth,
    cleanEmail,
    password
  );
  return credential.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().slice(0, 254);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Veuillez saisir une adresse e-mail valide.');
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function resendEmailVerification(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Aucun utilisateur connecté.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function refreshCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    await auth.currentUser.getIdToken(true);
  }
  return auth.currentUser;
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez Gmail.';
    case 'auth/invalid-email':
      return "L'adresse e-mail saisie n'est pas valide.";
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible (6 caractères minimum requis).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
    case 'auth/operation-not-allowed':
      return "L'authentification par e-mail/mot de passe n'est pas encore activée dans la console Firebase (Authentication > Sign-in method).";
    case 'auth/popup-closed-by-user':
      return 'Fenêtre de connexion Google fermée avant la fin.';
    case 'auth/popup-blocked':
      return 'La fenêtre popup Google a été bloquée par votre navigateur.';
    case 'auth/account-exists-with-different-credential':
      return 'Un compte existe déjà avec cette adresse e-mail via une autre méthode de connexion.';
    case 'auth/network-request-failed':
      return 'Erreur réseau : vérifiez votre connexion Internet.';
    default:
      if (error instanceof Error && error.message && !error.message.startsWith('Firebase:')) {
        return error.message;
      }
      return "Une erreur d'authentification est survenue. Veuillez réessayer.";
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Veuillez vérifier votre configuration Firebase.');
    }
  }
}

void testConnection();
