import React from 'react';
import { DataProvider, useData } from './context/DataContext';
import { Header } from './components/Header';
import { TrechosTab } from './components/TrechosTab';
import { MedicaoTab } from './components/MedicaoTab';
import { CadastroTab } from './components/CadastroTab';
import { PainelControleTab } from './components/PainelControleTab';
import { DashboardTab } from './components/DashboardTab';
import { FluxoObrasTab } from './components/FluxoObrasTab';
import { AuthModal } from './components/AuthModal';
import { Toast } from './components/Toast';
import { Loader2, Info } from 'lucide-react';
import { DEFAULT_DIRECT_PROFILE } from './firebase';

const AppContent: React.FC = () => {
  const { tab, loading, currentUser, userProfile, authChecked, canEdit, setUserProfile } =
    useData() as any;

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-[var(--cy)] animate-spin" />
        <p className="text-sm text-[var(--mu)] font-medium">
          Carregando dados de produção da GKF Engenharia...
        </p>
      </div>
    );
  }

  // If user profile is not set, allow login or direct access
  if (!userProfile) {
    return (
      <AuthModal
        onSuccess={(profile) => setUserProfile(profile)}
        onCancel={() => setUserProfile(DEFAULT_DIRECT_PROFILE)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Reader mode notice if not editor/gestor */}
      {!canEdit && (
        <div className="bg-blue-950/40 border-b border-blue-500/20 px-4 py-2 text-xs text-blue-200 flex items-center justify-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 text-[var(--cy)]" />
          <span>
            <b>Modo Leitura:</b> Seu perfil ({userProfile.displayName || userProfile.email}) possui permissão para visualizar todas as obras, relatórios e dashboards. Para editar dados, solicite autorização ao Gestor (cesar@gkfengenharia.com.br).
          </span>
        </div>
      )}

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 lg:p-7">
        {tab === 't' && <TrechosTab />}
        {tab === 'm' && <MedicaoTab />}
        {tab === 'c' && <CadastroTab />}
        {tab === 'p' && <PainelControleTab />}
        {tab === 'd' && <DashboardTab />}
        {tab === 'f' && <FluxoObrasTab />}
      </main>
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
