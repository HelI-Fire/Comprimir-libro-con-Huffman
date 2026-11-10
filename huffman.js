// ==========================================================
// CONTROLADOR DE NAVEGACIÓN SPA (CORREGIDO PARA ORDENAMIENTOS)
// ==========================================================
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    const items = document.querySelectorAll('.nav-item');
    items.forEach(it => it.addEventListener('click', function () {
        items.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const tabTarget = $(this.dataset.tab);
        if (tabTarget) {
            tabTarget.classList.add('active');
            
            // Si el usuario regresa a la pestaña de Ordenamientos y no hay barras dibujadas, las redibuja
            if (this.dataset.tab === 'tab-sorts' && typeof generateArray === 'function') {
                const container = $('array-container');
                if (container && container.children.length === 0) {
                    generateArray();
                }
            }
        }
    }));
});

// ==========================================================
// ALGORITMO DE HUFFMAN WEB COMPRESSOR (.fire v1)
// ==========================================================
const MAGIC = "FIRE";
let bytesActuales = null;
let nombreActual = "texto.txt";
let fireActual = null;
let ins = null;

// ---------- Utilidades ----------
function fmt(n) {
  const kb = n / 1024, mb = kb / 1024;
  if (mb >= 1) return `${n.toLocaleString()} bytes (${mb.toFixed(2)} MB)`;
  if (kb >= 1) return `${n.toLocaleString()} bytes (${kb.toFixed(2)} KB)`;
  return `${n.toLocaleString()} bytes`;
}

function symLabel(b) {
  if (b === 32) return "[Espacio]"; if (b === 10) return "\\n (salto)";
  if (b === 13) return "\\r"; if (b === 9) return "\\t";
  if (b > 32 && b < 127) return String.fromCharCode(b);
  return "0x" + b.toString(16).toUpperCase().padStart(2, "0");
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function sha256(bytes) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); }
const hex = u8 => [...u8].map(x => x.toString(16).padStart(2, "0")).join("");

function setStep(n) {
  document.querySelectorAll('#flow li').forEach((li, i) => li.classList.toggle('done', i < n));
  document.querySelectorAll('#flow li').forEach((li, i) => li.classList.toggle('now', i === n - 1));
}

function descargar(bytes, nombre, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
}

// ---------- Frecuencias, Árbol y Códigos ----------
function calcularFrecuencias(bytes) {
  const f = new Array(256).fill(0);
  for (const b of bytes) f[b]++;
  return f;
}

function construirArbol(freq) {
  let id = 0;
  let cola = [];
  freq.forEach((f, s) => { if (f > 0) cola.push({ freq: f, id: id++, sym: s, l: null, r: null }); });
  if (cola.length === 0) return null;
  if (cola.length === 1) return { freq: cola[0].freq, id: id++, sym: null, l: cola[0], r: null };
  while (cola.length > 1) {
    cola.sort((a, b) => a.freq - b.freq || a.id - b.id);
    const l = cola.shift(), r = cola.shift();
    cola.push({ freq: l.freq + r.freq, id: id++, sym: null, l, r });
  }
  return cola[0];
}

function generarCodigos(raiz) {
  const codes = {};
  (function rec(n, c) {
    if (!n) return;
    if (n.sym !== null) { codes[n.sym] = c || "0"; return; }
    rec(n.l, c + "0"); rec(n.r, c + "1");
  })(raiz, "");
  return codes;
}

function codificar(bytes, codes) {
  let total = 0;
  for (const b of bytes) total += codes[b].length;
  const out = new Uint8Array(Math.ceil(total / 8));
  let pos = 0;
  for (const b of bytes) {
    for (const ch of codes[b]) {
      if (ch === "1") out[pos >> 3] |= 0x80 >> (pos & 7);
      pos++;
    }
  }
  return { data: out, totalBits: total };
}

function decodificar(data, totalBits, raiz, origSize) {
  const out = new Uint8Array(origSize);
  let n = 0, nodo = raiz;
  for (let i = 0; i < totalBits && n < origSize; i++) {
    const bit = (data[i >> 3] >> (7 - (i & 7))) & 1;
    nodo = bit ? nodo.r : nodo.l;
    if (!nodo) throw new Error("Bits inválidos");
    if (nodo.sym !== null) { out[n++] = nodo.sym; nodo = raiz; }
  }
  return out;
}

