// ============================================================================
//  BIBLIOTECA — todas as informações detalhadas do sistema, somente leitura.
//  Extraído de app.js pra reduzir o monólito (era uma função de ~180 linhas
//  dentro de um arquivo de 5300+). Uso: import { telaBiblioteca } from
//  "./biblioteca.js"; chamado pelo roteador via import() dinâmico, igual
//  mapa-sistema.js/sistema-solar.js/criacao.js já fazem.
//
//  Corpo da função copiado tal e qual de app.js — só os identificadores livres
//  viraram imports (nomeados igual, pra não arriscar nada na tradução). Os
//  helpers abaixo (todasArmas, img, escalaTabela, etc.) continuam vivendo em
//  app.js porque telaFicha/telaMesa também os usam; aqui são só importados.
// ============================================================================
import {
  RACAS, CLASSES, SCRIPTS, FILOSOFIAS, ESTACOES, REGRAS_NAVE, UPGRADES_NAVE,
  AVARIAS, PERICIAS, TIROS_POR_PENTE,
} from "./dados-jogo.js";
import { NIVEIS_AMEACA } from "./dados-bestiario.js";
import { PAPEIS } from "./dados-npcs.js";
import {
  sign, CONDICOES_INFO, CAMPO_LARGURA, CAMPO_PISTAS, PISTA_M,
  ALCANCE_CAC, ALCANCE_ARMA, TIPOS_DANO, CON_PV_NIVEL_MAX,
} from "./regras.js";
import {
  shell, esc, img, imgFig, extras, escalaTabela, etiquetasKw,
  todasArmas, todasArmaduras, todosImplantes, todasNaves, todasCriaturas,
  todosNPCs, todosConsumiveis, perfil,
} from "./app.js";

// Termo de busca persiste entre trocas de aba (inclusive vindo do link "encontrei
// em: X" do índice cruzado) — mas não sobrevive a um F5, é só estado de sessão.
let buscaAtual = "";
// Índice leve — só os nomes de cada aba — pra dizer "existe, mas em outra aba"
// sem precisar re-renderizar o HTML inteiro de todas elas a cada tecla digitada.
const indiceAba = (id2) => ({
  racas: RACAS.map((r) => r.nome),
  classes: Object.keys(CLASSES),
  armas: todasArmas().map((a) => a.n),
  armaduras: todasArmaduras().map((a) => a.n),
  implantes: todosImplantes().map((i) => i.n),
  scripts: SCRIPTS.map((s) => s.n),
  filosofias: Object.keys(FILOSOFIAS),
  naves: todasNaves().map((n) => n.n),
  consumiveis: todosConsumiveis().map((c) => c.n),
  bestiario: todasCriaturas().map((c) => c.n),
  npcs: todosNPCs().map((n) => n.n),
  mecanicas: extras("mecanicas").map((m) => m.titulo),
}[id2] || []);

