import test from 'node:test';
import assert from 'node:assert/strict';
import { Motor } from './motor';
import { calc, fmt, pn, dbr, ordC, stC, filtC, dashRows, buildDash } from './calc';
import { Config, Contrato, PrecoItem } from '../types';

test('Motor: parses and executes arithmetic and cell references', () => {
  const cells = {
    A1: 10,
    A2: 25,
    A3: '=A1+A2',
    B1: '=A3*2',
  };
  const compiled = Motor.build(cells);
  const runtime = Motor.run(compiled, {});
  assert.equal(runtime.get('A3'), 35);
  assert.equal(runtime.get('B1'), 70);
});

test('Motor: IF, SUM and ROUND functions work accurately', () => {
  const cells = {
    A1: 5.456,
    A2: 2.123,
    A3: '=ROUND(A1+A2, 2)',
    A4: '=IF(A3>7, "Alto", "Baixo")',
    A5: '=SUM(A1:A2)',
  };
  const compiled = Motor.build(cells);
  const runtime = Motor.run(compiled, {});
  assert.equal(runtime.get('A3'), 7.58);
  assert.equal(runtime.get('A4'), 'Alto');
  assert.ok(Math.abs(runtime.get('A5') - 7.579) < 1e-4);
});

test('Formatting: pt-BR currency and date helpers', () => {
  assert.equal(fmt(1234567.89), '1.234.567,89');
  assert.equal(fmt(0), '0,00');
  assert.equal(pn('1.234.567,89'), 1234567.89);
  assert.equal(pn(500), 500);
  assert.equal(dbr('2026-10-29'), '29/10/2026');
});

test('Calc: computes contract financial indicators L, M, N, O, P, Q, R, S, T', () => {
  const cfg: Config = {
    periodo: { ini: '2026-10-01', fim: '2026-10-31' },
    k: 0.015,
    precos: [{ c: '20201', d: 'Serviço Teste', u: 'm', p: 100, q: 10 }],
    contratos: [
      {
        id: 'c1',
        n: '4001/2026',
        obra: 'Obra Teste 1',
        L: 100000,
        O: 5000,
        P: 20000,
        nl: 0,
        p: 'Polo Central',
      },
    ],
    frentes: [],
    equipes: [],
    rem: [],
  };

  const prm: Record<string, PrecoItem> = {
    '20201': cfg.precos[0],
  };

  const c = cfg.contratos[0];
  const res = calc(c, cfg, {}, prm, {});

  // L = 100000, P = 20000
  // T = L - P = 80000
  // O = 5000, N = 0
  // M = T > 0 ? (T - N - O < 0 ? T : N + O) : 0 => N + O = 5000
  // R = Math.max(L - N - P - O, 0) = 100000 - 0 - 20000 - 5000 = 75000
  // Q = 0 (since L - P > 0)
  // S = 0
  assert.equal(res.T, 80000);
  assert.equal(res.M, 5000);
  assert.equal(res.R, 75000);
  assert.equal(res.Q, 0);
  assert.equal(res.S, 0);
});

test('Contracts ordering: standard numbers first sorted, Aguardando last', () => {
  const contracts: Contrato[] = [
    { id: '1', n: 'Aguardando', obra: 'Obra Z', L: 0, O: 0, P: 0, nl: 0, p: '' },
    { id: '2', n: '4084/2026', obra: 'Indaial', L: 0, O: 0, P: 0, nl: 0, p: '' },
    { id: '3', n: '4072/2026', obra: 'Pouso Redondo', L: 0, O: 0, P: 0, nl: 0, p: '' },
  ];

  const sorted = ordC(contracts);
  assert.equal(sorted[0].n, '4072/2026');
  assert.equal(sorted[1].n, '4084/2026');
  assert.equal(sorted[2].n, 'Aguardando');
});

test('buildDash: injects serialized dashboard rows into template script tag', () => {
  const template = '<html><head><script id="dados" type="application/json">{"rows":[],"atualizado":""}</script></head></html>';
  const rows = [{ c: '4072/2026', o: 'Pouso Redondo', v: 430000 }];
  const out = buildDash(template, rows, '2026-10-29');
  assert.ok(out.includes('"4072/2026"'));
  assert.ok(out.includes('"Pouso Redondo"'));
  assert.ok(out.includes('"2026-10-29"'));
});

test('Calc: remanejamento deducts from origin Q and relieves S, adds to destination P/O', () => {
  const cfg: Config = {
    periodo: { ini: '2026-10-01', fim: '2026-10-31' },
    k: 0.015,
    precos: [],
    contratos: [
      {
        id: 'c1',
        n: '4084/2026',
        obra: 'Indaial',
        L: 415000,
        O: 0,
        P: 415260.57, // baseQ = 260.57, baseS = -260.57
        nl: 0,
        p: 'Rio do Sul',
      },
      {
        id: 'c2',
        n: '4316/2026',
        obra: 'Rio do Sul',
        L: 1000000,
        O: 0,
        P: 100000,
        nl: 0,
        p: 'Rio do Sul',
      },
    ],
    frentes: [],
    equipes: [],
    rem: [
      {
        id: 'rem1',
        de: 'c1',
        para: 'c2',
        valor: 260.57,
        data: '2026-11-01',
        st: 'med',
      },
    ],
  };

  const resOrigem = calc(cfg.contratos[0], cfg, {}, {}, {});
  assert.equal(resOrigem.Q, 0); // 260.57 deducted from retained balance
  assert.equal(resOrigem.S, 0); // -260.57 + 260.57 = 0

  const resDestino = calc(cfg.contratos[1], cfg, {}, {}, {});
  assert.equal(resDestino.P, 100260.57); // 260.57 added to accumulated measured
});

