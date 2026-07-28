// ============================================================================
//  SISTEMA SOLAR — seletor de raça 3D (Three.js) com fallback SVG.
//  Uso:  import { abrirSeletorPlanetas } from "./sistema-solar.js";
//        abrirSeletorPlanetas(RACAS, (nomeRaca) => { ... });
// ============================================================================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sign = (n) => (n >= 0 ? "+" + n : "" + n);

// Planetas em ordem de distância do sol (dados visuais + raça vinculada).
const PLANETAS = [
  { raca: "Mercusys",    planeta: "Mercúrio", cor: 0xc9a15a, hex: "#c9a15a", tam: 0.7,  orbita: 9,  vel: 0.90, aneis: false },
  { raca: "Ven'y",       planeta: "Vênus",    cor: 0xe0b060, hex: "#e0b060", tam: 0.95, orbita: 13, vel: 0.72, aneis: false },
  { raca: "Terráqueo",   planeta: "Terra",    cor: 0x4a90d9, hex: "#4a90d9", tam: 1.0,  orbita: 17, vel: 0.62, aneis: false },
  { raca: "Marciano",    planeta: "Marte",    cor: 0xc1440e, hex: "#c1440e", tam: 0.85, orbita: 21, vel: 0.50, aneis: false },
  { raca: "Conjupitero", planeta: "Júpiter",  cor: 0xd8a878, hex: "#d8a878", tam: 2.2,  orbita: 28, vel: 0.34, aneis: false },
  { raca: "Sata",        planeta: "Saturno",  cor: 0xe3d9a8, hex: "#e3d9a8", tam: 1.9,  orbita: 35, vel: 0.26, aneis: true },
  { raca: "Urak",        planeta: "Urano",    cor: 0xa0e0e0, hex: "#a0e0e0", tam: 1.4,  orbita: 41, vel: 0.20, aneis: true },
  { raca: "Proturno",    planeta: "Netuno",   cor: 0x3a6ecc, hex: "#3a6ecc", tam: 1.35, orbita: 46, vel: 0.16, aneis: false },
  { raca: "Infimor",     planeta: "Plutão",   cor: 0xb0a090, hex: "#b0a090", tam: 0.55, orbita: 51, vel: 0.12, aneis: false },
];

// Personagem de exemplo por raça (nome, classe, conceito).
const EXEMPLOS = {
  "Mercusys":    { nome: "Vex-3 “Relâmpago”",         classe: "Batedor",    conceito: "Mensageira que nunca parou de correr — entrega dados entre as colônias antes que a luz alcance." },
  "Ven'y":       { nome: "Sythra da Bruma",            classe: "Assassino",  conceito: "Alquimista-predadora: destila venenos da névoa e caça no silêncio de Vênus." },
  "Terráqueo":   { nome: "Cabo Dane Okoro",            classe: "Explorador", conceito: "Sobrevivente teimoso da Terra — frágil no papel, impossível de manter no chão." },
  "Marciano":    { nome: "Kaideth, Lâmina do Conclave", classe: "Soldado",   conceito: "Duelista do sangue duplo — sereno na paz, tempestade na guerra." },
  "Conjupitero": { nome: "Engenheiro-Titã Brox",       classe: "Mecânico",   conceito: "Senhor da gravidade e da engenharia pesada; monta e desmonta máquinas com a mente." },
  "Sata":        { nome: "Oräa dos Anéis",             classe: "Cinético",   conceito: "Cultista-moldadora que reescreve o próprio corpo com a genética dos Anéis." },
  "Urak":        { nome: "Voz-do-Gelo Tunn",           classe: "Músico",     conceito: "Fala o zero absoluto — congela o ar e silencia motores com uma nota só." },
  "Proturno":    { nome: "O Soberano Naeth",           classe: "Espião",     conceito: "Telepata das sombras de Netuno; domina a sala antes que saibam que ele entrou." },
  "Infimor":     { nome: "Gor’Vhal, o Esquecido",      classe: "Prospector", conceito: "Titã do vácuo de Plutão — carrega o peso de eras e a força para movê-lo." },
};

const ATTRS = ["For", "Des", "Con", "Int", "Sab", "Car"];

