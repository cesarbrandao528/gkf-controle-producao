import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { calc } from '../engine/calc';
import { Download, Printer } from 'lucide-react';

export const FluxoObrasTab: React.FC = () => {
  const { cfg, ln, prm, tpl, fluxt, fluxd, setFluxD, toast, theme } = useData() as any;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState<number>(2000);

  // Sync theme changes immediately to the embedded fluxo iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGE', theme }, '*');
    }
  }, [theme]);

  // Message listener for spreadsheet drops and height changes inside the iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'GKF_FLUX_RESIZE' && typeof e.data.height === 'number') {
        setFrameHeight(Math.max(1000, e.data.height + 30));
      }
      if (
        e.data.fluxoD &&
        e.data.fluxoD.obras &&
        Array.isArray(e.data.fluxoD.obras)
      ) {
        setFluxD(e.data.fluxoD);
        toast(
          `Fluxo e Resultado atualizado com ${e.data.nome || 'a planilha'} ✓`
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setFluxD, toast]);

  // Calculate Previsto Faturamento (Column M) from Painel de Controle
  const { totalPrevistoFaturamento, previstoFaturamentoPorObra } = useMemo(() => {
    let total = 0;
    const porObra: Record<string, number> = {};
    if (cfg?.contratos) {
      cfg.contratos.forEach((c: any) => {
        const r = calc(c, cfg, ln, prm, tpl);
        total += r.M || 0;
        if (c.id) porObra[c.id] = (porObra[c.id] || 0) + (r.M || 0);
        if (c.o) {
          const norm = c.o.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          porObra[norm] = (porObra[norm] || 0) + (r.M || 0);
          const cleanCity = norm.split(' - ')[0].trim();
          porObra[cleanCity] = (porObra[cleanCity] || 0) + (r.M || 0);
        }
      });
    }
    return { totalPrevistoFaturamento: total, previstoFaturamentoPorObra: porObra };
  }, [cfg, ln, prm, tpl]);

  const srcDocContent = useMemo(() => {
    if (!fluxt) return '';
    let html = fluxt;

    if (fluxd && Array.isArray(fluxd.obras)) {
      const i = fluxt.indexOf('let D=');
      if (i >= 0) {
        let d = 0;
        let k = i + 6;
        let ins = false;
        let esc = false;
        for (; k < fluxt.length; k++) {
          const c = fluxt[k];
          if (ins) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') ins = false;
          } else if (c === '"') ins = true;
          else if (c === '{') d++;
          else if (c === '}') {
            d--;
            if (d === 0) {
              k++;
              break;
            }
          }
        }
        html =
          fluxt.slice(0, i + 6) +
          JSON.stringify(fluxd).replace(/<\//g, '<\\/') +
          fluxt.slice(k);
      }
    }

    const withTheme = html.replace(
      /<html([^>]*)>/i,
      `<html$1 data-theme="${theme}">`
    );

    const customStyle = `
      html, body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow-y: hidden !important;
        overflow-x: hidden !important;
      }
      .app {
        max-width: 100% !important;
        padding: 8px 4px 30px !important;
        margin: 0 !important;
      }
      header .brand { display: none !important; }
      header { justify-content: flex-start !important; margin-bottom: 20px !important; }
      header .side {
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: flex-end !important;
        justify-content: flex-start !important;
        margin: 0 !important;
        gap: 12px 20px !important;
      }
      header .acts, header .filters { justify-content: flex-start !important; }
      @media print {
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
        html, body {
          background: #ffffff !important;
          color: #0f172a !important;
          overflow: visible !important;
          overflow-y: visible !important;
          overflow-x: visible !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .app {
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          height: auto !important;
        }
        .grid {
          display: block !important;
        }
        .card {
          opacity: 1 !important;
          transform: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: none !important;
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          color: #0f172a !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          margin-bottom: 16px !important;
          width: 100% !important;
        }
        .tw {
          overflow: visible !important;
          max-height: none !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        th, td {
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
          white-space: normal !important;
        }
        header, header .side, .filters, .acts, #up, #toast, #tip, .btn, button, .hbtn, #vb, #ed {
          display: none !important;
        }
        #grid-mensal {
          display: block !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          margin-bottom: 16px !important;
        }
        .tm-tab {
          font-size: 7.5pt !important;
          width: 100% !important;
        }
        .tm-tab th, .tm-tab td {
          padding: 3px 5px !important;
          white-space: nowrap !important;
        }
        .tm-tab th.th-lbl, .tm-tab td.td-lbl,
        .tm-tab th.th-final, .tm-tab td.td-final {
          position: static !important;
          box-shadow: none !important;
        }
      }
    </style>
    <script>
      window.PREVISTO_FATURAMENTO = ${JSON.stringify({
        total: totalPrevistoFaturamento,
        porObra: previstoFaturamentoPorObra,
      })};

      function reportHeight() {
        try {
          var h = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.getElementById('app') ? document.getElementById('app').scrollHeight : 0
          );
          window.parent.postMessage({ type: 'GKF_FLUX_RESIZE', height: h }, '*');
        } catch(e) {}
      }
      window.addEventListener('load', function() {
        reportHeight();
        setTimeout(reportHeight, 300);
        setTimeout(reportHeight, 1000);
        if (window.ResizeObserver) {
          new ResizeObserver(reportHeight).observe(document.body);
        }
      });
      window.addEventListener('resize', reportHeight);
    </script>
    `;

    return withTheme.replace('</style>', customStyle);
  }, [fluxt, fluxd, theme, cfg, ln, prm, tpl]);

  const handleIframeLoad = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGE', theme }, '*');
      try {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          const h = doc.body.scrollHeight || doc.documentElement.scrollHeight;
          if (h > 600) setFrameHeight(h + 30);
        }
      } catch (e) {}
    }
  };

  const handleDownloadCopy = () => {
    if (!fluxt) return;

    // Retrieve active dataset directly from iframe memory or state
    const liveD = (iframeRef.current?.contentWindow as any)?.D || fluxd;
    let baseHtml = fluxt;

    if (liveD && Array.isArray(liveD.obras)) {
      const i = baseHtml.indexOf('let D=');
      if (i >= 0) {
        let d = 0;
        let k = i + 6;
        let ins = false;
        let esc = false;
        for (; k < baseHtml.length; k++) {
          const c = baseHtml[k];
          if (ins) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') ins = false;
          } else if (c === '"') ins = true;
          else if (c === '{') d++;
          else if (c === '}') {
            d--;
            if (d === 0) {
              k++;
              break;
            }
          }
        }
        baseHtml =
          baseHtml.slice(0, i + 6) +
          JSON.stringify(liveD).replace(/<\//g, '<\\/') +
          baseHtml.slice(k);
      }
    }

    // Capture currently selected dropdown filters
    const liveDoc = iframeRef.current?.contentDocument;
    const curFs = (liveDoc?.getElementById('fs') as HTMLSelectElement)?.value || 'VALE';
    const curFo = (liveDoc?.getElementById('fo') as HTMLSelectElement)?.value || '';
    const curFy = (liveDoc?.getElementById('fy') as HTMLSelectElement)?.value || '';

    // Standalone styling with native app background, full scrolling, and GKF brand logo visible
    const standaloneStyle = `
      <style>
        html, body {
          background: radial-gradient(900px 500px at 12% -5%,rgba(var(--cyr),.13),transparent 60%),radial-gradient(800px 500px at 95% 5%,rgba(var(--vir),.15),transparent 60%),linear-gradient(165deg,var(--bgA) 0%,var(--bgB) 50%,var(--bgC) 100%) !important;
          background-attachment: fixed !important;
          color: ${theme === 'light' ? '#1b2733' : '#e8eefb'} !important;
          margin: 0 !important;
          padding: 24px 20px 80px !important;
          overflow-y: auto !important;
          overflow-x: auto !important;
          min-height: 100vh !important;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        .app {
          max-width: 1600px !important;
          margin: 0 auto !important;
          padding: 0 0 60px !important;
        }
        header .brand { display: flex !important; align-items: center !important; }
      </style>
      <script>
        window.PREVISTO_FATURAMENTO = ${JSON.stringify({
          total: totalPrevistoFaturamento,
          porObra: previstoFaturamentoPorObra,
        })};
        window.addEventListener('DOMContentLoaded', function() {
          try {
            if (document.getElementById('fs')) document.getElementById('fs').value = ${JSON.stringify(curFs)};
            if (typeof fo === 'function') fo();
            if (document.getElementById('fo')) document.getElementById('fo').value = ${JSON.stringify(curFo)};
            if (document.getElementById('fy')) document.getElementById('fy').value = ${JSON.stringify(curFy)};
            if (typeof fill === 'function') fill();
            if (typeof render === 'function') render();
          } catch (e) {
            console.warn(e);
          }
        });
      </script>
    `;

    let finalHtml = baseHtml
      .replace(/<html([^>]*)>/i, `<html$1 data-theme="${theme}">`)
      .replace(/localStorage\.getItem\(['"]cp_gkf_fluxd_v3['"]\)/g, 'null')
      .replace('</head>', `${standaloneStyle}</head>`);

    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fluxo_e_Resultado_Obras.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Fluxo e Resultado exportado com dados, filtros e design idênticos ao aplicativo ✓');
  };

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (e) {
        window.print();
      }
    } else {
      window.print();
    }
  };

  if (!fluxt) {
    return (
      <div className="gkf-card text-center py-12 text-[var(--mu)]">
        Fluxo e Resultado indisponível: o arquivo fluxo_obras.html não foi encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[var(--mu)]">
          Fluxo financeiro, custos diretos e indiretos, receitas e margens por obra integrados.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-emerald-400 flex items-center gap-1.5 text-[var(--tx)] transition-all cursor-pointer"
            title="Imprimir ou Salvar em PDF os cards de Fluxo e Resultado"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            Imprimir / PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadCopy}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-[var(--cy)] flex items-center gap-1.5 text-[var(--tx)] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Baixar arquivo HTML do Fluxo
          </button>
        </div>
      </div>

      {/* Seamless Native-integrated Fluxo (no suspended window, no double scrollbar) */}
      <div className="w-full">
        <iframe
          ref={iframeRef}
          title="Gestão de Obras - Fluxo e Resultado"
          srcDoc={srcDocContent}
          onLoad={handleIframeLoad}
          scrolling="no"
          style={{ height: `${frameHeight}px`, overflow: 'hidden' }}
          className="w-full border-0 block transition-all duration-200"
        />
      </div>
    </div>
  );
};
