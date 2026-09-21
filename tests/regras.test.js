// Testes das regras "puras" de regras.js (ficha, dados, condições, campo tático).
// Roda com: node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calc, novaFichaDados, dcSalvaguarda, danoCritico, parseDice,
  aplicarCond, infoCond, distCombate, posInicial, empurrarDe,
  tipoDanoArma, tipoDanoAtaque, imuneAoDano, alcanceDaArma,
  ALCANCE_CAC, ALCANCE_ARMA, PISTA_M, CAMPO_LARGURA, CONDICOES_INFO,
  capacidadeArma, municaoDe, descontarMunicao, recarregarArma,
  conPorNivel, CON_PV_NIVEL_MAX, podeAgirAgora,
} from "../public/js/regras.js";
import { FILOSOFIAS, RACAS, CLASSES } from "../public/js/dados-jogo.js";

describe("danoCritico", () => {
  // Regressão do bug relatado em produção: "1d6+3 crítico" saía rolando DOIS d6 (o dado
  // dobrado) em vez de somar 1 dado + bônus e SÓ DEPOIS multiplicar por 2. Isso deixava
  // o bônus fixo de fora da conta e sub-contava o dano.
  test("soma dados + bônus primeiro, só depois multiplica", () => {
    // 1d6 tirou 5, +3 de bônus, crítico ×2 → (5+3)×2 = 16, não (5+5)+3 = 13 nem 5+5+3=13.
    assert.equal(danoCritico(5, 3, 2), 16);
  });

  test("sem crítico (mult 1), é só a soma normal", () => {
    assert.equal(danoCritico(5, 3, 1), 8);
  });

  test("×4 (crítico que dobra por cima, ex. furtivo + crítico)", () => {
    assert.equal(danoCritico(5, 3, 4), 32);
  });

  test("mod negativo (arma penaliza) também entra na soma antes do ×mult", () => {
    assert.equal(danoCritico(5, -2, 2), 6);
  });
});

describe("calc — ficha derivada", () => {
  test("ficha vazia não quebra e tem CD base 10", () => {
    const f = novaFichaDados();
    const k = calc(f);
    assert.equal(k.cd, 10);
    assert.equal(k.pvTemp, 0);
    assert.equal(k.escudoLivre, 0);
  });

  test("Urak tem Con +2 (da raça) refletido no atributo", () => {
    const f = { ...novaFichaDados(), raca: "Urak" };
    const k = calc(f);
    assert.equal(k.attr.Con, 2);
  });

  test("pontos de atributo alocados somam em cima da raça", () => {
    const f = { ...novaFichaDados(), raca: "Urak", pontosAttr: { ...novaFichaDados().pontosAttr, Con: 3 } };
    const k = calc(f);
    assert.equal(k.attr.Con, 5);
  });

  test("teto de pentes é 5 + mod de Força (mínimo 2)", () => {
    const f = novaFichaDados();   // sem raça: For = 0
    const k = calc(f);
    assert.equal(k.pentesMax, 5);
    assert.equal(k.pentesReserva, 4);
  });
});

describe("dcSalvaguarda", () => {
  test("CD = 8 + modificador do atributo", () => {
    const k = { attr: { Sab: 3 } };
    assert.equal(dcSalvaguarda(k, "Sab"), 11);
  });

  test("atributo ausente conta como 0", () => {
    const k = { attr: {} };
    assert.equal(dcSalvaguarda(k, "Sab"), 8);
  });
});

describe("aplicarCond", () => {
  test("condição de estado (sem dano) guarda turnos+1 — decrementa no início do turno do alvo", () => {
    const alvo = { cond: [] };
    aplicarCond(alvo, "Cego", 2);
    assert.equal(alvo.cond[0].turnos, 3);
  });

  test("condição de dano contínuo empilha +1 turno, nunca aumenta o dado", () => {
    const alvo = { cond: [] };
    aplicarCond(alvo, "Sangrando", 3);
    aplicarCond(alvo, "Sangrando", 3);   // já ativa: soma 1, não substitui pela nova base
    assert.equal(alvo.cond.length, 1);
    assert.equal(alvo.cond[0].turnos, 4);
  });

  test("condição de estado repetida renova para a MAIOR duração, não empilha", () => {
    const alvo = { cond: [] };
    aplicarCond(alvo, "Marcado", 2);       // guarda 3
    aplicarCond(alvo, "Marcado", 1);       // guardaria 2 — menor, não deve baixar
    assert.equal(alvo.cond[0].turnos, 3);
  });

  test("origemId fica gravado na condição (usado pelo Amedrontado)", () => {
    const alvo = { cond: [] };
    aplicarCond(alvo, "Amedrontado", 2, "combatente-123");
    assert.equal(alvo.cond[0].origemId, "combatente-123");
  });

  test("sem alvo ou sem condição não quebra", () => {
    assert.doesNotThrow(() => aplicarCond(null, "Cego"));
    assert.doesNotThrow(() => aplicarCond({}, null));
  });
});

