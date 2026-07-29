// ============================================================================
//  UI — utilitários de interface reutilizáveis (modais/formulários bonitos).
//  Substitui os prompt()/confirm() nativos por formulários estilizados.
// ============================================================================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// modalForm({ titulo, campos:[{k,label,tipo,valor,opcoes,min,max,placeholder,rows}], okLabel, cancelLabel })
// tipos: "texto" | "numero" | "area" | "select"
// Resolve com um objeto { k: valor } ou null se cancelado.
export function modalForm({ titulo, descricao = "", campos = [], okLabel = "Confirmar", cancelLabel = "Cancelar" }) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "mdl-overlay";
    const campoHtml = (c) => {
      const id = "mdl-" + c.k;
      if (c.tipo === "area") return `<label class="mdl-campo"><span>${esc(c.label)}</span><textarea id="${id}" rows="${c.rows || 3}" placeholder="${esc(c.placeholder || "")}">${esc(c.valor || "")}</textarea></label>`;
      if (c.tipo === "select") return `<label class="mdl-campo"><span>${esc(c.label)}</span><select id="${id}">${(c.opcoes || []).map((o) => { const val = typeof o === "object" ? o.v : o; const lbl = typeof o === "object" ? o.l : o; return `<option value="${esc(val)}" ${String(c.valor) === String(val) ? "selected" : ""}>${esc(lbl)}</option>`; }).join("")}</select></label>`;
      const t = c.tipo === "numero" ? "number" : "text";
      return `<label class="mdl-campo"><span>${esc(c.label)}</span><input id="${id}" type="${t}" value="${esc(c.valor ?? "")}" ${c.min != null ? `min="${c.min}"` : ""} ${c.max != null ? `max="${c.max}"` : ""} placeholder="${esc(c.placeholder || "")}"/></label>`;
    };
    ov.innerHTML = `<div class="mdl-box" role="dialog" aria-modal="true">
      <h3 class="mdl-titulo">${esc(titulo)}</h3>
      ${descricao ? `<p class="mdl-desc">${esc(descricao)}</p>` : ""}
      <div class="mdl-campos">${campos.map(campoHtml).join("")}</div>
      <div class="mdl-acoes"><button class="mdl-cancel">${esc(cancelLabel)}</button><button class="mdl-ok btn-primario">${esc(okLabel)}</button></div>
    </div>`;
    document.body.appendChild(ov);
    const prim = ov.querySelector(`#mdl-${campos[0]?.k}`); if (prim) setTimeout(() => prim.focus(), 30);

    const fechar = (val) => { ov.remove(); document.removeEventListener("keydown", onKey); resolve(val); };
    const coletar = () => { const out = {}; for (const c of campos) { const el = ov.querySelector(`#mdl-${c.k}`); if (!el) continue; out[c.k] = c.tipo === "numero" ? (el.value === "" ? null : +el.value) : el.value; } return out; };
    const confirmar = () => fechar(coletar());
    ov.querySelector(".mdl-ok").onclick = confirmar;
    ov.querySelector(".mdl-cancel").onclick = () => fechar(null);
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) fechar(null); });
    const onKey = (e) => { if (e.key === "Escape") fechar(null); else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") confirmar(); };
    document.addEventListener("keydown", onKey);
  });
}

// confirmModal(texto) → Promise<boolean>
export function confirmModal(texto, { okLabel = "Confirmar", cancelLabel = "Cancelar", perigo = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement("div"); ov.className = "mdl-overlay";
    ov.innerHTML = `<div class="mdl-box" role="dialog" aria-modal="true"><p class="mdl-desc" style="margin-top:0">${esc(texto)}</p>
      <div class="mdl-acoes"><button class="mdl-cancel">${esc(cancelLabel)}</button><button class="mdl-ok ${perigo ? "" : "btn-primario"}" ${perigo ? 'style="border-color:var(--perigo);color:var(--perigo)"' : ""}>${esc(okLabel)}</button></div></div>`;
    document.body.appendChild(ov);
    const fechar = (v) => { ov.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    ov.querySelector(".mdl-ok").onclick = () => fechar(true);
    ov.querySelector(".mdl-cancel").onclick = () => fechar(false);
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) fechar(false); });
    const onKey = (e) => { if (e.key === "Escape") fechar(false); else if (e.key === "Enter") fechar(true); };
    document.addEventListener("keydown", onKey);
  });
}

// ---------------- SOM + NOTIFICAÇÃO ----------------
let somLigado = true;
try { somLigado = localStorage.getItem("ps-som") !== "0"; } catch (e) {}
export function getSom() { return somLigado; }
export function setSom(v) { somLigado = !!v; try { localStorage.setItem("ps-som", v ? "1" : "0"); } catch (e) {} }
let _ac = null;
function beep(freq, dur, vol) {
  if (!somLigado) return;
  try { _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = _ac.createOscillator(), g = _ac.createGain(); o.type = "sine"; o.frequency.value = freq;
    o.connect(g); g.connect(_ac.destination); const t = _ac.currentTime;
    g.gain.setValueAtTime(vol || 0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
export function somMensagem() { beep(620, 0.12); }
export function somDado() { beep(880, 0.05); setTimeout(() => beep(1200, 0.07), 65); }
export function notificar(titulo, corpo) {
  try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(titulo, { body: corpo, silent: true }); } catch (e) {}
}
export function pedirNotificacao() {
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
}
