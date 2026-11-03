import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  getDocFromServer,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export type UserRole = 'gestor' | 'editor' | 'leitor' | 'pendente';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  approvedBy?: string;
  updatedAt?: string;
}

export const SUPER_GESTOR_EMAIL = 'cesar@gkfengenharia.com.br';

export function encodeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/[@.]/g, '_');
}

// SHA-256 password hashing with salt
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode('gkf_salt_2025:' + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const DEFAULT_DIRECT_PROFILE: UserProfile = {
  id: 'equipe_gkf',
  email: 'equipe@gkfengenharia.com.br',
  displayName: 'Equipe GKF (Acesso Direto)',
  role: 'gestor',
  createdAt: '2025-01-01T00:00:00.000Z',
};

export function getSavedUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem('cp_gkf_user_profile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_DIRECT_PROFILE;
}

export function saveUserProfileLocal(p: UserProfile | null) {
  try {
    if (p) {
      localStorage.setItem('cp_gkf_user_profile', JSON.stringify(p));
    } else {
      localStorage.removeItem('cp_gkf_user_profile');
    }
  } catch {}
}

// Seed or ensure Gestor account exists in Firestore
export async function seedGestorIfMissing(): Promise<void> {
  const key = encodeEmail(SUPER_GESTOR_EMAIL);
  const userRef = doc(db, 'users', key);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const defaultHash = await hashPassword('Gkf@2025');
      await setDoc(userRef, {
        id: key,
        email: SUPER_GESTOR_EMAIL,
        displayName: 'César (Gestor)',
        role: 'gestor',
        passwordHash: defaultHash,
        createdAt: new Date().toISOString(),
        approvedBy: 'Sistema (Gestor Principal)',
      });
    }
  } catch (err) {
    console.warn('Erro ao verificar conta do gestor no Firestore:', err);
  }
}

// Auto-seed on boot
seedGestorIfMissing();

// Authenticate with email & password against Firestore
export async function authenticateWithPassword(
  email: string,
  pass: string
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const key = encodeEmail(cleanEmail);
  const userRef = doc(db, 'users', key);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error('E-mail não cadastrado. Clique na aba "Cadastre-se" para criar seu acesso.');
  }

  const data = snap.data();
  const inputHash = await hashPassword(pass);

  if (data.passwordHash !== inputHash) {
    throw new Error('Senha incorreta.');
  }

  const isSuper = cleanEmail === SUPER_GESTOR_EMAIL.toLowerCase();
  const profile: UserProfile = {
    id: key,
    email: data.email || cleanEmail,
    displayName: data.displayName || (isSuper ? 'César (Gestor)' : 'Usuário'),
    role: isSuper ? 'gestor' : (data.role || 'leitor'),
    createdAt: data.createdAt || new Date().toISOString(),
    approvedBy: data.approvedBy,
  };

  saveUserProfileLocal(profile);
  return profile;
}

// Helper to remove any undefined fields which cause Firestore setDoc() to fail
function cleanDoc<T extends Record<string, any>>(obj: T): Partial<T> {
  const res: any = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) {
      res[k] = obj[k];
    }
  }
  return res;
}

// Register new user with email & password
export async function registerWithPassword(
  name: string,
  email: string,
  pass: string
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail válido.');
  }
  if (!pass || pass.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }

  const key = encodeEmail(cleanEmail);
  const userRef = doc(db, 'users', key);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    throw new Error('Este e-mail já está cadastrado. Alterne para a aba "Entrar" e informe sua senha.');
  }

  const isSuper = cleanEmail === SUPER_GESTOR_EMAIL.toLowerCase();
  const pwdHash = await hashPassword(pass);

  const profile: UserProfile = {
    id: key,
    email: cleanEmail,
    displayName: name.trim() || cleanEmail.split('@')[0],
    role: isSuper ? 'gestor' : 'leitor', // Novos usuários entram como Leitor até aprovação do Gestor
    createdAt: new Date().toISOString(),
    ...(isSuper ? { approvedBy: 'Sistema (Gestor Principal)' } : {}),
  };

  await setDoc(
    userRef,
    cleanDoc({
      ...profile,
      passwordHash: pwdHash,
    })
  );

  saveUserProfileLocal(profile);
  return profile;
}

