// Testes das regras "puras" de dados-jogo.js — sem tela, sem Supabase.
// Roda com: node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chavesDaArma, propsArma, ARMAS, KEYWORDS } from "../public/js/dados-jogo.js";

describe("chavesDaArma", () => {
  test("separa uma arma com várias palavras-chave, uma por uma", () => {
    const chaves = chavesDaArma({ kw: "Destruidora, Perfurante, Aparar" });
    assert.equal(chaves.length, 3);
    assert.deepEqual(chaves.map((c) => c.nome), ["Destruidora", "Perfurante", "Aparar"]);
  });

  test("arma sem palavra-chave devolve lista vazia", () => {
    assert.deepEqual(chavesDaArma({ kw: "" }), []);
    assert.deepEqual(chavesDaArma({}), []);
  });

  test("kw composto sem vírgula (ex. 'Pesada / Queimadura') não é quebrado em duas", () => {
    // Só vírgula e · separam palavras-chave; "/" dentro de uma frase é uma frase só.
    const chaves = chavesDaArma({ kw: "Pesada / Queimadura" });
    assert.equal(chaves.length, 1);
  });
});

describe("propsArma", () => {
  test("Perfurante marca ignoraArmadura", () => {
    const p = propsArma({ kw: "Perfurante" });
    assert.equal(p.ignoraArmadura, 2);
  });

  test("com várias keywords, usa a maior ignoraArmadura entre elas (não soma)", () => {
    // Perfurante ignora 2, Perfurante Leve ignora 1 — juntas na mesma arma, vale a maior.
    const p = propsArma({ kw: "Perfurante, Perfurante Leve" });
    assert.equal(p.ignoraArmadura, 2);
  });

  test("Brutal/Destruidora marcam vantagem no dado de dano", () => {
    assert.equal(propsArma({ kw: "Brutal" }).brutal, true);
    assert.equal(propsArma({ kw: "Destruidora" }).brutal, true);
  });

  // Regressão do bug relatado em produção: a descrição (`efeito`) de uma arma com
  // várias palavras-chave saía "Destruidora, Perfurante, Aparar: Destruidora, Perfurante,
  // Aparar." — repetindo o rótulo como se fosse a explicação, porque KEYWORDS era
  // buscado pela string INTEIRA da arma, que nunca bate com nada, e caía de volta
  // no próprio texto cru.
  test("efeito nunca é igual ao texto cru da arma (não duplica)", () => {
    const cat = { kw: "Destruidora, Perfurante, Aparar" };
    const p = propsArma(cat);
    assert.notEqual(p.efeito, cat.kw);
    assert.ok(p.efeito.includes(KEYWORDS["Perfurante"]));
    assert.ok(p.efeito.includes(KEYWORDS["Aparar"]));
  });

  // Regressão do PRÓPRIO conserto acima: uma arma com um kw composto só (sem vírgula,
  // ex. "Pesada / Queimadura") tem em KEYWORDS uma frase específica pra essa combinação
  // exata. Juntar palavra por palavra (via chaves[].nome, que já vem fuzzy-casado pra
  // "Pesada" sozinho) perde a parte "queimadura" da descrição — o efeito tem que
  // preferir a frase inteira quando ela existir.
  test("kw composto usa a descrição específica do dicionário, não a genérica por palavra", () => {
    const p = propsArma({ kw: "Pesada / Queimadura" });
    assert.equal(p.efeito, KEYWORDS["Pesada / Queimadura"]);
    assert.notEqual(p.efeito, KEYWORDS["Pesada"]);
  });

  test("arma sem palavra-chave não tem efeito nem propriedades especiais", () => {
    const p = propsArma({ kw: "" });
    assert.equal(p.efeito, "");
    assert.equal(p.ignoraArmadura, 0);
    assert.equal(p.brutal, false);
  });
});

// Sanidade do conteúdo: toda arma cadastrada em ARMAS precisa reconhecer sua
// palavra-chave (chavesDaArma nunca fica vazia) e ganhar uma descrição de verdade
// (não pode sair igual ao texto cru salvo no cadastro).
describe("conteúdo das armas: toda arma com kw reconhece sua(s) palavra(s)-chave", () => {
  for (const arma of ARMAS) {
    if (!arma.kw) continue;
    test(`"${arma.n}" (kw: "${arma.kw}")`, () => {
      assert.ok(chavesDaArma(arma).length > 0, `chavesDaArma não reconheceu nada em "${arma.kw}"`);
      const efeito = propsArma(arma).efeito;
      assert.ok(efeito, `propsArma não gerou nenhuma descrição para "${arma.kw}"`);
      assert.notEqual(efeito, arma.kw, `descrição de "${arma.n}" saiu igual ao texto cru do kw`);
    });
  }
});