// ---------- Formato .fire v1 ----------
async function empaquetarFIRE(bytes, nombre) {
  const freq = calcularFrecuencias(bytes);
  const raiz = construirArbol(freq);
  const codes = raiz ? generarCodigos(raiz) : {};
  const { data, totalBits } = codificar(bytes, codes);
  const hash = await sha256(bytes);
  const nom = new TextEncoder().encode(nombre).slice(0, 255);
  const syms = freq.map((f, s) => [s, f]).filter(x => x[1] > 0);
  const head = 48 + nom.length + 5 * syms.length;
  const buf = new Uint8Array(head + data.length);
  const dv = new DataView(buf.buffer);
  buf.set(new TextEncoder().encode(MAGIC), 0);
  dv.setUint8(4, 1); dv.setUint16(5, syms.length); dv.setUint32(7, bytes.length);
  dv.setUint32(11, totalBits); buf.set(hash, 15); dv.setUint8(47, nom.length);
  buf.set(nom, 48);
  let p = 48 + nom.length;
  for (const [s, f] of syms) { dv.setUint8(p, s); dv.setUint32(p + 1, f); p += 5; }
  buf.set(data, p);
  return { buf, freq, raiz, codes, totalBits, hdr: head, nSym: syms.length };
}

function leerFIRE(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 48 || new TextDecoder().decode(buf.slice(0, 4)) !== MAGIC)
    throw new Error("No es un archivo .fire válido (firma incorrecta).");
  const version = dv.getUint8(4), n = dv.getUint16(5);
  const origSize = dv.getUint32(7), totalBits = dv.getUint32(11);
  const hash = buf.slice(15, 47), L = dv.getUint8(47);
  const nombre = new TextDecoder().decode(buf.slice(48, 48 + L));
  let p = 48 + L; const freq = new Array(256).fill(0);
  for (let i = 0; i < n; i++) { freq[dv.getUint8(p)] = dv.getUint32(p + 1); p += 5; }
  const data = buf.slice(p);
  if (data.length !== Math.ceil(totalBits / 8)) throw new Error("Archivo truncado o corrupto.");
  const raiz = construirArbol(freq);
  return { version, n, origSize, totalBits, hash, nombre, freq, data, hdr: p, raiz, codes: raiz ? generarCodigos(raiz) : {} };
}