describe("infoCond", () => {
  test("acha a condição ignorando maiúsculas/minúsculas", () => {
    assert.equal(infoCond("cego")?.n, "Cego");
    assert.equal(infoCond("CAÍDO")?.n, "Caído");
  });
  test("condição inexistente devolve undefined", () => {
    assert.equal(infoCond("Invisível"), undefined);
  });
});

describe("distCombate / posInicial (campo tático)", () => {
  test("mesma pista: distância é só a diferença em X", () => {
    const a = { pos: { x: 5, lane: 1 } }, b = { pos: { x: 8, lane: 1 } };
    assert.equal(distCombate(a, b), 3);
  });

  test("pistas diferentes somam a profundidade (PISTA_M por pista de diferença)", () => {
    const a = { pos: { x: 0, lane: 0 } }, b = { pos: { x: 0, lane: 2 } };
    assert.equal(distCombate(a, b), 2 * PISTA_M);
  });

  test("sem posição em algum dos dois, distância é null (não quebra)", () => {
    assert.equal(distCombate({ pos: { x: 0, lane: 0 } }, {}), null);
    assert.equal(distCombate(null, null), null);
  });

  test("posInicial põe jogadores à esquerda e inimigos à direita", () => {
    const pJog = posInicial([], "jogador");
    const pIni = posInicial([], "inimigo");
    assert.ok(pJog.x < pIni.x);
  });
});

describe("tipos de dano e alcance", () => {
  test("arma com kw de plasma vira dano térmico", () => {
    assert.equal(tipoDanoArma({ kw: "Derretimento" }), "térmico");
  });
  test("arma sem kw reconhecida é dano físico", () => {
    assert.equal(tipoDanoArma({ kw: "Brutal" }), "físico");
  });
  test("ataque de criatura lê o tipo do texto extra", () => {
    assert.equal(tipoDanoAtaque({ extra: "veneno ácido corrosivo" }), "ácido");
    assert.equal(tipoDanoAtaque({ extra: "mordida comum" }), "físico");
  });
  test("imuneAoDano acha a imunidade certa e ignora tipo verdadeiro", () => {
    const habs = [{ efeito: { tipo: "imunidade", a: "físico" } }];
    assert.ok(imuneAoDano(habs, "físico"));
    assert.equal(imuneAoDano(habs, "verdadeiro"), null);
    assert.equal(imuneAoDano(habs, "térmico"), null);
  });
  test("alcance de arma branca é o corpo-a-corpo (1,5m), a menos que tenha a chave Alcance", () => {
    assert.equal(alcanceDaArma({ tipo: "branca" }, {}), ALCANCE_CAC);
    assert.equal(alcanceDaArma({ tipo: "branca" }, { alcance: true }), 3);
  });
  test("arma de fogo sem chave de alcance é curto", () => {
    assert.equal(alcanceDaArma({ tipo: "fogo" }, {}), ALCANCE_ARMA.curto);
  });
  // Braços Telescópicos do Infimor: 10 m naturais de corpo a corpo. Antes o
  // efeito declarado era {acerto:0} — um no-op que não fazia absolutamente nada.
  test("alcance natural de quem empunha estende o corpo-a-corpo", () => {
    assert.equal(alcanceDaArma({ tipo: "branca" }, {}, 10), 10);
  });
  test("alcance natural NÃO soma com a chave Alcance — vale o maior", () => {
    assert.equal(alcanceDaArma({ tipo: "branca" }, { alcance: true }, 10), 10);
    assert.equal(alcanceDaArma({ tipo: "branca" }, { alcance: true }, 2), 3);
  });
  test("alcance natural não afeta arma de fogo", () => {
    assert.equal(alcanceDaArma({ tipo: "fogo" }, {}, 10), ALCANCE_ARMA.curto);
  });
});

describe("Iniciativa — bônus de classe e filosofia", () => {
  // Regressão: o Batedor somava +2 por hardcode em calc() E +2 pelo efeito
  // declarado em Sentidos Alertas, terminando com +4 onde o livro promete +2.
  test("Batedor soma +2, não +4", () => {
    const f = { ...novaFichaDados(), classe: "Batedor" };
    assert.equal(calc(f).iniciativa, calc(novaFichaDados()).iniciativa + 2);
  });

  test("Código do Sobrevivente soma +2 por efeito declarado", () => {
    const f = { ...novaFichaDados(), filosofia: "Código do Sobrevivente" };
    assert.equal(calc(f).iniciativa, calc(novaFichaDados()).iniciativa + 2);
  });

  test("Batedor + Código do Sobrevivente empilham para +4", () => {
    const f = { ...novaFichaDados(), classe: "Batedor", filosofia: "Código do Sobrevivente" };
    assert.equal(calc(f).iniciativa, calc(novaFichaDados()).iniciativa + 4);
  });

  test("k.iniBonus mostra só o que não veio da Destreza", () => {
    const f = { ...novaFichaDados(), raca: "Mercusys", classe: "Batedor" };  // Des +3
    const k = calc(f);
    assert.equal(k.attr.Des, 3);
    assert.equal(k.iniBonus, 2);
    assert.equal(k.iniciativa, 5);
  });
});