export function telaBiblioteca(aba = "racas") {
  const abas = [["regras", "📖 Regras"], ["racas", "Raças"], ["classes", "Classes"], ["armas", "Arsenal"], ["armaduras", "Armaduras"], ["implantes", "Implantes"], ["scripts", "Scripts"], ["filosofias", "Filosofias"], ["naves", "Naves"], ["consumiveis", "Consumíveis"], ["bestiario", "Bestiário"], ["npcs", "NPCs"], ["mecanicas", "Mecânicas"]];
  let corpo = "";
  const cardCriatura = (c) => { const nv = NIVEIS_AMEACA[c.ameaca] || { cor: "#8189a3" };
    return `<details class="det grande best-card" style="border-left:3px solid ${nv.cor}"><summary>${img(c.n)}<b>${esc(c.n)}</b>${c.apelido ? ` <i class="dim">${esc(c.apelido)}</i>` : ""} <span class="best-tag" style="color:${nv.cor};border-color:${nv.cor}">${esc(c.ameaca)}</span>${c.raca ? ` <i class="dim">${esc(c.raca)}</i>` : ""}</summary>
      ${imgFig(c.n)}${c.ambiental ? `<p>${esc(c.desc)}</p><p class="regra"><b class="chrome">⚠ Ameaça:</b> ${esc(c.ameaca_txt)}</p>` : `<p class="regra">❤ HP ${c.hp} · 🛡 CD ${c.cd} · 🏃 ${c.desloc}m${c.nota ? ` · <i>${esc(c.nota)}</i>` : ""}</p>`}
      ${(c.ataques || []).map((a) => `<p><b class="chrome">⚔ ${esc(a.n)}:</b> ${a.bonus != null ? `${sign(a.bonus)} acerto · ` : ""}${a.dano && a.dano !== "0" && a.dano !== "auto" ? `dano ${a.dano}` : ""}${a.extra ? ` <span class="dim">(${esc(a.extra)})</span>` : ""}</p>`).join("")}
      ${(c.habs || []).map((h) => h.efeito ? `<p><b class="tech-c">⚙ ${esc(h.n)}:</b> ${esc(h.d)} <span class="auto-tag" title="O app aplica sozinho no momento certo">automático</span></p>` : null).filter(Boolean).join("")}
      ${(c.habs || []).filter((h) => !h.efeito).map((h) => `<p><b class="tech-c">✦ ${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}</details>`; };
  if (aba === "racas") corpo = RACAS.map((r) => `<details class="det grande"><summary><b>${esc(r.nome)}</b> (${r.planeta}) — ${esc(r.titulo)}</summary>
    <p>${esc(r.lore)}</p>
    <p class="regra">Vida 4d6 (tira o menor) ${sign(r.vidaMod)} · por nível 1d${r.dadoVida} (fixo ${r.vidaFixa}) + Con até +${CON_PV_NIVEL_MAX} · ${["For","Des","Con","Int","Sab","Car"].map((a) => `${a} ${sign(r.attrs[a])}`).join(" · ")}</p>
    ${r.habilidades.map((h) => `<p><b class="tech-c">${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
    ${r.lendaria ? `<p><b class="sombra-c">★ Lendária (NV10) — ${esc(r.lendaria.n)}:</b> ${esc(r.lendaria.d)}</p>` : ""}</details>`).join("");
  if (aba === "classes") corpo = Object.entries(CLASSES).map(([n, c]) => `<details class="det grande"><summary><b>${esc(n)}</b>${c.titulo ? ` <i class="dim">${esc(c.titulo)}</i>` : ""} — Vida +${c.pv}</summary>
    ${c.lore ? `<p>${esc(c.lore)}</p>` : ""}
    <p class="regra">Perícias: ${Object.entries(c.pericias).map(([p, v]) => `${p} +${v}`).join(", ")}</p>
    ${c.hab.map((h) => `<p><b class="tech-c">${h.tipo} — ${esc(h.n)}:</b> ${esc(h.d)}</p>`).join("")}
    <p><b class="chrome">★ Veterana (NV5) — ${esc(c.vet.n)}:</b> ${esc(c.vet.d)}</p>
    ${c.lendaria ? `<p><b class="sombra-c">★★ Marco de classe (NV10) — ${esc(c.lendaria.n)}:</b> ${esc(c.lendaria.d)}</p>` : ""}
    ${c.equipamento ? `<p class="regra"><b>Equipamento inicial:</b> ${esc(c.equipamento)}</p>` : ""}</details>`).join("");
  if (aba === "armas") corpo = ["branca", "fogo"].map((t) => `<h3 class="sub">${t === "branca" ? "⚔ Armas Brancas (1d20 + For + Armas Brancas)" : "🔫 Armas de Fogo (1d20 + Des + Armas de Fogo)"}</h3>` +
    todasArmas().filter((a) => a.tipo === t).map((a) => `<details class="det grande"><summary>${img(a.n)}<b>${esc(a.n)}</b> · <b class="chrome">${a.dano}${a.escala ? "↗" : ""}</b>${a.preco ? ` · ${a.preco} CG` : ""}${a._ajustado ? ` <span class="best-tag" style="color:var(--chrome);border-color:var(--chrome)">ajustada</span>` : ""}</summary>
      ${imgFig(a.n)}
      <p class="regra">Rola <b>1d20 + ${a.attr === "Des" ? "Destreza" : "Força"} + ${esc(a.per)}</b> · dano <b>${a.dano} + ${a.attr}</b></p>
      ${a.escala ? `<div class="escala-box"><b class="tech-c">↗ Dano por nível</b>
        <div class="escala-linha">${escalaTabela(a)}</div>
        <p class="regra">Esta arma acompanha a sua carreira: o dado sobe nos marcos abaixo.</p></div>` : ""}
      ${a.kw ? etiquetasKw(a, { detalhado: true }) : `<p class="regra"><i>Sem palavras-chave.</i></p>`}
      ${a.desc ? `<p>${esc(a.desc)}</p>` : ""}</details>`).join("")).join("");
  if (aba === "armaduras") corpo = todasArmaduras().map((a) => `<details class="det grande"><summary>${img(a.n)}<b>${esc(a.n)}</b> · CD +${a.cd} <span class="dim">(${a.t})</span>${a.preco ? ` · <b class="chrome">${a.preco} CG</b>` : ""}</summary>${a.e ? `<p class="regra"><b>Efeito:</b> ${esc(a.e)}</p>` : ""}${a.desc ? `<p>${esc(a.desc)}</p>` : ""}</details>`).join("");
  if (aba === "implantes") corpo = todosImplantes().map((i) => `<div class="det"><b>${esc(i.n)}</b> · <b class="chrome">${i.p} CG</b> <span class="dim">(${i.g})</span> — ${esc(i.e)}</div>`).join("");
  if (aba === "scripts") corpo = SCRIPTS.map((s) => `<details class="det grande"><summary><b>${esc(s.n)}</b> <i class="sombra-c">${s.c}◈ ${esc(s.a)}</i></summary><p class="regra"><b>Efeito:</b> ${esc(s.d)}</p>${s.lore ? `<p>${esc(s.lore)}</p>` : ""}</details>`).join("");
  if (aba === "filosofias") corpo = ["Caminho", "Código"].map((cat) => `<h3 class="sub">${cat === "Caminho" ? "🌌 Os Caminhos — místicos e religiosos, focados em intuição, manipulação do ambiente e superação física pela fé" : "⚙️ Os Códigos — seculares e pragmáticos, focados em treinamento militar, lógica, malícia das ruas e sobrevivência crua"}</h3>` +
    Object.entries(FILOSOFIAS).filter(([, x]) => x.categoria === cat).map(([n, x]) => {
      // "1x/desc. passiva" não quer dizer nada: cada freq tem o seu rótulo.
      const etq = { passiva: "passiva", combate: "1x/combate", curto: "1x/desc. curto", longo: "1x/desc. longo" }[x.freq] || x.freq;
      const auto = (x.efeitos || []).length;
      return `<details class="det grande"><summary><b>${esc(n)}</b>${x.apelido ? ` <i class="dim">${esc(x.apelido)}</i>` : ""}${etq ? ` <span class="best-tag">${esc(etq)}</span>` : ""}${auto ? ` <span class="auto-tag" title="O app aplica sozinho no momento certo">automático</span>` : ""}</summary>${x.lore ? `<p>${esc(x.lore)}</p>` : ""}<p class="regra"><b class="tech-c">Mecânica:</b> ${esc(x.d)}</p></details>`;
    }).join("")).join("");
  if (aba === "naves") corpo = `<p class="regra">${esc(REGRAS_NAVE.defesa)}<br>${esc(REGRAS_NAVE.dobra)}<br>${esc(REGRAS_NAVE.critico)}</p>` +
    todasNaves().map((n) => `<details class="det grande"><summary><b>${esc(n.n)}</b> · Casco ${n.casco} · Escudos ${n.escudos} · Manobra ${sign(n.manobra)} · Dano ${n.dano}</summary>
    <p>${esc(n.desc)}</p><p class="regra">Tripulação: ${esc(n.trip)}</p></details>`).join("") +
    `<h3 class="sub">Estações de Batalha</h3>` + Object.values(ESTACOES).map((e) => `<div class="det"><b>${esc(e.n)}</b>${e.acoes.map((a) => `<p><b class="tech-c">${esc(a.n)}${a.rola ? ` (${a.rola.join("+")})` : ""}:</b> ${esc(a.d)}</p>`).join("")}</div>`).join("")
    + `<h3 class="sub">🛠 Manutenção e reparo</h3>
      <p class="regra">Uma nave avariada não se conserta sozinha. São quatro formas de recuperar o Casco, da mais imediata à mais definitiva.</p>
      <div class="det grande"><p><b class="tech-c">Em combate — Reparos de Emergência:</b> o Engenheiro gasta a Ação Principal e testa Inteligência + Mecânica. Com sucesso, a nave recupera <b>1d4</b> de Casco.</p>
        <p><b class="tech-c">Em combate — Reparo Estrutural em Massa:</b> Script de 4 Slots de RAM; nanites restauram <b>4d10</b> do Casco.</p>
        <p><b class="tech-c">Descanso Longo — manutenção de bordo:</b> oito horas paradas devolvem <b>1d10+5</b> de Casco e recalibram os Escudos, sem custo.</p>
        <p><b class="tech-c">Estaleiro — reparo definitivo:</b> Casco e Escudos ao máximo e todas as avarias reparadas. Custa <b class="chrome">8 CG por ponto de Casco</b> e <b class="chrome">150 CG por avaria</b>; alguém da tripulação paga a conta.</p>
        <p class="regra"><i>Escudos são a exceção: recarregam sozinhos entre combates. É o Casco que cobra caro.</i></p></div>`
    + `<h3 class="sub">⚙ Melhorias de nave</h3>
      <p class="regra">Permanentes: alteram os atributos da nave a partir da instalação. A nave da tripulação é um personagem coletivo — acumula melhorias e cicatrizes.</p>`
      + UPGRADES_NAVE.map((u) => `<div class="det"><b>${esc(u.n)}</b> · <b class="chrome">${u.p} CG</b> — ${esc(u.e)}</div>`).join("")
    + `<h3 class="sub">⚠ Falhas Críticas do Casco (1d6)</h3>
      <p class="regra">Um acerto crítico ou um dano massivo no Casco dispara uma avaria. Elas só saem com reparo.</p>`
      + AVARIAS.map((av) => `<div class="det"><b>${av.d} — ${esc(av.n)}</b><br><span class="regra">${esc(av.e)}</span></div>`).join("");
  if (aba === "bestiario") { const base = ["Crias do Vazio", "Inimigos das Raças", "Heranças das Estrelas"];
    const cats = [...base, ...[...new Set(todasCriaturas().map((c) => c.categoria))].filter((c) => c && !base.includes(c))];
    const legenda = `<p class="regra">Ordene as fichas por ameaça: ${Object.entries(NIVEIS_AMEACA).map(([n, v]) => `<span class="best-tag" style="color:${v.cor};border-color:${v.cor}">${n}</span>`).join(" ")}</p>`;
    corpo = legenda + cats.map((cat) => { const lista = todasCriaturas().filter((c) => c.categoria === cat).sort((a, b) => (NIVEIS_AMEACA[a.ameaca]?.ordem || 0) - (NIVEIS_AMEACA[b.ameaca]?.ordem || 0));
      const desc = { "Crias do Vazio": "Os invasores de fora da realidade — escalonados de lacaios a chefes.", "Inimigos das Raças": "Adversários de cada povo do sistema, em três níveis de dificuldade.", "Heranças das Estrelas": "Fauna exoplanetária e quimeras do mercado negro do Caminho da Espiral." }[cat];
      return `<h3 class="sub">${esc(cat)} <span class="dim">(${lista.length})</span></h3><p class="regra">${esc(desc)}</p>${lista.map(cardCriatura).join("")}`; }).join(""); }
  if (aba === "npcs") {
    const porPapel = {};
    todosNPCs().forEach((n) => (porPapel[n.papel] = porPapel[n.papel] || []).push(n));
    corpo = `<p class="regra">Figuras prontas para o Mestre puxar numa cena social: o que oferecem, o que querem e o segredo que guardam.</p>`
      + Object.entries(porPapel).map(([papel, lista]) => { const p = PAPEIS[papel] || { ic: "•", cor: "#8189a3" };
        return `<h3 class="sub">${p.ic} ${esc(papel)} <span class="dim">(${lista.length})</span></h3>` + lista.map((n) => `
          <details class="det grande best-card" style="border-left:3px solid ${p.cor}">
            <summary><b>${esc(n.n)}</b> <span class="best-tag" style="color:${p.cor};border-color:${p.cor}">${esc(n.atitude)}</span> <i class="dim">${esc(n.raca)} · ${esc(n.faccao)}</i></summary>
            <p class="regra">📍 ${esc(n.local)}</p>
            <p>${esc(n.gancho)}</p>
            <p class="npc-fala">${esc(n.fala)}</p>
            <p><b class="tech-c">Oferece:</b> ${esc(n.oferece)}</p>
            <p><b class="chrome">Quer:</b> ${esc(n.quer)}</p>
            <p><b style="color:var(--sombra)">Segredo (só o Mestre):</b> ${esc(n.segredo)}</p>
          </details>`).join(""); }).join("");
  }
  if (aba === "consumiveis") corpo = `<p class="regra">Itens de uso único. Gastam-se ao serem usados e pedem um alvo quando curam — na mesa, pelo botão <b>🎒 Usar item</b>.</p>`
    + todosConsumiveis().map((c) => `<details class="det grande"><summary>${img(c.n)}<b>${c.ic} ${esc(c.n)}</b> · <b class="chrome">${c.p} CG</b> <span class="dim">(${esc(c.acao)})</span></summary>${imgFig(c.n)}<p>${esc(c.d)}</p>${c.dado ? `<p class="regra"><b class="tech-c">Efeito:</b> cura ${c.dado} no alvo.</p>` : ""}</details>`).join("");
  // ---- REGRAS: o manual de bolso da mesa ----------------------------------
  // Gerado a partir das MESMAS constantes que o app usa para resolver as ações
  // (CONDICOES_INFO, TIPOS_DANO, ALCANCE_*, TIROS_POR_PENTE…). Se a regra mudar
  // no código, o texto aqui muda junto — não existe versão "de papel" para desatualizar.
  if (aba === "regras") {
    const m = (n) => String(n).replace(".", ",");
    const cardCond = (c) => `<div class="det regra-cond"><b class="tech-c">${c.ic} ${esc(c.n)}</b>${c.dano ? ` <span class="best-tag" style="color:var(--perigo);border-color:var(--perigo)">${c.dano}/turno</span>` : ""}<br><span class="regra">${esc(c.d)}</span></div>`;
    corpo = `
    <p class="regra">Como o app resolve cada coisa na mesa. O que está aqui é o que o sistema realmente faz quando você clica — não é resumo, é a regra em vigor.</p>

    <details class="det grande" open><summary><b>🎲 O teste básico</b></summary>
      <p>Quase tudo se resolve com <b class="chrome">1d20 + atributo + perícia</b> contra uma CD (dificuldade). Igual ou maior que a CD, passou.</p>
      <p class="regra"><b>Vantagem</b> rola dois d20 e fica com o <b>maior</b>. <b>Desvantagem</b> rola dois e fica com o <b>menor</b>. Quando as duas aparecem juntas, elas se cancelam: o app soma todas as fontes e o resultado final só pode ser vantagem, normal ou desvantagem — nunca "vantagem dupla".</p>
      <p class="regra"><b>Teste oposto:</b> os dois lados rolam perícia e o maior vence. <b>Empate favorece quem se defende.</b></p>
      <p class="regra">Perícias do sistema: ${PERICIAS.map(([p, a]) => `${esc(p)} <span class="dim">(${a})</span>`).join(" · ")}.</p></details>

    <details class="det grande"><summary><b>⚔ A rodada de combate</b></summary>
      <p>A ordem sai de <b>1d20 + Destreza</b> (Batedor e Código do Sobrevivente somam +2). Cada um age no seu turno, de cima para baixo, e a rodada vira quando todos agiram.</p>
      <h4 class="sub">Economia de ações</h4>
      <p class="regra">Por turno você tem <b class="chrome">1 Ação Principal</b> (P), <b class="chrome">1 Ação de Movimento</b> (M) e, por rodada, <b class="chrome">1 Reação</b> (R). Ações Livres não gastam nada.</p>
      <p class="regra">P e M recarregam no <b>seu</b> turno. A Reação recarrega na virada da <b>rodada</b> — por isso ela funciona fora do seu turno, que é justamente a graça dela.</p>
      <p class="regra">O indicador <b>P M R</b> aparece na sua linha do rastreador enquanto é a sua vez: aceso = disponível, apagado = já gastou. Atacar, conjurar, usar habilidade ou item, mover no campo e trocar pente consomem a ação que estiver escrita em cada um.</p>
      <p class="regra"><i>Fora do seu turno o app te bloqueia. O Mestre pode forçar qualquer coisa — ele confirma e segue.</i></p></details>

    <details class="det grande"><summary><b>🎯 Acertar e causar dano</b></summary>
      <p>Ataque é <b class="chrome">1d20 + atributo + perícia</b> contra a <b>Defesa</b> do alvo. Arma branca usa Força + Armas Brancas; arma de fogo usa Destreza + Armas de Fogo. Armas <b>Ágeis</b> podem trocar Força por Destreza.</p>
      <h4 class="sub">Crítico</h4>
      <p class="regra">Um <b class="chrome">20 natural</b> é crítico. Um alvo <b>Paralisado a até 2 m</b> também é crítico automático — mas um <b>1 natural</b> continua errando, sempre.</p>
      <p class="regra"><b>A conta do crítico:</b> soma os dados <b>e o bônus primeiro</b>, e só então multiplica o total. <code>1d6 tirou 5, +3 de bônus → (5+3) × 2 = <b>16</b></code>. Nunca é "rolar o dobro de dados" — o bônus entra na multiplicação.</p>
      <p class="regra">Efeitos que dobram crítico por cima (Ataque Furtivo do Assassino veterano) multiplicam de novo, chegando a ×4.</p>
      <h4 class="sub">Modificadores de acerto</h4>
      <p class="regra">Alvo <b>Marcado</b>: +2 para quem o ataca. Alvo <b>Atordoado, Paralisado, Caído, Cego ou Surpreso</b>: Vantagem contra ele. Atacante <b>Cego, Acovardado ou Envenenado</b>: Desvantagem. <b>Amedrontado</b>: Desvantagem só contra a fonte do medo.</p></details>

    <details class="det grande"><summary><b>🛡 Defesa, escudo e absorção</b></summary>
      <p>A <b>Defesa</b> é <b class="chrome">10 + Destreza + armadura</b> (+1 com Placas Subdérmicas). Armadura média limita a Destreza a +2; armadura pesada zera.</p>
      <p class="regra"><b>Cobertura</b> (só contra tiro — corpo a corpo ignora): parcial 🧱 <b>+2</b> de Defesa, total 🏚 <b>+5</b>.</p>
      <p class="regra"><b>Perfurante</b> e <b>Derretimento</b> descontam da Defesa do alvo antes de comparar. O log sempre mostra a conta: <code>Def 15 −2🗡 = 13</code>.</p>
      <h4 class="sub">Ordem em que o dano é absorvido</h4>
      <p class="regra">1. <b>Imunidade</b> ao tipo → o golpe simplesmente não acontece.<br>
        2. <b>Couraça</b> de criatura (golpe abaixo do limiar não arranha).<br>
        3. <b>Resistência adaptativa</b> 🧬 (o bicho já apanhou daquele tipo antes).<br>
        4. <b>Redução</b> de dano — só contra dano físico (Endurecer e afins).<br>
        5. <b>Escudo pessoal</b> 🛡 — recarrega em qualquer descanso.<br>
        6. <b>PV Temporário</b> ✚ — some no descanso e <b>não acumula</b>: fica sempre o maior valor, nunca a soma.<br>
        7. <b>Corpo</b> — o que sobrou vira PV perdido.</p></details>

    <details class="det grande"><summary><b>🔥 Tipos de dano</b></summary>
      <p class="regra">Todo dano tem um tipo. Ele decide imunidades, resistências e o que a Zona Morta faz com você.</p>
      <p>${TIPOS_DANO.map((t) => `<span class="best-tag">${esc(t)}</span>`).join(" ")}</p>
      <p class="regra">O tipo vem da palavra-chave da arma (plasma e Derretimento queimam, toxinas corroem, EMP eletrocuta), do texto do ataque da criatura, ou da munição especial carregada — nessa ordem, o mais específico ganha.</p>
      <p class="regra"><b class="chrome">Verdadeiro</b> é a exceção: atravessa imunidade, resistência e couraça. Nada segura.</p></details>

    <details class="det grande"><summary><b>🏷 Condições — todas as ${CONDICOES_INFO.length}</b></summary>
      <p class="regra">Condições contam turnos sozinhas e caem no início do turno de quem as carrega. As que causam <b>dano contínuo</b> empilham <b>+1 turno</b> se aplicadas de novo (o dado nunca aumenta); as de <b>estado</b> renovam para a maior duração.</p>
      ${CONDICOES_INFO.map(cardCond).join("")}
      <p class="regra" style="margin-top:10px"><b>Livrar-se antes da hora:</b> <b>Em chamas</b> — Ação Principal + Reação, deslocamento pela metade no turno, e um d20 puro: 10 ou mais apaga. <b>Caído</b> — Ação Principal + Ação de Movimento levanta na hora. <b>Sangrando</b> — Kit de Primeiros Socorros estanca.</p></details>

    <details class="det grande"><summary><b>🗺 Campo tático — distância e alcance</b></summary>
      <p>O campo tem <b class="chrome">${CAMPO_LARGURA} m</b> de frente e <b>${CAMPO_PISTAS} pistas</b> de profundidade (frente / meio / fundo), com ${m(PISTA_M)} m entre pistas. Arraste o seu token no seu turno — mover gasta a Ação de Movimento.</p>
      <p class="regra"><b>Quanto você anda:</b> o seu Deslocamento (9 m de base, 18 m para Mercusys, + 2 m por ponto de Destreza). <b>Metade</b> se estiver Caído, com Motor Travado, ou se tentou apagar fogo neste turno. <b>Zero</b> se estiver Paralisado, Congelado ou Lento.</p>
      <h4 class="sub">Alcance das armas</h4>
      <p class="regra"><b>Corpo a corpo:</b> ${m(ALCANCE_CAC)} m — o comprimento real de um braço com lâmina. A palavra-chave <b>Alcance</b> estende para 3 m, e quem tem alcance natural declarado (os Braços Telescópicos do Infimor chegam a 10 m) usa o maior dos dois — alcance não empilha.</p>
      <p class="regra"><b>Fogo:</b> curto <b>${ALCANCE_ARMA.curto} m</b> · médio <b>${ALCANCE_ARMA.medio} m</b> (Alcance Maior) · longo <b>${ALCANCE_ARMA.longo} m</b> (Mira Telescópica).</p>
      <p class="regra">Fora do alcance, o tiro <b>nem acontece</b> — você não gasta munição. O seletor de alvo só lista quem dá para acertar. O Mestre enxerga todo mundo e pode forçar, e aí o log registra "não alcança".</p>
      <h4 class="sub">Área e empurrão</h4>
      <p class="regra">Efeitos com raio pedem um <b>ponto de impacto</b>: você escolhe quem está no centro e o app marca automaticamente todo mundo dentro do raio — <b>aliado incluído</b>. É o risco real de uma granada.</p>
      <p class="regra">Efeitos com empurrão jogam o alvo para longe do centro, e o token anda no mapa de verdade.</p></details>

    <details class="det grande"><summary><b>🔫 Munição e pentes</b></summary>
      <p>Cada arma de fogo tem <b>${TIROS_POR_PENTE} tiros</b> por pente, e cada arma carrega o <b>seu próprio</b> pente. A mochila é compartilhada.</p>
      <p class="regra"><b>Quantos pentes você carrega:</b> 5 + modificador de Força (mínimo 2) — um no cano e o resto na mochila. Braço forte, mais chumbo.</p>
      <p class="regra">Trocar o pente gasta a <b>Ação de Movimento</b>. Pente vazio e mochila vazia significa que só um saque ou um descanso resolve.</p>
      <p class="regra"><b>Munição especial</b> troca o tipo de dano e pode aplicar condição ao acertar — ela manda por cima da palavra-chave da arma.</p></details>

    <details class="det grande"><summary><b>◈ Tecnomancia, RAM e Overclock</b></summary>
      <p>Scripts custam <b>Slots de RAM</b>. A RAM máxima é <b>1 + Inteligência + metade de Tecnomancia + 1 por nível ímpar</b> (+2 com o Chip de Expansão).</p>
      <p class="regra"><b>Sem RAM, dá para forçar pagando com o corpo:</b> <b class="sombra-c">Bateria Interna</b> (implante, scripts de custo até 2) cobra <b>1d8</b> de Vida e não gasta RAM; <b class="sombra-c">Overclock manual</b> cobra <b>1d6 por ponto que falta</b> e consome o que ainda havia.</p>
      <p class="regra">Uma <b>Zona Morta</b> de criatura desliga tudo isso dentro do raio: ninguém conjura, e os implantes ficam inertes — a ficha é recalculada sem eles enquanto você estiver lá dentro.</p></details>

    <details class="det grande"><summary><b>🌙 Descanso</b></summary>
      <p><b class="tech-c">Curto (1 h):</b> reinicia habilidades "1×/descanso curto", recarrega o escudo pessoal e dissolve o PV Temporário. Mercusys regenera +1d4 PV; os outros curam com Kits Médicos.</p>
      <p><b class="tech-c">Longo (8 h):</b> PV cheio, RAM recarregada, pentes repostos e todas as habilidades reiniciadas. A nave também recupera <b>1d10+5</b> de Casco.</p>
      <p><b class="tech-c">Sessão:</b> habilidades "1×/sessão" só voltam quando o Mestre abre uma sessão nova pela Tela do Mestre.</p>
      <p class="regra">O Mestre pode convocar um descanso para a mesa inteira de uma vez — todo mundo recebe o efeito ao mesmo tempo.</p></details>

    <details class="det grande"><summary><b>💀 Cair, morrer e ser derrotado</b></summary>
      <p>A <b>0 PV</b> o personagem cai inconsciente e sai do fluxo de turnos. O rastreador marca ☠ e a linha esmaece.</p>
      <p class="regra">Criaturas em <b>bando</b> (×N no rastreador) funcionam como uma fila: o dano mata uma e o excesso transborda para a próxima, na mesma rolagem.</p>
      <p class="regra">Naves não caem: perdem <b>Escudos</b> primeiro, depois <b>Casco</b>. Casco a zero é abate. Crítico ou dano pesado no casco dispara uma <b>Falha Crítica</b> (avaria), que só sai com reparo.</p></details>`;
  }
  if (aba === "mecanicas") {
    const ms = extras("mecanicas");
    corpo = `<p class="regra">Regras, mecânicas e conteúdo acrescentados pela administração da mesa — sempre em dia com a última versão do livro.</p>`
      + (ms.length ? ms.map((m) => `<details class="det grande" open><summary>${img(m.titulo)}<b>${esc(m.titulo)}</b>${m.cat ? ` <span class="best-tag">${esc(m.cat)}</span>` : ""}</summary>${imgFig(m.titulo)}<div class="mec-corpo">${(m.texto || "").split("\n").filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("")}</div></details>`).join("")
        : `<p class="regra"><i>Nenhuma mecânica adicional cadastrada ainda.</i></p>`);
  }
  const podeAdmin = !!perfil?.admin;
  shell("biblioteca", `
    <header class="masthead"><h1>BIBLIOTECA<span> DO SISTEMA</span></h1>
      <div class="mast-sub">Tudo do livro Passagem Sombria, pesquisável e completo${podeAdmin ? ` · <button id="abrir-admin" class="mini">🛠 Administrar conteúdo</button>` : ""}</div></header>
    <div class="filtros"><input id="bib-busca" placeholder="🔍 Buscar nesta aba (nome, palavra-chave, efeito…)" style="flex:1;min-width:220px" value="${esc(buscaAtual)}"/></div>
    <div id="bib-cross" class="regra" hidden></div>
    <div class="filtros">${abas.map(([id2, l]) => `<a href="#/biblioteca/${id2}" class="${aba === id2 ? "on" : ""}">${l}</a>`).join("")}</div>
    <section class="sec">${corpo}</section>`, "biblioteca");
  document.getElementById("abrir-admin")?.addEventListener("click", async () => { const { painelAdmin } = await import("./admin.js"); painelAdmin(aba); });

  // ---- Busca ----------------------------------------------------------------
  // Filtra os cards desta aba pelo texto (nome, descrição, o que tiver no card).
  // Um índice leve (só nomes, não o HTML inteiro) cobre as OUTRAS abas, pra avisar
  // "isso existe, mas em Arsenal" em vez de deixar parecer que não existe.
  const secao = document.querySelector("section.sec");
  const cross = document.getElementById("bib-cross");
  const aplicarBusca = (termoBruto) => {
    const termo = termoBruto.trim().toLowerCase();
    let visiveis = 0;
    secao.querySelectorAll(":scope > details, :scope > div.det").forEach((card) => {
      const bate = !termo || card.textContent.toLowerCase().includes(termo);
      card.hidden = !bate; if (bate) visiveis++;
    });
    if (!termo) { cross.hidden = true; return; }
    if (visiveis) { cross.hidden = true; return; }
    const outrosNomes = abas.filter(([id2]) => id2 !== aba && id2 !== "regras")
      .flatMap(([id2, l]) => indiceAba(id2).some((n) => n.toLowerCase().includes(termo)) ? [[id2, l]] : []);
    cross.hidden = false;
    cross.innerHTML = outrosNomes.length
      ? `Nada nesta aba. Encontrei em: ${outrosNomes.map(([id2, l]) => `<a href="#/biblioteca/${id2}">${l}</a>`).join(" · ")} <span class="dim">(clique pra ir lá e buscar de novo)</span>`
      : `<i>Nada encontrado em nenhuma aba.</i>`;
  };
  document.getElementById("bib-busca").oninput = (e) => { buscaAtual = e.target.value; aplicarBusca(buscaAtual); };
  if (buscaAtual) aplicarBusca(buscaAtual);
}
