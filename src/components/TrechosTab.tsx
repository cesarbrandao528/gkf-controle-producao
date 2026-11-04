import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import {
  calcOSE,
  bm,
  inP,
  per,
  fmt,
  pn,
  pf,
  dbr,
  hoje,
  uid,
  slug,
  valorQ,
} from '../engine/calc';
import {
  Plus,
  Trash2,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  History,
  Calendar,
  Layers,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Users,
  X,
  Check,
  FileSpreadsheet,
  Download,
  Filter,
  Building2,
} from 'lucide-react';
import { AvulsoItem, Config, Fechamento, FrenteLancamentos, OSE, OSERow, PrecoItem } from '../types';

export const TrechosTab: React.FC = () => {
  const {
    cfg,
    ln,
    tpl,
    prm,
    frenteId,
    setFrenteId,
    oseId,
    setOseId,
    updateConfig,
    updateFrenteLancamento,
    toast,
  } = useData() as any;

  // Selected period: 'current' (default), 'fech_${n}' (closed BM), or 'all'
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [showArchivedRows, setShowArchivedRows] = useState<boolean>(false);

  // Filter trechos by team in the OSE view: 'all', team id, or 'none'
  const [filterEquipeId, setFilterEquipeId] = useState<string>('all');

  // Modal states for equipes
  const [editingEquipeRowIndex, setEditingEquipeRowIndex] = useState<number | null>(null);
  const [showEquipesModal, setShowEquipesModal] = useState<boolean>(false);
  const [equipesModalTab, setEquipesModalTab] = useState<'compilacao' | 'cadastro'>('compilacao');
  const [compFilterEquipe, setCompFilterEquipe] = useState<string>('all');
  const [compFilterContrato, setCompFilterContrato] = useState<string>('all');
  const [compFilterTipo, setCompFilterTipo] = useState<string>('all');
  const [quickTeamName, setQuickTeamName] = useState<string>('');
  const [newTeamModalName, setNewTeamModalName] = useState<string>('');

  const [newOseName, setNewOseName] = useState('');
  const [newOseType, setNewOseType] = useState('MND');

  // Form for avulsos inside the current OSE
  const [oseAvData, setOseAvData] = useState(hoje());
  const [oseAvCodeInput, setOseAvCodeInput] = useState('');
  const [oseAvQtd, setOseAvQtd] = useState('');

  // Form for general avulsos (unlinked)
  const [genAvData, setGenAvData] = useState(hoje());
  const [genAvCodeInput, setGenAvCodeInput] = useState('');
  const [genAvQtd, setGenAvQtd] = useState('');

  if (!cfg) return null;

  const f = cfg.frentes.find((x: any) => x.id === frenteId);
  const fLanc: FrenteLancamentos = ln[frenteId] || { itens: [], oses: [] };
  const oses: OSE[] = fLanc.oses || [];
  const contrato = cfg.contratos.find((c: any) => c.id === f?.contrato);

  // Period management
  const pAtivo = per(cfg, frenteId);
  const fechamentosList: Fechamento[] = [...(fLanc.fech || [])].sort((a, b) => b.n - a.n);

  const isCurrentPeriod = selectedPeriod === 'current';
  const isAllPeriods = selectedPeriod === 'all';
  const selectedFech = !isCurrentPeriod && !isAllPeriods
    ? fechamentosList.find((x: Fechamento) => `fech_${x.n}` === selectedPeriod) || null
    : null;
  const isClosedPeriod = !!selectedFech;

  // Active date bounds for calculations
  const periodBounds = isClosedPeriod
    ? { ini: selectedFech.ini, fim: selectedFech.fim }
    : isCurrentPeriod
    ? { ini: pAtivo.ini, fim: pAtivo.fim }
    : null;

  // Filter OSEs: In current period, NEVER hide active OSEs or the currently selected OSE!
  const filteredOses = oses.filter((o: OSE) => {
    // Currently selected OSE is always visible
    if (o.id === oseId) return true;
    if (isAllPeriods) return true;

    // If in current active period:
    if (isCurrentPeriod) {
      // If it's a newly created OSE or has active work, keep it
      if (!o.rows || o.rows.length === 0) return true;
      return true;
    }

    // In closed period: only show OSEs that actually had data in this closed measurement
    if (isClosedPeriod && selectedFech) {
      const hasRowsInClosedPeriod = (o.rows || []).some(
        (r) => r.d && r.d >= selectedFech.ini && r.d <= selectedFech.fim
      );
      const wasInClosedCols = (selectedFech.cols || []).some(
        (c) => c.nome === o.nome || c.nome.startsWith(o.nome)
      );
      return hasRowsInClosedPeriod || wasInClosedCols;
    }

    return true;
  });

  // Current selected OSE
  let currentOse = oses.find((x) => x.id === oseId);
  if (!currentOse && oseId !== '__av') {
    currentOse = filteredOses[0] || oses[0] || null;
  }

  // Avulsos linked to current OSE
  const currentOseAvulsos: AvulsoItem[] = currentOse
    ? (fLanc.itens || []).filter((x: any) => x.oid === currentOse!.id)
    : [];

  // General avulsos not linked to any OSE
  const generalAvulsos: AvulsoItem[] = (fLanc.itens || []).filter((x: any) => !x.oid);

  // Template and unified calculation for selected OSE (includes formula items + avulsos)
  const tp = currentOse ? tpl[currentOse.tipo] : null;
  const oseCalc = currentOse
    ? calcOSE(currentOse, frenteId, cfg, prm, tpl, undefined, undefined, periodBounds, currentOseAvulsos)
    : null;

  const handleCreateOSE = () => {
    if (!newOseName.trim()) {
      toast('Informe o nome da nova OSE.');
      return;
    }
    const newO: OSE = {
      id: uid(),
      nome: newOseName.trim(),
      tipo: newOseType,
      rows: [],
      aj: {},
    };
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      oses: [...(prev.oses || []), newO],
    }));
    setSelectedPeriod('current');
    setOseId(newO.id);
    setNewOseName('');
    toast(`OSE "${newO.nome}" criada com sucesso ✓`);
  };

  const handleDeleteOSE = (o: OSE) => {
    if (isClosedPeriod) {
      toast('Não é possível excluir OSE de uma medição já fechada.');
      return;
    }
    if (!confirm(`Excluir a OSE "${o.nome}" e todos os seus lançamentos?`)) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      oses: (prev.oses || []).filter((x: OSE) => x.id !== o.id),
      itens: (prev.itens || []).filter((x: any) => x.oid !== o.id),
    }));
    setOseId('__av');
    toast(`OSE "${o.nome}" excluída.`);
  };

  const handleAddTrechoRow = (o: OSE) => {
    if (isClosedPeriod) {
      toast('Esta medição está fechada. Volte para o período atual para lançar novos trechos.');
      return;
    }
    const lastRow = o.rows[o.rows.length - 1];
    // Default date is today if in period, otherwise start of current active period
    let defaultDate = hoje();
    if (pAtivo && (defaultDate < pAtivo.ini || defaultDate > pAtivo.fim)) {
      defaultDate = pAtivo.ini;
    }
    const newRow: OSERow = {
      id: uid(),
      d: lastRow ? lastRow.d : defaultDate,
      v: {},
      eq: lastRow ? [...(lastRow.eq || [])] : [],
    };
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          return { ...x, rows: [...x.rows, newRow] };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleDeleteTrechoRow = (o: OSE, rowIndex: number) => {
    if (isClosedPeriod) {
      toast('Não é possível excluir trechos de uma medição já fechada.');
      return;
    }
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          const nextRows = [...x.rows];
          nextRows.splice(rowIndex, 1);
          return { ...x, rows: nextRows };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleUpdateTrechoField = (
    o: OSE,
    rowIndex: number,
    fieldKey: string,
    value: any
  ) => {
    if (isClosedPeriod) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          const nextRows = x.rows.map((r: OSERow, i: number) => {
            if (i === rowIndex) {
              if (fieldKey === 'd') {
                return { ...r, d: value };
              }
              return { ...r, v: { ...r.v, [fieldKey]: value } };
            }
            return r;
          });
          return { ...x, rows: nextRows };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleToggleEquipe = (o: OSE, rowIndex: number, equipeId: string) => {
    if (isClosedPeriod) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          const nextRows = x.rows.map((r: OSERow, i: number) => {
            if (i === rowIndex) {
              const currentEq = r.eq || [];
              const nextEq = currentEq.includes(equipeId)
                ? currentEq.filter((q: string) => q !== equipeId)
                : [...currentEq, equipeId];
              return { ...r, eq: nextEq };
            }
            return r;
          });
          return { ...x, rows: nextRows };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleAddNewEquipe = (teamName: string) => {
    const nome = teamName.trim();
    if (!nome) return;
    const id = slug(nome);
    updateConfig((prev: Config) => {
      const equipes = prev.equipes || [];
      if (equipes.some((q: any) => q.id === id || q.nome.toLowerCase() === nome.toLowerCase())) {
        toast(`Equipe "${nome}" já está cadastrada.`);
        return prev;
      }
      return {
        ...prev,
        equipes: [...equipes, { id, nome }],
      };
    });
    toast(`Equipe "${nome}" cadastrada com sucesso ✓`);
  };

  const handleDeleteEquipe = (equipeId: string, equipeNome: string) => {
    if (!confirm(`Remover a equipe "${equipeNome}" do cadastro do sistema?`)) return;
    updateConfig((prev: Config) => ({
      ...prev,
      equipes: (prev.equipes || []).filter((q: any) => q.id !== equipeId),
    }));
    toast(`Equipe "${equipeNome}" removida.`);
  };

  // Compilação de todos os trechos por equipe e empreiteiro em todos os contratos e frentes
  const compiledTrechos = useMemo(() => {
    if (!cfg) return [];

    const allEquipes = cfg.equipes || [];
    const equipeMap = new Map<string, string>();
    allEquipes.forEach((eq: any) => equipeMap.set(eq.id, eq.nome));

    const contratoMap = new Map<string, any>();
    (cfg.contratos || []).forEach((c: any) => {
      contratoMap.set(c.id, c);
      contratoMap.set(c.n, c);
    });

    const rowsList: Array<{
      equipeId: string;
      equipeNome: string;
      frenteId: string;
      frenteNome: string;
      contratoId: string;
      contratoNum: string;
      contratoObra: string;
      oseId: string;
      oseNome: string;
      oseTipo: string;
      tipoNome: string;
      data: string;
      estaca: string;
      extensao: number;
      dn: string;
      pavimento: string;
      profundidade: number | string;
      larguraVala: number | string;
      rochaPct: number | string;
    }> = [];

    (cfg.frentes || []).forEach((frente: any) => {
      const fLanc = ln[frente.id];
      if (!fLanc || !fLanc.oses) return;

      const cObj = contratoMap.get(frente.contrato);
      const contratoNum = cObj ? cObj.n : frente.contrato || '—';
      const contratoObra = cObj ? cObj.obra : '—';

      fLanc.oses.forEach((ose: OSE) => {
        const tpObj = tpl[ose.tipo];
        const tipoNome = tpObj?.nome || ose.tipo;

        (ose.rows || []).forEach((r: OSERow) => {
          let extensao = 0;
          if (ose.tipo === 'REP') {
            extensao = pf(r.v['D']) || 0;
          } else {
            extensao = pf(r.v['C']) || pf(r.v['D']) || 0;
          }

          const estaca = String(r.v['A'] || '—');
          const dn = r.v['B'] ? `${r.v['B']} mm` : '—';
          let profundidade: any = '—';
          if (ose.tipo === 'ESC') profundidade = r.v['F'] ? pf(r.v['F']) : '—';
          else if (ose.tipo === 'MND') profundidade = r.v['D'] ? pf(r.v['D']) : '—';

          let pavimento = '—';
          if (ose.tipo === 'ESC') pavimento = r.v['Y'] || '—';
          else if (ose.tipo === 'MND') pavimento = r.v['V'] || '—';
          else if (ose.tipo === 'REP') pavimento = r.v['F'] || '—';

          const larguraVala =
            ose.tipo === 'ESC'
              ? r.v['H'] ?? '—'
              : ose.tipo === 'MND'
              ? r.v['F'] ?? '—'
              : ose.tipo === 'REP'
              ? r.v['E'] ?? '—'
              : '—';
          const rochaPct =
            ose.tipo === 'ESC' ? r.v['S'] ?? '—' : ose.tipo === 'MND' ? r.v['P'] ?? '—' : '—';

          const assignedEqs = r.eq && r.eq.length > 0 ? r.eq : ['__none__'];

          assignedEqs.forEach((eqId) => {
            const eqNome =
              eqId === '__none__' ? 'Sem equipe atribuída' : equipeMap.get(eqId) || eqId;
            rowsList.push({
              equipeId: eqId,
              equipeNome: eqNome,
              frenteId: frente.id,
              frenteNome: frente.nome,
              contratoId: frente.contrato,
              contratoNum,
              contratoObra,
              oseId: ose.id,
              oseNome: ose.nome,
              oseTipo: ose.tipo,
              tipoNome,
              data: r.d || '',
              estaca,
              extensao,
              dn,
              pavimento,
              profundidade,
              larguraVala,
              rochaPct,
            });
          });
        });
      });
    });

    return rowsList;
  }, [cfg, ln, tpl]);

  // Resumo estatístico compilado por equipe
  const equipesSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        equipeId: string;
        equipeNome: string;
        totalExtensao: number;
        totalMND: number;
        totalEscavado: number;
        totalReposicao: number;
        qtdTrechos: number;
        contratosSet: Set<string>;
        frentesSet: Set<string>;
        osesSet: Set<string>;
      }
    >();

    // Inicializa com equipes cadastradas
    (cfg.equipes || []).forEach((eq: any) => {
      map.set(eq.id, {
        equipeId: eq.id,
        equipeNome: eq.nome,
        totalExtensao: 0,
        totalMND: 0,
        totalEscavado: 0,
        totalReposicao: 0,
        qtdTrechos: 0,
        contratosSet: new Set(),
        frentesSet: new Set(),
        osesSet: new Set(),
      });
    });

    compiledTrechos.forEach((row) => {
      let entry = map.get(row.equipeId);
      if (!entry) {
        entry = {
          equipeId: row.equipeId,
          equipeNome: row.equipeNome,
          totalExtensao: 0,
          totalMND: 0,
          totalEscavado: 0,
          totalReposicao: 0,
          qtdTrechos: 0,
          contratosSet: new Set(),
          frentesSet: new Set(),
          osesSet: new Set(),
        };
        map.set(row.equipeId, entry);
      }

      entry.totalExtensao += row.extensao;
      if (row.oseTipo === 'MND') entry.totalMND += row.extensao;
      else if (row.oseTipo === 'ESC') entry.totalEscavado += row.extensao;
      else if (row.oseTipo === 'REP') entry.totalReposicao += row.extensao;

      entry.qtdTrechos += 1;
      if (row.contratoNum && row.contratoNum !== '—') entry.contratosSet.add(row.contratoNum);
      if (row.frenteNome) entry.frentesSet.add(row.frenteNome);
      if (row.oseNome) entry.osesSet.add(row.oseNome);
    });

    return Array.from(map.values()).sort((a, b) => b.totalExtensao - a.totalExtensao);
  }, [cfg, compiledTrechos]);

  // Filtro de trechos compilados para exibição na modal
  const filteredCompiledRows = useMemo(() => {
    return compiledTrechos.filter((r) => {
      if (compFilterEquipe !== 'all') {
        if (compFilterEquipe === '__none__' && r.equipeId !== '__none__') return false;
        if (compFilterEquipe !== '__none__' && r.equipeId !== compFilterEquipe) return false;
      }
      if (
        compFilterContrato !== 'all' &&
        r.contratoId !== compFilterContrato &&
        r.contratoNum !== compFilterContrato
      ) {
        return false;
      }
      if (compFilterTipo !== 'all' && r.oseTipo !== compFilterTipo) {
        return false;
      }
      return true;
    });
  }, [compiledTrechos, compFilterEquipe, compFilterContrato, compFilterTipo]);

  // Exportação Excel (.xlsx) nativa com 2 abas
  const exportCompiledExcel = () => {
    try {
      const resumoData = equipesSummaries.map((s) => ({
        'Equipe / Empreiteiro': s.equipeNome,
        'Total Extensão Geral (m)': Number(s.totalExtensao.toFixed(2)),
        'Extensão MND / Cravação (m)': Number(s.totalMND.toFixed(2)),
        'Extensão Escavado / Vala Aberta (m)': Number(s.totalEscavado.toFixed(2)),
        'Extensão Reposição (m)': Number(s.totalReposicao.toFixed(2)),
        'Qtd. Trechos Executados': s.qtdTrechos,
        'Contratos Atendidos': Array.from(s.contratosSet).join(', ') || '—',
        'Municípios / Frentes': Array.from(s.frentesSet).join(', ') || '—',
      }));

      const detalheData = filteredCompiledRows.map((r) => ({
        'Equipe / Empreiteiro': r.equipeNome,
        'Contrato': r.contratoNum,
        'Obra / Município': r.contratoObra,
        'Frente': r.frenteNome,
        'OSE': r.oseNome,
        'Tipo de Serviço': r.tipoNome,
        'Data de Execução': dbr(r.data),
        'PV / Estaca / Trecho': r.estaca,
        'Extensão Executada (m)': Number(r.extensao.toFixed(2)),
        'Diâmetro DN': r.dn,
        'Pavimento': r.pavimento,
        'Profundidade (m)': typeof r.profundidade === 'number' ? Number(r.profundidade.toFixed(2)) : r.profundidade,
        'Largura da Vala (m)': typeof r.larguraVala === 'number' ? Number(r.larguraVala.toFixed(2)) : r.larguraVala,
        'Rocha (%)': typeof r.rochaPct === 'number' ? Number(r.rochaPct.toFixed(2)) : r.rochaPct,
      }));

      const wb = XLSX.utils.book_new();
      const wsResumo = XLSX.utils.json_to_sheet(resumoData);
      const wsDetalhe = XLSX.utils.json_to_sheet(detalheData);

      wsResumo['!cols'] = [
        { wch: 24 },
        { wch: 24 },
        { wch: 26 },
        { wch: 30 },
        { wch: 22 },
        { wch: 22 },
        { wch: 32 },
        { wch: 28 },
      ];

      wsDetalhe['!cols'] = [
        { wch: 24 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
        { wch: 28 },
        { wch: 26 },
        { wch: 16 },
        { wch: 20 },
        { wch: 22 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 12 },
      ];

      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Empreiteiros');
      XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Trechos Detalhados');

      XLSX.writeFile(wb, `GKF_Compilado_Equipes_Empreiteiros_${hoje()}.xlsx`);
      toast('Planilha compilada por equipe (.xlsx) gerada com sucesso! ✓');
    } catch (err: any) {
      console.error('Erro ao gerar Excel:', err);
      toast('Erro ao gerar arquivo Excel. Gerando CSV...');
      exportCompiledCsv();
    }
  };

  // Exportação CSV de contingência (BOM UTF-8, delimitador ;)
  const exportCompiledCsv = () => {
    const headers = [
      'Equipe/Empreiteiro',
      'Contrato',
      'Obra/Municipio',
      'Frente',
      'OSE',
      'Tipo de Servico',
      'Data',
      'PV/Estaca',
      'Extensao (m)',
      'DN',
      'Pavimento',
      'Profundidade (m)',
    ];
    const rows = filteredCompiledRows.map((r) => [
      `"${r.equipeNome}"`,
      `"${r.contratoNum}"`,
      `"${r.contratoObra}"`,
      `"${r.frenteNome}"`,
      `"${r.oseNome}"`,
      `"${r.tipoNome}"`,
      `"${dbr(r.data)}"`,
      `"${r.estaca}"`,
      `"${fmt(r.extensao)}"`,
      `"${r.dn}"`,
      `"${r.pavimento}"`,
      `"${typeof r.profundidade === 'number' ? fmt(r.profundidade) : r.profundidade}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GKF_Compilado_Equipes_${hoje()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Arquivo CSV baixado com sucesso ✓');
  };

  const handleUpdateAjuste = (o: OSE, code: string, valStr: string) => {
    if (isClosedPeriod) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          const nextAj = { ...(x.aj || {}) };
          if (valStr.trim() === '') {
            delete nextAj[code];
          } else {
            nextAj[code] = pf(valStr);
          }
          return { ...x, aj: nextAj };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleUpdateAjustePct = (o: OSE, code: string, pctStr: string) => {
    if (isClosedPeriod) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          const nextAjPct = { ...(x.ajPct || {}) };
          if (pctStr.trim() === '') {
            delete nextAjPct[code];
          } else {
            nextAjPct[code] = pf(pctStr);
          }
          return { ...x, ajPct: nextAjPct };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleUpdateDmt = (o: OSE, field: 'dmtPo' | 'dmtSolo', valStr: string) => {
    if (isClosedPeriod) return;
    const val = pf(valStr);
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          return { ...x, [field]: val };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const PAVIMENTO_OPTIONS = [
    { value: 's.pav', label: 'Sem Pavimento (s.pav)' },
    { value: 'asfalto', label: 'Asfalto' },
    { value: 'Asf + Par', label: 'Asfalto + Paralelo' },
    { value: 'paver', label: 'Paver' },
    { value: 'lajota', label: 'Lajota' },
    { value: 'Paral', label: 'Paralelepípedo (Paral)' },
    { value: 'Cimen', label: 'Cimento / Concreto' },
    { value: 'Ladri', label: 'Ladrilho' },
    { value: 'Meio Fio', label: 'Meio Fio' },
    { value: 'grama', label: 'Grama' },
    { value: 'Sarjeta', label: 'Sarjeta' },
    { value: 'Placa', label: 'Placa' },
  ];

  // Add Avulso directly to the selected OSE
  const handleAddAvulsoToOSE = () => {
    if (isClosedPeriod) {
      toast('Esta medição está fechada. Volte para o período atual.');
      return;
    }
    if (!currentOse) return;
    const code = oseAvCodeInput.split(' ')[0].trim();
    const q = pn(oseAvQtd);
    if (!oseAvData || !prm[code] || !(q > 0)) {
      toast('Informe uma data válida, selecione um serviço CASAN e informe quantidade > 0.');
      return;
    }

    const newItem: AvulsoItem = {
      i: uid(),
      d: oseAvData,
      os: currentOse.nome,
      oid: currentOse.id,
      c: code,
      q,
    };

    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: [...(prev.itens || []), newItem],
    }));

    setOseAvQtd('');
    setOseAvCodeInput('');
    toast(`Serviço ${code} lançado na OSE "${currentOse.nome}" ✓`);
  };

  // Add General Avulso (unlinked)
  const handleAddGeneralAvulso = () => {
    if (isClosedPeriod) {
      toast('Esta medição está fechada.');
      return;
    }
    const code = genAvCodeInput.split(' ')[0].trim();
    const q = pn(genAvQtd);
    if (!genAvData || !prm[code] || !(q > 0)) {
      toast('Informe uma data válida, selecione um serviço CASAN e informe quantidade > 0.');
      return;
    }

    const newItem: AvulsoItem = {
      i: uid(),
      d: genAvData,
      os: '— Geral da Frente —',
      oid: undefined,
      c: code,
      q,
    };

    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: [...(prev.itens || []), newItem],
    }));

    setGenAvQtd('');
    setGenAvCodeInput('');
    toast(`Serviço geral ${code} lançado na frente ✓`);
  };

  const handleDeleteAvulsoItem = (itemId: string) => {
    if (isClosedPeriod) {
      toast('Não é possível excluir serviços de uma medição já fechada.');
      return;
    }
    if (!confirm('Excluir este serviço lançado?')) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: (prev.itens || []).filter((x: any) => x.i !== itemId),
    }));
    toast('Serviço removido.');
  };

  const handleUpdateAvulsoItemQtd = (itemId: string, newQtdStr: string) => {
    if (isClosedPeriod) return;
    const q = pn(newQtdStr);
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: (prev.itens || []).map((x: any) => (x.i === itemId ? { ...x, q } : x)),
    }));
  };

  // KPI Calculations
  const bmValorAtual = bm(frenteId, cfg, ln, prm, tpl);
  const closedBmValor = selectedFech
    ? (selectedFech.cols || []).reduce(
        (acc: number, col: any) => acc + valorQ(col.q, prm),
        0
      )
    : 0;

  const displayBmValor = isClosedPeriod ? closedBmValor : bmValorAtual;
  const displayCanteiroValor = displayBmValor * (cfg.k || 0);
  const displayExecPeriodoValor = displayBmValor * (1 + (cfg.k || 0));

  // Trecho rows to show: In current period or all periods, SHOW ALL ROWS so nothing disappears while typing!
  const allRows = currentOse ? currentOse.rows || [] : [];
  const rowsWithIndex = allRows.map((row, index) => ({ row, originalIndex: index }));
  const visibleRowsWithIndex = rowsWithIndex.filter(({ row }) => {
    // Equipe filtering
    if (filterEquipeId === 'none') {
      if ((row.eq || []).length > 0) return false;
    } else if (filterEquipeId !== 'all') {
      if (!(row.eq || []).includes(filterEquipeId)) return false;
    }

    if (isCurrentPeriod || isAllPeriods || showArchivedRows) return true;
    if (!periodBounds) return true;
    return !row.d || (row.d >= periodBounds.ini && row.d <= periodBounds.fim);
  });

  return (
    <div className="space-y-5">
      {/* Top Controls Bar */}
      <div className="gkf-card flex flex-wrap items-end gap-3.5">
        {/* Frente Selector */}
        <label className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
          Frente (município)
          <select
            value={frenteId}
            onChange={(e) => {
              setFrenteId(e.target.value);
              const fl = ln[e.target.value];
              if (fl?.oses && fl.oses.length > 0) {
                setOseId(fl.oses[0].id);
              } else {
                setOseId('__av');
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] font-semibold text-sm cursor-pointer"
          >
            {[...(cfg.frentes || [])]
              .sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
              .map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
          </select>
        </label>

        {/* Linked Contract */}
        <div className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
          Contrato Vinculado
          <span className="py-2 text-sm font-bold text-[var(--tx)]">
            {contrato ? `${contrato.n} · ${contrato.obra}` : '— sem contrato vinculado —'}
          </span>
        </div>

        {/* Período / Medição Selector */}
        <label className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium min-w-[220px]">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--cy)]" />
            Período da Medição
          </span>
          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              setShowArchivedRows(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] font-semibold text-sm cursor-pointer"
          >
            <option value="current">
              🟢 Período Atual (Ativo): {dbr(pAtivo.ini)} a {dbr(pAtivo.fim)}
            </option>
            {fechamentosList.length > 0 && (
              <optgroup label="── Medições Fechadas (Histórico) ──">
                {fechamentosList.map((fech: Fechamento) => (
                  <option key={`fech_${fech.n}`} value={`fech_${fech.n}`}>
                    🔒 BM nº {fech.n} ({dbr(fech.ini)} a {dbr(fech.fim)}) · {fech.st === 'med' ? 'Aprovada' : 'Pendente'}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="all">
              📁 Todos os Períodos (Histórico Completo)
            </option>
          </select>
        </label>

        {/* OSE Selector */}
        <label className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium min-w-[220px]">
          OSE / Tipo de Lançamento
          <select
            value={currentOse ? currentOse.id : '__av'}
            onChange={(e) => setOseId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] font-semibold text-sm cursor-pointer"
          >
            {filteredOses.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome} ({tpl[o.tipo]?.nome || o.tipo})
              </option>
            ))}
            <option value="__av">Serviços avulsos gerais (sem OSE vinculada)</option>
          </select>
        </label>

        {/* Create New OSE (Available in current period) */}
        {!isClosedPeriod && (
          <div className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
            Nova OSE
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                placeholder="ex: R. Mississipe (MND)"
                value={newOseName}
                onChange={(e) => setNewOseName(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-sm w-48 min-w-[150px]"
              />
              <select
                value={newOseType}
                onChange={(e) => setNewOseType(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-sm"
              >
                {Object.keys(tpl).map((k) => (
                  <option key={k} value={k}>
                    {tpl[k].nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateOSE}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Gerenciar Equipes no Card Principal */}
          <button
            type="button"
            onClick={() => {
              setEquipesModalTab('compilacao');
              setShowEquipesModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] hover:border-[var(--cy)] hover:text-[var(--cy)] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Gerenciar equipes e compilação de produção por empreiteiro"
          >
            <Users className="w-3.5 h-3.5 text-[var(--cy)]" />
            Gerenciar Equipes
          </button>

          {/* Delete OSE button */}
          {currentOse && !isClosedPeriod && (
            <button
              type="button"
              onClick={() => handleDeleteOSE(currentOse!)}
              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir OSE
            </button>
          )}
        </div>
      </div>

      {/* Closed Period Lock Banner */}
      {isClosedPeriod && selectedFech && (
        <div className="p-3.5 rounded-2xl bg-amber-950/35 border border-amber-500/40 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-300">
                Medição BM nº {selectedFech.n} ({dbr(selectedFech.ini)} a {dbr(selectedFech.fim)}) — Período Fechado
              </p>
              <p className="text-[11px] text-amber-200/80">
                Modo de consulta histórica: os trechos e medições desta medição estão salvos e bloqueados para não misturar com os lançamentos atuais.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-xs">
              {selectedFech.st === 'med' ? '✓ Aprovada pela CASAN' : '⏳ Pendente de aprovação'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedPeriod('current')}
              className="px-3 py-1 rounded-lg bg-[var(--cy)] text-white font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Voltar ao Período Atual
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards for the Frente & Period */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="gkf-kpi">
          <span>
            {isClosedPeriod
              ? `Medição fechada (BM nº ${selectedFech.n})`
              : 'Medição do período da frente (BM)'}
          </span>
          <b>R$ {fmt(displayBmValor)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Canteiro / adm. local ({((cfg.k || 0) * 100).toFixed(2)}%)</span>
          <b>R$ {fmt(displayCanteiroValor)}</b>
        </div>
        <div className="gkf-kpi">
          <span>
            {isClosedPeriod
              ? `Executado total na medição (${f?.nome || ''})`
              : `Executado no período (${f?.nome || ''})`}
          </span>
          <b>R$ {fmt(displayExecPeriodoValor)}</b>
        </div>
      </div>

      {/* OSE Trechos Section */}
      {currentOse && tp ? (
        <div className="space-y-4">
          {/* Card 1: Trechos Físicos Executados & Serviços da OSE */}
          <div className="gkf-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ln)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--tx)]">
                    Trechos executados: {currentOse.nome}
                  </h3>
                  {isClosedPeriod && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Fechado
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--mu)]">
                  Modelo: <span className="font-semibold text-[var(--cy)]">{tp.nome}</span> · Os serviços físicos da CASAN são calculados automaticamente por trecho.
                </p>
              </div>

              {/* Toolbar Actions: Team Filter & Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro de Equipes no Cabeçalho dos Trechos */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.05)] border border-[var(--ln)] text-xs text-[var(--mu)]">
                  <Users className="w-3.5 h-3.5 text-[var(--cy)] shrink-0" />
                  <span className="font-medium text-[var(--tx)] hidden sm:inline">Equipe:</span>
                  <select
                    value={filterEquipeId}
                    onChange={(e) => setFilterEquipeId(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-[var(--cy)] cursor-pointer focus:ring-0 focus:outline-none p-0 pr-1"
                    title="Filtrar tabela para exibir trechos de uma equipe específica"
                  >
                    <option value="all" className="bg-[var(--card)] text-[var(--tx)]">
                      Todas as equipes ({allRows.length})
                    </option>
                    {(cfg.equipes || []).map((eq: any) => {
                      const count = allRows.filter((r: any) => (r.eq || []).includes(eq.id)).length;
                      return (
                        <option key={eq.id} value={eq.id} className="bg-[var(--card)] text-[var(--tx)]">
                          {eq.nome} ({count})
                        </option>
                      );
                    })}
                    <option value="none" className="bg-[var(--card)] text-[var(--tx)]">
                      Sem equipe ({allRows.filter((r: any) => !(r.eq || []).length).length})
                    </option>
                  </select>
                </div>

                {!isClosedPeriod && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowEquipesModal(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] hover:border-[var(--cy)] flex items-center gap-1.5 cursor-pointer"
                      title="Gerenciar equipes cadastradas"
                    >
                      <Users className="w-3.5 h-3.5 text-[var(--cy)]" />
                      Gerenciar Equipes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTrechoRow(currentOse!)}
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar trecho
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Trechos Table */}
            <div className="gkf-table-wrap">
              <table className="gkf-table">
                <thead>
                  <tr>
                    <th className="text-xs">Data</th>
                    <th className="text-xs" style={{ width: '180px' }}>Equipes</th>
                    {tp.entradas.map((e: any) => (
                      <th
                        key={e.k}
                        className={`text-xs ${e.t === 'n' ? 'text-right' : 'text-left'}`}
                      >
                        {e.l || e.d} {e.u ? `(${e.u})` : ''}
                      </th>
                    ))}
                    {!isClosedPeriod && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleRowsWithIndex.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tp.entradas.length + 3}
                        className="text-center py-6 text-[var(--mu)]"
                      >
                        {isClosedPeriod
                          ? 'Nenhum trecho registrado nesta medição fechada.'
                          : filterEquipeId !== 'all'
                          ? 'Nenhum trecho encontrado para o filtro de equipe selecionado.'
                          : 'Nenhum trecho lançado para esta OSE. Clique em "Adicionar trecho" acima para iniciar.'}
                      </td>
                    </tr>
                  ) : (
                    visibleRowsWithIndex.map(({ row, originalIndex }) => {
                      const isInPeriod = inP(row.d, cfg, frenteId, periodBounds);
                      const assignedEqNomes = (row.eq || [])
                        .map((qId: string) => (cfg.equipes || []).find((q: any) => q.id === qId)?.nome)
                        .filter(Boolean);

                      return (
                        <tr
                          key={row.id || originalIndex}
                          className={!isInPeriod ? 'opacity-50 bg-amber-950/10' : ''}
                        >
                          {/* Date */}
                          <td style={{ width: '135px' }}>
                            <div className="space-y-1">
                              <input
                                type="date"
                                disabled={isClosedPeriod}
                                value={row.d || ''}
                                onChange={(e) =>
                                  handleUpdateTrechoField(
                                    currentOse!,
                                    originalIndex,
                                    'd',
                                    e.target.value
                                  )
                                }
                                className="w-full text-xs disabled:opacity-75 disabled:cursor-not-allowed"
                              />
                              {!isInPeriod && row.d && (
                                <span className="block text-[10px] text-amber-400 font-semibold leading-tight">
                                  Fora do período ativo
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Seletor Visual de Equipes sem Desconfigurar */}
                          <td style={{ width: '180px' }}>
                            {isClosedPeriod ? (
                              <span className="text-xs font-medium text-[var(--tx)] px-2 py-1 block truncate">
                                {assignedEqNomes.join(', ') || '—'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingEquipeRowIndex(originalIndex)}
                                className={`w-full text-left py-1 px-2.5 rounded-xl border transition-all flex items-center justify-between gap-1.5 cursor-pointer shadow-sm group ${
                                  assignedEqNomes.length > 0
                                    ? 'border-blue-500/35 bg-blue-950/25 text-[var(--tx)] hover:border-[var(--cy)] hover:bg-blue-950/40'
                                    : 'border-[var(--ln)] bg-[rgba(var(--w),0.04)] text-[var(--mu)] hover:border-[var(--cy)] hover:text-[var(--tx)]'
                                }`}
                                title={
                                  assignedEqNomes.length > 0
                                    ? `Equipes: ${assignedEqNomes.join(', ')} (clique para alterar)`
                                    : 'Clique para selecionar equipes responsáveis'
                                }
                              >
                                <div className="flex items-center gap-1.5 truncate min-w-0">
                                  <Users
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      assignedEqNomes.length > 0
                                        ? 'text-[var(--cy)]'
                                        : 'text-[var(--mu)]'
                                    }`}
                                  />
                                  <span className="truncate text-xs font-semibold leading-tight">
                                    {assignedEqNomes.length === 0 ? (
                                      <span className="font-normal italic text-[var(--mu)]">
                                        — selecionar —
                                      </span>
                                    ) : (
                                      assignedEqNomes.join(', ')
                                    )}
                                  </span>
                                </div>
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--mu)] group-hover:text-[var(--cy)] shrink-0 transition-colors ml-1" />
                              </button>
                            )}
                          </td>

                          {/* Dynamic Inputs from Template */}
                          {tp.entradas.map((e: any) => {
                            const val = row.v?.[e.k] ?? '';

                            if (e.t === 'p') {
                              return (
                                <td key={e.k} style={{ minWidth: '135px' }}>
                                  <select
                                    disabled={isClosedPeriod}
                                    value={val || 's.pav'}
                                    onChange={(ev) =>
                                      handleUpdateTrechoField(
                                        currentOse!,
                                        originalIndex,
                                        e.k,
                                        ev.target.value
                                      )
                                    }
                                    className="w-full text-xs py-1 px-2 rounded-lg border border-[var(--ln)] bg-[rgba(var(--w),0.06)] text-[var(--tx)] font-medium disabled:opacity-75 disabled:cursor-not-allowed"
                                  >
                                    {PAVIMENTO_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }

                            return (
                              <td key={e.k} className={e.t === 'n' ? 'text-right' : ''}>
                                <input
                                  type="text"
                                  disabled={isClosedPeriod}
                                  value={val}
                                  placeholder={e.t === 'n' ? '0,00' : ''}
                                  onChange={(ev) =>
                                    handleUpdateTrechoField(
                                      currentOse!,
                                      originalIndex,
                                      e.k,
                                      ev.target.value
                                    )
                                  }
                                  className={`text-xs disabled:opacity-75 disabled:cursor-not-allowed ${
                                    e.t === 'n' ? 'text-right font-medium' : ''
                                  }`}
                                  style={{ width: e.t === 'n' ? '78px' : '95px' }}
                                />
                              </td>
                            );
                          })}

                          {/* Delete Row */}
                          {!isClosedPeriod && (
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteTrechoRow(currentOse!, originalIndex)}
                                aria-label="Excluir trecho"
                                className="text-[var(--mu)] hover:text-red-400 p-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SEÇÃO INTEGRADA: Serviços Complementares / Avulsos desta OSE */}
            <div className="pt-3 border-t border-[var(--ln)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--cy)] flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    Serviços Complementares / Avulsos desta OSE ({currentOse.nome})
                  </h4>
                  <p className="text-[11px] text-[var(--mu)]">
                    Estes serviços entram diretamente no cálculo e somam ao subtotal da OSE abaixo.
                  </p>
                </div>
              </div>

              {/* Formulário para Lançar Serviço Avulso diretamente na OSE */}
              {!isClosedPeriod && (
                <div className="flex flex-wrap items-end gap-2 p-2.5 rounded-xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)]">
                  <label className="flex flex-col gap-1 text-[11px] text-[var(--mu)]">
                    Data
                    <input
                      type="date"
                      value={oseAvData}
                      onChange={(e) => setOseAvData(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] text-[var(--mu)] flex-1 min-w-[260px]">
                    Serviço CASAN (código ou descrição)
                    <input
                      type="text"
                      list="dl-precos-ose"
                      placeholder="Digite o código (ex: 110101, 110102, 170314...) ou nome..."
                      value={oseAvCodeInput}
                      onChange={(e) => setOseAvCodeInput(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs w-full"
                    />
                    <datalist id="dl-precos-ose">
                      {cfg.precos.map((p: PrecoItem) => (
                        <option key={p.c} value={`${p.c} — ${p.d} (R$ ${fmt(p.p)}/${p.u})`} />
                      ))}
                    </datalist>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] text-[var(--mu)] w-24">
                    Quantidade
                    <input
                      type="text"
                      placeholder="0,00"
                      value={oseAvQtd}
                      onChange={(e) => setOseAvQtd(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs text-right font-medium"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleAddAvulsoToOSE}
                    className="px-3 py-1 rounded-lg font-bold text-xs bg-[var(--cy)] text-black hover:opacity-90 shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar Serviço na OSE
                  </button>
                </div>
              )}

              {/* Tabela de Serviços Avulsos lançados para esta OSE */}
              {currentOseAvulsos.length > 0 && (
                <div className="gkf-table-wrap">
                  <table className="gkf-table">
                    <thead>
                      <tr>
                        <th className="text-[11px]">Data</th>
                        <th className="text-[11px]">Código</th>
                        <th className="text-[11px]">Serviço CASAN</th>
                        <th className="text-[11px]">Und.</th>
                        <th className="text-right text-[11px]" style={{ width: '90px' }}>Quantidade</th>
                        <th className="text-right text-[11px]">Unitário R$</th>
                        <th className="text-right text-[11px]">Valor R$</th>
                        {!isClosedPeriod && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentOseAvulsos.map((av) => {
                        const p = prm[av.c] || { d: 'Item ' + av.c, u: 'un', p: 0 };
                        const isInPeriod = inP(av.d, cfg, frenteId, periodBounds);
                        const v = (av.q || 0) * (p.p || 0);

                        return (
                          <tr
                            key={av.i}
                            className={!isInPeriod ? 'opacity-50 bg-amber-950/10' : ''}
                          >
                            <td className="text-xs">
                              {dbr(av.d)}
                              {!isInPeriod && (
                                <span className="block text-[9px] text-amber-400 font-semibold">
                                  Fora do período
                                </span>
                              )}
                            </td>
                            <td className="text-xs font-bold text-[var(--cy)]">{av.c}</td>
                            <td className="text-xs max-w-xs truncate">{p.d}</td>
                            <td className="text-xs text-[var(--mu)]">{p.u}</td>
                            <td className="text-right">
                              <input
                                type="text"
                                disabled={isClosedPeriod}
                                value={fmt(av.q)}
                                onChange={(e) => handleUpdateAvulsoItemQtd(av.i, e.target.value)}
                                className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/20 w-16 disabled:opacity-75"
                              />
                            </td>
                            <td className="text-right text-xs">{fmt(p.p)}</td>
                            <td className="text-right text-xs font-bold text-[var(--cy)]">
                              {fmt(v)}
                            </td>
                            {!isClosedPeriod && (
                              <td className="text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAvulsoItem(av.i)}
                                  aria-label="Excluir serviço"
                                  className="text-[var(--mu)] hover:text-red-400 p-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Memória de Cálculo UNIFICADA da OSE (Quantidades e Serviços CASAN) */}
          {oseCalc && oseCalc.itens.length > 0 && (
            <div className="gkf-card space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--tx)]">
                    Memória de Cálculo da OSE (Quantidades e Serviços CASAN)
                  </h3>
                  <p className="text-xs text-[var(--mu)]">
                    Total unificado apurado das fórmulas do modelo e dos serviços complementares lançados para esta OSE.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[var(--mu)] block">Subtotal desta OSE:</span>
                  <span className="text-lg font-extrabold text-[var(--cy)]">
                    R$ {fmt(oseCalc.total)}
                  </span>
                </div>
              </div>

              {/* DMT Controls Banner for Escavado */}
              {currentOse.tipo === 'ESC' && (
                <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-blue-950/25 border border-blue-500/25 text-xs text-[var(--tx)]">
                  <span className="font-bold text-[var(--cy)]">
                    Distâncias de Transporte (DMT):
                  </span>
                  <label className="flex items-center gap-1.5 text-[var(--tx)]">
                    <span className="text-[var(--mu)]">DMT Pó de pedra (km):</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      disabled={isClosedPeriod}
                      value={currentOse.dmtPo ?? 5}
                      onChange={(e) => handleUpdateDmt(currentOse, 'dmtPo', e.target.value)}
                      className="w-16 px-2 py-0.5 rounded border border-[var(--ln)] bg-black/30 text-right font-bold text-[var(--cy)] disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                    <span className="text-[11px] text-[var(--mu)]">(multiplica item 40607)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[var(--tx)]">
                    <span className="text-[var(--mu)]">DMT Solo / Bota-fora (km):</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      disabled={isClosedPeriod}
                      value={currentOse.dmtSolo ?? 5}
                      onChange={(e) => handleUpdateDmt(currentOse, 'dmtSolo', e.target.value)}
                      className="w-16 px-2 py-0.5 rounded border border-[var(--ln)] bg-black/30 text-right font-bold text-[var(--cy)] disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                    <span className="text-[11px] text-[var(--mu)]">(multiplica item 40801)</span>
                  </label>
                </div>
              )}

              <div className="gkf-table-wrap">
                <table className="gkf-table">
                  <thead>
                    <tr>
                      <th className="text-xs">Código</th>
                      <th className="text-xs">Descrição do Serviço</th>
                      <th className="text-xs">Origem</th>
                      <th className="text-xs">Und.</th>
                      <th className="text-right text-xs">Unitário R$</th>
                      <th className="text-right text-xs">Qtd. Apurada</th>
                      <th className="text-right text-xs" style={{ width: '85px' }}>Ajuste (%)</th>
                      <th className="text-right text-xs" style={{ width: '95px' }}>Ajuste Qtd</th>
                      <th className="text-right text-xs">Qtd. Final</th>
                      <th className="text-right text-xs">Valor Total R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oseCalc.itens.map((it: any) => (
                      <tr key={it.c}>
                        <td className="font-bold text-xs text-[var(--cy)]">{it.c}</td>
                        <td className="text-xs max-w-md truncate">{it.d}</td>
                        <td className="text-xs">
                          {it.isAvulso ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Avulso
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300">
                              Fórmula
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-[var(--mu)]">{it.u}</td>
                        <td className="text-right text-xs">{fmt(it.p)}</td>
                        <td className="text-right text-xs text-[var(--mu)] font-medium">
                          {fmt(it.q)}
                        </td>
                        {/* Ajuste em porcentagem (%) */}
                        <td className="text-right">
                          <input
                            type="text"
                            placeholder="0%"
                            disabled={isClosedPeriod}
                            value={it.ajPct !== undefined ? `${it.ajPct}%` : ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace('%', '').trim();
                              handleUpdateAjustePct(currentOse!, it.c, clean);
                            }}
                            className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/25 w-16 disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </td>
                        {/* Ajuste em quantidade manual */}
                        <td className="text-right">
                          <input
                            type="text"
                            placeholder="auto"
                            disabled={isClosedPeriod}
                            value={it.ajVal !== undefined ? fmt(it.ajVal) : ''}
                            onChange={(e) =>
                              handleUpdateAjuste(currentOse!, it.c, e.target.value)
                            }
                            className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/25 w-20 disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="text-right text-xs font-bold text-[var(--tx)]">
                          {fmt(it.qf)}
                        </td>
                        <td className="text-right text-xs font-extrabold text-[var(--cy)]">
                          {fmt(it.v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={9} className="text-right font-bold text-xs">
                        Total desta OSE no período (Trechos + Serviços Complementares):
                      </td>
                      <td className="text-right text-sm font-extrabold text-[var(--cy)]">
                        R$ {fmt(oseCalc.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="gkf-card text-center py-6 text-[var(--mu)]">
          {oses.length === 0 ? (
            <p>Nenhuma OSE criada nesta frente. Utilize o campo "Nova OSE" acima para criar a primeira.</p>
          ) : (
            <p>Selecione uma OSE na barra superior para visualizar os trechos e memória de cálculo.</p>
          )}
        </div>
      )}

      {/* Serviços Avulsos GERAIS da Frente (sem OSE vinculada) */}
      <div className="gkf-card space-y-4">
        <div>
          <h3 className="text-base font-bold text-[var(--tx)] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--cy)]" />
            Serviços Avulsos Gerais da Frente (sem OSE vinculada)
          </h3>
          <p className="text-xs text-[var(--mu)]">
            Utilize esta seção para lançar serviços gerais do canteiro ou da frente que não pertencem a nenhuma rua ou OSE específica.
          </p>
        </div>

        {/* Form to Add General Avulso */}
        {!isClosedPeriod && (
          <div className="flex flex-wrap items-end gap-2.5 p-3 rounded-xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)]">
            <label className="flex flex-col gap-1 text-xs text-[var(--mu)]">
              Data
              <input
                type="date"
                value={genAvData}
                onChange={(e) => setGenAvData(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-[var(--mu)] flex-1 min-w-[280px]">
              Serviço CASAN (código ou descrição)
              <input
                type="text"
                list="dl-precos-gen"
                placeholder="Digite o código (ex: 20201) ou nome do serviço..."
                value={genAvCodeInput}
                onChange={(e) => setGenAvCodeInput(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs w-full"
              />
              <datalist id="dl-precos-gen">
                {cfg.precos.map((p: PrecoItem) => (
                  <option key={p.c} value={`${p.c} — ${p.d} (R$ ${fmt(p.p)}/${p.u})`} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-28">
              Quantidade
              <input
                type="text"
                placeholder="0,00"
                value={genAvQtd}
                onChange={(e) => setGenAvQtd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs text-right font-medium"
              />
            </label>

            <button
              type="button"
              onClick={handleAddGeneralAvulso}
              className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Lançar Geral
            </button>
          </div>
        )}

        {/* General Avulsos Table */}
        <div className="gkf-table-wrap">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Código</th>
                <th>Serviço CASAN</th>
                <th>Und.</th>
                <th className="text-right">Quantidade</th>
                <th className="text-right">Unitário R$</th>
                <th className="text-right">Valor R$</th>
                {!isClosedPeriod && <th></th>}
              </tr>
            </thead>
            <tbody>
              {generalAvulsos.length === 0 ? (
                <tr>
                  <td colSpan={isClosedPeriod ? 7 : 8} className="text-center py-5 text-[var(--mu)] text-xs">
                    Nenhum serviço avulso geral lançado na frente.
                  </td>
                </tr>
              ) : (
                generalAvulsos.map((item: any) => {
                  const p = prm[item.c] || { d: 'Item ' + item.c, u: 'un', p: 0 };
                  const isInPeriod = inP(item.d, cfg, frenteId, periodBounds);
                  const valor = (item.q || 0) * (p.p || 0);

                  return (
                    <tr
                      key={item.i}
                      className={!isInPeriod ? 'opacity-40 bg-black/20' : ''}
                    >
                      <td className="text-xs">{dbr(item.d)}</td>
                      <td className="text-xs font-bold text-[var(--cy)]">{item.c}</td>
                      <td className="text-xs max-w-xs truncate">{p.d}</td>
                      <td className="text-xs text-[var(--mu)]">{p.u}</td>
                      <td className="text-right" style={{ width: '100px' }}>
                        <input
                          type="text"
                          disabled={isClosedPeriod}
                          value={fmt(item.q)}
                          onChange={(e) => handleUpdateAvulsoItemQtd(item.i, e.target.value)}
                          className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/20 disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="text-right text-xs">{fmt(p.p)}</td>
                      <td className="text-right text-xs font-bold text-[var(--cy)]">
                        {fmt(valor)}
                      </td>
                      {!isClosedPeriod && (
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAvulsoItem(item.i)}
                            aria-label="Excluir avulso"
                            className="text-[var(--mu)] hover:text-red-400 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: SELETOR DE EQUIPES DO TRECHO (Nunca é cortado pela tabela) */}
      {editingEquipeRowIndex !== null && currentOse && currentOse.rows[editingEquipeRowIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingEquipeRowIndex(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--ln)] rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[var(--ln)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--tx)] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--cy)]" />
                  Equipes Responsáveis pelo Trecho
                </h3>
                <p className="text-xs text-[var(--mu)] mt-0.5">
                  Data: <span className="font-semibold text-[var(--tx)]">{dbr(currentOse.rows[editingEquipeRowIndex].d)}</span> · OSE: <span className="font-semibold text-[var(--tx)]">{currentOse.nome}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEquipeRowIndex(null)}
                className="text-[var(--mu)] hover:text-[var(--tx)] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(cfg.equipes || []).length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--mu)]">
                  Nenhuma equipe cadastrada ainda. Digite o nome abaixo para cadastrar.
                </div>
              ) : (
                (cfg.equipes || []).map((q: any) => {
                  const isAssigned = (currentOse.rows[editingEquipeRowIndex!].eq || []).includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isAssigned
                          ? 'bg-blue-950/40 border-blue-500/60 text-white shadow-sm'
                          : 'bg-[rgba(var(--w),0.03)] border-[var(--ln)] text-[var(--tx)] hover:bg-[rgba(var(--w),0.08)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleEquipe(currentOse!, editingEquipeRowIndex!, q.id)}
                          className="w-4 h-4 rounded text-[var(--cy)] cursor-pointer"
                        />
                        <span className="text-sm font-bold">{q.nome}</span>
                      </div>
                      {isAssigned && (
                        <span className="text-[11px] font-bold text-[var(--cy)] px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
                          ✓ Selecionada
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Cadastrar nova equipe rapidamente */}
            <div className="pt-3 border-t border-[var(--ln)] space-y-2">
              <span className="text-xs text-[var(--mu)] font-medium block">
                Cadastrar nova equipe:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="ex: HENELILTON, EQUIPE 02..."
                  value={quickTeamName}
                  onChange={(e) => setQuickTeamName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (quickTeamName.trim()) {
                        handleAddNewEquipe(quickTeamName);
                        setQuickTeamName('');
                      }
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-xs text-[var(--tx)] font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (quickTeamName.trim()) {
                      handleAddNewEquipe(quickTeamName);
                      setQuickTeamName('');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.1)] border border-[var(--ln)] hover:border-[var(--cy)] text-xs font-bold text-[var(--tx)] cursor-pointer"
                >
                  + Cadastrar
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingEquipeRowIndex(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white font-bold text-xs shadow-md cursor-pointer hover:opacity-95"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GERENCIAMENTO E COMPILAÇÃO DE EQUIPES / EMPREITEIROS */}
      {showEquipesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md"
          onClick={() => setShowEquipesModal(false)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--ln)] rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--ln)] p-5 pb-4 bg-[rgba(var(--w),0.02)]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[var(--cy)]/15 border border-[var(--cy)]/30 text-[var(--cy)]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--tx)] flex items-center gap-2">
                    Equipes & Empreiteiros · Compilação Geral
                  </h3>
                  <p className="text-xs text-[var(--mu)] mt-0.5">
                    Controle compilado de produção por equipe/empreiteiro em todos os contratos e frentes ativas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEquipesModal(false)}
                className="text-[var(--mu)] hover:text-[var(--tx)] p-1.5 rounded-xl hover:bg-[rgba(var(--w),0.07)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-[var(--ln)] bg-[rgba(var(--w),0.01)]">
              <button
                type="button"
                onClick={() => setEquipesModalTab('compilacao')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                  equipesModalTab === 'compilacao'
                    ? 'border-[var(--cy)] text-[var(--cy)] bg-[rgba(var(--w),0.04)]'
                    : 'border-transparent text-[var(--mu)] hover:text-[var(--tx)]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Compilação por Empreiteiro (Todos os Contratos)
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(var(--w),0.08)]">
                  {compiledTrechos.length} trechos
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEquipesModalTab('cadastro')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                  equipesModalTab === 'cadastro'
                    ? 'border-[var(--cy)] text-[var(--cy)] bg-[rgba(var(--w),0.04)]'
                    : 'border-transparent text-[var(--mu)] hover:text-[var(--tx)]'
                }`}
              >
                <Users className="w-4 h-4" />
                Cadastro de Equipes
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(var(--w),0.08)]">
                  {(cfg.equipes || []).length} equipes
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {equipesModalTab === 'compilacao' ? (
                <>
                  {/* Action / Filter Toolbar */}
                  <div className="p-4 rounded-2xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Filter by Team */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-xs">
                        <Users className="w-3.5 h-3.5 text-[var(--cy)] shrink-0" />
                        <span className="font-semibold text-[var(--mu)]">Equipe:</span>
                        <select
                          value={compFilterEquipe}
                          onChange={(e) => setCompFilterEquipe(e.target.value)}
                          className="bg-transparent border-0 text-xs font-bold text-[var(--tx)] cursor-pointer focus:ring-0 focus:outline-none p-0 pr-1"
                        >
                          <option value="all" className="bg-[var(--card)] text-[var(--tx)]">
                            Todas as equipes ({compiledTrechos.length})
                          </option>
                          {(cfg.equipes || []).map((eq: any) => {
                            const count = compiledTrechos.filter((r) => r.equipeId === eq.id).length;
                            return (
                              <option key={eq.id} value={eq.id} className="bg-[var(--card)] text-[var(--tx)]">
                                {eq.nome} ({count})
                              </option>
                            );
                          })}
                          <option value="__none__" className="bg-[var(--card)] text-[var(--tx)]">
                            Sem equipe atribuída ({compiledTrechos.filter((r) => r.equipeId === '__none__').length})
                          </option>
                        </select>
                      </div>

                      {/* Filter by Contract */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-xs">
                        <Building2 className="w-3.5 h-3.5 text-[var(--cy)] shrink-0" />
                        <span className="font-semibold text-[var(--mu)]">Contrato:</span>
                        <select
                          value={compFilterContrato}
                          onChange={(e) => setCompFilterContrato(e.target.value)}
                          className="bg-transparent border-0 text-xs font-bold text-[var(--tx)] cursor-pointer focus:ring-0 focus:outline-none p-0 pr-1"
                        >
                          <option value="all" className="bg-[var(--card)] text-[var(--tx)]">
                            Todos os contratos ({cfg.contratos?.length || 0})
                          </option>
                          {(cfg.contratos || []).map((c: any) => (
                            <option key={c.id} value={c.id} className="bg-[var(--card)] text-[var(--tx)]">
                              {c.n} · {c.obra}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Type */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-xs">
                        <Filter className="w-3.5 h-3.5 text-[var(--cy)] shrink-0" />
                        <span className="font-semibold text-[var(--mu)]">Serviço:</span>
                        <select
                          value={compFilterTipo}
                          onChange={(e) => setCompFilterTipo(e.target.value)}
                          className="bg-transparent border-0 text-xs font-bold text-[var(--tx)] cursor-pointer focus:ring-0 focus:outline-none p-0 pr-1"
                        >
                          <option value="all" className="bg-[var(--card)] text-[var(--tx)]">
                            Todos os tipos (MND, Escavado, Reposição)
                          </option>
                          <option value="MND" className="bg-[var(--card)] text-[var(--tx)]">
                            MND (Método Não Destrutivo)
                          </option>
                          <option value="ESC" className="bg-[var(--card)] text-[var(--tx)]">
                            Escavado (Vala Aberta)
                          </option>
                          <option value="REP" className="bg-[var(--card)] text-[var(--tx)]">
                            Reposição de Pavimento
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Download Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={exportCompiledExcel}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md hover:shadow-emerald-900/30 transition-all cursor-pointer"
                        title="Baixar planilha completa em formato Excel (.xlsx)"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Baixar Planilha Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={exportCompiledCsv}
                        className="px-3 py-2 rounded-xl bg-[rgba(var(--w),0.07)] hover:bg-[rgba(var(--w),0.12)] border border-[var(--ln)] text-[var(--tx)] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Baixar dados em formato CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  {(() => {
                    const totalExtGeral = filteredCompiledRows.reduce((acc, r) => acc + r.extensao, 0);
                    const totalMndGeral = filteredCompiledRows
                      .filter((r) => r.oseTipo === 'MND')
                      .reduce((acc, r) => acc + r.extensao, 0);
                    const totalEscavadoGeral = filteredCompiledRows
                      .filter((r) => r.oseTipo === 'ESC')
                      .reduce((acc, r) => acc + r.extensao, 0);
                    const totalReposicaoGeral = filteredCompiledRows
                      .filter((r) => r.oseTipo === 'REP')
                      .reduce((acc, r) => acc + r.extensao, 0);

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)]">
                          <span className="text-[11px] text-[var(--mu)] font-medium block">
                            Extensão Total Compilada
                          </span>
                          <span className="text-lg font-bold text-[var(--tx)] mt-0.5 block">
                            {fmt(totalExtGeral)} m
                          </span>
                          <span className="text-[10px] text-[var(--mu)]">
                            {filteredCompiledRows.length} trechos executados
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/30">
                          <span className="text-[11px] text-blue-300 font-medium block">
                            Cravação MND (Empreiteiros)
                          </span>
                          <span className="text-lg font-bold text-blue-400 mt-0.5 block">
                            {fmt(totalMndGeral)} m
                          </span>
                          <span className="text-[10px] text-blue-300/70">
                            Base para medição de MND
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                          <span className="text-[11px] text-amber-300 font-medium block">
                            Escavado / Vala Aberta
                          </span>
                          <span className="text-lg font-bold text-amber-400 mt-0.5 block">
                            {fmt(totalEscavadoGeral)} m
                          </span>
                          <span className="text-[10px] text-amber-300/70">
                            Extensão de escavação
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30">
                          <span className="text-[11px] text-purple-300 font-medium block">
                            Reposição de Pavimento
                          </span>
                          <span className="text-lg font-bold text-purple-400 mt-0.5 block">
                            {fmt(totalReposicaoGeral)} m
                          </span>
                          <span className="text-[10px] text-purple-300/70">
                            Metragem de reposição
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Resumo por Equipe Cards */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[var(--tx)] uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--cy)]" />
                        Totais Compilados por Empreiteiro / Equipe
                      </h4>
                      <span className="text-[11px] text-[var(--mu)]">
                        {equipesSummaries.length} equipes identificadas
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {equipesSummaries.map((summary) => {
                        const isFocused = compFilterEquipe === summary.equipeId;
                        return (
                          <div
                            key={summary.equipeId}
                            onClick={() =>
                              setCompFilterEquipe(
                                compFilterEquipe === summary.equipeId ? 'all' : summary.equipeId
                              )
                            }
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                              isFocused
                                ? 'bg-[rgba(var(--cy),0.08)] border-[var(--cy)] shadow-lg'
                                : 'bg-[rgba(var(--w),0.03)] border-[var(--ln)] hover:border-[var(--cy)]/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-bold text-sm text-[var(--tx)] flex items-center gap-2">
                                  {summary.equipeNome}
                                  {isFocused && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--cy)] text-black">
                                      Filtrado
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-[var(--mu)] mt-0.5 block">
                                  {summary.qtdTrechos} trecho(s) · {summary.contratosSet.size} contrato(s)
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-[var(--mu)] block">Extensão Total</span>
                                <span className="text-base font-extrabold text-[var(--cy)]">
                                  {fmt(summary.totalExtensao)} m
                                </span>
                              </div>
                            </div>

                            {/* Breakdown por tipo */}
                            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[var(--ln)] text-xs">
                              <div>
                                <span className="text-[10px] text-blue-300/80 block">MND / Cravação</span>
                                <span className="font-bold text-[var(--tx)]">
                                  {fmt(summary.totalMND)} m
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-amber-300/80 block">Escavado</span>
                                <span className="font-bold text-[var(--tx)]">
                                  {fmt(summary.totalEscavado)} m
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-purple-300/80 block">Reposição</span>
                                <span className="font-bold text-[var(--tx)]">
                                  {fmt(summary.totalReposicao)} m
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalhamento de Trechos Compilados Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[var(--tx)] uppercase tracking-wider flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--cy)]" />
                        Detalhamento de Trechos Executados ({filteredCompiledRows.length})
                      </h4>
                      {compFilterEquipe !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setCompFilterEquipe('all')}
                          className="text-xs text-[var(--cy)] hover:underline cursor-pointer"
                        >
                          Limpar filtro de equipe
                        </button>
                      )}
                    </div>

                    <div className="gkf-table-wrap max-h-80 overflow-y-auto border border-[var(--ln)] rounded-2xl">
                      <table className="gkf-table text-xs">
                        <thead>
                          <tr>
                            <th className="text-left">Equipe / Empreiteiro</th>
                            <th className="text-left">Contrato / Frente</th>
                            <th className="text-left">OSE / Tipo</th>
                            <th className="text-left">Data</th>
                            <th className="text-left">Estaca / Trecho</th>
                            <th className="text-right">Extensão (m)</th>
                            <th className="text-left">DN</th>
                            <th className="text-left">Pavimento</th>
                            <th className="text-right">Prof. (m)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCompiledRows.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center py-8 text-[var(--mu)]">
                                Nenhum trecho executado encontrado com os filtros selecionados.
                              </td>
                            </tr>
                          ) : (
                            filteredCompiledRows.map((row, idx) => (
                              <tr key={`${row.equipeId}_${row.oseId}_${idx}`} className="hover:bg-[rgba(var(--w),0.03)]">
                                <td className="font-semibold text-[var(--tx)] whitespace-nowrap">
                                  {row.equipeNome}
                                </td>
                                <td className="whitespace-nowrap">
                                  <span className="font-bold text-[var(--tx)]">{row.contratoNum}</span>
                                  <span className="text-[10px] text-[var(--mu)] block">{row.frenteNome}</span>
                                </td>
                                <td>
                                  <span className="font-medium text-[var(--tx)] block">{row.oseNome}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(var(--w),0.07)] text-[var(--mu)]">
                                    {row.tipoNome}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap font-mono text-[11px]">
                                  {dbr(row.data)}
                                </td>
                                <td className="font-mono">{row.estaca}</td>
                                <td className="text-right font-extrabold text-[var(--cy)]">
                                  {fmt(row.extensao)} m
                                </td>
                                <td>{row.dn}</td>
                                <td>{row.pavimento}</td>
                                <td className="text-right font-mono">
                                  {typeof row.profundidade === 'number'
                                    ? fmt(row.profundidade)
                                    : row.profundidade}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* TAB 2: CADASTRO E GERENCIAMENTO DE EQUIPES */
                <div className="space-y-4 max-w-xl mx-auto">
                  {/* Formulário de cadastro de nova equipe */}
                  <div className="p-4 rounded-2xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)] space-y-3">
                    <span className="text-xs font-bold text-[var(--tx)] block">
                      Cadastrar Nova Equipe ou Empreiteiro
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nome da equipe (ex: A&M, HENELILTON, EQUIPE 01)..."
                        value={newTeamModalName}
                        onChange={(e) => setNewTeamModalName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newTeamModalName.trim()) {
                              handleAddNewEquipe(newTeamModalName);
                              setNewTeamModalName('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-xs text-[var(--tx)] font-medium focus:border-[var(--cy)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newTeamModalName.trim()) {
                            handleAddNewEquipe(newTeamModalName);
                            setNewTeamModalName('');
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white font-bold text-xs shadow-md cursor-pointer hover:opacity-90"
                      >
                        + Cadastrar
                      </button>
                    </div>
                  </div>

                  {/* Lista de equipes cadastradas */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[var(--mu)] block">
                      Equipes Cadastradas ({(cfg.equipes || []).length})
                    </span>
                    {(cfg.equipes || []).length === 0 ? (
                      <div className="text-center py-8 text-xs text-[var(--mu)]">
                        Nenhuma equipe cadastrada ainda. Digite um nome acima para começar.
                      </div>
                    ) : (
                      (cfg.equipes || []).map((q: any) => {
                        const countInCurrentOSE = allRows.filter((r: any) =>
                          (r.eq || []).includes(q.id)
                        ).length;
                        const countOverall = compiledTrechos.filter(
                          (r) => r.equipeId === q.id
                        ).length;

                        return (
                          <div
                            key={q.id}
                            className="flex items-center justify-between p-3.5 rounded-xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)] hover:border-[var(--cy)]/50 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-[rgba(var(--w),0.07)] text-[var(--cy)]">
                                <Users className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-[var(--tx)] block">
                                  {q.nome}
                                </span>
                                <span className="text-[11px] text-[var(--mu)]">
                                  {countOverall} trecho(s) no total de contratos · {countInCurrentOSE} nesta OSE
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteEquipe(q.id, q.nome)}
                              className="text-[var(--mu)] hover:text-red-400 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Remover equipe do cadastro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--ln)] bg-[rgba(var(--w),0.02)] flex items-center justify-between">
              <span className="text-xs text-[var(--mu)]">
                {equipesModalTab === 'compilacao'
                  ? 'Planilha compilada pronta para conferência de medição e pagamento de empreiteiros.'
                  : 'Equipes cadastradas ficam disponíveis para seleção em todos os trechos.'}
              </span>
              <button
                type="button"
                onClick={() => setShowEquipesModal(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white font-bold text-xs shadow-md cursor-pointer hover:opacity-95"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
