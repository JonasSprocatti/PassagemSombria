// Testes das regras "puras" de dados-jogo.js — sem tela, sem Supabase.
// Roda com: node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chavesDaArma, propsArma, ARMAS, KEYWORDS, IMPLANTES, PALAVRAS_CHAVE, MODS_ARMA, NAVES } from "../public/js/dados-jogo.js";
import { parseDice } from "../public/js/regras.js";
import { FichaEfeitos, Portador } from "../public/js/efeitos.js";

describe("chavesDaArma", () => {
  test("separa uma arma com várias palavras-chave, uma por uma", () => {
    const chaves = chavesDaArma({ kw: "Brutal, Perfurante, Aparar" });
    assert.equal(chaves.length, 3);
    assert.deepEqual(chaves.map((c) => c.nome), ["Brutal", "Perfurante", "Aparar"]);
  });

  test("arma sem palavra-chave devolve lista vazia", () => {
    assert.deepEqual(chavesDaArma({ kw: "" }), []);
    assert.deepEqual(chavesDaArma({}), []);
  });

  test("kw composto sem vírgula (ex. 'Ultra-Oculta / Surpresa') não é quebrado em duas", () => {
    // Só vírgula e · separam palavras-chave; "/" dentro de uma frase é uma frase só.
    const chaves = chavesDaArma({ kw: "Ultra-Oculta / Surpresa" });
    assert.equal(chaves.length, 1);
  });
});

