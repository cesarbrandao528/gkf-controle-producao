import JSZip from 'jszip';
import { BMMap, Fechamento, Template } from '../types';

const cn = (a: string): number => {
  let n = 0;
  for (const ch of a) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
};

const cl = (n: number): string => {
  let s = '';
  while (n) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const ex = (s: any): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const styleOf = (x: string, ref: string): string => {
  const i = x.indexOf('<c r="' + ref + '"');
  if (i < 0) return '';
  const m = / s="(\d+)"/.exec(x.slice(i, x.indexOf('>', i) + 1));
  return m ? m[1] : '';
};

export function setCell(
  x: string,
  ref: string,
  val: any,
  st?: string,
  isF = false
): string {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  const col = cn(m[1]);
  const row = +m[2];

  const mk = (s?: string) => {
    const a = s ? ` s="${s}"` : '';
    return isF
      ? `<c r="${ref}"${a}><f>${ex(val)}</f></c>`
      : val == null || val === ''
        ? `<c r="${ref}"${a}/>`
        : typeof val === 'number'
          ? `<c r="${ref}"${a}><v>${val}</v></c>`
          : `<c r="${ref}"${a} t="inlineStr"><is><t xml:space="preserve">${ex(val)}</t></is></c>`;
  };

  const i = x.indexOf('<c r="' + ref + '"');
  if (i >= 0) {
    const te = x.indexOf('>', i);
    const open = x.slice(i, te + 1);
    const sm = / s="(\d+)"/.exec(open);
    const end = open.endsWith('/>') ? te + 1 : x.indexOf('</c>', te) + 4;
    return x.slice(0, i) + mk(sm ? sm[1] : st || '') + x.slice(end);
  }

  const ri = x.indexOf('<row r="' + row + '"');
  if (ri < 0) {
    const re = /<row r="(\d+)"/g;
    let q;
    let pos = -1;
    while ((q = re.exec(x))) {
      if (+q[1] > row) {
        pos = q.index;
        break;
      }
    }
    if (pos < 0) pos = x.indexOf('</sheetData>');
    return x.slice(0, pos) + `<row r="${row}">${mk(st)}</row>` + x.slice(pos);
  }

  const rte = x.indexOf('>', ri);
  let open = x.slice(ri, rte + 1);
  open = open.replace(
    /spans="(\d+):(\d+)"/,
    (_, b, c) => `spans="${Math.min(+b, col)}:${Math.max(+c, col)}"`
  );
  if (open.endsWith('/>'))
    return x.slice(0, ri) + open.slice(0, -2) + '>' + mk(st) + '</row>' + x.slice(rte + 1);

  const rend = x.indexOf('</row>', rte);
  const body = x.slice(rte + 1, rend);
  const re2 = /<c r="([A-Z]+)\d+"/g;
  let q2;
  let at = body.length;
  while ((q2 = re2.exec(body))) {
    if (cn(q2[1]) > col) {
      at = q2.index;
      break;
    }
  }
  return x.slice(0, ri) + open + body.slice(0, at) + mk(st) + body.slice(at) + x.slice(rend);
}

const shiftF = (f: string, dr: number, dc: number): string =>
  f.replace(
    /(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z])/g,
    (_, a, c, b2, r) => a + (a ? c : cl(cn(c) + dc)) + b2 + (b2 ? r : +r + dr)
  );

function unshare(x: string): string {
  const M: Record<string, { c: number; r: number; t: string }> = {};
  x = x.replace(
    /<c r="([A-Z]+)(\d+)"([^>]*)>(\s*)<f t="shared" ref="[^"]*" si="(\d+)"([^>]*)>([^<]*)<\/f>/g,
    (_, c, r, at, _ws, si, _fa, t) => {
      M[si] = { c: cn(c), r: +r, t };
      return `<c r="${c}${r}"${at}><f>${t}</f>`;
    }
  );
  return x.replace(
    /<c r="([A-Z]+)(\d+)"([^>]*)><f t="shared" si="(\d+)"\/>/g,
    (m, c, r, at, si) => {
      const g = M[si];
      return g ? `<c r="${c}${r}"${at}><f>${shiftF(g.t, +r - g.r, cn(c) - g.c)}</f>` : m;
    }
  );
}

const strip = (x: string): string =>
  x.replace(
    /(<c [^>]*>)(<f[^>]*?(?:\/>|>[\s\S]*?<\/f>))<v>[\s\S]*?<\/v>/g,
    (_, o, f) => o.replace(/ t="[^"]*"/, '') + f
  );

const serial = (d?: string | null): number | null =>
  d
    ? Math.round(
        (Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) -
          Date.UTC(1899, 11, 30)) /
          864e5
      )
    : null;

const br = (d?: string | null): string => (d ? d.split('-').reverse().join('/') : '');

