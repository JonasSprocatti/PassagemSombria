// Confere a "costura" entre os módulos do app, que não tem build para avisar:
//  - todo nome importado de um arquivo local (estático ou import() dinâmico com
//    desestruturação) precisa ser exportado por esse arquivo — um erro assim só
//    aparecia no navegador ("does not provide an export named …");
//  - todo módulo de public/js precisa estar na lista SHELL do service worker,
//    senão o app quebra offline.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pastaJs = join(raiz, "public", "js");
const ler = (p) => readFileSync(p, "utf8");
const arquivos = readdirSync(pastaJs).filter((n) => n.endsWith(".js"));

// Nomes exportados por um arquivo (export function/const/let/class, export { a, b as c }).
const exportsDe = (fonte) => {
  const nomes = new Set();
  for (const m of fonte.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) nomes.add(m[1]);
  // export let a = null, b = null;  (mais de um nome na mesma linha)
  for (const m of fonte.matchAll(/^export\s+(?:const|let|var)\s+([^;\n]+)/gm)) {
    for (const v of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)) nomes.add(v[1]);
  }
  for (const m of fonte.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const parte of m[1].split(",")) { const p = parte.trim(); if (!p) continue; const as = p.split(/\s+as\s+/); nomes.add((as[1] || as[0]).trim()); }
  }
  return nomes;
};
// Lista "a, b as c" → nomes como o módulo de origem os exporta (a, b).
const nomesImportados = (lista, sep) => lista.split(",").map((p) => p.trim()).filter(Boolean).map((p) => p.split(sep)[0].trim());

describe("imports entre módulos", () => {
  for (const nome of arquivos) {
    const fonte = ler(join(pastaJs, nome));
    const pedidos = [];   // [nomeImportado, arquivoAlvo]
    for (const m of fonte.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.\/[^"']+)["']/g)) nomesImportados(m[1], /\s+as\s+/).forEach((n) => pedidos.push([n, m[2]]));
    for (const m of fonte.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*["'](\.\/[^"']+)["']\s*\)/g)) nomesImportados(m[1], ":").forEach((n) => pedidos.push([n, m[2]]));
    if (!pedidos.length) continue;
    test(nome, () => {
      for (const [n, alvo] of pedidos) {
        const caminho = join(pastaJs, alvo);
        if (alvo === "./config.js") continue;   // gerado no build (config.exemplo.js no repo)
        assert.ok(existsSync(caminho), `${nome} importa de ${alvo}, que não existe`);
        assert.ok(exportsDe(ler(caminho)).has(n), `${nome} importa "${n}" de ${alvo}, que não exporta esse nome`);
      }
    });
  }
  test("config.exemplo.js exporta o que app.js pede de config.js", () => {
    const pedidos = [...ler(join(pastaJs, "app.js")).matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\/config\.js["']/g)].flatMap((m) => nomesImportados(m[1], /\s+as\s+/));
    const tem = exportsDe(ler(join(pastaJs, "config.exemplo.js")));
    for (const n of pedidos) assert.ok(tem.has(n), `config.exemplo.js não exporta "${n}"`);
  });
});

describe("service worker", () => {
  test("todo módulo de public/js está no SHELL do sw.js", () => {
    const sw = ler(join(raiz, "public", "sw.js"));
    for (const nome of arquivos) {
      if (nome === "config.exemplo.js") continue;
      assert.ok(sw.includes(`"./js/${nome}"`), `public/js/${nome} não está na lista SHELL de public/sw.js`);
    }
  });
  test("todo arquivo do SHELL existe", () => {
    const sw = ler(join(raiz, "public", "sw.js"));
    const lista = sw.slice(sw.indexOf("const SHELL"), sw.indexOf("];", sw.indexOf("const SHELL")));
    for (const m of lista.matchAll(/"\.\/([^"]+)"/g)) {
      if (m[1] === "js/config.js") continue;   // gerado no build
      assert.ok(existsSync(join(raiz, "public", m[1])), `SHELL lista ${m[1]}, que não existe`);
    }
  });
});
