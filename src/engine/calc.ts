import {
  AvulsoItem,
  CalcResult,
  Config,
  Contrato,
  Fechamento,
  FechamentoCol,
  FrenteLancamentos,
  OSE,
  PrecoItem,
  Template,
} from '../types';
import { Motor } from './motor';

export const fmt = (v: number | null | undefined, dec = 2): string => {
  if (v == null || isNaN(v)) return '0,00';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

export const pn = (v: any): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const s = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const pf = (v: any): number => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export const dbr = (d?: string | null): string => {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

export const byD = (a: any, b: any): number =>
  (a.d || '9999-99-99').localeCompare(b.d || '9999-99-99');

export const hoje = (): string => new Date().toISOString().slice(0, 10);

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const slug = (n: string): string =>
  n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || String(Date.now());

export const norm = (s: any): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const per = (cfg: Config, frenteId: string) => {
  const f = cfg.frentes.find((x) => x.id === frenteId);
  return (f && f.periodo) || cfg.periodo;
};

export const inP = (
  d: string | null | undefined,
  cfg: Config,
  frenteId: string,
  customPeriod?: { ini: string; fim: string } | null
): boolean => {
  if (!d) return false;
  const p = customPeriod || per(cfg, frenteId);
  return d >= p.ini && d <= p.fim;
};

export const addD = (d: string, n: number): string => {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const addM = (d: string, n: number): string => {
  const x = new Date(d + 'T00:00:00');
  const dd = x.getDate();
  x.setMonth(x.getMonth() + n);
  const u = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(dd, u));
  return x.toISOString().slice(0, 10);
};

export function calcOSE(
  o: OSE,
  frenteId: string,
  cfg: Config,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>,
  memo?: Record<string, any>,
  tplc?: Record<string, any>,
  customPeriod?: { ini: string; fim: string } | null,
  avulsosDaOse?: AvulsoItem[]
) {
  const avLen = (avulsosDaOse || []).length;
  const memoKey = customPeriod
    ? `${o.id}_${customPeriod.ini}_${customPeriod.fim}_${avLen}`
    : `${o.id}_${avLen}`;
  if (memo && memo[memoKey]) return memo[memoKey];
  const tp = tpl[o.tipo];
  if (!tp) return { itens: [], total: 0 };

  const cacheTPLC = tplc || {};
  const C = cacheTPLC[o.tipo] || (cacheTPLC[o.tipo] = Motor.build(tp.cells));
  const act = o.rows.filter((r) => !r.d || inP(r.d, cfg, frenteId, customPeriod));
  const cap = tp.r1 - tp.r0 + 1;
  const map: Record<string, number> = {};

  for (let pg = 0; pg === 0 || pg < act.length; pg += cap) {
    const inp: Record<string, any> = {};
    act.slice(pg, pg + cap).forEach((r, i) => {
      const row = tp.r0 + i;
      tp.entradas.forEach((e) => {
        const v = r.v[e.k];
        if (v === '' || v == null || e.t === 'd') return;
        // Do not override formula G = F + E + D if G is empty, 0 or negative
        if (e.k === 'G' && pf(v) <= 0) return;
        inp[e.k + row] = e.t === 'n' ? pf(v) : v;
      });
    });
    const run = Motor.run(C, inp);
    tp.servicos.forEach((s) => {
      const v = run.get(s.ref);
      if (typeof v === 'number' && Math.abs(v) > 1e-9) {
        map[s.c] = (map[s.c] || 0) + v;
      }
    });
  }

  // DMT multiplier logic and custom formulas for Escavado
  if (o.tipo === 'ESC') {
    const dmtPo = o.dmtPo !== undefined && !isNaN(o.dmtPo) ? o.dmtPo : 5;
    const dmtSolo = o.dmtSolo !== undefined && !isNaN(o.dmtSolo) ? o.dmtSolo : 5;

    // Fórmula solicitada: Item 40801 = (40201 + 40301 ou seja o volume total escavado - 40602)
    const escManual = map['40201'] || 0;
    const escMecanizada = map['40301'] || 0;
    const reaterro = map['40602'] || 0;
    const volumeBotaFora = Math.max(0, (escManual + escMecanizada) - reaterro);
    map['40801'] = volumeBotaFora;

    if (map['40607']) {
      map['40608'] = map['40607'] * dmtPo;
    }
    if (map['40801']) {
      map['40804'] = map['40801'] * dmtSolo;
    } else {
      map['40804'] = 0;
    }
    delete map['60102']; // Retirar item 60102 do Escavado
    delete map['110101']; // Retirar item 110101 (Tomada de Água) do Escavado
    delete map['110102']; // Retirar item 110102 (Ramal Predial) do Escavado
  }

  // Remove default template items 110101 and 110102 from MND (automatic formula)
  if (o.tipo === 'MND') {
    delete map['110101'];
    delete map['110102'];
  }

  // Map avulso services launched directly for this OSE
  const avulsosMap: Record<string, number> = {};
  if (avulsosDaOse && avulsosDaOse.length > 0) {
    avulsosDaOse.forEach((av) => {
      if (!av.d || inP(av.d, cfg, frenteId, customPeriod)) {
        avulsosMap[av.c] = (avulsosMap[av.c] || 0) + (av.q || 0);
        map[av.c] = (map[av.c] || 0) + (av.q || 0);
      }
    });
  }

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const aj = o.aj || {};
  const ajPct = o.ajPct || {};
  const allCodes = Array.from(
    new Set([...Object.keys(map), ...Object.keys(aj), ...Object.keys(ajPct), ...Object.keys(avulsosMap)])
  )
    .filter((c) => {
      // If it was explicitly launched as an avulso or manual adjustment, always keep it
      if (c in avulsosMap || c in aj || c in ajPct) return true;
      if (o.tipo === 'ESC' && (c === '60102' || c === '110101' || c === '110102')) return false;
      if (o.tipo === 'MND' && (c === '110101' || c === '110102')) return false;
      return true;
    })
    .sort();

  const itens = allCodes.map((c) => {
    const p = prm[c] || { d: 'Item ' + c, u: 'un', p: 0 };
    // Arredondar a quantidade apurada para 2 casas decimais (elimina resíduo de dízimas do Excel)
    const q = round2(map[c] || 0);
    const hasManualAj = c in aj && aj[c] !== undefined && !isNaN(aj[c]);
    const hasPctAj = c in ajPct && ajPct[c] !== undefined && !isNaN(ajPct[c]) && ajPct[c] !== 0;

    let qf = q;
    if (hasManualAj) {
      qf = round2(aj[c]);
    } else if (hasPctAj) {
      qf = round2(q * (1 + ajPct[c] / 100));
    }

    const unitPrice = p.p || 0;
    const calcQty = hasManualAj || hasPctAj ? qf : (map[c] !== undefined ? map[c] : qf);
    const v = round2(calcQty * unitPrice);
    const isAvulso = Boolean(avulsosMap[c]);

    return {
      c,
      d: p.d,
      u: p.u,
      p: unitPrice,
      q,
      aj: hasManualAj || hasPctAj,
      ajVal: hasManualAj ? aj[c] : undefined,
      ajPct: hasPctAj ? ajPct[c] : undefined,
      qf,
      v,
      isAvulso,
      avulsoQtd: avulsosMap[c] || 0,
    };
  });

  const res = { itens, total: round2(itens.reduce((t, x) => t + x.v, 0)) };
  if (memo) memo[memoKey] = res;
  return res;
}

export const bm = (
  frenteId: string,
  cfg: Config,
  ln: Record<string, FrenteLancamentos>,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>,
  memo?: Record<string, any>,
  tplc?: Record<string, any>
): number => {
  const fLanc = ln[frenteId] || { itens: [], oses: [] };
  // Apenas avulsos gerais sem OSE vinculada (oid vazio)
  const avulsosGerais = (fLanc.itens || [])
    .filter((x) => !x.oid && inP(x.d, cfg, frenteId))
    .reduce((t, x) => t + x.q * ((prm[x.c] || {}).p || 0), 0);

  const osesTotal = (fLanc.oses || []).reduce((t, o) => {
    const oAvulsos = (fLanc.itens || []).filter((x) => x.oid === o.id);
    return t + calcOSE(o, frenteId, cfg, prm, tpl, memo, tplc, null, oAvulsos).total;
  }, 0);

  return avulsosGerais + osesTotal;
};

export const exe = (
  frenteId: string,
  cfg: Config,
  ln: Record<string, FrenteLancamentos>,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>,
  memo?: Record<string, any>,
  tplc?: Record<string, any>
): number => {
  return bm(frenteId, cfg, ln, prm, tpl, memo, tplc) * (1 + cfg.k);
};

export const somaCols = (cols: FechamentoCol[]): Record<string, number> => {
  const q: Record<string, number> = {};
  (cols || []).forEach((c) => {
    for (const k in c.q) {
      q[k] = (q[k] || 0) + c.q[k];
    }
  });
  return q;
};

export const valorQ = (q: Record<string, number>, prm: Record<string, PrecoItem>): number => {
  return Object.entries(q).reduce((t, [c, v]) => t + v * ((prm[c] || {}).p || 0), 0);
};

export const fechTot = (
  x: { cols: FechamentoCol[] },
  cfg: Config,
  prm: Record<string, PrecoItem>
): number => {
  return valorQ(somaCols(x.cols), prm) * (1 + cfg.k);
};

export const fechCt = (
  c: Contrato,
  cfg: Config,
  ln: Record<string, FrenteLancamentos>
): Fechamento[] => {
  return cfg.frentes
    .filter((f) => f.contrato === c.id)
    .flatMap((f) => (ln[f.id] && ln[f.id].fech) || []);
};

export const remL = (cfg: Config) => cfg.rem || [];
export const remDe = (c: Contrato, cfg: Config) =>
  remL(cfg)
    .filter((r) => r.de === c.id)
    .reduce((t, r) => t + r.valor, 0);
export const remO = (c: Contrato, cfg: Config) =>
  remL(cfg)
    .filter((r) => r.para === c.id && r.st !== 'med')
    .reduce((t, r) => t + r.valor, 0);
export const remP = (c: Contrato, cfg: Config) =>
  remL(cfg)
    .filter((r) => r.para === c.id && r.st === 'med')
    .reduce((t, r) => t + r.valor, 0);
export const remTem = (c: Contrato, cfg: Config) =>
  remL(cfg).some((r) => r.de === c.id || r.para === c.id);

export function calc(
  c: Contrato,
  cfg: Config,
  ln: Record<string, FrenteLancamentos>,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>,
  memo?: Record<string, any>,
  tplc?: Record<string, any>
): CalcResult {
  const N =
    cfg.frentes
      .filter((f) => f.contrato === c.id)
      .reduce((t, f) => t + exe(f.id, cfg, ln, prm, tpl, memo, tplc), 0) + (c.nl || 0);

  const L = c.L || 0;
  const fc = fechCt(c, cfg, ln);
  const remSaida = remDe(c, cfg);
  const O =
    (c.O || 0) +
    remO(c, cfg) +
    fc.filter((x) => x.st !== 'med').reduce((t, x) => t + fechTot(x, cfg, prm), 0);
  const P =
    (c.P || 0) -
    remSaida +
    remP(c, cfg) +
    fc.filter((x) => x.st === 'med').reduce((t, x) => t + fechTot(x, cfg, prm), 0);

  const r2 = (n: number) => {
    const v = Math.round((n + Number.EPSILON) * 100) / 100;
    return Object.is(v, -0) || Math.abs(v) < 1e-9 ? 0 : v;
  };
  const T = r2(L - P > 0 ? L - P : 0);
  const M = r2(T > 0 ? (T - N - O < 0 ? T : N + O) : 0);
  const baseQ =
    'qo' in c && c.qo !== undefined
      ? Math.max(0, c.qo - remSaida)
      : L - P > 0
      ? 0
      : P - L;
  const Q = r2(baseQ);
  const R = r2(T > 0 ? Math.max(L - N - P - O, 0) : 0);
  const baseS =
    'so' in c && c.so !== undefined
      ? c.so < 0
        ? Math.min(0, c.so + remSaida)
        : c.so
      : L - N - O - P > 0
      ? 0
      : L - N - O - P;
  const S = r2(baseS);
  const U = M === 0 ? (N > 0 ? 1 : 0) : N / M;

  return { N: r2(N), M, Q, R, S, T, U, O: r2(O), P: r2(P) };
}

const RX = /^(\d+)\/(\d{4})$/;
const isAg = (c: Contrato) => !RX.test((c.n || '').trim());

export const ordC = (l: Contrato[]): Contrato[] =>
  [...l].sort((a, b) => {
    const A = isAg(a);
    const B = isAg(b);
    if (A !== B) return A ? 1 : -1;
    if (!A) {
      const x = RX.exec(a.n.trim())!;
      const y = RX.exec(b.n.trim())!;
      const d = +x[2] - +y[2] || +x[1] - +y[1];
      if (d !== 0) return d;
    }
    return (a.obra || '').localeCompare(b.obra || '');
  });

export const stC = (c: Contrato): string => {
  if (c.bx) return 'fin';
  if (isAg(c)) return 'ag';
  if (!c.df) return 'sd';
  const d = Math.floor(
    (new Date(c.df + 'T00:00:00').getTime() - new Date(hoje() + 'T00:00:00').getTime()) / 864e5
  );
  if (d < 0) return 'venc';
  if (d < 90) return 'renov';
  return 'vig';
};

export const filtC = (
  list: Contrato[],
  filt: { q: string; s: string },
  cfg: Config
): Contrato[] =>
  list.filter((c) => {
    const q = norm(filt.q);
    if (q) {
      const fs = cfg.frentes
        .filter((f) => f.contrato === c.id)
        .map((f) => f.nome)
        .join(' ');
      if (!norm([c.n, c.obra, c.p, fs].join(' ')).includes(q)) return false;
    }
    return !filt.s || stC(c) === filt.s;
  });

export function dashRows(
  cfg: Config,
  ln: Record<string, FrenteLancamentos>,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>
) {
  return ordC(cfg.contratos).map((c) => {
    const r = calc(c, cfg, ln, prm, tpl);
    const f = cfg.frentes.find((x) => x.contrato === c.id);
    return {
      c: (c.n || '').trim(),
      o: (f ? f.nome : c.obra || '').replace(/\s*-\s*[A-Z]{2}$/, ''),
      di: c.di || null,
      df: c.df || null,
      p: c.p || '',
      v: c.L || 0,
      pf: r.M,
      ex: r.N,
      ac: r.P,
      si: r.R,
      es: r.S,
      sc: r.T,
      bx: c.bx || null,
    };
  });
}

export function buildDash(templateHtml: string, rows: any[], atualizado = hoje()): string {
  const j = JSON.stringify({ rows, atualizado }).replace(/<\//g, '<\\/');
  return templateHtml.replace(
    /(<script id="dados" type="application\/json">)[\s\S]*?(<\/script>)/,
    (_, a, b) => a + j + b
  );
}

export const BASEBM = (bmap?: any) => (bmap && bmap.base) || 92072173.55;

export function colsFrente(
  id: string,
  cfg: Config,
  ln: Record<string, FrenteLancamentos>,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>,
  memo?: Record<string, any>,
  tplc?: Record<string, any>
): FechamentoCol[] {
  const L = ln[id] || { itens: [], oses: [] };
  const cols: FechamentoCol[] = [];

  (L.oses || []).forEach((o) => {
    const oAvulsos = (L.itens || []).filter((x) => x.oid === o.id);
    const q: Record<string, number> = {};
    calcOSE(o, id, cfg, prm, tpl, memo, tplc, null, oAvulsos).itens.forEach((x: any) => {
      if (x.qf) q[x.c] = x.qf;
    });
    if (Object.keys(q).length) {
      cols.push({
        nome: o.nome,
        q,
        os: {
          tipo: o.tipo,
          rows: o.rows
            .filter((r) => !r.d || inP(r.d, cfg, id))
            .map((r) => ({ d: r.d || null, v: { ...r.v } })),
          aj: { ...(o.aj || {}) },
        },
      });
    }
  });

  // Apenas serviços avulsos gerais sem OSE vinculada
  const avG: FechamentoCol = { nome: 'SERVIÇOS AVULSOS', q: {} };
  (L.itens || [])
    .filter((x) => !x.oid && inP(x.d, cfg, id))
    .forEach((x) => {
      avG.q[x.c] = (avG.q[x.c] || 0) + x.q;
    });

  if (Object.keys(avG.q).length) cols.push(avG);
  return cols;
}

export function snapAtual(
  id: string,
  cfg: Config,
  ln: Record<string, FrenteLancamentos>,
  prm: Record<string, PrecoItem>,
  tpl: Record<string, Template>
): Fechamento {
  const f = cfg.frentes.find((x) => x.id === id)!;
  const c = cfg.contratos.find((x) => x.id === f.contrato) || ({} as any);
  const fechsList = (ln[id]?.fech || []).sort((a: Fechamento, b: Fechamento) => a.n - b.n);
  return {
    n: fechsList.length + 1,
    ini: per(cfg, id).ini,
    fim: per(cfg, id).fim,
    mun: f.nome,
    ct: c.n || '',
    di: c.di || null,
    df: c.df || null,
    cols: colsFrente(id, cfg, ln, prm, tpl),
    em: new Date().toISOString(),
    st: 'pend',
  };
}