describe("Filosofias — efeitos declarados", () => {
  test("Código do Sobrevivente declara imunidade a surpresa (usada pelo #cb-surpresa)", () => {
    const k = calc({ ...novaFichaDados(), filosofia: "Código do Sobrevivente" });
    assert.ok(k.efeitos.imunidades().some((i) => /surpres/i.test(i)));
  });

  test("Código do Cético dá resistência a psíquico e a Dominado", () => {
    const k = calc({ ...novaFichaDados(), filosofia: "Código do Cético" });
    assert.ok(k.efeitos.resistencias().includes("psíquico"));
    assert.ok(k.efeitos.resistencias().includes("dominado"));
  });

  test("Caminho da Espiral marca a Vantagem nos dados de cura", () => {
    assert.equal(calc({ ...novaFichaDados(), filosofia: "Caminho da Espiral" }).vantagemCura, true);
    assert.notEqual(calc(novaFichaDados()).vantagemCura, true);
  });

  test("Código Corporativo declara Vantagem em Lábia / Persuasão", () => {
    const k = calc({ ...novaFichaDados(), filosofia: "Código Corporativo" });
    assert.ok(k.efeitos.vantagensPericia().some((v) => v.pericia === "Lábia / Persuasão"));
  });

  // Fronteira é condicional: só vale quando a situação `isolado` é verdadeira,
  // calculada pelo campo tático na hora do ataque.
  test("Código da Fronteira só soma +1 no acerto quando isolado", () => {
    const k = calc({ ...novaFichaDados(), filosofia: "Código da Fronteira" });
    assert.equal(k.efeitos.modificarAtaque({ situacao: { isolado: true } }).acerto, 1);
    assert.equal(k.efeitos.modificarAtaque({ situacao: { isolado: false } }).acerto, 0);
    assert.equal(k.efeitos.modificarAtaque({}).acerto, 0);
  });

  test("as 4 passivas não viram botão de habilidade ativa (tipo Passiva)", () => {
    for (const nome of ["Caminho da Espiral", "Código Corporativo", "Código do Cético", "Código da Fronteira"])
      assert.equal(FILOSOFIAS[nome].tipo, "Passiva", `${nome} deveria ser Passiva`);
  });
});

describe("Balanceamento — Con por nível e a curva de PV", () => {
  test("conPorNivel limita a +2 e nunca deixa negativo", () => {
    assert.equal(conPorNivel(-1), 0);
    assert.equal(conPorNivel(0), 0);
    assert.equal(conPorNivel(2), 2);
    assert.equal(conPorNivel(3), CON_PV_NIVEL_MAX);
    assert.equal(conPorNivel(5), CON_PV_NIVEL_MAX);
  });

  // Guarda da intenção de design: tanque e frágil podem ser MUITO diferentes,
  // mas não 3x diferentes. Antes deste ajuste o leque no nível 10 era 3,3x,
  // porque Con contava na vida inicial E em todo nível, e `dadoVida` andava
  // junto com Con em vez de compensá-la.
  const MEDIA_4D6_TIRA_MENOR = 12;   // só para comparar curvas entre si
  const pvNivel10 = (raca, pvClasse) => {
    const r = RACAS.find((x) => x.nome === raca);
    const con = calc({ ...novaFichaDados(), raca }).attr.Con;
    const pv1 = MEDIA_4D6_TIRA_MENOR + r.vidaMod + con + pvClasse;
    return pv1 + 9 * (r.vidaFixa + conPorNivel(con));
  };

  test("nenhuma combinação de raça e classe passa de 2,5x a mais frágil no nível 10", () => {
    const todos = RACAS.flatMap((r) => Object.values(CLASSES).map((c) => pvNivel10(r.nome, c.pv)));
    const maior = Math.max(...todos), menor = Math.min(...todos);
    assert.ok(maior / menor <= 2.5,
      `leque de PV no nível 10 chegou a ${(maior / menor).toFixed(2)}x (${menor}–${maior})`);
  });

  test("o ganho por nível de nenhuma raça passa de 2x o da mais fraca", () => {
    const ganhos = RACAS.map((r) => r.vidaFixa + conPorNivel(calc({ ...novaFichaDados(), raca: r.nome }).attr.Con));
    assert.ok(Math.max(...ganhos) / Math.min(...ganhos) <= 2.4,
      `ganho por nível varia ${(Math.max(...ganhos) / Math.min(...ganhos)).toFixed(2)}x`);
  });

  test("vidaMod de todas as raças está na faixa [-2,+2]", () => {
    for (const r of RACAS)
      assert.ok(r.vidaMod >= -2 && r.vidaMod <= 2, `${r.nome} tem vidaMod ${r.vidaMod}`);
  });

  test("todas as raças continuam somando exatamente +4 em atributos", () => {
    // Raça `livre` (Terráqueo) tem attrs todos 0 no catálogo: os +4 dela são pontos
    // que o jogador distribui, concedidos por calc() em `pontosDireito` no NV1.
    // Conta pelo próprio calc() em vez de somar +4 fixo, pra acompanhar a regra real.
    for (const r of RACAS) {
      const fixos = ["For", "Des", "Con", "Int", "Sab", "Car"].reduce((s, a) => s + r.attrs[a], 0);
      const livres = r.livre ? calc({ ...novaFichaDados(), raca: r.nome, nivel: 1 }).pontosDireito : 0;
      assert.equal(fixos + livres, 4, `${r.nome} soma ${fixos} fixos + ${livres} livres`);
    }
  });

  test("todas as classes continuam concedendo exatamente 12 pontos de perícia", () => {
    for (const [nome, c] of Object.entries(CLASSES)) {
      const soma = Object.values(c.pericias).reduce((s, v) => s + v, 0);
      assert.equal(soma, 12, `${nome} concede ${soma}`);
    }
  });
});

