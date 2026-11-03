import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { buildDash, dashRows, hoje } from '../engine/calc';
import { Download } from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const { cfg, ln, prm, tpl, dasht, toast, theme } = useData() as any;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState<number>(1400);

  // Sync theme changes immediately to the embedded dashboard iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGE', theme }, '*');
    }
  }, [theme]);

  // Listen for auto-resize messages from the iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'GKF_DASH_RESIZE' && typeof e.data.height === 'number') {
        setFrameHeight(Math.max(800, e.data.height + 20));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const srcDocContent = useMemo(() => {
    if (!dasht || !cfg) return '';
    const rows = dashRows(cfg, ln, prm, tpl);
    const htmlWithData = buildDash(dasht, rows, hoje());
    // Inject current active theme into html tag and restyle header for embedded view
    const withTheme = htmlWithData.replace(
      /<html([^>]*)>/i,
      `<html$1 data-theme="${theme}">`
    );

    // Inject styles to remove borders, make background transparent, and eliminate inner scrollbars
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
    </style>
    <script>
      function reportHeight() {
        try {
          var h = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.getElementById('app') ? document.getElementById('app').scrollHeight : 0
          );
          window.parent.postMessage({ type: 'GKF_DASH_RESIZE', height: h }, '*');
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
  }, [dasht, cfg, ln, prm, tpl, theme]);

  const handleDownloadCopy = () => {
    if (!dasht || !cfg) return;
    const rows = dashRows(cfg, ln, prm, tpl);
    const htmlWithData = buildDash(dasht, rows, hoje());
    const withTheme = htmlWithData.replace(
      /<html([^>]*)>/i,
      `<html$1 data-theme="${theme}">`
    );
    const standaloneStyle = `
      <style>
        html, body {
          background: ${theme === 'light' ? '#f0f5fa' : '#030813'} !important;
          color: ${theme === 'light' ? '#1b2733' : '#e8eefb'} !important;
          margin: 0 !important;
          padding: 24px 20px 60px !important;
          overflow-y: auto !important;
          overflow-x: auto !important;
          min-height: 100vh !important;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        .app {
          max-width: 1600px !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }
        .card {
          border-radius: 18px !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25) !important;
          margin-bottom: 24px !important;
        }
      </style>
    `;
    const finalHtml = withTheme.replace('</head>', `${standaloneStyle}</head>`);
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dashboard_Contratos_${hoje()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Dashboard exportado como HTML autônomo com rolagem completa ✓');
  };

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

  if (!dasht) {
    return (
      <div className="gkf-card text-center py-12 text-[var(--mu)]">
        Dashboard indisponível: o arquivo dashboard_modelo.html não foi encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[var(--mu)]">
          Painel gerencial integrado diretamente ao sistema de produção e contratos.
        </span>
        <button
          type="button"
          onClick={handleDownloadCopy}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(var(--w),0.07)] border border-[var(--ln)] hover:border-[var(--cy)] flex items-center gap-1.5 text-[var(--tx)] transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          Baixar arquivo HTML do Dashboard
        </button>
      </div>

      {/* Seamless Native-integrated Dashboard (no suspended window, no double scrollbar) */}
      <div className="w-full">
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          title="Dashboard de Contratos"
          srcDoc={srcDocContent}
          scrolling="no"
          style={{ height: `${frameHeight}px`, overflow: 'hidden' }}
          className="w-full border-0 block transition-all duration-200"
        />
      </div>
    </div>
  );
};