// Change user password
export async function changeUserPassword(
  email: string,
  oldPass: string,
  newPass: string
): Promise<boolean> {
  if (!newPass || newPass.length < 6) {
    throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
  }
  const cleanEmail = email.trim().toLowerCase();
  const key = encodeEmail(cleanEmail);
  const userRef = doc(db, 'users', key);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error('Usuário não encontrado.');
  }

  const data = snap.data();
  const oldHash = await hashPassword(oldPass);

  if (data.passwordHash && data.passwordHash !== oldHash) {
    throw new Error('Senha atual incorreta.');
  }

  const newHash = await hashPassword(newPass);
  await setDoc(
    userRef,
    {
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return true;
}

// Google Sign-In
export async function signInWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;
  const cleanEmail = (user.email || '').toLowerCase();
  const isSuper = cleanEmail === SUPER_GESTOR_EMAIL.toLowerCase();
  const key = encodeEmail(cleanEmail);
  const userRef = doc(db, 'users', key);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile: UserProfile = {
        id: key,
        email: cleanEmail,
        displayName: user.displayName || data.displayName || cleanEmail.split('@')[0],
        role: isSuper ? 'gestor' : (data.role || 'leitor'),
        createdAt: data.createdAt || new Date().toISOString(),
        approvedBy: data.approvedBy,
      };
      saveUserProfileLocal(profile);
      return profile;
    }
  } catch (e) {
    console.warn('Erro ao ler perfil do Google no Firestore:', e);
  }

  const profile: UserProfile = {
    id: key,
    email: cleanEmail,
    displayName: user.displayName || (isSuper ? 'César (Gestor)' : 'Usuário'),
    role: isSuper ? 'gestor' : 'leitor',
    createdAt: new Date().toISOString(),
    ...(isSuper ? { approvedBy: 'Sistema (Gestor Principal)' } : {}),
  };

  await setDoc(userRef, cleanDoc(profile), { merge: true });
  saveUserProfileLocal(profile);
  return profile;
}

// List all registered users for Gestor
export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const colRef = collection(db, 'users');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: data.role || 'leitor',
        createdAt: data.createdAt || '',
        approvedBy: data.approvedBy,
        updatedAt: data.updatedAt,
      };
    });
  } catch (e) {
    console.error('Erro ao listar usuários:', e);
    const saved = getSavedUserProfile();
    return saved ? [saved] : [];
  }
}

// Gestor updates role
export async function setRole(
  userId: string,
  role: UserRole,
  approverEmail: string
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        role,
        approvedBy: approverEmail,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.error('Erro ao atualizar papel do usuário:', e);
    return false;
  }
}

// Gestor deletes access
export async function deleteUserDoc(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    return true;
  } catch (e) {
    console.error('Erro ao excluir usuário:', e);
    return false;
  }
}

export async function saveCentralProduction(
  dataPackage: any,
  email: string
): Promise<boolean> {
  try {
    const prodRef = doc(db, 'production', 'current');
    let dataToStore = dataPackage;
    // Backward compatibility: if someone passed cfg directly
    if (dataPackage && dataPackage.contratos && !dataPackage.cfg) {
      dataToStore = { cfg: dataPackage };
    }
    await setDoc(prodRef, {
      id: 'current',
      updatedAt: new Date().toISOString(),
      updatedBy: email,
      payload: JSON.stringify(dataToStore),
    });
    return true;
  } catch (e) {
    console.error('Erro ao sincronizar com banco central:', e);
    return false;
  }
}

export async function loadCentralProduction(): Promise<any | null> {
  try {
    const prodRef = doc(db, 'production', 'current');
    const snap = await getDoc(prodRef);
    if (snap.exists() && snap.data().payload) {
      const parsed = JSON.parse(snap.data().payload);
      // Backward compatibility if saved as raw cfg
      if (parsed.contratos && !parsed.cfg) {
        return { cfg: parsed, ln: null, fluxd: null };
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Banco central não inicializado ainda:', e);
  }
  return null;
}

export async function logoutUser() {
  try {
    await fbSignOut(auth);
  } catch {}
  saveUserProfileLocal(null);
}

export const signOut = logoutUser;
export { onAuthStateChanged };

export async function ensureUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const cleanEmail = (user.email || '').toLowerCase();
  const isSuper = cleanEmail === SUPER_GESTOR_EMAIL.toLowerCase();
  const key = encodeEmail(cleanEmail);
  const userRef = doc(db, 'users', key);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile: UserProfile = {
        id: key,
        email: cleanEmail,
        displayName: user.displayName || data.displayName || cleanEmail.split('@')[0],
        role: isSuper ? 'gestor' : (data.role || 'leitor'),
        createdAt: data.createdAt || new Date().toISOString(),
        approvedBy: data.approvedBy,
      };
      saveUserProfileLocal(profile);
      return profile;
    }
  } catch (e) {
    console.warn('Erro ao ler perfil no Firestore:', e);
  }

  const profile: UserProfile = {
    id: key,
    email: cleanEmail,
    displayName: user.displayName || (isSuper ? 'César (Gestor)' : 'Usuário'),
    role: isSuper ? 'gestor' : 'leitor',
    createdAt: new Date().toISOString(),
    ...(isSuper ? { approvedBy: 'Sistema (Gestor Principal)' } : {}),
  };

  await setDoc(userRef, cleanDoc(profile), { merge: true });
  saveUserProfileLocal(profile);
  return profile;
}

export type { FirebaseUser };
