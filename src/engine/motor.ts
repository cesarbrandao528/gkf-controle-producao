/**
 * Motor de fórmulas Excel embutido para cálculo de trechos e OSE (CASAN)
 */

export class ExcelError {
  c: string;
  constructor(c: string) {
    this.c = c;
  }
}

export const colN = (s: string): number => {
  let n = 0;
  for (const ch of s) {
    n = n * 26 + ch.charCodeAt(0) - 64;
  }
  return n;
};

export const colL = (n: number): string => {
  let s = '';
  while (n) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const TK = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?)|"((?:[^"]|"")*)"|([A-Z][A-Z0-9.]*)(?=\()|(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)|(<>|<=|>=|[-+*\/^&=<>(),%])|(TRUE|FALSE))/gy;

export function parse(src: string): any {
  const t: any[] = [];
  TK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (TK.lastIndex < src.length && (m = TK.exec(src))) {
    if (m[1] !== undefined) t.push(['n', +m[1]]);
    else if (m[2] !== undefined) t.push(['s', m[2].replace(/""/g, '"')]);
    else if (m[3] !== undefined) t.push(['f', m[3]]);
    else if (m[4] !== undefined) t.push(['r', m[4]]);
    else if (m[5] !== undefined) t.push(['o', m[5]]);
    else t.push(['b', m[6] === 'TRUE']);
  }
  if (TK.lastIndex < src.trim().length) throw new Error('fórmula não suportada: ' + src);

  let p = 0;
  const nx = () => t[p++];
  const isO = (o: string) => t[p] && t[p][0] === 'o' && t[p][1] === o;
  const ref = (s: string) => {
    const q = s.replace(/\$/g, '').split(':');
    const a = /([A-Z]+)(\d+)/.exec(q[0])!;
    const b = q[1] ? /([A-Z]+)(\d+)/.exec(q[1])! : a;
    return q[1]
      ? ['g', colN(a[1]), +a[2], colN(b[1]), +b[2]]
      : ['c', colN(a[1]), +a[2]];
  };

  function cmp() {
    let l = cat();
    while (t[p] && t[p][0] === 'o' && ['=', '<>', '<', '>', '<=', '>='].includes(t[p][1])) {
      const o = nx()[1];
      l = ['B', o, l, cat()];
    }
    return l;
  }

  function cat() {
    let l = add();
    while (isO('&')) {
      nx();
      l = ['B', '&', l, add()];
    }
    return l;
  }

  function add() {
    let l = mul();
    while (isO('+') || isO('-')) {
      const o = nx()[1];
      l = ['B', o, l, mul()];
    }
    return l;
  }

  function mul() {
    let l = pow();
    while (isO('*') || isO('/')) {
      const o = nx()[1];
      l = ['B', o, l, pow()];
    }
    return l;
  }

  function pow() {
    let l = un();
    while (isO('^')) {
      nx();
      l = ['B', '^', l, un()];
    }
    return l;
  }

  function un(): any {
    if (isO('-')) {
      nx();
      return ['u', un()];
    }
    if (isO('+')) {
      nx();
      return un();
    }
    return pc();
  }

  function pc(): any {
    let x = pr();
    while (isO('%')) {
      nx();
      x = ['B', '/', x, ['n', 100]];
    }
    return x;
  }

  function pr(): any {
    const k = nx();
    if (!k) throw new Error('fim inesperado');
    if (k[0] === 'n' || k[0] === 's' || k[0] === 'b') return k;
    if (k[0] === 'r') return ref(k[1]);
    if (k[0] === 'f') {
      nx();
      const a = [];
      if (!isO(')')) {
        do {
          a.push(cmp());
        } while (isO(',') && nx());
      }
      nx();
      return ['F', k[1], a];
    }
    if (k[0] === 'o' && k[1] === '(') {
      const e = cmp();
      nx();
      return e;
    }
    throw new Error('token inesperado');
  }

  return cmp();
}

export function build(cells: Record<string, any>): Record<string, any> {
  const C: Record<string, any> = {};
  for (const k in cells) {
    const v = cells[k];
    C[k] = typeof v === 'string' && v[0] === '=' ? { f: parse(v.slice(1)) } : { v };
  }
  return C;
}