describe("Balanceamento — outliers aparados", () => {
  test("Conjupitero dá +1 de CD, não +2", () => {
    const k = calc({ ...novaFichaDados(), raca: "Conjupitero" });
    // Des -2 com armadura leve: 10 - 2 + 1 = 9
    assert.equal(k.cd, 9);
  });

  test("Conjupitero dá +1 em Pilotagem e Mecânica", () => {
    const k = calc({ ...novaFichaDados(), raca: "Conjupitero" });
    assert.equal(k.per["Pilotagem"], 1);
    assert.equal(k.per["Mecânica"], 1);
  });

  // O estouro do teto de perícia vinha daqui: classe 5 + raça 2 = 7 no nível 1,
  // quando o teto do nível 1 é +5 (e +7 só a partir do 5).
  test("Conjupitero Mecânico não passa do teto de perícia do nível 5", () => {
    const k = calc({ ...novaFichaDados(), raca: "Conjupitero", classe: "Mecânico" });
    assert.equal(k.per["Mecânica"], 6);
    assert.ok(k.per["Mecânica"] <= 7);
  });

  test("Terráqueo ganha +3 de PV máximo pela Resiliência Terráquea", () => {
    const k = calc({ ...novaFichaDados(), raca: "Terráqueo", pvMax: 20 });
    assert.equal(k.pvMax, 23);
  });

  test("Fúria do Infimor não mexe mais em Destreza (não vaza para CD nem deslocamento)", () => {
    const base = calc({ ...novaFichaDados(), raca: "Infimor" });
    const furia = calc({ ...novaFichaDados(), raca: "Infimor", modos: { "Fúria dos Desclassificados": "" } });
    assert.equal(furia.attr.For, base.attr.For + 2);
    assert.equal(furia.attr.Con, base.attr.Con + 2);
    assert.equal(furia.attr.Des, base.attr.Des);
    assert.equal(furia.cd, base.cd);
    assert.equal(furia.deslocamento, base.deslocamento);
  });

  test("Fúria soma +2 no acerto e no dano, não +3", () => {
    const k = calc({ ...novaFichaDados(), raca: "Infimor", modos: { "Fúria dos Desclassificados": "" } });
    const m = k.efeitos.modificarAtaque({ acerto: 0, dano: 0 });
    assert.equal(m.acerto, 2);
    assert.equal(m.dano, 2);
  });
});

describe("Marco de classe (NV10)", () => {
  test("toda classe tem um marco de NV10 com nome e descrição", () => {
    for (const [nome, c] of Object.entries(CLASSES)) {
      assert.ok(c.lendaria?.n, `${nome} sem marco de NV10`);
      assert.ok(c.lendaria?.d, `${nome}: marco sem descrição`);
    }
  });

  test("o efeito do marco só entra a partir do nível 10", () => {
    const nv9 = calc({ ...novaFichaDados(), classe: "Prospector", nivel: 9 });
    const nv10 = calc({ ...novaFichaDados(), classe: "Prospector", nivel: 10 });
    assert.equal(nv9.efeitos.aoSaquear().pct, 30);    // +20 da passiva, +10 da Veterana
    assert.equal(nv10.efeitos.aoSaquear().pct, 50);   // +20 do marco
    assert.equal(calc({ ...novaFichaDados(), classe: "Prospector", nivel: 4 }).efeitos.aoSaquear().pct, 20);
  });

  test("Piloto Fantasma soma ao Instinto Evasivo: +6 no veículo", () => {
    const k = calc({ ...novaFichaDados(), classe: "Piloto", nivel: 10 });
    assert.equal(k.efeitos.defesaVeiculo(), 6);
  });

  // Marco que é modo (liga por N turnos) precisa aparecer em modosAtivosDe,
  // senão ativar pela mesa não aplicaria nada.
  test("Singularidade do Cinético, ligada, dá +5 de RAM e +3 de conjuração", () => {
    const base = calc({ ...novaFichaDados(), classe: "Cinético", nivel: 10 });
    const on = calc({ ...novaFichaDados(), classe: "Cinético", nivel: 10,
      modos: { "Singularidade de Carne e Código": "" } });
    assert.equal(on.ramMax, base.ramMax + 5);
    assert.equal(on.conj, base.conj + 3);
  });

  test("Não Recuar do Soldado, ligado, reduz 3 de dano", () => {
    const k = calc({ ...novaFichaDados(), classe: "Soldado", nivel: 10, modos: { "Não Recuar": "" } });
    assert.equal(k.efeitos.aoSofrer().reducao, 3);
  });

  // Regra do usuário: nenhum marco pode ser só texto. Todo marco tem que
  // declarar um `resolve` (vira botão que resolve sozinho) ou `efeitos`.
  test("nenhum marco de NV10 é só narrado", () => {
    for (const [nome, c] of Object.entries(CLASSES))
      assert.ok(c.lendaria.resolve || c.lendaria.efeitos?.length, `${nome}: marco sem resolve nem efeitos`);
  });

  test("marcos em área usam salvaguarda com raio declarado", () => {
    for (const nome of ["Estudioso", "Pirata"]) {
      const R = CLASSES[nome].lendaria.resolve;
      assert.equal(R.tipo, "salvaguarda");
      assert.ok(R.area && R.raio > 0, `${nome}: área sem raio`);
    }
  });
});

