// Testes dos helpers de seguro.js (escapar HTML, endereços de imagem/link, sanear).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { esc, num, urlImg, urlLink, html, cru, texto, sanear } from "../public/js/seguro.js";

describe("esc", () => {
  test("escapa os cinco caracteres perigosos", () => {
    assert.equal(esc(`<img src=x onerror="a('b')">&`), "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
  });
  test("null/undefined viram vazio", () => { assert.equal(esc(null), ""); assert.equal(esc(undefined), ""); });
});

describe("num", () => {
  test("número e texto numérico passam", () => { assert.equal(num(5), 5); assert.equal(num("7"), 7); });
  test("lixo vira o padrão", () => {
    assert.equal(num("<b>"), 0); assert.equal(num(NaN, 3), 3); assert.equal(num(Infinity), 0); assert.equal(num("", 2), 2);
  });
});

describe("urlImg / urlLink", () => {
  test("aceita data:image base64 e https", () => {
    assert.equal(urlImg("data:image/jpeg;base64,AAAA"), "data:image/jpeg;base64,AAAA");
    assert.equal(urlImg("https://x.supabase.co/a.jpg"), "https://x.supabase.co/a.jpg");
  });
  test("recusa javascript:, data:text/html, http e aspas", () => {
    for (const u of ["javascript:alert(1)", "data:text/html;base64,AAAA", "http://x/a.jpg", 'https://x/a.jpg" onerror="1', "data:image/svg+xml;base64,AAAA"]) {
      assert.equal(urlImg(u), "", u);
    }
  });
  test("link só https", () => {
    assert.equal(urlLink("https://a.b/c"), "https://a.b/c");
    assert.equal(urlLink("javascript:alert(1)"), "");
    assert.equal(urlLink("data:image/png;base64,AA"), "");
  });
});

describe("html``", () => {
  test("escapa valores e deixa cru() passar", () => {
    const nome = "<script>";
    assert.equal(texto(html`<b>${nome}</b>${cru("<i>ok</i>")}`), "<b>&lt;script&gt;</b><i>ok</i>");
  });
  test("aninha e junta arrays", () => {
    assert.equal(texto(html`<ul>${["a", "<b>"].map((x) => html`<li>${x}</li>`)}</ul>`), "<ul><li>a</li><li>&lt;b&gt;</li></ul>");
  });
  test("null/false somem", () => { assert.equal(texto(html`a${null}${false}${undefined}b`), "ab"); });
});

describe("sanear", () => {
  test("força campos numéricos conhecidos a número, em qualquer profundidade", () => {
    const o = sanear({ dados: { nivel: "<img onerror=1>", pvAtual: "12" }, ordem: [{ hp: "x", nome: "<b>" }] });
    assert.equal(o.dados.nivel, 0);
    assert.equal(o.dados.pvAtual, 12);
    assert.equal(o.ordem[0].hp, 0);
    assert.equal(o.ordem[0].nome, "<b>");   // texto livre não é mexido (quem exibe usa esc)
  });
  test("mantém null (\"ainda não rolou\") e zera número não finito", () => {
    const o = sanear({ pvMax: null, outro: Infinity });
    assert.equal(o.pvMax, null); assert.equal(o.outro, 0);
  });
  test("não estoura com objeto muito fundo", () => {
    let fundo = {}; const raiz = fundo;
    for (let i = 0; i < 50; i++) { fundo.a = {}; fundo = fundo.a; }
    assert.doesNotThrow(() => sanear(raiz));
  });
});
