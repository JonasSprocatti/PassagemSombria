import { test } from "node:test";
import assert from "node:assert/strict";
import { relatorioFichas, checarFicha, danoMedio } from "../public/js/relatorio-fichas.js";
import { RACAS, CLASSES, ARMAS } from "../public/js/dados-jogo.js";
import { calc, novaFichaDados } from "../public/js/regras.js";

const fichaBase = (extra = {}) => ({ ...novaFichaDados(), raca: RACAS[0].nome, classe: Object.keys(CLASSES)[0], pvMax: 12, pvAtual: 12, ...extra });

test("danoMedio: média dos dados + modificador", () => {
  assert.equal(danoMedio("1d6"), 3.5);
  assert.equal(danoMedio("2d6+1"), 8);
  assert.equal(danoMedio("lixo"), null);
});

test("checarFicha acusa estados impossíveis", () => {
  const f = fichaBase({ pvAtual: 999, creditos: -5, implantes: ["Implante Que Não Existe"], inventario: [{ tipo: "arma", nome: "Arma Fantasma", equip: true }] });
  const txt = checarFicha(f, calc(f)).filter(([n]) => n === "erro").map(([, t]) => t).join("\n");
  assert.match(txt, /PV atual 999 acima do máximo/);
  assert.match(txt, /créditos negativos/);
  assert.match(txt, /implante desconhecido/);
  assert.match(txt, /arma desconhecida/);
});

test("checarFicha acusa raça/classe desconhecida", () => {
  const f = fichaBase({ raca: "Elfo", classe: "Bardo" });
  const erros = checarFicha(f, calc(f)).map(([, t]) => t);
  assert.ok(erros.some((t) => /raça desconhecida/.test(t)));
  assert.ok(erros.some((t) => /classe desconhecida/.test(t)));
});

test("relatorioFichas monta tabela e seção por ficha", () => {
  const arma = ARMAS[0];
  const linhas = [{ id: "x1", nome: "Teste", dono: "jogador", dados: fichaBase({ inventario: [{ tipo: "arma", nome: arma.n, equip: true }] }) }];
  const md = relatorioFichas(linhas);
  assert.match(md, /\| Teste \| jogador \|/);
  assert.match(md, /### Teste \(jogador\)/);
  assert.ok(md.includes(arma.n));
});