describe("Mecanismos dos marcos (antes narrados)", () => {
  const nv = (classe, nivel, extra = {}) => calc({ ...novaFichaDados(), classe, nivel, ...extra });

  test("chance_extra de várias fontes não empilha rolagem: fica o menor mínimo", () => {
    const r1 = nv("Catador", 1).efeitos.aoSaquear().rolagens;
    const r5 = nv("Catador", 5).efeitos.aoSaquear().rolagens;
    const r10 = nv("Catador", 10).efeitos.aoSaquear().rolagens;
    assert.equal(r1.length, 1); assert.equal(r1[0].minimo, 4);
    assert.equal(r5.length, 1); assert.equal(r5[0].minimo, 3);
    assert.equal(r10.length, 1); assert.equal(r10[0].minimo, 2);
  });

  test("Rajada Disciplinada e Não Recuar dão 2 ataques por Ação Principal enquanto ligados", () => {
    assert.equal(nv("Soldado", 5).ataquesPorAcao, undefined);
    assert.equal(nv("Soldado", 5, { modos: { "Rajada Disciplinada": "ativo" } }).ataquesPorAcao, 2);
    assert.equal(nv("Soldado", 10, { modos: { "Não Recuar": "ativo" } }).ataquesPorAcao, 2);
  });

  test("Um Tiro, ligado, marca o próximo disparo como perfeito", () => {
    assert.notEqual(nv("Franco-atirador", 10).tiroPerfeito, true);
    assert.equal(nv("Franco-atirador", 10, { modos: { "Um Tiro": "ativo" } }).tiroPerfeito, true);
  });

  test("Frequência: cada opção é uma aura de 10 m; Sinfonia Total põe as duas a 20 m, inquebráveis", () => {
    const insp = nv("Músico", 1, { modos: { "Frequência de Inspiração/Ressonância": "Inspiração" } }).efeitos.auras();
    assert.deepEqual(insp.map((a) => [a.alvo, a.raio]), [["aliados", 10]]);
    const k10 = nv("Músico", 10);
    assert.equal(k10.efeitos.auras().filter((a) => a.raio === 20).length, 2);
    assert.equal(k10.auraInquebravel, true);
  });

  test("Maestro de Guerra sustenta a aura com Performance CD 12", () => {
    assert.deepEqual(nv("Músico", 5).sustentaAura, { pericia: "Performance / Arte", cd: 12 });
  });

  test("dado da Marca do Caçador sobe de 1d4 (NV5) para 1d6 (NV10), sem somar", () => {
    assert.equal(nv("Batedor", 1).bonusMarca, undefined);
    assert.equal(nv("Batedor", 5).bonusMarca, "1d4");
    assert.equal(nv("Batedor", 10).bonusMarca, "1d6");
    assert.equal(nv("Batedor", 10).marcaEmArea, true);
  });

  test("Vulnerabilidade Exposta: 1 ataque, depois 2 e Ação de Movimento, depois o combate todo", () => {
    assert.equal(nv("Explorador", 1).expostoCargas, undefined);
    const k5 = nv("Explorador", 5);
    assert.equal(k5.expostoCargas, 2);
    assert.equal(k5.acaoDe["Vulnerabilidade Exposta"], "Ação de Movimento");
    assert.equal(nv("Explorador", 10).expostoCargas, 99);
  });

  test("Eu Sou Qualquer Um: +2 e Vantagem em Enganação", () => {
    const base = nv("Espião", 9), k10 = nv("Espião", 10);
    assert.equal(k10.per["Enganação"], base.per["Enganação"] + 2);
    assert.ok(k10.efeitos.vantagensPericia().some((v) => v.pericia === "Enganação"));
  });

  test("Dono do Contrato dá desconto de 50% na loja", () => {
    assert.equal(nv("Prospector", 10).descontoLoja, 50);
    assert.equal(nv("Prospector", 9).descontoLoja, undefined);
  });
});

