import React, { useState } from 'react';
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
      // Also show if it has any rows or avulsos
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

  const handleCreateEquipe = () => {
    const nome = prompt('Nome da equipe:')?.trim();
    if (!nome) return;
    const id = slug(nome);
    updateConfig((prev: Config) => {
      const equipes = prev.equipes || [];
      if (equipes.some((q: any) => q.id === id)) return prev;
      return {
        ...prev,
        equipes: [...equipes, { id, nome }],
      };
    });
    toast(`Equipe "${nome}" adicionada.`);
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
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Delete OSE button */}
          {currentOse && !isClosedPeriod && (
            <button
              type="button"
              onClick={() => handleDeleteOSE(currentOse!)}
              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 transition-all flex items-center gap-1.5"
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
              className="px-3 py-1 rounded-lg bg-[var(--cy)] text-white font-bold text-xs hover:opacity-90 transition-opacity"
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ln)] pb-3">
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
              <div className="flex items-center gap-2">
                {!isClosedPeriod && (
                  <>
                    <button
                      type="button"
                      onClick={handleCreateEquipe}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] hover:border-[var(--cy)]"
                    >
                      + Nova equipe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTrechoRow(currentOse!)}
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5"
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
                    <th className="text-xs">Equipes</th>
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

                          {/* Equipes Dropdown */}
                          <td style={{ minWidth: '135px' }}>
                            {isClosedPeriod ? (
                              <span className="text-xs text-[var(--mu)] px-2 py-1 block">
                                {assignedEqNomes.join(', ') || '—'}
                              </span>
                            ) : (
                              <details className="relative group">
                                <summary className="cursor-pointer text-xs py-1 px-2 rounded-lg border border-[var(--ln)] hover:border-[var(--cy)] bg-[rgba(var(--w),0.05)] list-none flex items-center justify-between">
                                  <span className="truncate">
                                    {assignedEqNomes.join(', ') || '— equipes —'}
                                  </span>
                                  <ChevronDown className="w-3 h-3 ml-1 shrink-0 opacity-60" />
                                </summary>
                                <div className="absolute top-full left-0 mt-1 z-30 p-2.5 bg-[var(--tipbg)] border border-[var(--ln)] rounded-xl shadow-xl w-48 space-y-1.5 backdrop-blur-md">
                                  {(cfg.equipes || []).length === 0 ? (
                                    <span className="text-xs text-[var(--mu)] block">
                                      Nenhuma equipe cadastrada.
                                    </span>
                                  ) : (
                                    cfg.equipes.map((q: any) => {
                                      const checked = (row.eq || []).includes(q.id);
                                      return (
                                        <label
                                          key={q.id}
                                          className="flex items-center gap-2 text-xs text-[var(--tx)] cursor-pointer hover:bg-white/5 p-1 rounded"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              handleToggleEquipe(currentOse!, originalIndex, q.id)
                                            }
                                            className="rounded"
                                          />
                                          <span>{q.nome}</span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              </details>
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
                                className="text-[var(--mu)] hover:text-red-400 p-1 transition-colors"
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
                                  className="text-[var(--mu)] hover:text-red-400 p-1"
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
              className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5"
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
                            className="text-[var(--mu)] hover:text-red-400 p-1"
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
    </div>
  );
};