export function run(C: Record<string, any>, inp: Record<string, any>) {
  const X: Record<string, any> = Object.assign({}, C);
  const memo: Record<string, any> = {};
  const busy: Record<string, any> = {};
  for (const k in inp) X[k] = { v: inp[k] };

  const num = (v: any) => {
    if (v instanceof ExcelError) return v;
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = +String(v).replace(',', '.');
    return isNaN(n) ? new ExcelError('#VALUE!') : n;
  };

  const isn = (v: any) => typeof v === 'number';
  const cell = (c: number, r: number) => get(colL(c) + r);

  function get(k: string): any {
    if (k in memo) return memo[k];
    const x = X[k];
    if (!x) return null;
    if (!x.f) return x.v === undefined ? null : x.v;
    if (busy[k]) return new ExcelError('#REF!');
    busy[k] = 1;
    let v = ev(x.f);
    if (v == null) v = 0;
    busy[k] = 0;
    return (memo[k] = v);
  }

  const rng = (n: any[]) => {
    const o: any[] = [];
    for (let r = n[2]; r <= n[4]; r++) {
      for (let c = n[1]; c <= n[3]; c++) {
        o.push(cell(c, r));
      }
    }
    return o;
  };

  const tru = (v: any) => {
    if (v instanceof ExcelError) return v;
    if (typeof v === 'string') return v.toUpperCase() === 'TRUE' ? true : new ExcelError('#VALUE!');
    return !!num(v);
  };

  const eq = (a: any, b: any) => {
    if (a == null) a = typeof b === 'string' ? '' : 0;
    if (b == null) b = typeof a === 'string' ? '' : 0;
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
    return a === b;
  };

  const cmpv = (o: string, a: any, b: any) => {
    if (a instanceof ExcelError) return a;
    if (b instanceof ExcelError) return b;
    if (o === '=' || o === '<>') {
      const r = eq(a, b);
      return o === '=' ? r : !r;
    }
    if (a == null) a = typeof b === 'string' ? '' : 0;
    if (b == null) b = typeof a === 'string' ? '' : 0;
    const ra = typeof a === 'string' ? 1 : 0;
    const rb = typeof b === 'string' ? 1 : 0;
    const d =
      ra !== rb
        ? ra - rb
        : ra
          ? a.toLowerCase() < b.toLowerCase()
            ? -1
            : a.toLowerCase() > b.toLowerCase()
              ? 1
              : 0
          : a - b;
    return o === '<' ? d < 0 : o === '>' ? d > 0 : o === '<=' ? d <= 0 : d >= 0;
  };

  const crit = (cr: any) => {
    let o = '=';
    let v = cr;
    if (typeof cr === 'string') {
      const m = /^(<>|<=|>=|=|<|>)(.*)$/.exec(cr);
      if (m) {
        o = m[1];
        v = m[2];
      }
      const n = v !== '' && !isNaN(+v) ? +v : v;
      v = n;
    }
    return (x: any) => {
      if (x instanceof ExcelError) return false;
      if (typeof v === 'number') {
        const n = typeof x === 'number' ? x : typeof x === 'string' && x !== '' && !isNaN(+x) ? +x : null;
        if (n == null) return o === '<>';
        return o === '=' ? n === v : o === '<>' ? n !== v : o === '<' ? n < v : o === '>' ? n > v : o === '<=' ? n <= v : n >= v;
      }
      const s = x == null ? '' : String(x).toLowerCase();
      const w = String(v).toLowerCase();
      return o === '<>' ? s !== w : s === w;
    };
  };

  function ev(n: any[]): any {
    switch (n[0]) {
      case 'n':
      case 's':
      case 'b':
        return n[1];
      case 'c':
        return cell(n[1], n[2]);
      case 'g':
        return new ExcelError('#VALUE!');
      case 'u': {
        const v = num(ev(n[1]));
        return v instanceof ExcelError ? v : -v;
      }
      case 'B': {
        const o = n[1];
        let a = ev(n[2]);
        let b = ev(n[3]);
        if (['=', '<>', '<', '>', '<=', '>='].includes(o)) return cmpv(o, a, b);
        if (o === '&')
          return a instanceof ExcelError
            ? a
            : b instanceof ExcelError
              ? b
              : String(a == null ? '' : a) + String(b == null ? '' : b);
        a = num(a);
        b = num(b);
        if (a instanceof ExcelError) return a;
        if (b instanceof ExcelError) return b;
        if (o === '+') return a + b;
        if (o === '-') return a - b;
        if (o === '*') return a * b;
        if (o === '/') return b === 0 ? new ExcelError('#DIV/0!') : a / b;
        return Math.pow(a, b);
      }
      case 'F':
        return fn(n[1], n[2]);
    }
  }

  function fn(f: string, a: any[]): any {
    const flat = (skipText?: number) => {
      const o: any[] = [];
      for (const x of a) {
        if (x[0] === 'g') o.push(...rng(x));
        else if (skipText === 2 && x[0] === 'c') o.push(ev(x));
        else o.push(ev(x));
      }
      return o;
    };

    switch (f) {
      case 'IF': {
        const c = tru(ev(a[0]));
        if (c instanceof ExcelError) return c;
        return c ? ev(a[1]) : a.length > 2 ? ev(a[2]) : false;
      }
      case 'IFERROR': {
        const v = ev(a[0]);
        return v instanceof ExcelError ? ev(a[1]) : v;
      }
      case 'SUM':
      case 'AVERAGE':
      case 'MAX':
      case 'MIN': {
        let s = 0;
        let k = 0;
        let mx = -Infinity;
        let mn = Infinity;
        for (const x of a) {
          const direct = x[0] !== 'g' && x[0] !== 'c';
          const vs = x[0] === 'g' ? rng(x) : [ev(x)];
          for (const v of vs) {
            if (v instanceof ExcelError) return v;
            let q = null;
            if (isn(v)) q = v;
            else if (direct && v != null && v !== '') {
              q = num(v);
              if (q instanceof ExcelError) return q;
            } else if (typeof v === 'boolean' && direct) q = v ? 1 : 0;
            if (q != null) {
              s += q;
              k++;
              mx = Math.max(mx, q);
              mn = Math.min(mn, q);
            }
          }
        }
        return f === 'SUM'
          ? s
          : f === 'AVERAGE'
            ? k
              ? s / k
              : new ExcelError('#DIV/0!')
            : f === 'MAX'
              ? k
                ? mx
                : 0
              : k
                ? mn
                : 0;
      }
      case 'SUMIF': {
        const g = a[0];
        const t = crit(ev(a[1]));
        const s = a[2] || a[0];
        const R = rng(g);
        const S = rng(['g', s[1], s[2], s[1] + (g[3] - g[1]), s[2] + (g[4] - g[2])]);
        let tot = 0;
        R.forEach((v, i) => {
          if (t(v) && isn(S[i])) tot += S[i];
        });
        return tot;
      }
      case 'OR':
      case 'AND': {
        const r = f === 'AND';
        for (const v of flat()) {
          if (v == null || v === '') continue;
          const b = tru(v);
          if (b instanceof ExcelError) return b;
          if (f === 'OR' && b) return true;
          if (f === 'AND' && !b) return false;
        }
        return r ? true : false;
      }
      case 'ROUND': {
        const v = num(ev(a[0]));
        if (v instanceof ExcelError) return v;
        const d = num(ev(a[1]));
        if (d instanceof ExcelError) return d;
        const p = Math.pow(10, d);
        return (Math.sign(v) * Math.round(Math.abs(v) * p + 1e-9)) / p;
      }
      case 'TODAY':
        return Math.floor((Date.now() - Date.UTC(1899, 11, 30)) / 864e5);
      default:
        return new ExcelError('#NAME?');
    }
  }

  return {
    get,
    ev: (k: string) => {
      const v = get(k);
      return v instanceof ExcelError ? v.c : v;
    },
  };
}

export const Motor = {
  parse,
  build,
  run,
  colN,
  colL,
  ExcelError,
};