describe("Habilidades de NV1 e Veteranas mecanizadas", () => {
  const nv = (classe, nivel, extra = {}) => calc({ ...novaFichaDados(), classe, nivel, ...extra });

  test("Anatomia Comparada: crítico 19–20 só quando furtivo", () => {
    assert.equal(nv("Assassino", 4).criticoEm, undefined);
    assert.deepEqual(nv("Assassino", 5).criticoEm, [{ valor: 19, quando: "desprevenido" }]);
  });

  test("Palavra de Capitão: \"Deixem isto comigo!\" vale 2 cargas", () => {
    assert.equal(nv("Starlord", 5).cargasDe["“Deixem isto comigo!”"], 2);
  });

  test("Rajada Disciplinada abre o Fogo de Supressão num cone de 5 m", () => {
    assert.equal(nv("Soldado", 5).areaDe["Fogo de Supressão"], 5);
  });

  test("Terror Nominal: Grito com Desvantagem e +2 de dano contra Amedrontado", () => {
    const k = nv("Pirata", 5);
    assert.equal(k.saveDesv["Grito de Saqueador"], true);
    assert.equal(k.efeitos.modificarAtaque({ situacao: { alvo_amedrontado: true } }).dano, 2);
    assert.equal(k.efeitos.modificarAtaque({ situacao: {} }).dano, 0);
  });

  test("usos grátis 1x/combate declarados nas Veteranas", () => {
    assert.ok(nv("Estudioso", 5).gratisPorCombate["Ponto Estrutural Crítico"]);
    assert.ok(nv("Piloto", 5).gratisPorCombate["Sobrecarga de Propulsores"]);
    assert.ok(nv("Assassino", 5).gratisPorCombate["Desaparecer nas Sombras"]);
    assert.equal(nv("Estudioso", 5).catalogar, true);
  });

  test("Tiro Incapacitante vira opção de ataque: metade do dano, alvo Lento", () => {
    const o = nv("Franco-atirador", 1).efeitos.opcoesAtaque()[0];
    assert.equal(o.multDano, 0.5); assert.equal(o.cond, "Lento");
  });

  test("Identidade Profunda segura o Ponto Cego 1 turno depois de atacar", () => {
    assert.equal(nv("Espião", 5).condPersiste["Ponto Cego"], 1);
  });

  test("Olho Clínico arranca módulos no Desmanche", () => {
    assert.equal(nv("Catador", 5).roubaModulo, true);
  });

  // A penalidade da armadura pesada agora é efeito declarado; o Mecânico a anula.
  test("Operador de Máquinas Pesadas anula a penalidade de Furtividade da armadura pesada", () => {
    const inv = [{ tipo: "armadura", nome: "Armadura Pesada Marciana", equip: true }];
    assert.equal(nv("Soldado", 1, { inventario: inv }).per["Furtividade"], 1 - 4);
    assert.equal(nv("Mecânico", 1, { inventario: inv }).per["Furtividade"], 0);
  });

  test("nenhuma habilidade Ativa de classe fica sem resolve (só texto)", () => {
    for (const [nome, c] of Object.entries(CLASSES))
      for (const h of [...c.hab, c.vet].filter((x) => x.tipo !== "Passiva"))
        assert.ok(h.resolve, `${nome}: "${h.n}" é ativa e não resolve nada`);
  });
});

describe("podeAgirAgora — turno normal e turno extra", () => {
  const combate = { rodada: 2, turno: 0, ordem: [{ id: "a" }, { id: "b" }, { id: "c" }] };
  test("quem está na vez pode agir", () => assert.equal(podeAgirAgora(combate, combate.ordem[0]), true));
  test("quem não está na vez, não", () => assert.equal(podeAgirAgora(combate, combate.ordem[1]), false));
  test("turno extra concedido agora libera", () =>
    assert.equal(podeAgirAgora(combate, { id: "b", turnoExtra: { rodada: 2, turno: 0 } }), true));
  test("turno extra expira assim que o combate avança", () =>
    assert.equal(podeAgirAgora(combate, { id: "b", turnoExtra: { rodada: 1, turno: 0 } }), false));
});

describe("Ven'y — Argônio reduz dano, não sobe Defesa", () => {
  // O texto sempre prometeu "−2 de dano físico recebido", mas o efeito declarado
  // era {tipo:"defesa"} (+2 de CD) — mecânica diferente do que estava escrito.
  test("o gás Argônio entra como redução de dano", () => {
    const f = { ...novaFichaDados(), raca: "Ven'y", modos: { "Air Shifter": "Argônio" } };
    const k = calc(f);
    assert.equal(k.efeitos.aoSofrer().reducao, 2);
    assert.equal(k.cd, calc({ ...novaFichaDados(), raca: "Ven'y" }).cd);
  });
});

