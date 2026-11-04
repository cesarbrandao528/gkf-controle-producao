import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import {
  Config,
  FrenteLancamentos,
  Template,
  BMMap,
  PrecoItem,
  Fechamento,
} from '../types';
import { gerarBM, BMDataPayload } from '../engine/bmGen';
import { somaCols, valorQ, BASEBM, pf, slug } from '../engine/calc';

import {
  auth,
  onAuthStateChanged,
  signOut,
  ensureUserProfile,
  saveCentralProduction,
  loadCentralProduction,
  getSavedUserProfile,
  saveUserProfileLocal,
  UserProfile,
  FirebaseUser,
} from '../firebase';

const STORAGE_KEY_CFG = 'cp_gkf_cfg_v2';
const STORAGE_KEY_LN = 'cp_gkf_ln_v2';
const STORAGE_KEY_THEME = 'cp-tema';
const STORAGE_KEY_FLUXD = 'cp_gkf_fluxd_v3';

interface DataContextType {
  cfg: Config | null;
  ln: Record<string, FrenteLancamentos>;
  tpl: Record<string, Template>;
  bmap: BMMap | null;
  dasht: string;
  fluxt: string;
  fluxd: any;
  tab: string;
  setTab: (t: string) => void;
  frenteId: string;
  setFrenteId: (id: string) => void;
  oseId: string;
  setOseId: (id: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  filt: { q: string; s: string };
  setFilt: React.Dispatch<React.SetStateAction<{ q: string; s: string }>>;
  prm: Record<string, PrecoItem>;
  loading: boolean;
  activeToast: string | null;
  toast: (msg: string) => void;
  saveAll: () => Promise<boolean>;
  resetToDefault: () => Promise<void>;
  exportZip: () => Promise<void>;
  importZip: (file: File) => Promise<void>;
  updateConfig: (updater: (prev: Config) => Config) => void;
  updateFrenteLancamento: (
    frenteId: string,
    updater: (prev: FrenteLancamentos) => FrenteLancamentos
  ) => void;
  updateFrentePeriodo: (frenteId: string, key: 'ini' | 'fim', val: string) => void;
  downloadBMFile: (frenteId: string, sn: Fechamento) => Promise<void>;
  setFluxD: (data: any) => void;
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  canEdit: boolean;
  isGestor: boolean;
  authChecked: boolean;
  logout: () => Promise<void>;
  setUserProfile: (p: UserProfile | null) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [ln, setLn] = useState<Record<string, FrenteLancamentos>>({});
  const [tpl, setTpl] = useState<Record<string, Template>>({});
  const [bmap, setBmap] = useState<BMMap | null>(null);
  const [dasht, setDasht] = useState<string>('');
  const [fluxt, setFluxt] = useState<string>('');
  const [fluxd, setFluxd] = useState<any>(null);
  const [bmTemplateBuf, setBmTemplateBuf] = useState<ArrayBuffer | null>(null);

  const [tab, setTab] = useState<string>('t'); // 't' (Trechos), 'm' (Medição), 'c' (Cadastro), 'p' (Painel), 'd' (Dashboard), 'f' (Fluxo)
  const [frenteId, setFrenteId] = useState<string>('ibirama');
  const [oseId, setOseId] = useState<string>('__av');
  const [filt, setFilt] = useState<{ q: string; s: string }>({ q: '', s: '' });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // Auth & RBAC State (Login obrigatório para todos os usuários)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getSavedUserProfile());
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    const saved = getSavedUserProfile();
    if (saved) {
      setUserProfile(saved);
    }
    const unsub = onAuthStateChanged(auth, async (u: FirebaseUser | null) => {
      setCurrentUser(u);
      if (u) {
        try {
          const prof = await ensureUserProfile(u);
          setUserProfile(prof);
        } catch (e) {
          console.warn('Erro ao carregar perfil:', e);
        }
      } else {
        const local = getSavedUserProfile();
        setUserProfile(local);
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const canEdit = useMemo(() => {
    if (!userProfile) return false;
    return userProfile.role === 'gestor' || userProfile.role === 'editor';
  }, [userProfile]);

  const isGestor = useMemo(() => {
    if (!userProfile) return false;
    return userProfile.role === 'gestor';
  }, [userProfile]);

  const toast = useCallback((msg: string) => {
    setActiveToast(msg);
    setTimeout(() => {
      setActiveToast((curr) => (curr === msg ? null : curr));
    }, 3800);
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch {}
    saveUserProfileLocal(null);
    setCurrentUser(null);
    setUserProfile(null);
    toast('Sessão encerrada com sucesso.');
  }, [toast]);

  // Theme synchronization
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as 'dark' | 'light';
      const initialTheme =
        savedTheme ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      setTheme(initialTheme);
      document.documentElement.dataset.theme = initialTheme;
    } catch {
      // fallback
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(STORAGE_KEY_THEME, nextTheme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Initial data loading from /dados/
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch core files in parallel
      const [
        cfgRes,
        tplRes,
        bmapRes,
        dashRes,
        fluxRes,
        bmBufRes,
      ] = await Promise.all([
        fetch('/dados/config.json').then((r) => r.json()),
        fetch('/dados/templates.json').then((r) => r.json()),
        fetch('/dados/bm_map.json').then((r) => r.json()),
        fetch('/dados/dashboard_modelo.html').then((r) => r.text()),
        fetch('/dados/fluxo_obras.html').then((r) => r.text()),
        fetch('/dados/BM_modelo.xlsx').then((r) => r.arrayBuffer()).catch(() => null),
      ]);

      setTpl(tplRes || {});
      setBmap(bmapRes || null);
      setDasht(dashRes || '');
      setFluxt(fluxRes || '');
      if (bmBufRes) setBmTemplateBuf(bmBufRes);

      // Check if user has saved data in Firebase central or localStorage
      let initialCfg = cfgRes;
      let initialLn: Record<string, FrenteLancamentos> = {};

      try {
        const centralData = await loadCentralProduction();
        if (centralData) {
          if (centralData.cfg) {
            initialCfg = centralData.cfg;
            try {
              localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(centralData.cfg));
            } catch {}
          } else if (centralData.contratos) {
            initialCfg = centralData;
            try {
              localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(centralData));
            } catch {}
          }

          if (centralData.ln && typeof centralData.ln === 'object' && Object.keys(centralData.ln).length > 0) {
            initialLn = centralData.ln;
            try {
              localStorage.setItem(STORAGE_KEY_LN, JSON.stringify(centralData.ln));
            } catch {}
          }

          if (centralData.fluxd) {
            setFluxd(centralData.fluxd);
            try {
              localStorage.setItem(STORAGE_KEY_FLUXD, JSON.stringify(centralData.fluxd));
            } catch {}
          }
        }

        // If not populated from central, fallback to local storage
        if (!initialLn || Object.keys(initialLn).length === 0) {
          const savedLn = localStorage.getItem(STORAGE_KEY_LN);
          if (savedLn) initialLn = JSON.parse(savedLn);
        }
        if (!centralData || (!centralData.cfg && !centralData.contratos)) {
          const savedCfg = localStorage.getItem(STORAGE_KEY_CFG);
          if (savedCfg) initialCfg = JSON.parse(savedCfg);
        }
        const savedFluxD = localStorage.getItem(STORAGE_KEY_FLUXD);
        if (savedFluxD && !centralData?.fluxd) {
          setFluxd(JSON.parse(savedFluxD));
        }
      } catch (err) {
        console.warn('Erro ao carregar dados salvos:', err);
      }

      // Fetch any missing frentes lancamentos from server
      const frentes = initialCfg.frentes || [];
      const loadedLns: Record<string, FrenteLancamentos> = { ...initialLn };

      await Promise.all(
        frentes.map(async (f: any) => {
          if (!loadedLns[f.id]) {
            try {
              const res = await fetch(`/dados/lanc_${f.id}.json`);
              if (res.ok) {
                const data = await res.json();
                loadedLns[f.id] = data || { itens: [] };
              } else {
                loadedLns[f.id] = { itens: [] };
              }
            } catch {
              loadedLns[f.id] = { itens: [] };
            }
          }
        })
      );

      // Auto-initialize OSE objects from f.oses if not present in ln[f.id].oses
      for (const f of frentes) {
        const fL = loadedLns[f.id] || { itens: [], oses: [] };
        if (!fL.oses || fL.oses.length === 0) {
          if (f.oses && f.oses.length > 0) {
            fL.oses = f.oses.map((oseName: string) => {
              const lower = oseName.toLowerCase();
              const tipo = lower.includes('mnd')
                ? 'MND'
                : lower.includes('rep') || lower.includes('pav')
                  ? 'REP'
                  : 'ESC';
              const oseId = 'ose_' + slug(oseName);
              return {
                id: oseId,
                nome: oseName,
                tipo,
                rows: [],
                aj: {},
              };
            });
            // Link existing items to their OSE oid if matching by name
            fL.itens = (fL.itens || []).map((it: any) => {
              if (!it.oid && it.os) {
                const matchedOse = (fL.oses || []).find((o: any) => o.nome === it.os);
                if (matchedOse) {
                  return { ...it, oid: matchedOse.id };
                }
              }
              return it;
            });
          } else {
            fL.oses = [];
          }
        }
        loadedLns[f.id] = fL;
      }

      setCfg(initialCfg);
      setLn(loadedLns);

      // Select default frente
      if (frentes.length > 0) {
        const defaultFrente = frentes.find((f: any) => f.id === 'ibirama') || frentes[0];
        setFrenteId(defaultFrente.id);
        const fL = loadedLns[defaultFrente.id];
        if (fL?.oses && fL.oses.length > 0) {
          setOseId(fL.oses[0].id);
        } else {
          setOseId('__av');
        }
      }
    } catch (err: any) {
      console.error('Falha ao inicializar dados:', err);
      toast('Erro ao carregar arquivos da pasta dados: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Derived price map for fast lookup
  const prm = useMemo(() => {
    if (!cfg || !cfg.precos) return {};
    return Object.fromEntries(cfg.precos.map((p) => [p.c, p]));
  }, [cfg]);

  // Update Config
  const updateConfig = useCallback(
    (updater: (prev: Config) => Config) => {
      setCfg((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        try {
          localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    },
    []
  );

  // Update Frente Lancamentos
  const updateFrenteLancamento = useCallback(
    (frenteIdToUpdate: string, updater: (prev: FrenteLancamentos) => FrenteLancamentos) => {
      setLn((prev) => {
        const current = prev[frenteIdToUpdate] || { itens: [], oses: [], fech: [] };
        const updated = updater(current);
        const next = { ...prev, [frenteIdToUpdate]: updated };
        try {
          localStorage.setItem(STORAGE_KEY_LN, JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    },
    []
  );

  const updateFrentePeriodo = useCallback((fId: string, key: 'ini' | 'fim', val: string) => {
    updateConfig((prev) => {
      const frentes = prev.frentes.map((fr) => {
        if (fr.id === fId) {
          return {
            ...fr,
            periodo: {
              ...(fr.periodo || prev.periodo),
              [key]: val,
            },
          };
        }
        return fr;
      });
      return { ...prev, frentes };
    });
  }, [updateConfig]);

  // Manual save trigger
  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!cfg) return false;
    if (!canEdit) {
      toast('Apenas o Gestor e Editores autorizados podem salvar alterações. Seu perfil atual é de Leitor.');
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(cfg));
      localStorage.setItem(STORAGE_KEY_LN, JSON.stringify(ln));
      if (fluxd) {
        try {
          localStorage.setItem(STORAGE_KEY_FLUXD, JSON.stringify(fluxd));
        } catch {}
      }

      // Sincronizar com banco de dados central Firebase (contratos, trechos/lançamentos e fluxo)
      const authorEmail = currentUser?.email || userProfile?.email || 'gestor@gkfengenharia.com.br';
      const synced = await saveCentralProduction({ cfg, ln, fluxd }, authorEmail);
      if (synced) {
        toast('Lançamentos e dados sincronizados no Banco Central com sucesso ✓');
      } else {
        toast('Dados salvos no navegador com sucesso ✓');
      }
      return true;
    } catch (e: any) {
      toast('Não foi possível salvar: ' + e.message);
      return false;
    }
  }, [cfg, ln, fluxd, canEdit, currentUser, userProfile, toast]);

  // Auto-sync debounced to Firestore (3.5s after any edit by an authorized user)
  useEffect(() => {
    if (!cfg || !canEdit || !authChecked || loading) return;
    const timer = setTimeout(async () => {
      try {
        const authorEmail = currentUser?.email || userProfile?.email || 'gestor@gkfengenharia.com.br';
        await saveCentralProduction({ cfg, ln, fluxd }, authorEmail);
      } catch (e) {
        console.warn('Auto-sync silencioso:', e);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [cfg, ln, fluxd, canEdit, authChecked, loading, currentUser, userProfile]);

  // Reset to default seed files
  const resetToDefault = useCallback(async () => {
    if (!confirm('Deseja restaurar todos os dados para o padrão original da pasta de dados? Suas alterações salvas no navegador serão substituídas.')) {
      return;
    }
    localStorage.removeItem(STORAGE_KEY_CFG);
    localStorage.removeItem(STORAGE_KEY_LN);
    await loadInitialData();
    toast('Dados restaurados com sucesso ✓');
  }, [loadInitialData, toast]);

  // Export full ZIP
  const exportZip = useCallback(async () => {
    if (!cfg) return;
    toast('Preparando arquivo ZIP para download...');
    try {
      const zip = new JSZip();
      const dadosFolder = zip.folder('dados') || zip;
      dadosFolder.file('config.json', JSON.stringify(cfg, null, 2));
      dadosFolder.file('templates.json', JSON.stringify(tpl, null, 2));
      if (bmap) dadosFolder.file('bm_map.json', JSON.stringify(bmap, null, 2));
      if (dasht) dadosFolder.file('dashboard_modelo.html', dasht);
      if (fluxt) dadosFolder.file('fluxo_obras.html', fluxt);
      if (fluxd) dadosFolder.file('fluxo_dados.json', JSON.stringify(fluxd, null, 2));

      for (const [id, lancData] of Object.entries(ln)) {
        dadosFolder.file(`lanc_${id}.json`, JSON.stringify(lancData, null, 2));
      }

      if (bmTemplateBuf) {
        dadosFolder.file('BM_modelo.xlsx', bmTemplateBuf);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Controle_Producao_GKF_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Backup ZIP baixado com sucesso ✓');
    } catch (err: any) {
      toast('Erro ao gerar ZIP: ' + err.message);
    }
  }, [cfg, tpl, bmap, dasht, fluxt, fluxd, ln, bmTemplateBuf, toast]);

  // Import ZIP
  const importZip = useCallback(
    async (file: File) => {
      toast('Importando arquivo ZIP...');
      try {
        const zip = await JSZip.loadAsync(file);
        let newCfg: Config | null = null;
        const newLn: Record<string, FrenteLancamentos> = {};

        // Find config.json
        const cfgFile = zip.file(/config\.json$/i)[0];
        if (cfgFile) {
          const cfgText = await cfgFile.async('string');
          newCfg = JSON.parse(cfgText);
        }

        // Find lanc_*.json
        const lancFiles = zip.file(/lanc_.*\.json$/i);
        for (const lf of lancFiles) {
          const m = /lanc_([^\\/]+)\.json$/i.exec(lf.name);
          if (m) {
            const fid = m[1];
            const text = await lf.async('string');
            newLn[fid] = JSON.parse(text);
          }
        }

        if (newCfg) {
          setCfg(newCfg);
          setLn(newLn);
          localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(newCfg));
          localStorage.setItem(STORAGE_KEY_LN, JSON.stringify(newLn));
          toast('Dados do ZIP importados e salvos com sucesso ✓');
        } else {
          toast('Arquivo config.json não encontrado dentro do ZIP.');
        }
      } catch (err: any) {
        toast('Erro ao importar ZIP: ' + err.message);
      }
    },
    [toast]
  );

  // Download CASAN BM Excel
  const downloadBMFile = useCallback(
    async (id: string, sn: Fechamento) => {
      if (!bmap) {
        toast('Mapeamento BM (bm_map.json) não carregado.');
        return;
      }
      toast('Gerando planilha Excel do BM CASAN...');
      try {
        let buf = bmTemplateBuf;
        if (!buf) {
          const res = await fetch('/dados/BM_modelo.xlsx');
          if (!res.ok) throw new Error('Não foi possível carregar BM_modelo.xlsx');
          buf = await res.arrayBuffer();
          setBmTemplateBuf(buf);
        }

        const fechsList = (ln[id]?.fech || []).filter((x) => x.n < sn.n);
        const ant = somaCols(fechsList.flatMap((x) => x.cols));
        const antCan = valorQ(ant, prm) / BASEBM(bmap);

        const payload: BMDataPayload = {
          ...sn,
          ant,
          antCan,
        };

        const out = await gerarBM(buf, bmap, payload, pf, tpl);
        const blob = new Blob([out as any], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `BM ${String(sn.n).padStart(2, '0')} - ${sn.mun} - ${sn.ini}.xlsx`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast(`Planilha gerada com sucesso: ${filename} ✓`);
      } catch (err: any) {
        toast('Erro ao gerar BM Excel: ' + err.message);
      }
    },
    [bmap, bmTemplateBuf, ln, prm, tpl, toast]
  );

  const handleSetFluxD = useCallback((data: any) => {
    setFluxd(data);
    try {
      if (data) {
        localStorage.setItem(STORAGE_KEY_FLUXD, JSON.stringify(data));
      } else {
        localStorage.removeItem(STORAGE_KEY_FLUXD);
      }
    } catch (e) {
      console.warn('Erro ao salvar fluxd no localStorage:', e);
    }
  }, []);

  const value = {
    cfg,
    ln,
    tpl,
    bmap,
    dasht,
    fluxt,
    fluxd,
    tab,
    setTab,
    frenteId,
    setFrenteId,
    oseId,
    setOseId,
    theme,
    toggleTheme,
    filt,
    setFilt,
    prm,
    loading,
    activeToast,
    toast,
    saveAll,
    resetToDefault,
    exportZip,
    importZip,
    updateConfig,
    updateFrenteLancamento,
    updateFrentePeriodo,
    downloadBMFile,
    setFluxD: handleSetFluxD,
    currentUser,
    userProfile,
    canEdit,
    isGestor,
    authChecked,
    logout,
    setUserProfile,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
