// Testes de validação de conteúdo — criaturas.js e efeitos.js. Cobrem
// especificamente o campo "Imune a" (select + "Outro"), pra garantir que a
// sentinela "__outro__" nunca fica gravada como se fosse um valor de verdade.
// Roda com: node --test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validar } from "../public/js/criaturas.js";
import { validarEfeitos } from "../public/js/efeitos.js";

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