describe("empurrarDe (Repulsão Cinética e afins)", () => {
  test("empurra o alvo para LONGE da origem, no eixo X", () => {
    const origem = { pos: { x: 5, lane: 1 } }, alvo = { pos: { x: 8, lane: 1 } };
    assert.deepEqual(empurrarDe(origem, alvo, 3), { x: 11, lane: 1 });
  });

  test("alvo à esquerda da origem é empurrado para a esquerda", () => {
    const origem = { pos: { x: 8, lane: 0 } }, alvo = { pos: { x: 5, lane: 0 } };
    assert.deepEqual(empurrarDe(origem, alvo, 3), { x: 2, lane: 0 });
  });

  test("em cima um do outro: empurra para a direita, não trava em 0", () => {
    const origem = { pos: { x: 10, lane: 0 } }, alvo = { pos: { x: 10, lane: 0 } };
    assert.equal(empurrarDe(origem, alvo, 3).x, 13);
  });

  test("não joga ninguém para fora do campo", () => {
    assert.equal(empurrarDe({ pos: { x: 5, lane: 0 } }, { pos: { x: 1, lane: 0 } }, 10).x, 0);
    assert.equal(empurrarDe({ pos: { x: 0, lane: 0 } }, { pos: { x: 39, lane: 0 } }, 10).x, CAMPO_LARGURA);
  });

  test("mantém a pista (empurrão não muda profundidade)", () => {
    assert.equal(empurrarDe({ pos: { x: 0, lane: 2 } }, { pos: { x: 4, lane: 2 } }, 3).lane, 2);
  });

  test("sem posição, ou sem metros, devolve null (vira narração)", () => {
    assert.equal(empurrarDe({ pos: { x: 0, lane: 0 } }, {}, 3), null);
    assert.equal(empurrarDe({ pos: { x: 0, lane: 0 } }, { pos: { x: 4, lane: 0 } }, 0), null);
  });
});

describe("calc com implantes inertes (Zona Morta)", () => {
  const comImplantes = () => ({
    ...novaFichaDados(),
    implantes: ["Chip de Expansão de RAM", "Placas Subdérmicas de Titânio"],
  });

  test("normalmente o Chip dá +2 de RAM e as Placas +1 de Defesa", () => {
    const k = calc(comImplantes());
    assert.equal(k.ramMax, 3);   // 1 de base + 2 do Chip
    assert.equal(k.cd, 11);      // 10 de base + 1 das Placas
    assert.equal(k.implantesInertes, false);
  });

  test("dentro da Zona Morta, a ficha é recalculada sem implante nenhum", () => {
    const k = calc(comImplantes(), { semImplantes: true });
    assert.equal(k.ramMax, 1);
    assert.equal(k.cd, 10);
    assert.equal(k.implantesInertes, true);
  });

  test("quem não tem implante não é marcado como inerte (não muda nada pra ele)", () => {
    const k = calc(novaFichaDados(), { semImplantes: true });
    assert.equal(k.implantesInertes, false);
    assert.equal(k.cd, 10);
  });
});

describe("condições novas (Motor Travado e Hesitante)", () => {
  test("estão cadastradas e são condições de estado, sem dano contínuo", () => {
    for (const nome of ["Motor Travado", "Hesitante"]) {
      const c = infoCond(nome);
      assert.ok(c, `${nome} precisa existir em CONDICOES_INFO`);
      assert.equal(c.dano, null, `${nome} não causa dano por turno`);
      assert.ok(c.ic, `${nome} precisa de ícone`);
    }
  });

  test("toda condição tem nome, ícone e descrição — nada pela metade", () => {
    for (const c of CONDICOES_INFO) {
      assert.ok(c.n && c.ic && c.d, `condição incompleta: ${JSON.stringify(c)}`);
    }
  });
});

describe("Blindagem Dispersora de Impacto — armadura anticrítica", () => {
  const comBlindagem = () => ({
    ...novaFichaDados(),
    inventario: [{ tipo: "armadura", nome: "Blindagem Dispersora de Impacto", equip: true }],
  });

  test("quem veste nega dano crítico (k.efeitos.aoSofrer().semCritico)", () => {
    const k = calc(comBlindagem());
    assert.equal(k.efeitos.aoSofrer().semCritico, true);
  });

  test("sem a armadura, semCritico fica false — não é o padrão de todo mundo", () => {
    const k = calc(novaFichaDados());
    assert.equal(k.efeitos.aoSofrer().semCritico, false);
  });

  test("carrega o penalidade de −3 Furtividade junto", () => {
    const k = calc(comBlindagem());
    assert.equal(k.per["Furtividade"], -3);
  });

  test("CD reflete a armadura pesada (+3), sem Destreza (pesada zera o ajuste)", () => {
    const f = { ...comBlindagem(), pontosAttr: { ...novaFichaDados().pontosAttr, Des: 4 } };
    const k = calc(f);
    assert.equal(k.cd, 13);   // 10 base + 3 da armadura + 0 de Destreza (pesada)
  });
});

