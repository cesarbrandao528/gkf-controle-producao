/**
 * Data structures for Controle de Produção GKF
 */

export interface PrecoItem {
  c: string; // code, e.g. "20201"
  d: string; // description
  u: string; // unit, e.g. "m³", "m"
  p: number; // unit price R$
  q: number; // initial quantity
}

export interface Contrato {
  id: string;
  n: string; // number, e.g. "4072/2026"
  obra: string; // e.g. "Pouso Redondo - SC"
  L: number; // Contratado / Licitado R$
  O: number; // Pendente de medição anterior R$
  P: number; // Acumulado medido anterior R$
  nl: number; // Não lançado / Legado R$
  p: string; // polo, e.g. "Rio do Sul"
  di?: string | null; // data início
  df?: string | null; // data fim
  resp?: string; // responsável
  bx?: string | null; // data de finalização (baixa)
  qo?: number; // override Q
  so?: number; // override S
}

export interface Frente {
  id: string; // e.g. "rio_do_sul", "apiuna", "ibirama", "presidente_nereu"
  nome: string; // display name
  contrato: string; // id of linked Contrato
  oses?: string[]; // list of OSE names or legacy references
  periodo?: {
    ini: string; // YYYY-MM-DD
    fim: string; // YYYY-MM-DD
  };
}

export interface Equipe {
  id: string;
  nome: string;
}

export interface Remanejamento {
  id: string;
  de: string; // contrato id origem
  para: string; // contrato id destino
  valor: number; // valor R$
  data: string; // YYYY-MM-DD
  st: 'pend' | 'med'; // pendente ou medido
  obs?: string;
  dmed?: string;
}

export interface Config {
  periodo: {
    ini: string;
    fim: string;
  };
  k: number; // Canteiro / adm local factor
  precos: PrecoItem[];
  contratos: Contrato[];
  frentes: Frente[];
  equipes: Equipe[];
  rem?: Remanejamento[];
}

export interface AvulsoItem {
  i: string;
  d: string; // YYYY-MM-DD
  os?: string; // OSE display name
  oid?: string; // OSE id if linked
  c: string; // item code
  q: number; // quantity
}

export interface OSERow {
  d: string; // date YYYY-MM-DD
  v: Record<string, any>; // column key -> value
  eq?: string[]; // array of team ids
}

export interface OSE {
  id: string;
  nome: string;
  tipo: string; // "ESC", "MND", "REP"
  rows: OSERow[];
  aj?: Record<string, number>; // code -> manual adjustment quantity
  ajPct?: Record<string, number>; // code -> percentage adjustment (%) e.g. 10 for +10%
  dmtPo?: number; // DMT Pó / Areia (km)
  dmtSolo?: number; // DMT Solo / Bota-fora (km)
}

export interface FechamentoCol {
  nome: string;
  q: Record<string, number>;
  os?: {
    tipo: string;
    rows: Array<{ d: string | null; v: Record<string, any> }>;
    aj: Record<string, number>;
  };
}

export interface Fechamento {
  n: number;
  ini: string;
  fim: string;
  mun: string;
  ct: string;
  di?: string | null;
  df?: string | null;
  cols: FechamentoCol[];
  em: string; // timestamp ISO
  st: 'pend' | 'med';
  aprov?: string | null;
}

export interface FrenteLancamentos {
  itens: AvulsoItem[];
  oses?: OSE[];
  fech?: Fechamento[];
}

export interface TemplateEntrada {
  k: string; // key, e.g. "B", "C", "D"
  t: 'n' | 's' | 'd'; // number, string, date
  d: string; // label
  u?: string; // unit
}

export interface TemplateServico {
  ref: string; // cell ref, e.g. "N11"
  c: string; // CASAN code, e.g. "20201"
}

export interface Template {
  nome: string;
  r0: number; // first row
  r1: number; // last row in page
  entradas: TemplateEntrada[];
  cells: Record<string, any>;
  servicos: TemplateServico[];
}

export interface CalcResult {
  N: number; // Exec. período (app)
  M: number; // Previsto faturamento / Possível medir
  Q: number; // Saldo retido
  R: number; // Saldo incluso exec. / Saldo a medir
  S: number; // Exec. sem saldo
  T: number; // Saldo de contratos
  U: number; // % avanço
  O: number; // Pendente de medição
  P: number; // Acumulado medido
}

export interface BMMap {
  bm: Record<string, string>; // code -> cell ref
  res: Record<string, string>;
  resRows: number[];
  rowCode: Record<string, string>;
  base: number;
}