// ---------- Renderizado Visual ----------
function renderTabla(tbodyId, freq, codes) {
  const tb = $(tbodyId); tb.innerHTML = "";
  const orden = freq.map((f, s) => [s, f]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  for (const [s, f] of orden) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(symLabel(s))}</td><td>${f.toLocaleString()}</td><td class="code">${codes[s]}</td><td>${codes[s].length}</td>`;
    tb.appendChild(tr);
  }
}

function renderArbol(contId, raiz) {
  const c = $(contId);
  if (!raiz) { c.innerHTML = ""; return; }
  const DX = 38, DY = 56; let leaf = 0, maxD = 0; const pts = [];
  (function lay(n, d) {
    maxD = Math.max(maxD, d);
    if (!n) return;
    if (n.sym !== null) n.x = leaf++ * DX + 24;
    else { lay(n.l, d + 1); lay(n.r, d + 1); const k = [n.l, n.r].filter(Boolean); n.x = (k[0].x + k[k.length - 1].x) / 2; }
    n.y = d * DY + 24; pts.push(n);
  })(raiz, 0);
  let svg = `<svg width="${leaf * DX + 48}" height="${(maxD + 1) * DY + 40}" xmlns="http://www.w3.org/2000/svg">`;
  for (const n of pts) for (const [h, bit] of [[n.l, "0"], [n.r, "1"]]) if (h) {
    svg += `<line x1="${n.x}" y1="${n.y}" x2="${h.x}" y2="${h.y}" stroke="#4a5568"/>`;
    svg += `<text x="${(n.x + h.x) / 2 + (bit === "0" ? -7 : 7)}" y="${(n.y + h.y) / 2}" fill="#dd6b20" font-size="11" text-anchor="middle">${bit}</text>`;
  }
  for (const n of pts) {
    if (n.sym !== null) svg += `<rect x="${n.x - 17}" y="${n.y - 12}" width="34" height="34" rx="5" fill="#2f855a"/><text x="${n.x}" y="${n.y + 2}" fill="#fff" font-size="11" text-anchor="middle">${esc(symLabel(n.sym).slice(0, 5))}</text><text x="${n.x}" y="${n.y + 16}" fill="#c6f6d5" font-size="9" text-anchor="middle">${n.freq}</text>`;
    else svg += `<circle cx="${n.x}" cy="${n.y}" r="14" fill="#2b6cb0"/><text x="${n.x}" y="${n.y + 4}" fill="#fff" font-size="10" text-anchor="middle">${n.freq}</text>`;
  }
  c.innerHTML = svg + "</svg>";
}

function bitsPreview(data, totalBits, maxBytes = 48) {
  let s = "";
  for (let i = 0; i < Math.min(data.length, maxBytes); i++) {
    let b = data[i].toString(2).padStart(8, "0");
    if (i === data.length - 1 && totalBits % 8) b = b.slice(0, totalBits % 8) + "·".repeat(8 - totalBits % 8);
    s += b + " ";
  }
  return s + (data.length > maxBytes ? `… (+${data.length - maxBytes} bytes)` : "");
}

// ---------- Event Listeners de Huffman ----------
let editado = false;
if ($('input-text')) $('input-text').addEventListener('input', () => { editado = true; });

if ($('file-input')) $('file-input').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    bytesActuales = new Uint8Array(ev.target.result); nombreActual = f.name; editado = false;
    $('input-text').value = new TextDecoder().decode(bytesActuales.slice(0, 20000));
    $('src-info').textContent = `Cargado: ${f.name} (${fmt(bytesActuales.length)}). Vista previa limitada a 20,000 bytes.`;
    setStep(1);
  };
  r.readAsArrayBuffer(f);
});

function entradaBytes() {
  if (bytesActuales && !editado) return bytesActuales;
  nombreActual = bytesActuales ? nombreActual : "texto.txt";
  return new TextEncoder().encode($('input-text').value);
}

if ($('btn-analyze')) $('btn-analyze').addEventListener('click', () => {
  const bytes = entradaBytes();
  if (!bytes.length) return alert("Carga un .txt, busca un libro o escribe texto.");
  const freq = calcularFrecuencias(bytes), raiz = construirArbol(freq), codes = generarCodigos(raiz);
  renderTabla('huffman-body', freq, codes); renderArbol('tree-box', raiz); setStep(3);
});

if ($('btn-compress')) $('btn-compress').addEventListener('click', async () => {
  const bytes = entradaBytes();
  if (!bytes.length) return alert("Carga un .txt, busca un libro o escribe texto.");
  const r = await empaquetarFIRE(bytes, nombreActual);
  fireActual = r.buf;
  renderTabla('huffman-body', r.freq, r.codes); renderArbol('tree-box', r.raiz);
  const ahorro = bytes.length - r.buf.length, pct = (ahorro / bytes.length) * 100;
  $('m-orig').textContent = fmt(bytes.length);
  $('m-comp').textContent = fmt(r.buf.length);
  $('m-save').textContent = (ahorro < 0 ? "-" : "") + fmt(Math.abs(ahorro));
  $('m-pct').textContent = pct.toFixed(2) + " %";
  $('m-ratio').textContent = (bytes.length / r.buf.length).toFixed(3) + " : 1";
  $('m-sym').textContent = r.nSym;
  $('m-detail').textContent = `Encabezado: ${fmt(r.hdr)} · Datos: ${fmt(r.buf.length - r.hdr)} · Bits válidos: ${r.totalBits.toLocaleString()}` +
    (ahorro < 0 ? " · Texto muy corto: el encabezado pesa más que el ahorro." : "");
  $('output-text').value = bitsPreview(r.buf.slice(r.hdr), r.totalBits, 64);
  const rec = decodificar(r.buf.slice(r.hdr), r.totalBits, r.raiz, bytes.length);
  const ok = hex(await sha256(rec)) === hex(await sha256(bytes));
  $('integrity').textContent = ok ? "✔ Integridad verificada (SHA-256 idéntico)" : "❌ El contenido recuperado NO coincide";
  $('integrity').className = ok ? "ok" : "bad";
  $('btn-download-fire').disabled = false; $('btn-to-inspector').disabled = false;
  setStep(4);
});

if ($('btn-download-fire')) $('btn-download-fire').addEventListener('click', () => {
  if (fireActual) descargar(fireActual, nombreActual.replace(/\.[^.]*$/, "") + ".fire", "application/octet-stream");
});
if ($('btn-to-inspector')) $('btn-to-inspector').addEventListener('click', () => { if (fireActual) cargarInspector(fireActual, nombreActual.replace(/\.[^.]*$/, "") + ".fire"); });
if ($('btn-clear')) $('btn-clear').addEventListener('click', () => {
  bytesActuales = null; fireActual = null; editado = false;
  ['file-input'].forEach(i => $(i).value = "");
  $('input-text').value = ""; $('output-text').value = ""; $('src-info').textContent = "";
  $('huffman-body').innerHTML = ""; $('tree-box').innerHTML = "";
  ['m-orig', 'm-comp', 'm-save', 'm-pct', 'm-ratio', 'm-sym'].forEach(i => $(i).textContent = "—");
  $('m-detail').textContent = ""; $('integrity').textContent = "";
  $('btn-download-fire').disabled = true; $('btn-to-inspector').disabled = true; setStep(0);
});

// ---------- Inspector de Archivos .fire ----------
if ($('fire-input')) $('fire-input').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => cargarInspector(new Uint8Array(ev.target.result), f.name);
  r.readAsArrayBuffer(f);
});

function cargarInspector(buf, nombre) {
  try {
    const h = leerFIRE(buf); ins = { h, buf, nombre };
    const ahorro = h.origSize - buf.length;
    $('ins-info').innerHTML = `
      <tr><td>Archivo</td><td>${esc(nombre)} (ext. .${esc(nombre.split('.').pop())})</td></tr>
      <tr><td>Formato / versión</td><td>FIRE · v${h.version}</td></tr>
      <tr><td>Nombre original</td><td>${esc(h.nombre)}</td></tr>
      <tr><td>Tamaño original</td><td>${fmt(h.origSize)}</td></tr>
      <tr><td>Tamaño comprimido</td><td>${fmt(buf.length)} (encabezado ${h.hdr} B + datos ${h.data.length} B)</td></tr>
      <tr><td>Ahorro</td><td>${ahorro < 0 ? "-" : ""}${fmt(Math.abs(ahorro))}</td></tr>
      <tr><td>Reducción</td><td>${h.origSize ? (ahorro / h.origSize * 100).toFixed(2) : 0} %</td></tr>
      <tr><td>Símbolos distintos</td><td>${h.n}</td></tr>
      <tr><td>Bits codificados</td><td>${h.totalBits.toLocaleString()} (último byte usa ${h.totalBits % 8 || 8} bits)</td></tr>
      <tr><td>SHA-256 original</td><td class="code" style="word-break:break-all">${hex(h.hash)}</td></tr>`;
    $('ins-bits').textContent = bitsPreview(h.data, h.totalBits);
    renderTabla('ins-body', h.freq, h.codes); renderArbol('ins-tree', h.raiz);
    $('ins-result').textContent = ""; $('ins-text').value = "";
    $('btn-ins-dec').disabled = false;
    $('btn-ins-txt').disabled = true;
    $('ins-panel').scrollIntoView({ behavior: "smooth" }); setStep(5);
  } catch (err) { alert(err.message); }
}

let recuperado = null;
if ($('btn-ins-dec')) $('btn-ins-dec').addEventListener('click', async () => {
  if (!ins) return;
  try {
    const h = ins.h;
    recuperado = decodificar(h.data, h.totalBits, h.raiz, h.origSize);
    const ok = hex(await sha256(recuperado)) === hex(h.hash);
    $('ins-text').value = new TextDecoder().decode(recuperado.slice(0, 20000));
    $('ins-result').textContent = ok ? `✔ Descompresión correcta: SHA-256 coincide con el original (${fmt(recuperado.length)})` : "❌ El hash NO coincide: archivo corrupto";
    $('ins-result').className = ok ? "ok" : "bad";
    $('btn-ins-txt').disabled = false; setStep(6);
  } catch (err) { alert("Error al descomprimir: " + err.message); }
});

if ($('btn-ins-txt')) $('btn-ins-txt').addEventListener('click', () => {
  if (recuperado) descargar(recuperado, (ins.h.nombre || "recuperado.txt").replace(/\.[^.]*$/, "") + "_recuperado.txt", "text/plain");
});

// ---------- Project Gutenberg API --------------------9
const MI_PROXY = "https://gutenberg-proxy.isaac-castaneda8602.workers.dev/";
const proxies = [...(MI_PROXY ? [u => `${MI_PROXY}/?url=${encodeURIComponent(u)}`] : []), u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
                 u => `https://corsproxy.io/?${encodeURIComponent(u)}`];

async function viaProxy(url, tipo, ms = 20000) {
  for (const p of proxies) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(p(url), { signal: ctl.signal });
      if (r.ok) return tipo === "buf" ? new Uint8Array(await r.arrayBuffer()) : await r.text();
    } catch (e) { console.warn("Proxy falló:", e.message); }
    finally { clearTimeout(t); }
  }
  throw new Error("proxy");
}
//----------------------------------------------------