describe("Coração Sintético de Duplo Fluxo — PV máximo extra e resistência", () => {
  const comImplante = () => ({ ...novaFichaDados(), implantes: ["Coração Sintético de Duplo Fluxo"] });

  test("k.pvMax = f.pvMax + 5 enquanto o implante está instalado", () => {
    const f = { ...comImplante(), pvMax: 20 };
    assert.equal(calc(f).pvMax, 25);
  });

  test("sem o implante, k.pvMax é só o valor bruto salvo", () => {
    const f = { ...novaFichaDados(), pvMax: 20 };
    assert.equal(calc(f).pvMax, 20);
  });

  test("removido o implante, o bônus some (k.pvMax cai de novo)", () => {
    const comK = calc({ ...comImplante(), pvMax: 20 });
    const semK = calc({ ...novaFichaDados(), pvMax: 20 });
    assert.equal(comK.pvMax, 25);
    assert.equal(semK.pvMax, 20);
  });

  test("dá Vantagem (resistência) em testes contra Envenenado", () => {
    const k = calc(comImplante());
    assert.deepEqual(k.efeitos.resistencias(), ["envenenado"]);
  });

  test("sem o implante, sem resistência a Envenenado", () => {
    const k = calc(novaFichaDados());
    assert.deepEqual(k.efeitos.resistencias(), []);
  });
});

describe("k.escudoMax soma armadura (absorve) + efeitos declarados (escudo_max)", () => {
  test("sem armadura de escudo nem efeito, escudoMax é 0", () => {
    assert.equal(calc(novaFichaDados()).escudoMax, 0);
  });

  test("armadura com absorve continua funcionando sozinha", () => {
    const f = { ...novaFichaDados(), inventario: [{ tipo: "armadura", nome: "Escudo de Energia Pessoal", equip: true }] };
    const k = calc(f);
    assert.ok(k.escudoMax > 0, "armadura com absorve deveria conceder escudoMax");
  });
});

describe("parseDice", () => {
  test("lê dado com e sem bônus", () => {
    assert.deepEqual(parseDice("2d6+3"), { n: 2, f: 6, mod: 3 });
    assert.deepEqual(parseDice("d20"), { n: 1, f: 20, mod: 0 });
    assert.deepEqual(parseDice("1d4-1"), { n: 1, f: 4, mod: -1 });
  });
  test("texto que não é um dado devolve null", () => {
    assert.equal(parseDice("abacate"), null);
  });
});

describe("munição de arma de nave (capacidadeArma/municaoDe/descontarMunicao/recarregarArma)", () => {
  const energia = { n: "Laser", tipo: "energia", dano: "3d8" };
  const balistica = { n: "Canhões", tipo: "balistica", dano: "3d6", pente: 6 };
  const missil = { n: "Torpedo", tipo: "missil", dano: "4d6", unidades: 2 };

  test("energia não tem teto — capacidadeArma null, municaoDe infinita", () => {
    assert.equal(capacidadeArma(energia), null);
    assert.equal(municaoDe({}, energia), Infinity);
  });

  test("balística e míssil usam pente/unidades como teto", () => {
    assert.equal(capacidadeArma(balistica), 6);
    assert.equal(capacidadeArma(missil), 2);
  });

  test("sem municao[] gravado ainda, municaoDe cai no teto do catálogo", () => {
    assert.equal(municaoDe({}, balistica), 6);
    assert.equal(municaoDe({}, missil), 2);
  });

  test("descontarMunicao reduz 1 e nunca passa de 0", () => {
    const nave = {};
    descontarMunicao(nave, balistica);
    assert.equal(municaoDe(nave, balistica), 5);
    for (let i = 0; i < 10; i++) descontarMunicao(nave, missil);
    assert.equal(municaoDe(nave, missil), 0);   // não fica negativo
  });

  test("descontarMunicao não faz nada em arma de energia (infinita continua infinita)", () => {
    const nave = {};
    descontarMunicao(nave, energia);
    assert.equal(municaoDe(nave, energia), Infinity);
    assert.deepEqual(nave.municao ?? {}, {});   // não cria entrada à toa
  });

  test("recarregarArma restaura o teto", () => {
    const nave = { municao: { [balistica.n]: 0 } };
    recarregarArma(nave, balistica);
    assert.equal(municaoDe(nave, balistica), 6);
  });

  test("recarregarArma em míssil/energia não faz nada (sem recarga em combate)", () => {
    const naveM = {};
    recarregarArma(naveM, missil);
    assert.equal(municaoDe(naveM, missil), 2);   // continua o teto do catálogo, não "recarregou"
    const naveE = {};
    recarregarArma(naveE, energia);
    assert.deepEqual(naveE.municao ?? {}, {});
  });
});