// -------- Silhueta estilizada (SVG) por raça --------
// Base humanoide + traço distintivo + cor do planeta. Sem imagens externas.
function silhueta(raca, hex) {
  const tracos = {
    "Mercusys":    `<path d="M60 120 L40 150 M150 130 L175 160" stroke="${hex}" stroke-width="3" opacity=".7"/><circle cx="120" cy="70" r="6" fill="${hex}"/>`, // linhas de velocidade
    "Ven'y":       `<path d="M95 95 q25 -18 50 0" fill="none" stroke="${hex}" stroke-width="4"/><path d="M108 205 l-10 30 M132 205 l10 30" stroke="${hex}" stroke-width="3"/>`, // máscara + garras
    "Terráqueo":   `<circle cx="120" cy="86" r="4" fill="${hex}"/><path d="M92 150 h56" stroke="${hex}" stroke-width="3" opacity=".6"/>`, // equilíbrio
    "Marciano":    `<path d="M120 40 L110 20 L130 20 Z" fill="${hex}"/><rect x="150" y="150" width="6" height="70" fill="${hex}"/>`, // crista + lâmina
    "Conjupitero": `<rect x="70" y="120" width="100" height="14" rx="6" fill="${hex}" opacity=".8"/><circle cx="150" cy="175" r="10" fill="none" stroke="${hex}" stroke-width="3"/>`, // armadura pesada
    "Sata":        `<ellipse cx="120" cy="82" rx="34" ry="10" fill="none" stroke="${hex}" stroke-width="3" transform="rotate(-18 120 82)"/>`, // anel
    "Urak":        `<path d="M120 46 l-8 22 h16 Z" fill="${hex}"/><path d="M96 120 l8 20 M144 120 l-8 20" stroke="${hex}" stroke-width="2.5" opacity=".8"/>`, // cristais de gelo
    "Proturno":    `<path d="M84 78 q36 -40 72 0 l-6 40 q-30 -20 -60 0 Z" fill="${hex}" opacity=".5"/>`, // capuz sombrio
    "Infimor":     `<path d="M70 118 q50 -26 100 0" fill="none" stroke="${hex}" stroke-width="6" opacity=".7"/><circle cx="120" cy="72" r="10" fill="none" stroke="${hex}" stroke-width="3"/>`, // porte de titã
  };
  return `<svg viewBox="0 0 240 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs><radialGradient id="g-${raca.replace(/\W/g, "")}" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="${hex}" stop-opacity=".38"/><stop offset="100%" stop-color="${hex}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="120" cy="150" r="120" fill="url(#g-${raca.replace(/\W/g, "")})"/>
    <g fill="#0c0f19" stroke="${hex}" stroke-width="1.5">
      <circle cx="120" cy="78" r="26"/>
      <path d="M94 150 q0 -34 26 -34 q26 0 26 34 l-6 96 q-20 10 -40 0 Z"/>
      <path d="M96 150 l-22 70 q-2 10 8 10 l14 -6" fill="#0c0f19"/>
      <path d="M144 150 l22 70 q2 10 -8 10 l-14 -6" fill="#0c0f19"/>
      <path d="M104 250 l-6 66 q0 6 10 6 l8 -60 Z"/>
      <path d="M136 250 l6 66 q0 6 -10 6 l-8 -60 Z"/>
    </g>
    ${tracos[raca] || ""}
  </svg>`;
}

// -------- Ficha da raça (painel lateral) --------
function fichaRacaHTML(r, plan) {
  const ex = EXEMPLOS[r.nome] || {};
  const attrs = ATTRS.map((a) => `<div class="ss-a"><span>${a}</span><b>${sign(r.attrs[a])}</b></div>`).join("");
  const habs = (r.habilidades || []).map((h) => `<p><b>${esc(h.n)}</b> <i>(${esc(h.tipo || "")})</i> — ${esc(h.d)}</p>`).join("");
  const lend = r.lendaria ? `<p class="ss-lend"><b>★★ Lendária (NV10) — ${esc(r.lendaria.n)}:</b> ${esc(r.lendaria.d)}</p>` : "";
  return `
    <div class="ss-ex">
      <div class="ss-silhueta">${silhueta(r.nome, plan.hex)}</div>
      <div class="ss-ex-info">
        <span class="ss-tag" style="color:${plan.hex};border-color:${plan.hex}">${esc(plan.planeta)}</span>
        <h2>${esc(r.nome)}</h2>
        <p class="ss-titulo">${esc(r.titulo)}</p>
        <div class="ss-exemplo">
          <span class="ss-ex-lbl">Personagem de exemplo</span>
          <b>${esc(ex.nome || "—")}</b> <i>· ${esc(ex.classe || "")}</i>
          <p>${esc(ex.conceito || "")}</p>
        </div>
      </div>
    </div>
    <div class="ss-attrs">${attrs}</div>
    <p class="ss-vida">❤ Vida inicial: 4d6 (tira o menor) ${sign(r.vidaMod)} · Por nível: 1d${r.dadoVida} (fixo ${r.vidaFixa}) + Con · Deslocamento base ${r.nome === "Mercusys" ? "dobrado" : "9m"}${r.livre ? " · +4 pontos livres, +3 perícias" : ""}</p>
    <div class="ss-lore"><p>${esc(r.lore)}</p></div>
    <div class="ss-habs">${habs}${lend}</div>`;
}

