import React, { useState } from 'react';
import {
  authenticateWithPassword,
  registerWithPassword,
  signInWithGoogle,
  DEFAULT_DIRECT_PROFILE,
  saveUserProfileLocal,
  UserProfile,
} from '../firebase';
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: (profile: UserProfile) => void;
  onCancel?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onCancel }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Google sign in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await signInWithGoogle();
      onSuccess(profile);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Não foi possível autenticar pelo Google: ' + (err.message || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const profile = await authenticateWithPassword(email, password);
        setSuccessMsg(`Bem-vindo, ${profile.displayName}! Conectando...`);
        setTimeout(() => onSuccess(profile), 400);
      } else {
        const profile = await registerWithPassword(name, email, password);
        setSuccessMsg('Cadastro realizado com sucesso! Conectando...');
        setTimeout(() => onSuccess(profile), 500);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar sua solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[var(--bgB)] to-[var(--bgC)] border border-[var(--ln)] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            title="Fechar"
            className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--mu)] hover:text-[var(--tx)] hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header / Logo */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[rgba(var(--cyr),0.15)] border border-[var(--cy)]/30 text-[var(--cy)] mb-1">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--tx)] tracking-tight">
            Controle de Produção • GKF
          </h2>
          <p className="text-xs text-[var(--mu)]">
            Acesso livre para a equipe de obras e medição
          </p>
        </div>

        {/* Botão de Acesso Direto sem Login */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 text-center space-y-2">
          <p className="text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Entrada livre sem necessidade de senha
          </p>
          <button
            type="button"
            onClick={() => {
              saveUserProfileLocal(DEFAULT_DIRECT_PROFILE);
              onSuccess(DEFAULT_DIRECT_PROFILE);
            }}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Acessar Diretamente sem Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[var(--ln)]"></div>
          <span className="flex-shrink mx-3 text-[11px] text-[var(--mu)] uppercase tracking-wider font-semibold">
            ou acesse com conta pessoal
          </span>
          <div className="flex-grow border-t border-[var(--ln)]"></div>
        </div>

        {/* Tabs: Entrar / Cadastre-se */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-black/30 rounded-xl border border-[var(--ln)] text-center text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg font-bold transition-all ${
              mode === 'login'
                ? 'bg-[var(--cy)] text-white shadow'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-lg font-bold transition-all ${
              mode === 'register'
                ? 'bg-[var(--cy)] text-white shadow'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            Cadastre-se
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--mu)] mb-1">
                Nome completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-[var(--mu)]" />
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs focus:border-[var(--cy)] outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--mu)] mb-1">
              E-mail corporativo
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[var(--mu)]" />
              <input
                type="email"
                required
                placeholder="nome@gkfengenharia.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs focus:border-[var(--cy)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--mu)] mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[var(--mu)]" />
              <input
                type="password"
                required
                placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs focus:border-[var(--cy)] outline-none"
              />
            </div>
          </div>

          {mode === 'register' && (
            <p className="text-[11.5px] text-[var(--mu)] leading-relaxed">
              Novos colaboradores cadastrados iniciam com permissão de visualização (Leitor). O Gestor do sistema autoriza permissões de edição no painel de acessos.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 hover:brightness-110 text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Verificando...</span>
            ) : mode === 'login' ? (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Concluir Cadastro</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Google Sign-in */}
        <div className="pt-2 border-t border-[var(--ln)] space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2 px-3 rounded-xl border border-[var(--ln)] bg-[rgba(var(--w),0.04)] hover:bg-[rgba(var(--w),0.08)] text-[var(--tx)] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar com Google</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--mu)]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gestor do aplicativo: cesar@gkfengenharia.com.br</span>
          </div>
        </div>
      </div>
    </div>
  );
};
