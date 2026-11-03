import React from 'react';
import { useData } from '../context/DataContext';
import {
  ordC,
  filtC,
  calc,
  fmt,
  pn,
  remTem,
} from '../engine/calc';
import { Search } from 'lucide-react';
import { Contrato } from '../types';
import { NumericInput } from './NumericInput';

export const PainelControleTab: React.FC = () => {
  const {
    cfg,
    ln,
    prm,
    tpl,
    filt,
    setFilt,
    updateConfig,
  } = useData() as any;

  if (!cfg) return null;

  const sortedContratos = ordC(cfg.contratos);
  const filteredContratos = filtC(sortedContratos, filt, cfg);

  // Global totals
  const T = {
    L: 0,
    M: 0,
    N: 0,
    nl: 0,
    O: 0,
    P: 0,
    Q: 0,
    R: 0,
    S: 0,
    T: 0,
  };

  const calculatedRows = filteredContratos.map((c) => {
    const r = calc(c, cfg, ln, prm, tpl);
    T.L += c.L || 0;
    T.nl += c.nl || 0;
    T.M += r.M;
    T.N += r.N;
    T.O += r.O;
    T.P += r.P;
    T.Q += r.Q;
    T.R += r.R;
    T.S += r.S;
    T.T += r.T;
    return { c, r };
  });

  const handleUpdateField = (cId: string, key: string, val: any) => {
    updateConfig((prev: any) => ({
      ...prev,
      contratos: prev.contratos.map((c: Contrato) => {
        if (c.id === cId) {
          const isNum = ['L', 'nl'].includes(key);
          return {
            ...c,
            [key]: isNum ? (typeof val === 'number' ? val : pn(val)) : val,
          };
        }
        return c;
      }),
    }));
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters Bar */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="gkf-kpi">
          <span>Medido no período (N)</span>
          <b>R$ {fmt(T.N)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Possível medir (M)</span>
          <b>R$ {fmt(T.M)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Saldo geral (R)</span>
          <b>R$ {fmt(T.R)}</b>
        </div>
        <div className="gkf-kpi">
          <span>Valor total para recebimento</span>
          <b>R$ {fmt(T.M - T.S)}</b>
        </div>
      </div>

      {/* Main Financial Spreadsheet */}
      <div className="gkf-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--tx)]">
              Painel Geral de Controle de Contratos e Medições
            </h3>
            <p className="text-xs text-[var(--mu)]">
              Acompanhamento financeiro integrado CASAN com saldos contratuais, medições anteriores e faturamento previsto.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-[var(--ln)] text-[var(--mu)]">
                <th className="text-left font-bold py-2 px-1.5 text-[11px] leading-tight">Contrato</th>
                <th className="text-left font-bold py-2 px-1.5 text-[11px] leading-tight">Obra</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight">Contratado<br/>(L)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight text-[var(--cy)]">Previsto Faturam.<br/>(M)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight text-blue-300">Exec. Período<br/>(N)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight">Exec. Legado<br/>(nl)*</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight text-amber-300">Pendente Med.<br/>(O)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight">Acumulado Med.<br/>(P)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight text-amber-400">Saldo Retido<br/>(Q)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight text-emerald-400">Saldo c/ Exec.<br/>(R)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight text-red-400">Exec. s/ Saldo<br/>(S)</th>
                <th className="text-right font-bold py-2 px-1.5 text-[11px] leading-tight">Saldo Contratos<br/>(T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(var(--w),0.05)]">
              {calculatedRows.map(({ c, r }) => {
                const hasRem = remTem(c, cfg);
                return (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    {/* Contrato number */}
                    <td className="py-1 px-1.5">
                      <input
                        type="text"
                        value={c.n || ''}
                        onChange={(e) => handleUpdateField(c.id, 'n', e.target.value)}
                        className="font-bold text-xs py-0.5 px-1.5 rounded border border-transparent hover:border-[var(--ln)] focus:border-[var(--cy)] bg-transparent w-20"
                      />
                    </td>

                    {/* Obra */}
                    <td className="py-1 px-1.5">
                      <input
                        type="text"
                        value={c.obra || ''}
                        onChange={(e) => handleUpdateField(c.id, 'obra', e.target.value)}
                        className="text-xs py-0.5 px-1.5 rounded border border-transparent hover:border-[var(--ln)] focus:border-[var(--cy)] bg-transparent w-36 truncate"
                      />
                    </td>

                    {/* Contratado (L) */}
                    <td className="text-right py-1 px-1.5">
                      <NumericInput
                        value={c.L}
                        onChange={(val) => handleUpdateField(c.id, 'L', val)}
                        className="text-right text-xs font-semibold py-0.5 px-1 rounded border border-transparent hover:border-[var(--ln)] focus:border-[var(--cy)] bg-transparent w-24"
                      />
                    </td>

                    {/* Previsto faturamento (M) */}
                    <td className="text-right text-xs font-bold text-[var(--cy)] py-1 px-1.5">
                      {fmt(r.M)}
                    </td>

                    {/* Exec. período app (N) */}
                    <td className="text-right text-xs text-blue-300 font-semibold py-1 px-1.5">
                      {fmt(r.N)}
                    </td>

                    {/* Exec. legado (nl) */}
                    <td className="text-right py-1 px-1.5">
                      <NumericInput
                        value={c.nl}
                        onChange={(val) => handleUpdateField(c.id, 'nl', val)}
                        className="text-right text-xs text-[var(--mu)] py-0.5 px-1 rounded border border-transparent hover:border-[var(--ln)] focus:border-[var(--cy)] bg-transparent w-20"
                      />
                    </td>

                    {/* Pendente de medição (O) */}
                    <td
                      className="text-right text-xs text-amber-300 font-semibold py-1 px-1.5"
                      title={hasRem ? 'Inclui valor remanejado de saldo retido' : undefined}
                    >
                      {fmt(r.O)}
                    </td>

                    {/* Acumulado medido (P) */}
                    <td
                      className="text-right text-xs font-medium py-1 px-1.5"
                      title={hasRem ? 'Inclui valor remanejado de saldo retido' : undefined}
                    >
                      {fmt(r.P)} {hasRem ? '⇄' : ''}
                    </td>

                    {/* Saldo retido (Q) */}
                    <td
                      className={`text-right text-xs py-1 px-1.5 ${
                        r.Q > 0 ? 'text-amber-400 font-bold' : 'text-[var(--mu)]'
                      }`}
                      title={c.qo !== undefined ? 'Valor fixado manualmente' : undefined}
                    >
                      {fmt(r.Q)} {c.qo !== undefined ? '✎' : ''}
                    </td>

                    {/* Saldo incluso exec. (R) */}
                    <td className="text-right text-xs font-semibold text-emerald-400 py-1 px-1.5">
                      {fmt(r.R)}
                    </td>

                    {/* Exec. sem saldo (S) */}
                    <td
                      className={`text-right text-xs py-1 px-1.5 ${
                        r.S < 0 ? 'text-red-400 font-bold' : 'text-[var(--mu)]'
                      }`}
                      title={c.so !== undefined ? 'Valor fixado manualmente' : undefined}
                    >
                      {fmt(r.S)} {c.so !== undefined ? '✎' : ''}
                    </td>

                    {/* Saldo de contratos (T) */}
                    <td className="text-right text-xs font-bold text-[var(--tx)] py-1 px-1.5">
                      {fmt(r.T)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-white/5 font-extrabold border-t border-[var(--ln)]">
                <td colSpan={2} className="py-2.5 px-2 text-xs">SUBTOTAL OBRAS</td>
                <td className="text-right py-2.5 px-1.5 text-xs">{fmt(T.L)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-[var(--cy)]">{fmt(T.M)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-blue-300">{fmt(T.N)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-[var(--mu)]">{fmt(T.nl)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-amber-300">{fmt(T.O)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs">{fmt(T.P)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-amber-400">{fmt(T.Q)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-emerald-400">{fmt(T.R)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs text-red-400">{fmt(T.S)}</td>
                <td className="text-right py-2.5 px-1.5 text-xs font-black">{fmt(T.T)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-[var(--mu)] leading-relaxed pt-2 border-t border-[var(--ln)]">
          *<b>Exec. legado</b>: executado de obras cuja produção ainda não foi migrada para o aplicativo (valor da planilha de origem).
          O "<b>Pendente de medição</b>" soma o valor anterior (cadastro) e as medições fechadas ainda não marcadas como medidas;
          o "<b>Acumulado medido</b>" soma o valor anterior e as medições marcadas como medidas.
          O "<b>Exec. período (app)</b>" já inclui os lançamentos das frentes vinculadas ao contrato e o legado.
        </p>
      </div>
    </div>
  );
};