// ============================================================================
//  Overlay + cena
// ============================================================================
export async function abrirSeletorPlanetas(RACAS, onSelect) {
  const racaPorNome = Object.fromEntries(RACAS.map((r) => [r.nome, r]));
  const ov = document.createElement("div");
  ov.className = "ss-overlay";
  ov.innerHTML = `
    <div class="ss-canvas-wrap"><canvas class="ss-canvas"></canvas>
      <div class="ss-hint">🖱️ Arraste para girar · role para aproximar · clique num planeta</div>
      <button class="ss-fechar" title="Fechar">✕</button>
    </div>
    <aside class="ss-painel">
      <div class="ss-vazio"><h2>Sistema Solar</h2><p>Cada mundo abriga uma raça. Clique num planeta para conhecer seu povo — ou escolha pela lista abaixo.</p>
        <div class="ss-lista">${PLANETAS.map((p) => `<button class="ss-chip" data-raca="${esc(p.raca)}" style="border-color:${p.hex}"><i style="background:${p.hex}"></i>${esc(p.raca)} <small>${esc(p.planeta)}</small></button>`).join("")}</div>
      </div>
      <div class="ss-detalhe" style="display:none"></div>
      <div class="ss-acoes" style="display:none"><button class="ss-voltar">← planetas</button><button class="ss-escolher btn-primario">✓ ESCOLHER ESTA RAÇA</button></div>
    </aside>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";

  let racaAtual = null;
  const painelDet = ov.querySelector(".ss-detalhe");
  const painelVazio = ov.querySelector(".ss-vazio");
  const acoes = ov.querySelector(".ss-acoes");

  const mostrarRaca = (nome) => {
    const r = racaPorNome[nome]; const plan = PLANETAS.find((p) => p.raca === nome);
    if (!r || !plan) return;
    racaAtual = nome;
    painelDet.innerHTML = fichaRacaHTML(r, plan);
    painelDet.style.display = "block"; painelVazio.style.display = "none"; acoes.style.display = "flex";
    painelDet.scrollTop = 0;
    if (foco) foco(nome); // câmera 3D
  };
  const voltar = () => { painelDet.style.display = "none"; acoes.style.display = "none"; painelVazio.style.display = "block"; racaAtual = null; if (desfoco) desfoco(); };

  const fechar = () => {
    document.body.style.overflow = ""; if (limpar) limpar();
    ov.remove();
  };
  ov.querySelector(".ss-fechar").onclick = fechar;
  ov.querySelector(".ss-voltar").onclick = voltar;
  ov.querySelector(".ss-escolher").onclick = () => { if (racaAtual) { onSelect(racaAtual); fechar(); } };
  ov.querySelectorAll(".ss-chip").forEach((b) => b.onclick = () => mostrarRaca(b.dataset.raca));
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });

  let foco = null, desfoco = null, limpar = null;
  // Tenta a cena 3D; se falhar (rede/lib), cai no fallback SVG.
  try {
    const cena = await montar3D(ov.querySelector(".ss-canvas"), mostrarRaca);
    foco = cena.foco; desfoco = cena.desfoco; limpar = cena.limpar;
  } catch (err) {
    console.warn("Three.js indisponível, usando fallback 2D:", err);
    limpar = montarFallbackSVG(ov.querySelector(".ss-canvas-wrap"), mostrarRaca);
  }
}

// ---------------- Cena 3D (Three.js via ESM) ----------------
async function montar3D(canvas, onPick) {
  const THREE = await import("https://esm.sh/three@0.160.0");
  const { OrbitControls } = await import("https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js");
  const wrap = canvas.parentElement;
  const W = () => wrap.clientWidth, H = () => wrap.clientHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H(), false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, W() / H(), 0.1, 4000);
  camera.position.set(0, 34, 62);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 8; controls.maxDistance = 200; controls.enablePan = false;

  scene.add(new THREE.AmbientLight(0x88aaff, 0.35));
  const sunLight = new THREE.PointLight(0xffddaa, 3.2, 0, 0.6); scene.add(sunLight);

  // Sol
  const sol = new THREE.Mesh(new THREE.SphereGeometry(4, 40, 40), new THREE.MeshBasicMaterial({ color: 0xffcc44 }));
  scene.add(sol);
  const brilho = new THREE.Mesh(new THREE.SphereGeometry(5.6, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.18 }));
  scene.add(brilho);

  // Estrelas
  const estN = 1400, pos = new Float32Array(estN * 3);
  for (let i = 0; i < estN; i++) { const r = 300 + Math.random() * 700, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(p) * Math.cos(t); pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t); pos[i * 3 + 2] = r * Math.cos(p); }
  const estrelasGeo = new THREE.BufferGeometry(); estrelasGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(estrelasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.8 })));

  // Planetas + órbitas
  const planetas = [];
  for (const p of PLANETAS) {
    const anel = new THREE.Mesh(new THREE.RingGeometry(p.orbita - 0.06, p.orbita + 0.06, 128),
      new THREE.MeshBasicMaterial({ color: 0x2a3350, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
    anel.rotation.x = -Math.PI / 2; scene.add(anel);

    const mat = new THREE.MeshStandardMaterial({ color: p.cor, roughness: 0.85, metalness: 0.1,
      emissive: new THREE.Color(p.cor).multiplyScalar(0.12) });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.tam, 32, 24), mat);
    mesh.userData = { raca: p.raca, tam: p.tam };
    const ang0 = Math.random() * Math.PI * 2;
    mesh.position.set(Math.cos(ang0) * p.orbita, 0, Math.sin(ang0) * p.orbita);
    scene.add(mesh);

    if (p.aneis) { const ring = new THREE.Mesh(new THREE.RingGeometry(p.tam * 1.4, p.tam * 2.2, 48),
      new THREE.MeshBasicMaterial({ color: p.cor, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      ring.rotation.x = -Math.PI / 2.3; mesh.add(ring); }

    planetas.push({ p, mesh, ang: ang0 });
  }

  // Raycast (clique)
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downXY = null;
  const onDown = (e) => { downXY = [e.clientX, e.clientY]; };
  const onUp = (e) => {
    if (!downXY) return; const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    downXY = null; if (Math.hypot(dx, dy) > 6) return; // foi arraste, não clique
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(planetas.map((x) => x.mesh))[0];
    if (hit) onPick(hit.object.userData.raca);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  // Foco de câmera
  let alvoFoco = null;
  const foco = (nome) => { const pl = planetas.find((x) => x.p.raca === nome); if (pl) alvoFoco = pl; };
  const desfoco = () => { alvoFoco = null; };

  const onResize = () => { renderer.setSize(W(), H(), false); camera.aspect = W() / H(); camera.updateProjectionMatrix(); };
  window.addEventListener("resize", onResize);

  let vivo = true, rafId = 0;
  const tmp = new THREE.Vector3();
  const loop = () => {
    if (!vivo) return; rafId = requestAnimationFrame(loop);
    for (const x of planetas) { x.ang += x.p.vel * 0.0016; x.mesh.position.set(Math.cos(x.ang) * x.p.orbita, 0, Math.sin(x.ang) * x.p.orbita); x.mesh.rotation.y += 0.01; }
    sol.rotation.y += 0.002;
    if (alvoFoco) { // aproxima a câmera do planeta focado
      const alvo = alvoFoco.mesh.position;
      controls.target.lerp(alvo, 0.08);
      const desejada = tmp.copy(alvo).add(new THREE.Vector3(alvoFoco.p.tam * 3 + 5, alvoFoco.p.tam * 1.5 + 3, alvoFoco.p.tam * 3 + 5));
      camera.position.lerp(desejada, 0.06);
    } else { controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05); }
    controls.update(); renderer.render(scene, camera);
  };
  loop();

  const limpar = () => {
    vivo = false; cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("pointerup", onUp);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); } });
    renderer.dispose();
  };
  return { foco, desfoco, limpar };
}

// ---------------- Fallback SVG (se o 3D não carregar) ----------------
function montarFallbackSVG(wrap, onPick) {
  const cx = 300, cy = 300;
  const orbs = PLANETAS.map((p, i) => {
    const rr = 40 + i * 27; const ang = Math.random() * Math.PI * 2;
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.5;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * 0.5}" fill="none" stroke="#2a3350" stroke-width="1"/>
      <circle class="ss-fb-planeta" data-raca="${esc(p.raca)}" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(6 + p.tam * 4).toFixed(0)}" fill="${p.hex}" style="cursor:pointer">
        <title>${esc(p.raca)} — ${esc(p.planeta)}</title></circle>
      <text x="${x.toFixed(0)}" y="${(y - 6 - p.tam * 4).toFixed(0)}" fill="${p.hex}" font-size="11" text-anchor="middle" style="pointer-events:none">${esc(p.raca)}</text>`;
  }).join("");
  wrap.querySelector(".ss-canvas").style.display = "none";
  const div = document.createElement("div"); div.className = "ss-fallback";
  div.innerHTML = `<svg viewBox="0 0 600 600" width="100%" height="100%">
    <circle cx="${cx}" cy="${cy}" r="16" fill="#ffcc44"/><circle cx="${cx}" cy="${cy}" r="24" fill="#ffaa33" opacity=".2"/>
    ${orbs}</svg>`;
  wrap.appendChild(div);
  div.querySelectorAll(".ss-fb-planeta").forEach((c) => c.onclick = () => onPick(c.dataset.raca));
  return () => div.remove();
}