describe("propsArma", () => {
  test("Perfurante marca ignoraArmadura", () => {
    const p = propsArma({ kw: "Perfurante" });
    assert.equal(p.ignoraArmadura, 2);
  });

  // Duas palavras-chave que concedem o MESMO tipo de bônus (aqui, ignora armadura)
  // SOMAM — não fica só a maior, e não sobrescreve uma a outra. Mesma regra vale
  // pra `raio`/`empurrao` de palavras de Área (ver comentário em propsArma()).
  test("com várias keywords do mesmo tipo de bônus, os valores somam", () => {
    const p = propsArma({ kw: "Perfurante, Perfurante Leve" });
    assert.equal(p.ignoraArmadura, 3);
  });

  test("Brutal e Certeira (a antiga 'Destruidora') marcam Vantagem — cada uma na sua metade", () => {
    assert.equal(propsArma({ kw: "Brutal" }).brutal, true);
    assert.equal(propsArma({ kw: "Brutal, Certeira" }).brutal, true);
    const vantAcerto = propsArma({ kw: "Certeira" }).efeitos.find((e) => e.tipo === "vantagem");
    assert.ok(vantAcerto, "Certeira devia declarar um efeito de vantagem no ataque");
  });

  // Regressão do bug relatado em produção: a descrição (`efeito`) de uma arma com
  // várias palavras-chave saía "Brutal, Perfurante, Aparar: Brutal, Perfurante,
  // Aparar." — repetindo o rótulo como se fosse a explicação, porque KEYWORDS era
  // buscado pela string INTEIRA da arma, que nunca bate com nada, e caía de volta
  // no próprio texto cru.
  test("efeito nunca é igual ao texto cru da arma (não duplica)", () => {
    const cat = { kw: "Brutal, Perfurante, Aparar" };
    const p = propsArma(cat);
    assert.notEqual(p.efeito, cat.kw);
    assert.ok(p.efeito.includes(KEYWORDS["Perfurante"]));
    assert.ok(p.efeito.includes(KEYWORDS["Aparar"]));
  });

  // Regressão do PRÓPRIO conserto acima: uma arma com um kw composto só (sem vírgula,
  // ex. "Ultra-Oculta / Surpresa") tem em KEYWORDS uma frase específica pra essa
  // combinação exata. Juntar palavra por palavra (via chaves[].nome, que cairia no
  // fuzzy-match de "Ultra-Oculta" pra... nada, já que não é prefixo de nenhuma chave)
  // perderia a descrição — o efeito tem que preferir a frase inteira quando ela existir.
  test("kw composto usa a descrição específica do dicionário, não a genérica por palavra", () => {
    const p = propsArma({ kw: "Ultra-Oculta / Surpresa" });
    assert.equal(p.efeito, KEYWORDS["Ultra-Oculta / Surpresa"]);
    assert.notEqual(p.efeito, "");
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

// Regressão direta do bug pego pelo teste acima: "Área" tinha entrada em
// PALAVRAS_CHAVE (props.area/raio) mas ficou sem texto em KEYWORDS — nenhuma
// arma com kw:"Área" sozinha (sem outra palavra-chave junto) tinha descrição
// nenhuma (`propsArma().efeito` saía ""). Checa isso pra TODA entrada de
// PALAVRAS_CHAVE de uma vez, sem depender de existir uma arma cadastrada que
// use aquela chave sozinha — pega o gap na hora de criar a palavra-chave, não
// só quando alguém cadastra uma arma com ela.
describe("toda entrada de PALAVRAS_CHAVE tem texto correspondente em KEYWORDS", () => {
  for (const nome of Object.keys(PALAVRAS_CHAVE)) {
    test(`"${nome}" tem descrição em KEYWORDS`, () => {
      assert.ok(KEYWORDS[nome], `"${nome}" existe em PALAVRAS_CHAVE mas não tem texto em KEYWORDS — propsArma().efeito sai vazio pra arma que usar só essa palavra-chave`);
    });
  }
});

// Regressão: `chavesDaArma` só casa por EXATO ou por PREFIXO quando um pedaço do
// kw (cada um separado por vírgula/·) não bate direto. Um nome composto sem
// entrada própria em PALAVRAS_CHAVE cai no prefixo mais curto que bater (ex. a
// antiga "Pesada / Queimadura" caía em "Pesada" sozinha), perdendo a outra
// metade do efeito silenciosamente. Cada PEDAÇO do kw de toda arma cadastrada
// precisa ter uma chave EXATA no dicionário — nenhum pode depender do fallback
// fuzzy. Armas hoje podem ter mais de uma palavra-chave separada por vírgula
// (ex. "Brutal, Certeira") — por isso o teste checa pedaço por pedaço, não a
// string inteira do `kw`.
describe("conteúdo das armas: cada palavra-chave do kw é uma entrada EXATA em PALAVRAS_CHAVE (sem depender do fuzzy-match)", () => {
  for (const arma of ARMAS) {
    if (!arma.kw) continue;
    test(`"${arma.n}" (kw: "${arma.kw}")`, () => {
      const pedacos = arma.kw.split(/,|·/).map((x) => x.trim()).filter(Boolean);
      for (const pedaco of pedacos)
        assert.ok(PALAVRAS_CHAVE[pedaco], `"${pedaco}" (de "${arma.kw}") não é uma chave exata de PALAVRAS_CHAVE — vai cair no fuzzy-match`);
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

// `raio`/`empurrao` seguem a mesma regra de "soma, não sobrescreve" que
// `ignoraArmadura` — nenhuma arma cadastrada combina duas palavras de Área hoje,
// mas o merge em propsArma() tem que ficar protegido pra qualquer conteúdo futuro
// que combine (ex. um mod de bancada que também declare raio/empurrão).
describe("propsArma: raio e empurrao somam entre fontes, igual ignoraArmadura", () => {
  test("duas palavras de Área somam o raio", () => {
    const p = propsArma({ kw: "Área, Artilharia" });
    assert.equal(p.raio, 2 + 5);
  });
  test("empurrao soma se houver mais de uma fonte", () => {
    const p = propsArma({ kw: "Cone de Repulsão, Cone de Repulsão" });
    // mesma palavra-chave duas vezes é um caso degenerado (não deveria acontecer
    // em conteúdo real), mas o merge não pode quebrar nem ficar negativo.
    assert.equal(p.empurrao, 3 + 3);
  });
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

// Regressão do bug de verdade: o mod de bancada "Núcleo Térmico" declarava
// `kw:"Em chamas"` — essa palavra-chave nunca existiu (só a CONDIÇÃO se chama
// assim; a palavra-chave que a aplica é "Queimadura") — o mod estava 100%
// inerte desde sempre. Cada mod que referencia uma palavra-chave (`m.kw`)
// precisa apontar pra uma entrada EXATA de PALAVRAS_CHAVE.
describe("conteúdo dos mods de bancada: todo `kw` referenciado existe em PALAVRAS_CHAVE", () => {
  for (const mod of MODS_ARMA) {
    if (!mod.kw) continue;
    test(`"${mod.n}" (kw: "${mod.kw}")`, () => {
      assert.ok(PALAVRAS_CHAVE[mod.kw], `"${mod.kw}" (mod "${mod.n}") não existe em PALAVRAS_CHAVE`);
    });
  }
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

// Armamento de nave (NAVES[i].armas) — cada arma tem tipo válido, munição
// coerente com o tipo e dado que parseia. Regressão: energia (infinita) não
// pode ter pente/unidades, e balística/míssil precisam do teto declarado,
// senão `capacidadeArma`/`municaoDe` (regras.js) trabalham com `undefined`.
// `area`/`raio` (explosivos, ex. mísseis/torpedos) precisam vir juntos e com
// raio positivo — mesa-nave.js/mesa-combate.js checam `arma.area && arma.raio`
// pra decidir entre o fluxo de área (epicentro) e o de alvo único; um `raio`
// zerado ou ausente com `area:true` faria o filtro de epicentro (`comPos.length`
// com raio 0/undefined) se comportar como "ninguém no raio", silenciosamente.
describe("conteúdo das naves: toda arma declarada tem tipo, munição e dado válidos", () => {
  for (const nave of NAVES) {
    if (!nave.armas?.length) continue;
    for (const arma of nave.armas) {
      test(`"${nave.n}" — "${arma.n}" (${arma.tipo})`, () => {
        assert.ok(parseDice(arma.dano), `dado de dano "${arma.dano}" não parseia`);
        assert.ok(["energia", "balistica", "missil"].includes(arma.tipo), `tipo "${arma.tipo}" inválido`);
        if (arma.tipo === "balistica") assert.ok(arma.pente > 0, `arma balística "${arma.n}" sem pente`);
        if (arma.tipo === "missil") assert.ok(arma.unidades > 0, `míssil "${arma.n}" sem unidades`);
        if (arma.tipo === "energia") assert.ok(arma.pente == null && arma.unidades == null, `arma de energia "${arma.n}" não devia ter pente/unidades`);
        if (arma.area) assert.ok(arma.raio > 0, `arma de área "${arma.n}" sem raio positivo`);
        if (arma.raio != null) assert.ok(arma.area === true, `arma "${arma.n}" tem raio mas não está marcada area:true`);
      });
    }
  }
});
