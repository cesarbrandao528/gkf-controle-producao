import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  snapAtual,
  somaCols,
  valorQ,
  fmt,
  dbr,
  pn,
  addD,
  addM,
  fechTot,
  remL,
  remDe,
  calc,
  ordC,
  uid,
  hoje,
} from '../engine/calc';
import { Download, CheckCircle, RefreshCcw, ArrowRightLeft, Trash2, Calendar } from 'lucide-react';
import { Config, Contrato, Fechamento, Frente, FrenteLancamentos, Remanejamento } from '../types';

export const MedicaoTab: React.FC = () => {
  const {
    cfg,
    ln,
    prm,
    tpl,
    frenteId,
    setFrenteId,
    updateConfig,
    updateFrenteLancamento,
    downloadBMFile,
    toast,
  } = useData() as any;

  // Remanejamento form state
  const [remOrigem, setRemOrigem] = useState('');
  const [remDestino, setRemDestino] = useState('');
  const [remValor, setRemValor] = useState('');
  const [remObs, setRemObs] = useState('');

  if (!cfg) return null;

  const f = cfg.frentes.find((x: any) => x.id === frenteId);
  if (!f) return null;

  const fLanc: FrenteLancamentos = ln[frenteId] || { itens: [], oses: [], fech: [] };
  const F: Fechamento[] = (fLanc.fech || []).slice().sort((a: Fechamento, b: Fechamento) => a.n - b.n);

  const sn = snapAtual(frenteId, cfg, ln, prm, tpl);
  const qAtual = somaCols(sn.cols);
  const antAtual = somaCols(F.flatMap((x: Fechamento) => x.cols));
  const vp = valorQ(qAtual, prm);
  const va = valorQ(antAtual, prm);
  const k = cfg.k || 0;

  const allCodes = Array.from(new Set([...Object.keys(qAtual), ...Object.keys(antAtual)])).sort();

  // Fechar Medição
  const handleFecharMedicao = async () => {
    if (!sn.cols.length) {
      toast('Não há produção no período para fechar.');
      return;
    }
    if (F.some((x: Fechamento) => x.ini === sn.ini && x.fim === sn.fim)) {
      toast('Já existe uma medição fechada para este período.');
      return;
    }
    if (
      !confirm(
        `Fechar a medição nº ${sn.n} de ${sn.mun} (${dbr(sn.ini)} a ${dbr(sn.fim)})?\nOs ajustes de quantidade das OSE serão zerados para o próximo período.`
      )
    ) {
      return;
    }

    const novoFech: Fechamento = {
      ...sn,
      em: new Date().toISOString(),
      st: 'pend' as const,
    };

    const nextF = [...F, novoFech];

    // Reset OSE manual adjustments
    const nextOses = (fLanc.oses || []).map((o: any) => ({ ...o, aj: {} }));

    // Advance period by 1 month
    const ni = addD(sn.fim, 1);
    const novoFim = addD(addM(ni, 1), -1);

    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      oses: nextOses,
      fech: nextF,
    }));

    updateConfig((prev: Config) => ({
      ...prev,
      frentes: prev.frentes.map((fr: Frente) =>
        fr.id === frenteId ? { ...fr, periodo: { ini: ni, fim: novoFim } } : fr
      ),
    }));

    // Generate Excel for the closed BM
    await downloadBMFile(frenteId, novoFech);
    toast(`Medição nº ${sn.n} fechada! Novo período: ${dbr(ni)} a ${dbr(novoFim)}.`);
  };

  // Toggle status of closed BM
  const handleToggleMedido = (fechN: number) => {
    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => {
      const nextFech = (prev.fech || []).map((x: Fechamento) => {
        if (x.n === fechN) {
          const nextSt = x.st === 'med' ? 'pend' : 'med';
          return {
            ...x,
            st: nextSt,
            aprov: nextSt === 'med' ? hoje() : null,
          };
        }
        return x;
      });
      return { ...prev, fech: nextFech };
    });
  };

  // Reopen last closed BM
  const handleReabrir = () => {
    const last = F[F.length - 1];
    if (!last) return;
    if (
      !confirm(
        `Reabrir a medição nº ${last.n}? Ela volta a ser produção do período ${dbr(last.ini)} a ${dbr(last.fim)} e deixa de contar como medição fechada.`
      )
    ) {
      return;
    }

    const nextFech = F.slice(0, -1);

    // Restore adjustments if any
    const nextOses = (fLanc.oses || []).map((o: any) => {
      const col = last.cols.find((y: any) => y.nome === o.nome && y.os);
      return col && col.os ? { ...o, aj: { ...(col.os.aj || {}) } } : o;
    });

    updateFrenteLancamento(frenteId, (prev: FrenteLancamentos) => ({
      ...prev,
      oses: nextOses,
      fech: nextFech,
    }));

    updateConfig((prev: Config) => ({
      ...prev,
      frentes: prev.frentes.map((fr: Frente) =>
        fr.id === frenteId ? { ...fr, periodo: { ini: last.ini, fim: last.fim } } : fr
      ),
    }));

    toast(`Medição nº ${last.n} reaberta ✓`);
  };

  // Remanejamento actions
  const contratosList = ordC(cfg.contratos);
  const retidoDisponivel = (c: Contrato) => Math.max(0, calc(c, cfg, ln, prm, tpl).Q - remDe(c, cfg));

  const handleRemanejar = () => {
    if (!remOrigem || !remDestino || remOrigem === remDestino) {
      toast('Escolha contratos de origem e destino diferentes.');
      return;
    }
    const cOrigem = cfg.contratos.find((c: any) => c.id === remOrigem);
    if (!cOrigem) return;

    const Q = retidoDisponivel(cOrigem);
    if (!(Q > 0.005)) {
      toast('O contrato de origem não tem saldo retido disponível para remanejar.');
      return;
    }

    let v = pn(remValor);
    if (!(v > 0)) v = Q;
    if (v > Q + 0.005) {
      toast(`O valor excede o saldo retido disponível do contrato de origem (R$ ${fmt(Q)}).`);
      return;
    }

    const novoRem: Remanejamento = {
      id: 'rem' + uid(),
      de: remOrigem,
      para: remDestino,
      valor: Math.round(v * 100) / 100,
      data: hoje(),
      st: 'pend' as const,
      obs: remObs.trim(),
    };

    updateConfig((prev: Config) => ({
      ...prev,
      rem: [...(prev.rem || []), novoRem],
    }));

    setRemValor('');
    setRemObs('');
    toast('Saldo retido remanejado com sucesso ✓');
  };

  const handleToggleRemStatus = (remId: string) => {
    updateConfig((prev: Config) => ({
      ...prev,
      rem: (prev.rem || []).map((r: Remanejamento) => {
        if (r.id === remId) {
          const nextSt = r.st === 'med' ? 'pend' : 'med';
          return {
            ...r,
            st: nextSt,
            dmed: nextSt === 'med' ? hoje() : undefined,
          };
        }
        return r;
      }),
    }));
  };

  const handleDeleteRem = (remId: string) => {
    if (!confirm('Excluir este remanejamento de saldo retido?')) return;
    updateConfig((prev: Config) => ({
      ...prev,
      rem: (prev.rem || []).filter((r: Remanejamento) => r.id !== remId),
    }));
  };

  return (
    <div className="space-y-5">
      {/* Frente & Actions Bar */}
      <div className="gkf-card flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
            Frente (município)
            <select
              value={frenteId}
              onChange={(e) => setFrenteId(e.target.value)}
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

          <div className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
            Contrato Vinculado
            <span className="py-1 text-sm font-bold text-[var(--tx)]">
              {sn.ct || '— sem contrato vinculado —'}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-xs text-[var(--mu)] font-medium">
            Período Atual da Frente
            <span className="py-1 text-sm font-semibold text-[var(--tx)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {dbr(sn.ini)} a {dbr(sn.fim)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadBMFile(frenteId, sn)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Baixar BM nº {sn.n} (Excel CASAN)
          </button>
          <button
            type="button"
            onClick={handleFecharMedicao}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(var(--w),0.08)] border border-[var(--ln)] text-[var(--tx)] hover:border-[var(--cy)] flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Fechar medição nº {sn.n}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="gkf-kpi">
          <span>Serviços do período</span>
          <b>R$ {fmt(vp)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Canteiro / adm. local ({(k * 100).toFixed(2)}%)</span>
          <b>R$ {fmt(vp * k)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Total do período ({sn.n}ª medição)</span>
          <b>R$ {fmt(vp * (1 + k))}</b>
        </div>
        <div className="gkf-kpi">
          <span>Acumulado após esta medição</span>
          <b>R$ {fmt((vp + va) * (1 + k))}</b>
        </div>
      </div>

      {/* Quantidades do Boletim Table */}
      <div className="gkf-card space-y-3">
        <div>
          <h3 className="text-base font-bold text-[var(--tx)]">
            Quantidades do Boletim de Medição (BM CASAN)
          </h3>
          <p className="text-xs text-[var(--mu)]">
            O BM usa o modelo oficial da CASAN (CAPA, Resumo $, Canteiro, BM e Resumo de quantidades).
            Cada OSE vira uma folha de memória de cálculo com as fórmulas do modelo ligada à planilha de quantidades.
          </p>
        </div>

        <div className="gkf-table-wrap">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Serviço CASAN</th>
                <th>Und.</th>
                <th className="text-right">Anterior</th>
                <th className="text-right">Período</th>
                <th className="text-right">Acumulado</th>
                <th className="text-right">Valor do Período R$</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[var(--mu)] text-xs">
                    Sem produção no período para esta frente de trabalho.
                  </td>
                </tr>
              ) : (
                allCodes.map((code) => {
                  const p = prm[code] || { d: 'Item ' + code, u: 'un', p: 0 };
                  const antQ = antAtual[code] || 0;
                  const perQ = qAtual[code] || 0;
                  const acumQ = antQ + perQ;
                  const valorPer = perQ * (p.p || 0);

                  return (
                    <tr key={code}>
                      <td className="font-bold text-xs">{code}</td>
                      <td className="text-xs max-w-md truncate">{p.d}</td>
                      <td className="text-xs text-[var(--mu)]">{p.u}</td>
                      <td className="text-right text-xs text-[var(--mu)]">
                        {fmt(antQ)}
                      </td>
                      <td className="text-right text-xs font-bold text-[var(--tx)]">
                        {fmt(perQ)}
                      </td>
                      <td className="text-right text-xs font-bold text-blue-400">
                        {fmt(acumQ)}
                      </td>
                      <td className="text-right text-xs font-extrabold text-[var(--cy)]">
                        {fmt(valorPer)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {allCodes.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="text-right font-bold text-xs">
                    Total dos Serviços no Período:
                  </td>
                  <td className="text-right text-sm font-extrabold text-[var(--cy)]">
                    R$ {fmt(vp)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Remanejamento de Saldo Retido Panel */}
      <div className="gkf-card space-y-4">
        <div>
          <h3 className="text-base font-bold text-[var(--tx)]">
            Remanejamento de Saldo Retido entre Contratos
          </h3>
          <p className="text-xs text-[var(--mu)]">
            Transfira saldo retido (quando o medido acumulado ultrapassa o limite licitado L) de um contrato para amortizar o saldo de outro.
          </p>
        </div>

        {/* Remanejamento Form */}
        <div className="flex flex-wrap items-end gap-2.5 p-3 rounded-xl bg-[rgba(var(--w),0.03)] border border-[var(--ln)]">
          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] flex-1 min-w-[200px]">
            Contrato de Origem (com saldo retido)
            <select
              value={remOrigem}
              onChange={(e) => setRemOrigem(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs cursor-pointer"
            >
              <option value="">Selecione a origem...</option>
              {contratosList.map((c: Contrato) => {
                const ret = retidoDisponivel(c);
                return (
                  <option key={c.id} value={c.id}>
                    {c.n} {c.obra ? `· ${c.obra}` : ''}
                    {ret > 0.005 ? ` — Saldo retido R$ ${fmt(ret)}` : ''}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] flex-1 min-w-[200px]">
            Contrato de Destino
            <select
              value={remDestino}
              onChange={(e) => setRemDestino(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs cursor-pointer"
            >
              <option value="">Selecione o destino...</option>
              {contratosList.map((c: Contrato) => (
                <option key={c.id} value={c.id}>
                  {c.n} {c.obra ? `· ${c.obra}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] w-32">
            Valor (R$)
            <input
              type="text"
              placeholder="Total disponível"
              value={remValor}
              onChange={(e) => setRemValor(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs text-right font-medium"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--mu)] flex-1 min-w-[180px]">
            Observação
            <input
              type="text"
              placeholder="Opcional..."
              value={remObs}
              onChange={(e) => setRemObs(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[rgba(var(--w),0.07)] border border-[var(--ln)] text-[var(--tx)] text-xs"
            />
          </label>

          <button
            type="button"
            onClick={handleRemanejar}
            className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--cy)] to-blue-600 text-white shadow-sm flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Remanejar
          </button>
        </div>

        {/* Remanejamento List */}
        <div className="gkf-table-wrap">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Destino</th>
                <th className="text-right">Valor R$</th>
                <th>Situação</th>
                <th>Observação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {remL(cfg).length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-[var(--mu)] text-xs">
                    Nenhum remanejamento registrado.
                  </td>
                </tr>
              ) : (
                remL(cfg).map((r: Remanejamento) => {
                  const de = cfg.contratos.find((c: Contrato) => c.id === r.de);
                  const pa = cfg.contratos.find((c: Contrato) => c.id === r.para);
                  const isMedido = r.st === 'med';

                  return (
                    <tr key={r.id}>
                      <td className="text-xs">{dbr(r.data)}</td>
                      <td className="text-xs font-medium">
                        {de ? `${de.n} · ${de.obra}` : '(excluído)'}
                      </td>
                      <td className="text-xs font-medium">
                        {pa ? `${pa.n} · ${pa.obra}` : '(excluído)'}
                      </td>
                      <td className="text-right text-xs font-bold text-[var(--cy)]">
                        {fmt(r.valor)}
                      </td>
                      <td className="text-xs">
                        {isMedido ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Medido
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold">
                            A medir no destino
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-[var(--mu)] max-w-xs truncate">
                        {r.obs || '—'}
                      </td>
                      <td className="text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleRemStatus(r.id)}
                          className="px-2 py-0.5 rounded text-xs bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-[var(--cy)]"
                        >
                          {isMedido ? 'Tornar pendente' : 'Marcar medido'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRem(r.id)}
                          className="text-[var(--mu)] hover:text-red-400 p-1"
                          aria-label="Excluir remanejamento"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
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

      {/* Medições Fechadas History Table */}
      <div className="gkf-card space-y-3">
        <h3 className="text-base font-bold text-[var(--tx)]">
          Histórico de Medições Fechadas ({f.nome})
        </h3>
        <div className="gkf-table-wrap">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Período</th>
                <th>Contrato</th>
                <th className="text-right">Total R$</th>
                <th>Situação</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {F.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[var(--mu)] text-xs">
                    Nenhuma medição fechada nesta frente de trabalho.
                  </td>
                </tr>
              ) : (
                F.map((item: Fechamento, idx: number) => {
                  const isMedido = item.st === 'med';
                  const isLast = idx === F.length - 1;

                  return (
                    <tr key={item.n}>
                      <td className="font-bold text-xs">{item.n}ª</td>
                      <td className="text-xs">
                        {dbr(item.ini)} a {dbr(item.fim)}
                      </td>
                      <td className="text-xs">{item.ct || '—'}</td>
                      <td className="text-right text-xs font-bold text-[var(--cy)]">
                        {fmt(fechTot(item, cfg, prm))}
                      </td>
                      <td className="text-xs">
                        {isMedido ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Medido em {dbr(item.aprov || item.em?.slice(0, 10))}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold">
                            Pendente de medição
                          </span>
                        )}
                      </td>
                      <td className="text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => downloadBMFile(frenteId, item)}
                          className="px-2.5 py-1 rounded text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-[var(--cy)] inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3 text-blue-400" />
                          Baixar BM
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleMedido(item.n)}
                          className="px-2.5 py-1 rounded text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-[var(--cy)]"
                        >
                          {isMedido ? 'Tornar pendente' : 'Marcar medido'}
                        </button>
                        {isLast && (
                          <button
                            type="button"
                            onClick={handleReabrir}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 inline-flex items-center gap-1"
                          >
                            <RefreshCcw className="w-3 h-3" />
                            Reabrir
                          </button>
                        )}
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