const nomeAba = (n: string, usados: Set<string>): string => {
  const b =
    String(n)
      .replace(/[\\\/\?\*\[\]:]/g, '')
      .trim()
      .slice(0, 31) || 'OSE';
  let u = b;
  let k = 2;
  while (usados.has(u.toLowerCase())) {
    const suf = ' (' + k++ + ')';
    u = b.slice(0, 31 - suf.length) + suf;
  }
  usados.add(u.toLowerCase());
  return u;
};

async function montarOSE(
  z: JSZip,
  tp: any,
  os: any,
  _nome: string,
  d: any,
  pf: (v: any) => number,
  svc: Record<string, string>
) {
  let x = await z.file('xl/worksheets/sheet' + tp.sheetNum + '.xml')!.async('string');
  x = unshare(x.replace(/ tabSelected="1"/, '').replace(/(<pageSetup[^>]*?) r:id="[^"]*"/, '$1'));

  for (const e of tp.entradas) {
    for (let r = tp.r0; r <= tp.r1; r++) {
      x = setCell(x, e.k + r, null);
    }
  }
  for (const ref of tp.limpar || []) {
    x = setCell(x, ref, null);
  }

  for (const k in tp.cells) {
    const m = /^([A-Z]+)(\d+)$/.exec(k)!;
    const r = +m[2];
    const v = tp.cells[k];
    if (r >= tp.r0 && r <= tp.r1 && typeof v === 'string' && v[0] === '=') {
      x = setCell(x, k, v.slice(1), styleOf(x, m[1] + (tp.r0 + 1)), true);
    }
  }

  os.rows.forEach((r: any, i: number) => {
    const row = tp.r0 + i;
    if (row > tp.r1) return;
    tp.entradas.forEach((e: any) => {
      const v = r.v[e.k];
      if (e.t === 'd') {
        if (r.d) x = setCell(x, e.k + row, serial(r.d));
        return;
      }
      if (v === '' || v == null) {
        if (e.k === 'A' && r.d) x = setCell(x, 'A' + row, br(r.d));
        return;
      }
      x = setCell(
        x,
        e.k + row,
        e.t === 'n' ? pf(v) : e.k === 'A' && r.d ? br(r.d) + ' - ' + v : String(v)
      );
    });
    if (!r.v.A && r.d && tp.entradas.some((e: any) => e.k === 'A')) {
      x = setCell(x, 'A' + row, br(r.d));
    }
  });

  for (const c in os.aj || {}) {
    if (svc[c]) x = setCell(x, svc[c], os.aj[c]);
  }

  if (tp.sheetNum === 11) {
    x = setCell(x, 'D2', os.nome);
    x = setCell(x, 'F3', d.n);
    x = setCell(x, 'D4', d.mun);
  } else {
    x = setCell(x, 'B2', os.nome);
  }

  return strip(x);
}

export interface BMDataPayload extends Fechamento {
  ant: Record<string, number>;
  antCan: number;
}

export async function gerarBM(
  templateBuffer: ArrayBuffer,
  map: BMMap,
  d: BMDataPayload,
  pf: (v: any) => number,
  tpl: Record<string, Template>
): Promise<Uint8Array> {
  const z = await JSZip.loadAsync(templateBuffer);
  const P = (n: number) => 'xl/worksheets/sheet' + n + '.xml';
  const rd = (n: number) => z.file(P(n))!.async('string');
  const MUN = d.mun.toUpperCase();

  let capa = await rd(1);
  capa = setCell(capa, 'A24', d.n + 'ª MEDIÇÃO');
  capa = setCell(capa, 'A29', 'PERÍODO: ' + br(d.ini) + ' e ' + br(d.fim));
  capa = setCell(capa, 'A36', 'MUNICÍPIO: ' + MUN + '/SC');
  if (d.ct) capa = setCell(capa, 'H52', d.ct);
  capa = capa.replace(/<sheetView /, (m) => m + (/tabSelected/.test(capa) ? '' : 'tabSelected="1" '));

  let res = await rd(2);
  res = setCell(res, 'A4', 'Cidade: ' + d.mun + '/SC');
  if (d.di) res = setCell(res, 'B5', 'Início: ' + br(d.di));
  if (d.df) res = setCell(res, 'C5', 'Término: ' + br(d.df));

  let can = await rd(3);
  can = setCell(can, 'A2', 'Cidade: ' + d.mun + '/SC');
  if (d.di) can = setCell(can, 'F3', serial(d.di));
  if (d.df) can = setCell(can, 'F4', serial(d.df));
  can = setCell(can, 'K6', d.n);
  can = setCell(can, 'K12', d.antCan || 0);
  can = setCell(can, 'K13', d.antCan || 0);

  let bm = await rd(5);
  for (const c in map.bm) {
    bm = setCell(bm, 'J' + map.bm[c], Math.round((d.ant[c] || 0) * 1e6) / 1e6);
  }

  let q = await rd(8);
  let cols = d.cols.slice();
  if (cols.length > 14) {
    const rest = cols.slice(13);
    const m: Record<string, number> = {};
    rest.forEach((c) => {
      for (const k in c.q) m[k] = (m[k] || 0) + c.q[k];
    });
    cols = cols.slice(0, 13).concat([{ nome: 'DEMAIS OSE', q: m }]);
  }

  const n = Math.max(cols.length, 3);
  const st3 = styleOf(q, 'K3');
  const wbx = await z.file('xl/workbook.xml')!.async('string');
  const usados = new Set(
    [...wbx.matchAll(/<sheet name="([^"]*)"/g)].map((m) => m[1].toLowerCase())
  );
  let sid = Math.max(...[...wbx.matchAll(/sheetId="(\d+)"/g)].map((m) => +m[1]));
  let nx = 13;
  const newSheets: string[] = [];
  let ct = await z.file('[Content_Types].xml')!.async('string');
  let rels = await z.file('xl/_rels/workbook.xml.rels')!.async('string');
  const linkCol: any[] = [];

  for (let k = 0; k < cols.length; k++) {
    const c = cols[k];
    if (c.os && tpl && tpl[c.os.tipo] && k < 13 + (cols.length > 14 ? 0 : 1)) {
      const tp = tpl[c.os.tipo];
      const svc: Record<string, string> = {};
      tp.servicos.forEach((s) => (svc[s.c] = s.ref));
      const cap = tp.r1 - tp.r0 + 1;
      const rows = c.os.rows || [];
      const pages = [];
      const nomes = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += cap) {
        pages.push(rows.slice(i, i + cap));
      }
      for (let pg = 0; pg < pages.length; pg++) {
        const suf = pg ? ' (' + (pg + 1) + ')' : '';
        const lim =
          String(c.nome)
            .replace(/[\\\/\?\*\[\]:]/g, '')
            .trim()
            .slice(0, 31 - suf.length) + suf;
        const nome = nomeAba(lim, usados);
        const tit = c.nome + suf;
        const aj =
          pg === 0 ? c.os.aj || {} : Object.fromEntries(Object.keys(c.os.aj || {}).map((x) => [x, 0]));

        z.file(
          P(nx),
          await montarOSE(z, tp, { ...c.os, rows: pages[pg], aj, nome: tit }, nome, d, pf, svc)
        );

        ct = ct.replace(
          '</Types>',
          `<Override PartName="/xl/worksheets/sheet${nx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
        );
        rels = rels.replace(
          '</Relationships>',
          `<Relationship Id="rId${900 + nx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${nx}.xml"/></Relationships>`
        );
        newSheets.push(`<sheet name="${ex(nome)}" sheetId="${++sid}" r:id="rId${900 + nx}"/>`);
        nomes.push(nome);
        nx++;
      }
      linkCol[k] = { nomes, svc };
    }
  }

  for (let k = 0; k < n; k++) {
    const L = cl(9 + k);
    q = setCell(q, L + '3', cols[k] ? cols[k].nome : k === 0 ? '—' : '', styleOf(q, L + '3') || st3);
  }

  for (const r of map.resRows) {
    const code = map.rowCode[r];
    const stl = styleOf(q, 'K' + r);
    for (let k = 0; k < n; k++) {
      const ref = cl(9 + k) + r;
      const lk = linkCol[k];
      if (lk) {
        q =
          lk.svc[code] && code
            ? setCell(
                q,
                ref,
                lk.nomes.map((n: string) => "'" + n.replace(/'/g, "''") + "'!" + lk.svc[code]).join('+'),
                stl,
                true
              )
            : setCell(q, ref, null, stl);
      } else {
        const v =
          code && cols[k] && cols[k].q[code] ? Math.round(cols[k].q[code] * 1e6) / 1e6 : null;
        q = setCell(q, ref, v, stl);
      }
    }
  }

  z.file(P(1), strip(capa));
  z.file(P(2), strip(res));
  z.file(P(3), strip(can));
  z.file(P(5), strip(bm));
  z.file(P(8), strip(q));
  z.file(P(12), (await rd(12)).replace(/ tabSelected="1"/, ''));

  let wb = wbx;
  for (const s of ['ESCAVADO', 'REPOSIÇÃO', 'MND']) {
    wb = wb.replace('<sheet name="' + s + '" ', '<sheet name="' + s + '" state="hidden" ');
  }
  wb = wb
    .replace('</sheets>', newSheets.join('') + '</sheets>')
    .replace(/<calcPr[^>]*\/>/, '<calcPr calcId="191029" fullCalcOnLoad="1"/>')
    .replace(/firstSheet="\d+"/, 'firstSheet="0"')
    .replace(/activeTab="\d+"/, 'activeTab="0"');

  z.file('xl/workbook.xml', wb);
  z.remove('xl/calcChain.xml');
  z.file('xl/_rels/workbook.xml.rels', rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''));
  z.file('[Content_Types].xml', ct.replace(/<Override [^>]*calcChain[^>]*\/>/, ''));

  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
