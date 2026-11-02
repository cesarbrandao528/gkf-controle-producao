import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  calcOSE,
  bm,
  inP,
  fmt,
  pn,
  pf,
  dbr,
  hoje,
  uid,
  slug,
} from '../engine/calc';
import { Plus, Trash2, ChevronDown, Save } from 'lucide-react';
import { Config, FrenteLancamentos, OSE, OSERow, PrecoItem } from '../types';

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
    saveAll,
  } = useData() as any;

  const [newOseName, setNewOseName] = useState('');
  const [newOseType, setNewOseType] = useState('ESC');

  // Form for avulsos
  const [avData, setAvData] = useState(hoje());
  const [avCodeInput, setAvCodeInput] = useState('');
  const [avQtd, setAvQtd] = useState('');
  const [avOid, setAvOid] = useState('');

  if (!cfg) return null;

  const f = cfg.frentes.find((x: any) => x.id === frenteId);
  const fLanc: FrenteLancamentos = ln[frenteId] || { itens: [], oses: [] };
  const oses: OSE[] = fLanc.oses || [];
  const contrato = cfg.contratos.find((c: any) => c.id === f?.contrato);

  let currentOse = oses.find((x) => x.id === oseId);
  if (!currentOse && oseId !== '__av') {
    currentOse = oses[0];
  }

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
    setOseId(newO.id);
    setNewOseName('');
    toast(`OSE "${newO.nome}" criada com sucesso ✓`);
  };

  const handleDeleteOSE = (o: OSE) => {
    if (!confirm(`Excluir a OSE "${o.nome}" e todos os seus trechos?`)) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      oses: (prev.oses || []).filter((x: OSE) => x.id !== o.id),
      itens: (prev.itens || []).filter((x: any) => x.oid !== o.id),
    }));
    setOseId('__av');
    toast(`OSE "${o.nome}" excluída.`);
  };

  const handleAddTrechoRow = (o: OSE) => {
    const lastRow = o.rows[o.rows.length - 1];
    const newRow: OSERow = {
      d: lastRow ? lastRow.d : hoje(),
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

  const handleDeleteTrechoRow = (o: OSE, index: number) => {
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const updatedOses = (prev.oses || []).map((x: OSE) => {
        if (x.id === o.id) {
          const nextRows = [...x.rows];
          nextRows.splice(index, 1);
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
          if (fieldKey === 'd') {
            nextRows.sort((a: OSERow, b: OSERow) => (a.d || '9999').localeCompare(b.d || '9999'));
          }
          return { ...x, rows: nextRows };
        }
        return x;
      });
      return { ...prev, oses: updatedOses };
    });
  };

  const handleToggleEquipe = (o: OSE, rowIndex: number, equipeId: string) => {
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

  // Add Avulso
  const handleAddAvulso = () => {
    const code = avCodeInput.split(' ')[0].trim();
    const q = pn(avQtd);
    if (!avData || !prm[code] || !(q > 0)) {
      toast('Informe uma data, selecione um serviço válido da lista e quantidade > 0.');
      return;
    }
    const targetOid = currentOse ? currentOse.id : avOid;
    const linkedO = oses.find((x) => x.id === targetOid);

    const newItem = {
      i: uid(),
      d: avData,
      os: linkedO ? linkedO.nome : '',
      oid: linkedO ? linkedO.id : undefined,
      c: code,
      q,
    };

    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: [...(prev.itens || []), newItem],
    }));

    setAvQtd('');
    setAvCodeInput('');
    toast('Serviço avulso lançado ✓');
  };

  const handleDeleteAvulso = (itemId: string) => {
    if (!confirm('Excluir este lançamento avulso?')) return;
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: (prev.itens || []).filter((x: any) => x.i !== itemId),
    }));
    toast('Lançamento avulso excluído.');
  };

  const handleUpdateAvulsoQtd = (itemId: string, newQtdStr: string) => {
    const q = pn(newQtdStr);
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      itens: (prev.itens || []).map((x: any) => (x.i === itemId ? { ...x, q } : x)),
    }));
  };

  // Calculations for current frente
  const bmValor = bm(frenteId, cfg, ln, prm, tpl);
  const canteiroValor = bmValor * cfg.k;
  const execPeriodoValor = bmValor * (1 + cfg.k);

  // Template and calculation for selected OSE
  const tp = currentOse ? tpl[currentOse.tipo] : null;
  const oseCalc = currentOse ? calcOSE(currentOse, frenteId, cfg, prm, tpl) : null;

  // Filter avulsos for this view
  const avulsosList = currentOse
    ? (fLanc.itens || []).filter((x: any) => x.oid === currentOse!.id)
    : fLanc.itens || [];

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

        {/* OSE Selector */}
        <label className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
          OSE / Tipo de Lançamento
          <select
            value={currentOse ? currentOse.id : '__av'}
            onChange={(e) => setOseId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] font-semibold text-sm cursor-pointer"
          >
            {oses.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome} ({tpl[o.tipo]?.nome || o.tipo})
              </option>
            ))}
            <option value="__av">Serviços avulsos (por código CASAN)</option>
          </select>
        </label>

        {/* Create New OSE */}
        <div className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
          Nova OSE
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              placeholder="ex: OSE 01 Rua X"
              value={newOseName}
              onChange={(e) => setNewOseName(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-sm w-44 min-w-[140px]"
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

        <div className="flex items-center gap-2 ml-auto">
          {/* Delete OSE button */}
          {currentOse && (
            <button
              type="button"
              onClick={() => handleDeleteOSE(currentOse!)}
              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir OSE
            </button>
          )}

          {/* Save to Cloud button */}
          <button
            type="button"
            onClick={saveAll}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            title="Salvar alterações e sincronizar com o banco na nuvem (Firestore)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar na Nuvem</span>
          </button>
        </div>
      </div>

      {/* KPI Cards for the Frente */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="gkf-kpi">
          <span>Medição do período da frente (BM)</span>
          <b>R$ {fmt(bmValor)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Canteiro / adm. local (proporcional {((cfg.k || 0) * 100).toFixed(2)}%)</span>
          <b>R$ {fmt(canteiroValor)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Executado no período ({f?.nome || ''})</span>
          <b>R$ {fmt(execPeriodoValor)}</b>
        </div>
      </div>

      {/* OSE Trechos Section */}
      {currentOse && tp ? (
        <div className="space-y-4">
          <div className="gkf-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ln)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--tx)]">
                  Trechos executados: {currentOse.nome}
                </h3>
                <p className="text-xs text-[var(--mu)]">
                  Modelo: <span className="font-semibold">{tp.nome}</span> · Os serviços CASAN são calculados automaticamente por trecho.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateEquipe}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] hover:border-[var(--cy)]"
                >
                  + Nova equipe
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTrechoRow(currentOse!)}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar trecho
                </button>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {currentOse.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tp.entradas.length + 3}
                        className="text-center py-6 text-[var(--mu)]"
                      >
                        Nenhum trecho lançado para esta OSE. Clique em "Adicionar trecho" acima.
                      </td>
                    </tr>
                  ) : (
                    currentOse.rows.map((row: OSERow, rIdx: number) => {
                      const isInPeriod = inP(row.d, cfg, frenteId);
                      const assignedEqNomes = (row.eq || [])
                        .map((qId: string) => (cfg.equipes || []).find((q: any) => q.id === qId)?.nome)
                        .filter(Boolean);

                      return (
                        <tr
                          key={rIdx}
                          className={!isInPeriod ? 'opacity-40 bg-black/20' : ''}
                        >
                          {/* Date */}
                          <td style={{ width: '125px' }}>
                            <input
                              type="date"
                              value={row.d || ''}
                              onChange={(e) =>
                                handleUpdateTrechoField(
                                  currentOse!,
                                  rIdx,
                                  'd',
                                  e.target.value
                                )
                              }
                              className="w-full text-xs"
                            />
                          </td>

                          {/* Equipes Dropdown */}
                          <td style={{ minWidth: '135px' }}>
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
                                            handleToggleEquipe(currentOse!, rIdx, q.id)
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
                          </td>

                          {/* Dynamic Inputs from Template */}
                          {tp.entradas.map((e: any) => {
                            const val = row.v?.[e.k] ?? '';

                            if (e.t === 'p') {
                              return (
                                <td key={e.k} style={{ minWidth: '135px' }}>
                                  <select
                                    value={val || 's.pav'}
                                    onChange={(ev) =>
                                      handleUpdateTrechoField(
                                        currentOse!,
                                        rIdx,
                                        e.k,
                                        ev.target.value
                                      )
                                    }
                                    className="w-full text-xs py-1 px-2 rounded-lg border border-[var(--ln)] bg-[rgba(var(--w),0.06)] text-[var(--tx)] font-medium"
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
                                  value={val}
                                  placeholder={e.t === 'n' ? '0,00' : ''}
                                  onChange={(ev) =>
                                    handleUpdateTrechoField(
                                      currentOse!,
                                      rIdx,
                                      e.k,
                                      ev.target.value
                                    )
                                  }
                                  className={`text-xs ${
                                    e.t === 'n' ? 'text-right font-medium' : ''
                                  }`}
                                  style={{ width: e.t === 'n' ? '78px' : '95px' }}
                                />
                              </td>
                            );
                          })}

                          {/* Delete Row */}
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteTrechoRow(currentOse!, rIdx)}
                              aria-label="Excluir trecho"
                              className="text-[var(--mu)] hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--mu)] italic">
              * Linhas esmaecidas estão fora do período de medição da frente e não somam no executado.
            </p>
          </div>

          {/* Quantidades e Ajustes da OSE */}
          {oseCalc && oseCalc.itens.length > 0 && (
            <div className="gkf-card space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--tx)]">
                    Memória de Cálculo da OSE (Quantidades e Serviços CASAN)
                  </h3>
                  <p className="text-xs text-[var(--mu)]">
                    Valores apurados pelas fórmulas do modelo. Digite em "Ajuste (%)" ou "Ajuste Qtd" para fixar quantitativo diferente.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[var(--mu)] block">Subtotal desta OSE:</span>
                  <span className="text-base font-extrabold text-[var(--cy)]">
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
                      value={currentOse.dmtPo ?? 5}
                      onChange={(e) => handleUpdateDmt(currentOse, 'dmtPo', e.target.value)}
                      className="w-16 px-2 py-0.5 rounded border border-[var(--ln)] bg-black/30 text-right font-bold text-[var(--cy)]"
                    />
                    <span className="text-[11px] text-[var(--mu)]">(multiplica item 40607)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[var(--tx)]">
                    <span className="text-[var(--mu)]">DMT Solo / Bota-fora (km):</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={currentOse.dmtSolo ?? 5}
                      onChange={(e) => handleUpdateDmt(currentOse, 'dmtSolo', e.target.value)}
                      className="w-16 px-2 py-0.5 rounded border border-[var(--ln)] bg-black/30 text-right font-bold text-[var(--cy)]"
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
                      <th className="text-xs">Und.</th>
                      <th className="text-right text-xs">Unitário R$</th>
                      <th className="text-right text-xs">Qtd. Trechos</th>
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
                        <td className="text-xs text-[var(--mu)]">{it.u}</td>
                        <td className="text-right text-xs">{fmt(it.p)}</td>
                        <td className="text-right text-xs text-[var(--mu)]">
                          {fmt(it.q)}
                        </td>
                        {/* Ajuste em porcentagem (%) */}
                        <td className="text-right">
                          <input
                            type="text"
                            placeholder="0%"
                            value={it.ajPct !== undefined ? `${it.ajPct}%` : ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace('%', '').trim();
                              handleUpdateAjustePct(currentOse!, it.c, clean);
                            }}
                            className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/25 w-16"
                          />
                        </td>
                        {/* Ajuste em quantidade manual */}
                        <td className="text-right">
                          <input
                            type="text"
                            placeholder="auto"
                            value={it.ajVal !== undefined ? fmt(it.ajVal) : ''}
                            onChange={(e) =>
                              handleUpdateAjuste(currentOse!, it.c, e.target.value)
                            }
                            className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/25 w-20"
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
                      <td colSpan={8} className="text-right font-bold text-xs">
                        Total desta OSE no período:
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
          Para lançar por trecho, crie uma OSE (Escavado, MND ou Reposição) na barra superior ou selecione uma existente.
        </div>
      )}

      {/* Serviços Avulsos Section */}
      <div className="gkf-card space-y-4">
        <div>
          <h3 className="text-base font-bold text-[var(--tx)]">
            {currentOse
              ? `Serviços avulsos desta OSE (${currentOse.nome})`
              : 'Serviços avulsos (Geral da Frente)'}
          </h3>
          <p className="text-xs text-[var(--mu)]">
            Lance serviços complementares que não saem diretamente dos trechos. Eles entram no BM CASAN em coluna própria.
          </p>
        </div>

        {/* Form to Add Avulso */}
        <div className="flex flex-wrap items-end gap-2.5 p-3 rounded-xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)]">
          <label className="flex flex-col gap-1 text-xs text-[var(--mu)]">
            Data
            <input
              type="date"
              value={avData}
              onChange={(e) => setAvData(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
            />
          </label>

          {!currentOse && (
            <label className="flex flex-col gap-1 text-xs text-[var(--mu)]">
              Vincular a OSE
              <select
                value={avOid}
                onChange={(e) => setAvOid(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs cursor-pointer"
              >
                <option value="">— avulso geral (sem OSE) —</option>
                {oses.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({tpl[o.tipo]?.nome || o.tipo})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] flex-1 min-w-[280px]">
            Serviço CASAN (código ou descrição)
            <input
              type="text"
              list="dl-precos"
              placeholder="Digite o código (ex: 20201) ou nome do serviço..."
              value={avCodeInput}
              onChange={(e) => setAvCodeInput(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs w-full"
            />
            <datalist id="dl-precos">
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
              value={avQtd}
              onChange={(e) => setAvQtd(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs text-right font-medium"
            />
          </label>

          <button
            type="button"
            onClick={handleAddAvulso}
            className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>

        {/* Avulsos Table */}
        <div className="gkf-table-wrap">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>OSE</th>
                <th>Código</th>
                <th>Serviço</th>
                <th>Und.</th>
                <th className="text-right">Quantidade</th>
                <th className="text-right">Unitário R$</th>
                <th className="text-right">Valor R$</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {avulsosList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-5 text-[var(--mu)] text-xs">
                    Nenhum serviço avulso lançado.
                  </td>
                </tr>
              ) : (
                avulsosList.map((item: any) => {
                  const p = prm[item.c] || { d: 'Item ' + item.c, u: 'un', p: 0 };
                  const isInPeriod = inP(item.d, cfg, frenteId);
                  const o = oses.find((y) => y.id === item.oid);
                  const oseNome = o ? o.nome : item.os || '— avulso geral —';
                  const valor = item.q * (p.p || 0);

                  return (
                    <tr
                      key={item.i}
                      className={!isInPeriod ? 'opacity-40 bg-black/20' : ''}
                    >
                      <td className="text-xs">{dbr(item.d)}</td>
                      <td className="text-xs font-medium text-[var(--tx)]">{oseNome}</td>
                      <td className="text-xs font-bold">{item.c}</td>
                      <td className="text-xs max-w-xs truncate">{p.d}</td>
                      <td className="text-xs text-[var(--mu)]">{p.u}</td>
                      <td className="text-right" style={{ width: '100px' }}>
                        <input
                          type="text"
                          value={fmt(item.q)}
                          onChange={(e) => handleUpdateAvulsoQtd(item.i, e.target.value)}
                          className="text-right text-xs border border-[var(--ln)] rounded px-1.5 py-0.5 bg-black/20"
                        />
                      </td>
                      <td className="text-right text-xs">{fmt(p.p)}</td>
                      <td className="text-right text-xs font-bold text-[var(--cy)]">
                        {fmt(valor)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAvulso(item.i)}
                          aria-label="Excluir avulso"
                          className="text-[var(--mu)] hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
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
