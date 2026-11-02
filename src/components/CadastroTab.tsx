import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  ordC,
  filtC,
  fmt,
  pn,
  dbr,
  hoje,
  uid,
  slug,
  buildDash,
  dashRows,
} from '../engine/calc';
import { Plus, Trash2, X, Search, FileDown } from 'lucide-react';
import { Config, Contrato, Frente } from '../types';

export const CadastroTab: React.FC = () => {
  const {
    cfg,
    ln,
    prm,
    tpl,
    dasht,
    filt,
    setFilt,
    updateConfig,
    updateFrenteLancamento,
    toast,
  } = useData() as any;

  // New contract form fields
  const [num, setNum] = useState('');
  const [obraFrente, setObraFrente] = useState('');
  const [polo, setPolo] = useState('Rio do Sul');
  const [di, setDi] = useState('');
  const [df, setDf] = useState('');
  const [valor, setValor] = useState('');

  if (!cfg) return null;

  const sortedContratos = ordC(cfg.contratos);
  const filteredContratos = filtC(sortedContratos, filt, cfg);

  // Helper to ensure frente exists
  const garantirFrente = (nome: string) => {
    const id = slug(nome);
    const existing = cfg.frentes.find((x: any) => x.id === id);
    if (!existing) {
      const novaF = {
        id,
        nome,
        contrato: '',
        oses: [],
      };
      updateConfig((prev: Config) => ({
        ...prev,
        frentes: [...prev.frentes, novaF],
      }));
      updateFrenteLancamento(id, () => ({ itens: [] }));
      return novaF;
    }
    return existing;
  };

  const handleCreateContrato = () => {
    if (!num.trim()) {
      toast('Informe o número do contrato (ex: 4350/2026).');
      return;
    }

    let linkedFrenteId = '';
    const fn = obraFrente.trim();
    if (fn) {
      const f = garantirFrente(fn);
      linkedFrenteId = f.id;
    }

    const newId = 'c' + uid();
    const newC: Contrato = {
      id: newId,
      n: num.trim(),
      obra: fn,
      p: polo.trim(),
      di: di || null,
      df: df || null,
      L: pn(valor),
      O: 0,
      P: 0,
      nl: 0,
    };

    updateConfig((prev: Config) => {
      const updatedFrentes = prev.frentes.map((f: Frente) => {
        if (f.id === linkedFrenteId) {
          return { ...f, contrato: newId };
        }
        return f;
      });
      return {
        ...prev,
        frentes: updatedFrentes,
        contratos: [...prev.contratos, newC],
      };
    });

    setNum('');
    setObraFrente('');
    setDi('');
    setDf('');
    setValor('');
    toast('Contrato cadastrado com sucesso ✓');
  };

  const handleDeleteContrato = (c: Contrato) => {
    if (
      !confirm(
        `Excluir o contrato ${c.n || '(sem número)'}? As frentes vinculadas ficarão sem contrato.`
      )
    ) {
      return;
    }

    updateConfig((prev: Config) => ({
      ...prev,
      frentes: prev.frentes.map((f: Frente) => (f.contrato === c.id ? { ...f, contrato: '' } : f)),
      contratos: prev.contratos.filter((x: Contrato) => x.id !== c.id),
    }));
    toast('Contrato excluído.');
  };

  const handleUpdateContratoField = (cId: string, fieldKey: string, val: any) => {
    updateConfig((prev: Config) => ({
      ...prev,
      contratos: prev.contratos.map((c: Contrato) => {
        if (c.id === cId) {
          const isNum = ['L', 'P', 'O', 'nl'].includes(fieldKey);
          return {
            ...c,
            [fieldKey]: isNum ? pn(val) : val || (fieldKey === 'di' || fieldKey === 'df' ? null : ''),
          };
        }
        return c;
      }),
    }));
  };

  const handleUnlinkFrente = (frenteIdToUnlink: string) => {
    updateConfig((prev: Config) => ({
      ...prev,
      frentes: prev.frentes.map((f: Frente) => (f.id === frenteIdToUnlink ? { ...f, contrato: '' } : f)),
    }));
  };

  const handleAssignFrente = (cId: string, frenteVal: string) => {
    if (!frenteVal) return;
    if (frenteVal === '__nova') {
      const nome = prompt('Nome da frente (município):')?.trim();
      if (!nome) return;
      const f = garantirFrente(nome);
      updateConfig((prev: Config) => ({
        ...prev,
        frentes: prev.frentes.map((x: Frente) => (x.id === f.id ? { ...x, contrato: cId } : x)),
        contratos: prev.contratos.map((c: Contrato) => (c.id === cId ? { ...c, obra: f.nome } : c)),
      }));
    } else {
      const f = cfg.frentes.find((x: any) => x.id === frenteVal);
      if (f) {
        updateConfig((prev: Config) => ({
          ...prev,
          frentes: prev.frentes.map((x: Frente) => (x.id === f.id ? { ...x, contrato: cId } : x)),
          contratos: prev.contratos.map((c: Contrato) => (c.id === cId ? { ...c, obra: f.nome } : c)),
        }));
      }
    }
  };

  const handleExportDashboardHtml = () => {
    if (!dasht) {
      toast('Modelo de dashboard não encontrado.');
      return;
    }
    const rows = dashRows(cfg, ln, prm, tpl);
    const html = buildDash(dasht, rows, hoje());
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dashboard_Contratos_${hoje()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Arquivo Dashboard_Contratos.html baixado ✓');
  };

  const renderSituacaoBadge = (c: Contrato) => {
    if (c.bx) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-500/20 text-gray-400">
          Finalizado em {dbr(c.bx)}
        </span>
      );
    }
    if (!c.df) {
      return <span className="text-xs text-[var(--mu)] italic">sem data final</span>;
    }
    const d = Math.floor(
      (new Date(c.df + 'T00:00:00').getTime() - new Date(hoje() + 'T00:00:00').getTime()) / 864e5
    );
    if (d < 0) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-950/60 text-red-300 border border-red-500/30">
          Vencido há {-d} dias
        </span>
      );
    }
    if (d < 60) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
          {d} dias · alta prioridade
        </span>
      );
    }
    if (d < 90) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-950/40 text-blue-300 border border-blue-500/20">
          {d} dias · renovar
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-[var(--mu)]">
        {d} dias · vigente
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Novo Contrato Card */}
      <div className="gkf-card space-y-3">
        <h3 className="text-base font-bold text-[var(--tx)]">Novo Contrato CASAN</h3>
        <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)]">
          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-32">
            Número
            <input
              type="text"
              placeholder="ex: 4350/2026"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs font-semibold"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] flex-1 min-w-[200px]">
            Obra / Frente (município)
            <input
              type="text"
              list="dl-frentes"
              placeholder="ex: Rio do Sul, Apiúna..."
              value={obraFrente}
              onChange={(e) => setObraFrente(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
            />
            <datalist id="dl-frentes">
              {[...(cfg.frentes || [])]
                .sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
                .map((x: any) => (
                  <option key={x.id} value={x.nome} />
                ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-32">
            Polo
            <input
              type="text"
              value={polo}
              onChange={(e) => setPolo(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-36">
            Data início
            <input
              type="date"
              value={di}
              onChange={(e) => setDi(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-36">
            Data final
            <input
              type="date"
              value={df}
              onChange={(e) => setDf(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-36">
            Valor licitado (R$)
            <input
              type="text"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs text-right font-medium"
            />
          </label>

          <button
            type="button"
            onClick={handleCreateContrato}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar contrato
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="gkf-card flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--mu)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por número, obra, polo..."
              value={filt.q}
              onChange={(e) => setFilt((prev: any) => ({ ...prev, q: e.target.value }))}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs w-64 focus:outline-none focus:border-[var(--cy)]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--mu)] font-medium">
            Situação:
            <select
              value={filt.s}
              onChange={(e) => setFilt((prev: any) => ({ ...prev, s: e.target.value }))}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs cursor-pointer"
            >
              <option value="">Todas</option>
              <option value="vig">Vigentes</option>
              <option value="renov">A renovar (menos de 90 dias)</option>
              <option value="venc">Vencidos</option>
              <option value="fin">Finalizados</option>
              <option value="ag">Aguardando</option>
              <option value="sd">Sem data final</option>
            </select>
          </label>

          {(filt.q || filt.s) && (
            <button
              type="button"
              onClick={() => setFilt({ q: '', s: '' })}
              className="px-2.5 py-1 text-xs text-[var(--mu)] hover:text-[var(--tx)] rounded-lg border border-[var(--ln)]"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <span className="text-xs text-[var(--mu)]">
          {filteredContratos.length} de {cfg.contratos.length} contratos
        </span>
      </div>

      {/* Contracts Table */}
      <div className="gkf-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--tx)]">Contratos Cadastrados</h3>
          <button
            type="button"
            onClick={handleExportDashboardHtml}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-[var(--cy)] flex items-center gap-1.5 text-[var(--tx)]"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-400" />
            Salvar cópia do dashboard (HTML)
          </button>
        </div>

        <div className="gkf-table-wrap">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Obra / Frentes Vinculadas</th>
                <th>Polo</th>
                <th>Data início</th>
                <th>Data final</th>
                <th className="text-right">Valor Contratado (L)</th>
                <th className="text-right">Acum. Anterior (P)</th>
                <th>Situação</th>
                <th className="text-center">Finalizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredContratos.map((c) => {
                const assignedFrentes = cfg.frentes.filter((f: Frente) => f.contrato === c.id);
                const unassignedFrentes = cfg.frentes
                  .filter((f: Frente) => f.contrato !== c.id)
                  .sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

                return (
                  <tr key={c.id}>
                    {/* Número */}
                    <td style={{ width: '120px' }}>
                      <input
                        type="text"
                        value={c.n || ''}
                        onChange={(e) => handleUpdateContratoField(c.id, 'n', e.target.value)}
                        className="font-bold text-xs"
                      />
                    </td>

                    {/* Obra / Frentes */}
                    <td style={{ minWidth: '220px' }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {assignedFrentes.map((f: Frente) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20"
                          >
                            {f.nome}
                            <button
                              type="button"
                              onClick={() => handleUnlinkFrente(f.id)}
                              title="Desvincular frente"
                              className="text-blue-300/70 hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {assignedFrentes.length === 0 && c.obra && (
                          <span className="text-xs text-[var(--mu)]">{c.obra} (sem frente)</span>
                        )}
                        <select
                          value=""
                          onChange={(e) => handleAssignFrente(c.id, e.target.value)}
                          className="text-xs py-0.5 px-1.5 bg-transparent border border-dashed border-[var(--ln)] hover:border-[var(--cy)] rounded cursor-pointer text-[var(--mu)]"
                        >
                          <option value="">+ vincular frente…</option>
                          {unassignedFrentes.map((f: Frente) => (
                            <option key={f.id} value={f.id}>
                              {f.nome} {f.contrato ? '(em outro contrato)' : ''}
                            </option>
                          ))}
                          <option value="__nova">➕ Nova frente…</option>
                        </select>
                      </div>
                    </td>

                    {/* Polo */}
                    <td style={{ width: '110px' }}>
                      <input
                        type="text"
                        value={c.p || ''}
                        onChange={(e) => handleUpdateContratoField(c.id, 'p', e.target.value)}
                        className="text-xs"
                      />
                    </td>

                    {/* Data início */}
                    <td style={{ width: '130px' }}>
                      <input
                        type="date"
                        value={c.di || ''}
                        onChange={(e) => handleUpdateContratoField(c.id, 'di', e.target.value)}
                        className="text-xs"
                      />
                    </td>

                    {/* Data final */}
                    <td style={{ width: '130px' }}>
                      <input
                        type="date"
                        value={c.df || ''}
                        onChange={(e) => handleUpdateContratoField(c.id, 'df', e.target.value)}
                        className="text-xs"
                      />
                    </td>

                    {/* Valor Contratado (L) */}
                    <td className="text-right" style={{ width: '130px' }}>
                      <input
                        type="text"
                        value={fmt(c.L)}
                        onChange={(e) => handleUpdateContratoField(c.id, 'L', e.target.value)}
                        className="text-right text-xs font-semibold"
                      />
                    </td>

                    {/* Acumulado Anterior (P) */}
                    <td className="text-right" style={{ width: '130px' }}>
                      <input
                        type="text"
                        value={fmt(c.P)}
                        onChange={(e) => handleUpdateContratoField(c.id, 'P', e.target.value)}
                        className="text-right text-xs font-medium"
                      />
                    </td>

                    {/* Situação */}
                    <td>{renderSituacaoBadge(c)}</td>

                    {/* Finalizado checkbox */}
                    <td className="text-center" style={{ width: '70px' }}>
                      <input
                        type="checkbox"
                        checked={!!c.bx}
                        onChange={(e) =>
                          handleUpdateContratoField(c.id, 'bx', e.target.checked ? hoje() : null)
                        }
                        className="rounded cursor-pointer"
                        title={c.bx ? `Finalizado em ${dbr(c.bx)}` : 'Marcar como finalizado'}
                      />
                    </td>

                    {/* Delete */}
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteContrato(c)}
                        title="Excluir contrato"
                        className="text-[var(--mu)] hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
