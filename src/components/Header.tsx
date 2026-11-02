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
    isGestor,
    logout,
  } = useData() as any;

  const [showUserModal, setShowUserModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentOrigin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://ais-pre-fqdhk2i6igejyrd5v5vdyo-715953476300.us-west2.run.app';

  const handleCopyShareLink = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

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
        <button
          role="tab"
          aria-selected={tab === 't'}
          onClick={() => setTab('t')}
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
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
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
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
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
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
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
            tab === 'p'
              ? 'text-white bg-gradient-to-r from-[var(--cy)] to-blue-600 shadow-sm'
              : 'text-[var(--tx)] bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)]'
          }`}
        >
          Painel de Controle
        </button>
        <button
          role="tab"
          aria-selected={tab === 'd'}
          onClick={() => setTab('d')}
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
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
          className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
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
        {/* Period picker (only visible on Trechos and Medição) */}
        {isPeriodTab && (
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

        {/* Save button */}
        <button
          type="button"
          onClick={saveAll}
          title="Salvar alterações no navegador"
          aria-label="Salvar alterações"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)] text-[var(--tx)] transition-all"
        >
          <Save className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden md:inline">Salvar</span>
        </button>

        {/* Export ZIP */}
        <button
          type="button"
          onClick={exportZip}
          title="Exportar todos os dados em arquivo ZIP"
          aria-label="Exportar ZIP"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)] text-[var(--tx)] transition-all"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Exportar ZIP</span>
        </button>

        {/* Import ZIP */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".zip"
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Importar dados de um arquivo ZIP"
          aria-label="Importar ZIP"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)] text-[var(--tx)] transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Importar</span>
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={resetToDefault}
          title="Restaurar dados para o padrão original"
          aria-label="Restaurar padrão"
          className="p-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)] text-[var(--tx)] transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[var(--mu)]" />
        </button>

        {/* Light/Dark Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)] text-[var(--tx)] transition-all cursor-pointer"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Tema claro</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden lg:inline">Tema escuro</span>
            </>
          )}
        </button>

        {/* Publicar / Link Próprio Button */}
        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          title="Como criar link independente e compartilhar com a equipe"
          aria-label="Link Próprio"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 transition-all cursor-pointer shadow-sm"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Link Próprio (Site)</span>
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

      {/* Share / Link Independente Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[var(--bgB)] border border-[var(--ln)] rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ln)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--tx)]">Link Independente & Acesso sem Login</h3>
                  <p className="text-xs text-[var(--mu)]">Como disponibilizar o aplicativo para toda a equipe sem necessidade de login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg text-[var(--mu)] hover:text-[var(--tx)] hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status: Acesso Livre Ativo */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Acesso Direto Sem Login Ativado no Código</span>
              </div>
              <p className="text-[var(--tx)] text-[12px] leading-relaxed">
                Nenhum membro da equipe precisará preencher e-mail ou criar senha ao abrir o link. O aplicativo abre diretamente com permissão total para lançar trechos (OSE), calcular medições CASAN, simular fluxo financeiro e salvar no banco central na nuvem.
              </p>
            </div>

            {/* Motivo do Erro 404 anterior */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                ⚠️ Por que a equipe encontrou erro 404 (Not Found) no link anterior?
              </span>
              <p className="text-[var(--tx)] leading-relaxed text-[11.5px]">
                A URL temporária <code className="text-amber-200 bg-black/40 px-1 py-0.5 rounded font-mono">ais-pre-...run.app</code> é uma prévia interna e volátil da máquina de desenvolvimento do Google Cloud. Ela só funciona durante a sessão do criador e bloqueia acessos de terceiros sem login de desenvolvedor.
              </p>
            </div>

            {/* 3 Opções para Ter Seu Link Próprio e Permanente */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--mu)]">
                Opções para ter um link próprio definitivo (fora do AI Studio):
              </h4>

              {/* Opção A: Vercel em Destaque */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border-2 border-blue-500/40 space-y-3 text-xs shadow-lg shadow-blue-500/5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-300 text-sm flex items-center gap-2">
                    <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">OPÇÃO A</span>
                    Deploy na Vercel (Recomendado • 100% Gratuito)
                  </span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full font-bold">~ 2 minutos</span>
                </div>
                
                <p className="text-[var(--tx)] text-[12px] leading-relaxed">
                  O projeto já está configurado com <code className="bg-black/40 text-blue-200 px-1.5 py-0.5 rounded font-mono">vercel.json</code> para que todo o roteamento funcione perfeitamente sem erro 404.
                </p>

                {/* Passo a passo Vercel */}
                <div className="space-y-2 bg-black/30 p-3 rounded-xl border border-blue-500/20 text-[11.5px]">
                  <div className="font-semibold text-blue-200 text-xs">Passo a passo simples:</div>
                  <div className="space-y-1.5 text-[var(--tx)]">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                      <div>
                        <strong>Acesse a Vercel:</strong> Entre em <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">vercel.com</a> e crie uma conta gratuita (com seu e-mail da GKF ou GitHub).
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                      <div>
                        <strong>Novo Projeto:</strong> No painel da Vercel, clique em <strong>Add New... → Project</strong> e importe seu repositório GitHub (ou arraste a pasta do projeto via Vercel CLI).
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                      <div>
                        <strong>Configurações automáticas:</strong> A Vercel já detectará <em>Framework: Vite</em> e pasta <em>dist</em>. Apenas clique em <strong>Deploy</strong>.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                      <div>
                        <strong>Pronto!</strong> Seu link estará no ar (ex: <code className="text-blue-300 font-mono">https://gkf-producao.vercel.app</code>) e você pode adicionar o domínio <code className="text-emerald-300 font-mono">producao.gkfengenharia.com.br</code> nas configurações.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação Vercel */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="/gkf-codigo-fonte.zip"
                    download="gkf-codigo-fonte.zip"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Código-Fonte Completo (ZIP para GitHub)
                  </a>
                  <a
                    href="/gkf-producao-site.zip"
                    download="gkf-producao-site.zip"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-[var(--tx)] border border-[var(--ln)] transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-300" />
                    Baixar Site Pronto/Compilado (Para Netlify Drop)
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink('npx vercel')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/40 hover:bg-black/60 border border-[var(--ln)] text-blue-300 font-mono transition-all cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar comando terminal: npx vercel
                  </button>
                </div>
              </div>

              {/* Opção B: Firebase Hosting */}
              <div className="p-3.5 rounded-2xl bg-[rgba(var(--w),0.04)] border border-[var(--ln)] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                    🔥 Opção B: Firebase Hosting (Google Cloud)
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">Alternativa</span>
                </div>
                <p className="text-[var(--tx)] text-[11.5px] leading-relaxed">
                  O arquivo <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-amber-300">firebase.json</code> está configurado. Ao rodar <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-amber-300">firebase deploy --only hosting</code>, o site é publicado em <code className="text-amber-200">https://gen-lang-client-0880036035.web.app</code>.
                </p>
              </div>

              {/* Opção C: Netlify Drop */}
              <div className="p-3.5 rounded-2xl bg-[rgba(var(--w),0.04)] border border-[var(--ln)] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                    ⚡ Opção C: Netlify Drop (Mais rápida sem terminal)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">30 segundos</span>
                </div>
                <p className="text-[var(--tx)] text-[11.5px] leading-relaxed">
                  Baixe o <strong>Pacote do Site Compilado (ZIP)</strong> acima, extraia a pasta e arraste em <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline font-semibold">app.netlify.com/drop</a>. O site entra no ar na hora.
                </p>
              </div>
            </div>

            {/* URL Atual de Teste */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-[var(--mu)] block">
                Link da instância ativa no momento (para teste imediato):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentOrigin}
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-black/30 border border-[var(--ln)] text-[var(--cy)] font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(currentOrigin)}
                  className="px-3.5 py-2 rounded-xl font-bold bg-[var(--cy)] hover:bg-blue-600 text-white shadow transition-all cursor-pointer text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copiado! ✓' : 'Copiar Link'}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  exportZip();
                  setShowShareModal(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] hover:border-[var(--cy)] border border-[var(--ln)] text-[var(--tx)] transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[var(--cy)]" />
                Baixar Backup dos Dados (ZIP)
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-[var(--tx)] transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
