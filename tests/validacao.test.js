// Testes de validação de conteúdo — criaturas.js e efeitos.js. Cobrem
// especificamente o campo "Imune a" (select + "Outro"), pra garantir que a
// sentinela "__outro__" nunca fica gravada como se fosse um valor de verdade.
// Roda com: node --test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validar } from "../public/js/criaturas.js";
import { validarEfeitos, FichaEfeitos, Portador } from "../public/js/efeitos.js";

describe("criaturas.js validar() — efeito de imunidade", () => {
  const base = { n: "Bicho de Teste", hp: 10, cd: 12, habs: [] };

  test("imune a um tipo de dano real: válido", () => {
    const c = { ...base, habs: [{ n: "Pele Dura", efeito: { tipo: "imunidade", a: "físico" } }] };
    assert.deepEqual(validar(c), []);
  });

  test("só limiar (couraça), sem 'a': válido — é o caso da Couraça de Anéis", () => {
    const c = { ...base, habs: [{ n: "Couraça", efeito: { tipo: "imunidade", limiar: 10 } }] };
    assert.deepEqual(validar(c), []);
  });

  test("sem 'a' e sem limiar: inválido", () => {
    const c = { ...base, habs: [{ n: "Vazio", efeito: { tipo: "imunidade" } }] };
    const erros = validar(c);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /não diz a quê/);
  });

  test("sentinela do select 'Outro' sem descrever: inválido, mesmo mensagem de 'sem a'", () => {
    const c = { ...base, habs: [{ n: "Meio Escolhido", efeito: { tipo: "imunidade", a: "__outro__" } }] };
    const erros = validar(c);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /não diz a quê/);
  });

  test("sentinela MAS com limiar também: válido (limiar sozinho já basta)", () => {
    const c = { ...base, habs: [{ n: "Meio Escolhido com Couraça", efeito: { tipo: "imunidade", a: "__outro__", limiar: 5 } }] };
    assert.deepEqual(validar(c), []);
  });

  test("texto livre descrito de verdade (imunidade narrativa): válido", () => {
    const c = { ...base, habs: [{ n: "Sismo", efeito: { tipo: "imunidade", a: "terreno difícil" } }] };
    assert.deepEqual(validar(c), []);
  });
});

describe("efeitos.js validarEfeitos() — efeito de imunidade (itens: arma/armadura/implante...)", () => {
  test("imune a uma condição do sistema: válido", () => {
    assert.deepEqual(validarEfeitos([{ tipo: "imunidade", a: "Cego" }]), []);
  });

  test("sem 'a': inválido", () => {
    const erros = validarEfeitos([{ tipo: "imunidade" }]);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /não diz a quê/);
  });

  test("sentinela '__outro__' sem descrever: inválido", () => {
    const erros = validarEfeitos([{ tipo: "imunidade", a: "__outro__" }]);
    assert.equal(erros.length, 1);
  });
});

describe("efeitos.js validarEfeitos() — resistência (mesma sentinela da imunidade)", () => {
  test("resistente a um tipo de dano: válido", () => {
    assert.deepEqual(validarEfeitos([{ tipo: "resistencia", a: "psíquico" }]), []);
  });
  test("sem 'a': inválido", () => {
    const erros = validarEfeitos([{ tipo: "resistencia" }]);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /não diz a quê/);
  });
  test("sentinela '__outro__' sem descrever: inválido", () => {
    assert.equal(validarEfeitos([{ tipo: "resistencia", a: "__outro__" }]).length, 1);
  });
});

describe("efeitos.js validarEfeitos() — pv_max / escudo_max precisam de valor numérico", () => {
  test("pv_max sem valor: inválido", () => {
    const erros = validarEfeitos([{ tipo: "pv_max" }]);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /PV máximo/);
  });
  test("pv_max com valor: válido", () => {
    assert.deepEqual(validarEfeitos([{ tipo: "pv_max", valor: 5 }]), []);
  });
  test("escudo_max sem valor: inválido", () => {
    const erros = validarEfeitos([{ tipo: "escudo_max" }]);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /escudo/);
  });
  test("escudo_max com valor: válido", () => {
    assert.deepEqual(validarEfeitos([{ tipo: "escudo_max", valor: 10 }]), []);
  });
});

describe("FichaEfeitos — pv_max / escudo_max / resistencia (motor declarativo)", () => {
  test("pv_max soma em k.pvMaxBonus via aplicarNaFicha", () => {
    const fe = new FichaEfeitos([new Portador("Coração Sintético", { efeitos: [{ tipo: "pv_max", valor: 5 }] })]);
    const k = {};
    fe.aplicarNaFicha(k);
    assert.equal(k.pvMaxBonus, 5);
  });

  test("duas fontes de pv_max somam", () => {
    const fe = new FichaEfeitos([
      new Portador("Implante A", { efeitos: [{ tipo: "pv_max", valor: 5 }] }),
      new Portador("Implante B", { efeitos: [{ tipo: "pv_max", valor: 3 }] }),
    ]);
    const k = {};
    fe.aplicarNaFicha(k);
    assert.equal(k.pvMaxBonus, 8);
  });

  test("escudo_max soma em k.escudoBonus via aplicarNaFicha", () => {
    const fe = new FichaEfeitos([new Portador("Campo de Força", { efeitos: [{ tipo: "escudo_max", valor: 10 }] })]);
    const k = {};
    fe.aplicarNaFicha(k);
    assert.equal(k.escudoBonus, 10);
  });

  test("resistencias() normaliza em minúsculas, pra bater com o nome da condição/tipo de dano", () => {
    const fe = new FichaEfeitos([new Portador("Coração Sintético", { efeitos: [{ tipo: "resistencia", a: "Envenenado" }] })]);
    assert.deepEqual(fe.resistencias(), ["envenenado"]);
  });

  test("sem fonte de resistência, resistencias() fica vazio", () => {
    const fe = new FichaEfeitos([new Portador("Nada Especial", {})]);
    assert.deepEqual(fe.resistencias(), []);
  });
});
