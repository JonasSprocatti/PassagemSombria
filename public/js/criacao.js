// ============================================================================
//  CRIAÇÃO GUIADA — monta um tripulante passo a passo, na ordem em que as
//  escolhas fazem sentido: raça, classe, filosofia, atributos, perícias e nome.
//  Dá para voltar e trocar qualquer coisa antes de confirmar; nada é gravado
//  no banco até o último passo.
// ============================================================================
import { RACAS, CLASSES, FILOSOFIAS, PERICIAS, TEMAS, CONVERTE_2D8 } from "./dados-jogo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sign = (n) => (n >= 0 ? "+" + n : "" + n);
const d = (f) => 1 + Math.floor(Math.random() * f);
const ATTRS = ["For", "Des", "Con", "Int", "Sab", "Car"];

const PASSOS = [
  { k: "raca", n: "Raça", ic: "🌌", d: "De onde você vem define o seu corpo." },
  { k: "classe", n: "Classe", ic: "⚔", d: "O que você faz quando as coisas dão errado." },
  { k: "filosofia", n: "Filosofia", ic: "📚", d: "No que você acredita quando ninguém está olhando." },
  { k: "atributos", n: "Atributos", ic: "△", d: "A matéria-prima: força, reflexo, mente." },
  { k: "pericias", n: "Perícias", ic: "%", d: "O que a vida te ensinou a fazer bem." },
  { k: "identidade", n: "Identidade", ic: "◈", d: "Nome, rosto e as cores que te acompanham." },
];

