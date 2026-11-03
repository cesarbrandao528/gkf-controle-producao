import React, { useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { per, dbr } from '../engine/calc';
import {
  Sun,
  Moon,
  Download,
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  Users,
  LogOut,
  Shield,
  KeyRound,
  User as UserIcon,
  Share2,
  Copy,
  X,
  ExternalLink,
  Globe,
  Sparkles,
  Server,
} from 'lucide-react';
import { UserManagementModal } from './UserManagementModal';
import { ChangePasswordModal } from './ChangePasswordModal';

export const Header: React.FC = () => {
  const {
    cfg,
    tab,
    setTab,
    frenteId,
    theme,
    toggleTheme,
    updateFrentePeriodo,
    saveAll,
    resetToDefault,
    exportZip,
    importZip,
    currentUser,
    userProfile,
    canEdit,
    isGestor,
    logout,
  } = useData() as any;

  const [showUserModal, setShowUserModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);

  if (!cfg) return null;

  const frente = cfg.frentes.find((x: any) => x.id === frenteId);
  const p = per(cfg, frenteId);
  const isPeriodTab = tab === 't' || tab === 'm';

  const handlePeriodChange = (key: 'ini' | 'fim', val: string) => {
    if (!frenteId) return;
    const { updateConfig } = (window as any).__dataContext || {};
    // update frente periodo in context
    const frentes = cfg.frentes.map((f: any) => {
      if (f.id === frenteId) {
        return {
          ...f,
          periodo: {
            ...per(cfg, frenteId),
            [key]: val,
          },
        };
      }
      return f;
    });
    // trigger through custom method or updateConfig
    updateFrentePeriodo(frenteId, key, val);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importZip(file);
      e.target.value = '';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ln)] px-4 py-3 bg-[linear-gradient(180deg,rgba(var(--w),0.07),rgba(var(--w),0.03))] backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <img
          src="/gkf-logo.png"
          alt="GKF Engenharia de Obras"
          className="h-10 bg-white rounded-lg px-2 py-1 shadow-md object-contain"
          onError={(e) => {
            // fallback if image not loaded
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div>
          <h1 className="text-lg md:text-xl font-extrabold tracking-tight leading-none text-[var(--tx)]">
            Controle de Produção
          </h1>
          <small className="block mt-1 text-xs text-[var(--mu)] font-medium">
            Trechos · Medições CASAN · Contratos • GKF Engenharia
          </small>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap items-center gap-1.5" role="tablist">
        {/* Navigation Tabs - Readers only see Dashboard and Fluxo */}
        {userProfile?.role !== 'leitor' && (
          <>
            <button
              role="tab"
              aria-selected={tab === 't'}
              onClick={() => setTab('t')}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                tab === 't'
                  ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
                  : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
              }`}
            >
              Trechos (OSE)
            </button>
            <button
              role="tab"
              aria-selected={tab === 'm'}
              onClick={() => setTab('m')}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                tab === 'm'
                  ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
                  : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
              }`}
            >
              Medição (BM CASAN)
            </button>
            <button
              role="tab"
              aria-selected={tab === 'c'}
              onClick={() => setTab('c')}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                tab === 'c'
                  ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
                  : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
              }`}
            >
              Cadastro de contratos
            </button>
            <button
              role="tab"
              aria-selected={tab === 'p'}
              onClick={() => setTab('p')}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                tab === 'p'
                  ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
                  : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
              }`}
            >
              Painel de Controle
            </button>
          </>
        )}
        <button
          role="tab"
          aria-selected={tab === 'd'}
          onClick={() => setTab('d')}
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            tab === 'd'
              ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
              : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
          }`}
        >
          Dashboard
        </button>
        <button
          role="tab"
          aria-selected={tab === 'f'}
          onClick={() => setTab('f')}
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            tab === 'f'
              ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
              : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
          }`}
        >
          Fluxo e Resultado
        </button>
      </nav>

      {/* Tools & Settings */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period picker (only visible on Trechos and Medição for editors/gestors) */}
        {isPeriodTab && canEdit && (
          <div className="flex items-center gap-2 bg-[rgba(var(--w),0.05)] border border-[var(--ln)] px-2.5 py-1 rounded-xl text-xs">
            <span className="text-[var(--mu)] hidden sm:inline">
              Período {frente?.nome ? `(${frente.nome})` : ''}:
            </span>
            <input
              type="date"
              aria-label="Data início do período"
              value={p?.ini || ''}
              onChange={(e) => handlePeriodChange('ini', e.target.value)}
              className="bg-transparent text-[var(--tx)] border-0 text-xs focus:ring-0 focus:outline-none p-0 cursor-pointer"
            />
            <span className="text-[var(--mu)]">até</span>
            <input
              type="date"
              aria-label="Data fim do período"
              value={p?.fim || ''}
              onChange={(e) => handlePeriodChange('fim', e.target.value)}
              className="bg-transparent text-[var(--tx)] border-0 text-xs focus:ring-0 focus:outline-none p-0 cursor-pointer"
            />
          </div>
        )}

        {/* Save button (only for editors/gestors) */}
        {canEdit && (
          <button
            type="button"
            onClick={saveAll}
            title="Salvar alterações no banco central na nuvem"
            aria-label="Salvar alterações"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salvar</span>
          </button>
        )}

        {/* Light/Dark Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[rgba(var(--w),0.08)] hover:bg-[rgba(var(--w),0.14)] border border-[var(--ln)] text-[var(--tx)] transition-all cursor-pointer shadow-sm"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Tema claro</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden lg:inline">Tema escuro</span>
            </>
          )}
        </button>

        {/* User Profile & Auth Controls */}
        {userProfile && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--ln)]">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[rgba(var(--w),0.05)] border border-[var(--ln)] text-xs"
              title={`Logado como: ${userProfile.email}`}
            >
              <UserIcon className="w-3.5 h-3.5 text-[var(--mu)]" />
              <span className="hidden xl:inline text-[var(--tx)] font-medium max-w-[140px] truncate">
                {userProfile.displayName || userProfile.email.split('@')[0]}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  userProfile?.role === 'gestor'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : userProfile?.role === 'editor'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                }`}
              >
                {userProfile?.role === 'gestor'
                  ? 'Gestor'
                  : userProfile?.role === 'editor'
                  ? 'Editor'
                  : 'Leitor'}
              </span>
            </div>

            {/* Gestor User Management Button */}
            {isGestor && (
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                title="Gestão de Usuários e Autorizações (Gestor)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-all cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Acessos</span>
              </button>
            )}

            {/* Change Password button */}
            <button
              type="button"
              onClick={() => setShowPassModal(true)}
              title="Alterar minha senha"
              aria-label="Alterar senha"
              className="p-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:bg-[rgba(var(--w),0.12)] border border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)] transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            {/* Logout button */}
            <button
              type="button"
              onClick={logout}
              title="Encerrar sessão"
              aria-label="Sair"
              className="p-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:bg-rose-500/20 hover:text-rose-400 border border-[var(--ln)] text-[var(--mu)] transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showUserModal && userProfile && (
        <UserManagementModal
          currentUser={userProfile}
          onClose={() => setShowUserModal(false)}
        />
      )}

      {showPassModal && userProfile && (
        <ChangePasswordModal
          currentUser={userProfile}
          onClose={() => setShowPassModal(false)}
        />
      )}
    </header>
  );
};