async function buscarEnGutenberg(q) {
  const html = await viaProxy(`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(q)}`);
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("li.booklink")].map(li => ({
    id: (li.querySelector("a.link")?.getAttribute("href") || "").split("/").pop(),
    title: li.querySelector(".title")?.textContent.trim() || "Sin título",
    author: li.querySelector(".subtitle")?.textContent.trim() || "Desconocido"
  })).filter(b => /^\d+$/.test(b.id)).slice(0, 8);
}

async function searchGutenberg() {
  const q = $('gutenberg-search').value.trim(), box = $('gutenberg-results');
  if (!q) return alert("Ingresa un título, autor o palabra clave.");
  box.innerHTML = `<p class="muted">Buscando "${esc(q)}" en gutenberg.org...</p>`;
  let libros = [];
  try { libros = await buscarEnGutenberg(q); } catch (e) {}
  if (!libros.length) {
    try {
      const d = await (await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(q)}`)).json();
      libros = (d.results || []).slice(0, 8).map(b => ({ id: String(b.id), title: b.title, author: b.authors.map(a => a.name).join(', ') || "Desconocido" }));
    } catch (e) {}
  }
  box.innerHTML = "";
  if (!libros.length) return box.innerHTML = "<p>Sin resultados o sin conexión. Prueba otra búsqueda.</p>";
  libros.forEach(b => {
    const c = document.createElement('div'); c.className = "card book";
    c.innerHTML = `<h3>${esc(b.title)}</h3><p class="muted">${esc(b.author)} · ID ${b.id} · <a href="https://www.gutenberg.org/ebooks/${b.id}" target="_blank" rel="noopener" style="color:#63b3ed">ver en gutenberg.org</a></p>`;
    const bt = document.createElement('button'); bt.className = "btn btn-start"; bt.textContent = "Usar como entrada";
    bt.onclick = () => cargarLibro(b.id, b.title, bt); c.appendChild(bt); box.appendChild(c);
  });
}

async function cargarLibro(id, titulo, boton) {
  const estado = $('gutenberg-status') || (() => { const p = document.createElement('p'); p.id = 'gutenberg-status'; p.className = 'muted'; $('gutenberg-results').before(p); return p; })();
  if (boton) { boton.disabled = true; boton.textContent = "Descargando..."; }
  estado.textContent = `Descargando "${titulo}" desde gutenberg.org...`;
  const urls = [`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`];
  for (const u of urls) {
    try {
      const b = await viaProxy(u, "buf");
      if (b.length < 500) continue;
      bytesActuales = b;
      nombreActual = titulo.replace(/[^\w\- ]+/g, "").slice(0, 60).trim().replace(/ +/g, "_") + ".txt"; editado = false;
      $('input-text').value = new TextDecoder().decode(b.slice(0, 20000));
      $('src-info').textContent = `Libro de gutenberg.org: ${titulo} (${fmt(b.length)}). Vista previa limitada a 20,000 bytes.`;
      estado.textContent = `✔ "${titulo}" cargado (${fmt(b.length)}).`;
      if (boton) { boton.disabled = false; boton.textContent = "Usar como entrada"; }
      setStep(1); 
      const huffmanNavBtn = document.querySelector('.nav-item[data-tab="tab-huffman"]');
      if (huffmanNavBtn) huffmanNavBtn.click();
      return;
    } catch (e) { console.warn("Falló", u); }
  }
  estado.textContent = " No se pudo descargar.";
  if (boton) { boton.disabled = false; boton.textContent = "Usar como entrada"; }
  alert("No se pudo descargar. Abre el libro en gutenberg.org, descarga el 'Plain Text UTF-8' y súbelo con el botón de archivo.");
} 
//____implementar direccionamientio
//---------implentar gui 