// Abre o assistente. onCriar(dados, nome) recebe a ficha pronta.
export function abrirCriacao({ onCriar, onCancelar, abrirSistemaSolar }) {
  let passo = 0;
  const esc0 = { raca: "", classe: "", filosofia: "", rolagens: null, distrib: {}, pericias: {},
                 nome: "", foto: null, tema: "Vácuo" };

  const ov = document.createElement("div");
  ov.className = "cri-overlay";
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";

  const fechar = () => { document.body.style.overflow = ""; ov.remove(); onCancelar?.(); };

  // ---- validação: o que falta para poder avançar ----
  const podeAvancar = () => {
    if (passo === 0) return !!esc0.raca;
    if (passo === 1) return !!esc0.classe;
    if (passo === 2) return !!esc0.filosofia;
    if (passo === 3) return esc0.rolagens && ATTRS.every((a) => esc0.distrib[a] != null);
    if (passo === 4) return pontosPericiaLivres() === 0;
    if (passo === 5) return esc0.nome.trim().length > 0;
    return true;
  };
  // A classe já concede perícias com valores próprios; estes são os pontos LIVRES
  // que o jogador distribui por cima no nível 1.
  const pontosPericiaIniciais = () => {
    const r = RACAS.find((x) => x.nome === esc0.raca);
    return 4 + (r?.livre ? 3 : 0);
  };
  const pontosPericiaLivres = () => pontosPericiaIniciais() - Object.values(esc0.pericias).reduce((a, b) => a + (b || 0), 0);

  // ---- cada passo ----
  const passoRaca = () => `
    <p class="cri-ajuda">Nove povos, nove mundos. A raça define atributos, dado de vida e habilidades próprias.
      ${abrirSistemaSolar ? `Se preferir explorar, <button id="cri-solar" class="mini">🌌 abra o sistema solar</button>.` : ""}</p>
    <div class="cri-grade">${RACAS.map((r) => `
      <button class="cri-op ${esc0.raca === r.nome ? "on" : ""}" data-raca="${esc(r.nome)}">
        <b>${esc(r.nome)}</b>
        <span class="cri-sub">${esc(r.planeta)}</span>
        <span class="cri-attrs">${ATTRS.filter((a) => r.attrs[a]).map((a) => `${a} ${sign(r.attrs[a])}`).join(" · ") || "sem modificadores"}</span>
      </button>`).join("")}</div>
    ${esc0.raca ? (() => { const r = RACAS.find((x) => x.nome === esc0.raca);
      return `<div class="cri-detalhe">
        <h4>${esc(r.nome)} — ${esc(r.titulo)}</h4>
        <p>${esc(r.lore)}</p>
        <p class="regra">❤ Vida inicial 4d6 (tira o menor) ${sign(r.vidaMod)} · dado por nível 1d${r.dadoVida}${r.livre ? " · +4 pontos livres e +3 perícias" : ""}</p>
        ${(r.habilidades || []).map((h) => `<p class="regra"><b class="tech-c">${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
      </div>`; })() : ""}`;

  const passoClasse = () => `
    <p class="cri-ajuda">A classe define o seu papel na tripulação, os pontos de vida base e as perícias de treino.</p>
    <div class="cri-grade">${Object.entries(CLASSES).map(([n, c]) => `
      <button class="cri-op ${esc0.classe === n ? "on" : ""}" data-classe="${esc(n)}">
        <b>${esc(n)}</b>
        <span class="cri-sub">+${c.pv} PV base</span>
        <span class="cri-attrs">${Object.keys(c.pericias || {}).slice(0, 3).join(" · ")}</span>
      </button>`).join("")}</div>
    ${esc0.classe ? (() => { const c = CLASSES[esc0.classe];
      return `<div class="cri-detalhe">
        <h4>${esc(esc0.classe)}</h4>
        <p class="regra">Perícias de classe: ${Object.entries(c.pericias || {}).map(([p2, v]) => `${p2} ${sign(v)}`).join(" · ") || "—"}</p>
        ${(c.hab || []).map((h) => `<p class="regra"><b class="tech-c">${esc(h.n)}</b> <i>(${esc(h.tipo || "")})</i>: ${esc(h.d)}</p>`).join("")}
        ${c.vet ? `<p class="regra"><b class="chrome">★ Veterana (NV5) — ${esc(c.vet.n)}:</b> ${esc(c.vet.d)}</p>` : ""}
      </div>`; })() : ""}`;

  const passoFilosofia = () => `
    <p class="cri-ajuda">A filosofia é o código que o seu personagem segue. Concede uma habilidade por descanso.</p>
    <div class="cri-grade dois">${Object.entries(FILOSOFIAS).map(([n, x]) => `
      <button class="cri-op ${esc0.filosofia === n ? "on" : ""}" data-filo="${esc(n)}">
        <b>${esc(n)}</b>${x.apelido ? `<span class="cri-sub">${esc(x.apelido)}</span>` : ""}
        <span class="cri-attrs">${esc((x.d || "").slice(0, 70))}…</span>
      </button>`).join("")}</div>
    ${esc0.filosofia ? (() => { const x = FILOSOFIAS[esc0.filosofia];
      return `<div class="cri-detalhe"><h4>${esc(esc0.filosofia)}</h4>
        ${x.lore ? `<p>${esc(x.lore)}</p>` : ""}
        <p class="regra"><b class="tech-c">Mecânica:</b> ${esc(x.d)}</p></div>`; })() : ""}`;

  const passoAtributos = () => {
    const r = RACAS.find((x) => x.nome === esc0.raca);
    if (!esc0.rolagens) return `
      <p class="cri-ajuda">A Origem define de onde você parte. Role <b>2d8 sete vezes</b>: a pior soma é descartada
        e as seis restantes viram os seus atributos. Cada soma converte assim:
        2–4 = −1 · 5–10 = +0 · 11–15 = +1 · 16 = +2.</p>
      <div class="cri-centro"><button id="cri-rolar" class="btn-primario">🎲 ROLAR A ORIGEM</button></div>`;
    const usadas = Object.values(esc0.distrib);
    return `
      <p class="cri-ajuda">Escolha uma soma para cada atributo. O modificador racial entra por cima.</p>
      <div class="cri-somas">${esc0.rolagens.map((v, i) => {
        const usada = usadas.includes(i);
        return `<span class="cri-soma ${usada ? "usada" : ""}">${v} <i>${sign(CONVERTE_2D8(v))}</i></span>`; }).join("")}</div>
      <div class="cri-grade seis">${ATTRS.map((a) => {
        const idx = esc0.distrib[a];
        const base = idx != null ? CONVERTE_2D8(esc0.rolagens[idx]) : null;
        const rac = r?.attrs[a] || 0;
        return `<div class="cri-attr ${idx != null ? "on" : ""}">
          <span class="cri-attr-n">${a}</span>
          <b class="cri-attr-v">${base != null ? sign(base + rac) : "—"}</b>
          <span class="regra">racial ${sign(rac)}</span>
          <select data-attr="${a}">
            <option value="">— escolher —</option>
            ${esc0.rolagens.map((v, i) => `<option value="${i}" ${idx === i ? "selected" : ""} ${usadas.includes(i) && idx !== i ? "disabled" : ""}>${v} → ${sign(CONVERTE_2D8(v))}</option>`).join("")}
          </select></div>`; }).join("")}</div>
      <div class="cri-centro"><button id="cri-rerolar" class="mini">↻ Rolar tudo de novo</button></div>`;
  };

  const passoPericias = () => {
    const c = CLASSES[esc0.classe];
    const livres = pontosPericiaLivres();
    return `
      <p class="cri-ajuda">Você tem <b class="${livres === 0 ? "tech-c" : "chrome"}">${livres}</b> ponto(s) para distribuir.
        As perícias de treino da sua classe já vêm marcadas. Teto de +5 por perícia no nível 1.</p>
      <div class="cri-pericias">${PERICIAS.map(([pn, at]) => {
        const daClasse = (c?.pericias || {})[pn] || 0;
        const v = esc0.pericias[pn] || 0;
        return `<div class="cri-per ${v ? "on" : ""}">
          <span>${esc(pn)} <i class="dim">(${at})</i>${daClasse ? ` <span class="best-tag" title="A sua classe já concede este valor">classe ${sign(daClasse)}</span>` : ""}</span>
          <span class="cri-per-ctl">
            <button class="mini" data-per="${esc(pn)}" data-dp="-1" ${v <= 0 ? "disabled" : ""}>−</button>
            <b>${sign(v)}</b>
            <button class="mini" data-per="${esc(pn)}" data-dp="1" ${livres <= 0 || v >= 5 ? "disabled" : ""}>+</button>
          </span></div>`; }).join("")}</div>`;
  };

  const passoIdentidade = () => `
    <p class="cri-ajuda">O último passo: quem é essa pessoa.</p>
    <div class="cri-ident">
      <label>Nome do tripulante<input id="cri-nome" value="${esc(esc0.nome)}" placeholder="Como a tripulação te chama" maxlength="40"/></label>
      <label>Tema visual<select id="cri-tema">${Object.keys(TEMAS).map((t) => `<option ${esc0.tema === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    </div>
    <div class="cri-tema-amostra">${Object.keys(TEMAS).map((t) => { const x = TEMAS[t];
      return `<button class="cri-cor ${esc0.tema === t ? "on" : ""}" data-tema="${esc(t)}" title="${esc(t)}"
        style="background:linear-gradient(135deg,${x.tech},${x.chrome},${x.sombra})"></button>`; }).join("")}</div>
    ${resumo()}`;

  const resumo = () => {
    const r = RACAS.find((x) => x.nome === esc0.raca), c = CLASSES[esc0.classe];
    const mods = {}; ATTRS.forEach((a) => {
      const idx = esc0.distrib[a];
      mods[a] = (idx != null ? CONVERTE_2D8(esc0.rolagens[idx]) : 0) + (r?.attrs[a] || 0);
    });
    const treinadas = Object.entries(esc0.pericias).filter(([, v]) => v > 0);
    return `<div class="cri-resumo">
      <h4>Resumo</h4>
      <p class="regra"><b>${esc(esc0.nome) || "Sem nome"}</b> — ${esc(esc0.raca)} · ${esc(esc0.classe)} · ${esc(esc0.filosofia)}</p>
      <div class="cri-resumo-attrs">${ATTRS.map((a) => `<span>${a} <b>${sign(mods[a])}</b></span>`).join("")}</div>
      <p class="regra">❤ Vida: 4d6 (tira o menor) ${sign(r?.vidaMod || 0)} + Con ${sign(mods.Con)} + ${c?.pv || 0} da classe — rolada ao confirmar.</p>
      <p class="regra">% ${treinadas.length ? treinadas.map(([p2, v]) => `${p2} ${sign(v)}`).join(" · ") : "nenhuma perícia distribuída"}</p>
    </div>`;
  };

  const corpos = [passoRaca, passoClasse, passoFilosofia, passoAtributos, passoPericias, passoIdentidade];

  // ---- desenho ----
  const pintar = () => {
    const p = PASSOS[passo];
    ov.innerHTML = `<div class="cri-caixa">
      <div class="cri-topo">
        <div><span class="cri-eyebrow">Novo tripulante · passo ${passo + 1} de ${PASSOS.length}</span>
          <h2>${p.ic} ${esc(p.n)}</h2><p class="cri-desc">${esc(p.d)}</p></div>
        <button class="mp-x" id="cri-x" title="Cancelar">✕</button>
      </div>
      <div class="cri-trilha">${PASSOS.map((x, i) => `
        <button class="cri-bola ${i === passo ? "atual" : ""} ${i < passo ? "feito" : ""}"
          data-ir="${i}" ${i > passo && !podeAvancar() ? "disabled" : ""} title="${esc(x.n)}">
          <span>${i < passo ? "✓" : x.ic}</span><i>${esc(x.n)}</i></button>`).join("")}</div>
      <div class="cri-corpo">${corpos[passo]()}</div>
      <div class="cri-rodape">
        <button id="cri-voltar" class="mini" ${passo === 0 ? "disabled" : ""}>← Voltar</button>
        <span class="cri-dica">${podeAvancar() ? "" : dicaFalta()}</span>
        ${passo < PASSOS.length - 1
          ? `<button id="cri-proximo" class="btn-primario" ${podeAvancar() ? "" : "disabled"}>Continuar →</button>`
          : `<button id="cri-criar" class="btn-primario" ${podeAvancar() ? "" : "disabled"}>✓ CRIAR TRIPULANTE</button>`}
      </div></div>`;
    ligar();
  };

  const dicaFalta = () => {
    if (passo === 0) return "Escolha uma raça para continuar";
    if (passo === 1) return "Escolha uma classe";
    if (passo === 2) return "Escolha uma filosofia";
    if (passo === 3) return esc0.rolagens ? "Distribua todas as somas" : "Role a Origem";
    if (passo === 4) return `Faltam ${pontosPericiaLivres()} ponto(s) de perícia`;
    if (passo === 5) return "Dê um nome ao tripulante";
    return "";
  };

  const ligar = () => {
    ov.querySelector("#cri-x").onclick = fechar;
    ov.querySelector("#cri-voltar").onclick = () => { if (passo > 0) { passo--; pintar(); } };
    ov.querySelector("#cri-proximo")?.addEventListener("click", () => { if (podeAvancar()) { passo++; pintar(); } });
    ov.querySelectorAll("[data-ir]").forEach((b) => b.onclick = () => { const i = +b.dataset.ir;
      if (i <= passo || podeAvancar()) { passo = i; pintar(); } });

    ov.querySelectorAll("[data-raca]").forEach((b) => b.onclick = () => { esc0.raca = b.dataset.raca; pintar(); });
    ov.querySelectorAll("[data-classe]").forEach((b) => b.onclick = () => {
      esc0.classe = b.dataset.classe; esc0.pericias = {};   // os pontos livres recomeçam
      pintar();
    });
    ov.querySelectorAll("[data-filo]").forEach((b) => b.onclick = () => { esc0.filosofia = b.dataset.filo; pintar(); });

    ov.querySelector("#cri-solar")?.addEventListener("click", () => {
      abrirSistemaSolar?.((nome) => { esc0.raca = nome; pintar(); });
    });

    ov.querySelector("#cri-rolar")?.addEventListener("click", () => {
      const somas = Array.from({ length: 7 }, () => d(8) + d(8)).sort((a, b) => b - a);
      esc0.rolagens = somas.slice(0, 6);         // descarta a pior
      esc0.distrib = {}; pintar();
    });
    ov.querySelector("#cri-rerolar")?.addEventListener("click", () => { esc0.rolagens = null; esc0.distrib = {}; pintar(); });
    ov.querySelectorAll("[data-attr]").forEach((sel) => sel.onchange = () => {
      const a = sel.dataset.attr;
      if (sel.value === "") delete esc0.distrib[a]; else esc0.distrib[a] = +sel.value;
      pintar();
    });

    ov.querySelectorAll("[data-per]").forEach((b) => b.onclick = () => {
      const pn = b.dataset.per, dp = +b.dataset.dp;
      const v = (esc0.pericias[pn] || 0) + dp;
      if (v < 0 || v > 5) return;
      if (dp > 0 && pontosPericiaLivres() <= 0) return;
      esc0.pericias[pn] = v; if (!v) delete esc0.pericias[pn];
      pintar();
    });

    const nomeEl = ov.querySelector("#cri-nome");
    if (nomeEl) { nomeEl.oninput = () => { esc0.nome = nomeEl.value;
        const bt = ov.querySelector("#cri-criar"); if (bt) bt.disabled = !podeAvancar();
        const dica = ov.querySelector(".cri-dica"); if (dica) dica.textContent = podeAvancar() ? "" : dicaFalta(); };
      setTimeout(() => nomeEl.focus(), 40); }
    ov.querySelector("#cri-tema")?.addEventListener("change", (e) => { esc0.tema = e.target.value; pintar(); });
    ov.querySelectorAll("[data-tema]").forEach((b) => b.onclick = () => { esc0.tema = b.dataset.tema; pintar(); });

    ov.querySelector("#cri-criar")?.addEventListener("click", () => {
      const r = RACAS.find((x) => x.nome === esc0.raca), c = CLASSES[esc0.classe];
      const rolagem = {}, pontosAttr = {};
      ATTRS.forEach((a) => { const idx = esc0.distrib[a]; rolagem[a] = idx != null ? esc0.rolagens[idx] : null; pontosAttr[a] = 0; });
      // Vida inicial: 4d6 descartando o menor + modificador racial + Con + PV base da classe
      const d4 = Array.from({ length: 4 }, () => d(6)).sort((a, b) => a - b);
      const con = (esc0.distrib.Con != null ? CONVERTE_2D8(esc0.rolagens[esc0.distrib.Con]) : 0) + (r?.attrs.Con || 0);
      const pv = Math.max(1, d4[1] + d4[2] + d4[3] + (r?.vidaMod || 0) + con + (c?.pv || 0));
      onCriar({
        raca: esc0.raca, classe: esc0.classe, filosofia: esc0.filosofia,
        rolagem, pontosAttr, periciasExtra: { ...esc0.pericias },
        pvMax: pv, pvAtual: pv, tema: esc0.tema, foto: esc0.foto,
        log: [{ q: new Date().toISOString(), t: `◈ Tripulante registrado: ${esc0.raca} ${esc0.classe}. Vida inicial ${pv} (4d6 tira-menor [${d4.slice(1).join(", ")}] ${sign(r?.vidaMod || 0)} Con ${sign(con)} +${c?.pv || 0} classe).` }],
      }, esc0.nome.trim());
      document.body.style.overflow = ""; ov.remove();
    });
  };

  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
  pintar();
}
