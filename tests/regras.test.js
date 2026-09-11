// Testes das regras "puras" de regras.js (ficha, dados, condições, campo tático).
// Roda com: node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calc, novaFichaDados, dcSalvaguarda, danoCritico, parseDice,
  aplicarCond, infoCond, distCombate, posInicial,
  tipoDanoArma, tipoDanoAtaque, imuneAoDano, alcanceDaArma,
  ALCANCE_CAC, ALCANCE_ARMA, PISTA_M,
} from "../public/js/regras.js";

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
