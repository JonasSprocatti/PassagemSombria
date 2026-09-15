// Testes das regras "puras" de dados-jogo.js — sem tela, sem Supabase.
// Roda com: node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chavesDaArma, propsArma, ARMAS, KEYWORDS, IMPLANTES, PALAVRAS_CHAVE } from "../public/js/dados-jogo.js";
import { parseDice } from "../public/js/regras.js";
import { FichaEfeitos, Portador } from "../public/js/efeitos.js";

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

// Regressão: `chavesDaArma` só casa por EXATO ou por PREFIXO quando o kw não tem
// vírgula/·. Um nome composto (ex. "Pesada / Queimadura") sem entrada própria em
// PALAVRAS_CHAVE cai no prefixo mais curto que bater ("Pesada"), perdendo a outra
// metade do efeito silenciosamente. Toda arma cadastrada precisa ter uma chave
// EXATA no dicionário — nenhuma pode depender do fallback fuzzy.
describe("conteúdo das armas: toda arma tem uma chave EXATA em PALAVRAS_CHAVE (sem depender do fuzzy-match)", () => {
  for (const arma of ARMAS) {
    if (!arma.kw) continue;
    test(`"${arma.n}" (kw: "${arma.kw}")`, () => {
      assert.ok(PALAVRAS_CHAVE[arma.kw], `"${arma.kw}" não é uma chave exata de PALAVRAS_CHAVE — vai cair no fuzzy-match`);
    });
  }
});

// Regressão: 4 palavras-chave existiam só como `{ props: {} }` — nenhum campo,
// nenhum efeito, apesar do texto em KEYWORDS prometer uma mecânica. Confere que
// toda entrada do dicionário tem PELO MENOS um jeito de fazer alguma coisa:
// ignoraArmadura, aoAcertar, efeitos, ou um prop reconhecido fora do baseline
// puramente descritivo (agil/oculta/brutal/area/alcance são consumidos em algum
// lugar do app; um objeto `props` totalmente vazio é sempre inerte).
describe("PALAVRAS_CHAVE: nenhuma entrada é totalmente inerte", () => {
  for (const [nome, def] of Object.entries(PALAVRAS_CHAVE)) {
    test(`"${nome}" faz alguma coisa`, () => {
      const props = def.props || {};
      const temProp = Object.keys(props).length > 0;
      const fazAlgo = temProp || def.ignoraArmadura || (def.aoAcertar && Object.keys(def.aoAcertar).length)
        || (def.efeitos && def.efeitos.length);
      assert.ok(fazAlgo, `"${nome}" não declara props, ignoraArmadura, aoAcertar nem efeitos — é inerte`);
    });
  }
});

// Palavras de Área precisam de `raio` pra `[data-atq]` conseguir montar o
// seletor de epicentro — sem isso, a "Área" nunca atinge mais de um alvo.
describe("PALAVRAS_CHAVE: toda palavra de Área declara um raio", () => {
  for (const [nome, def] of Object.entries(PALAVRAS_CHAVE)) {
    if (!def.props?.area) continue;
    test(`"${nome}" tem props.raio numérico`, () => {
      assert.equal(typeof def.props.raio, "number");
      assert.ok(def.props.raio > 0);
    });
  }
});

// Regressão do bug de verdade: Anti-Sintético/Ferramenta declaravam
// `{tipo:"dano",valor:2,contra:"robos"}`, mas `combina("robos")` depende do
// `alvo` passado a `modificarAtaque()` — que `[data-atq]` nunca preenchia. Este
// teste cobre o MOTOR (efeitos.js), que é a parte testável fora do navegador:
// confirma que o efeito dispara quando o alvo bate com o padrão de "robô" e
// fica de fora quando não bate — a parte que faltava era só ligar o fio em
// app.js (`alvo: alvoParaEfeitos`), já corrigida.
describe("dano contra 'robos' (Anti-Sintético) dispara só com o alvo certo", () => {
  const fe = new FichaEfeitos([new Portador("Rifle Anti-Sintético",
    { efeitos: [{ tipo: "dano", valor: 2, contra: "robos", momento: "ao_atacar" }] })]);
  test("alvo com nome de sintético: +2 de dano", () => {
    const ctx = fe.modificarAtaque({ acerto: 0, dano: 0, arma: { tipo: "fogo" }, alvo: { nome: "Drone Sentinela" } });
    assert.equal(ctx.dano, 2);
  });
  test("alvo orgânico comum: sem bônus", () => {
    const ctx = fe.modificarAtaque({ acerto: 0, dano: 0, arma: { tipo: "fogo" }, alvo: { nome: "Bandido de Rua" } });
    assert.equal(ctx.dano, 0);
  });
  test("sem alvo nenhum (como era o bug): sem bônus, não quebra", () => {
    const ctx = fe.modificarAtaque({ acerto: 0, dano: 0, arma: { tipo: "fogo" } });
    assert.equal(ctx.dano, 0);
  });
});

// Implantes com `ataque` declarado (ex. Lâmina Oculta Retrátil) agem como uma
// arma extra em telaMesa (ver `implanteComoArma`/`catDoAtaque` em app.js) — o
// dado precisa parsear e, se declarar kw, precisa ser reconhecido do mesmo jeito
// que uma arma de verdade, senão o ataque do implante sai sem descrição/mudo.
describe("conteúdo dos implantes: todo `ataque` declarado tem dado válido e kw reconhecido", () => {
  for (const imp of IMPLANTES) {
    if (!imp.ataque) continue;
    test(`"${imp.n}" (dano: "${imp.ataque.dano}")`, () => {
      assert.ok(parseDice(imp.ataque.dano), `dado de dano "${imp.ataque.dano}" não parseia`);
      assert.ok(["branca", "fogo"].includes(imp.ataque.tipo || "branca"), `tipo de ataque inválido em "${imp.n}"`);
      if (imp.ataque.kw) assert.ok(chavesDaArma(imp.ataque).length > 0, `kw "${imp.ataque.kw}" não reconhecido`);
    });
  }
});
