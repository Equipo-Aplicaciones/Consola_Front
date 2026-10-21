// ===== Núcleo: adaptadores por agregador =====
// Editable SOLO: descripción, precio, categoría y orden. Imágenes: se exportan aparte en .zip.

function readText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (typeof v.default === 'string') return v.default;
    if (v.translations) { const t = v.translations; return t.es ?? t.en ?? Object.values(t)[0] ?? ''; }
    const s = Object.values(v).find(x => typeof x === 'string'); return s ?? '';
  }
  return String(v);
}
function writeText(obj, key, text, shapeIfMissing) {
  const v = obj[key];
  if (typeof v === 'string') { obj[key] = text; return; }
  if (v && typeof v === 'object') {
    if ('default' in v) { v.default = text; return; }
    if (v.translations) { const t = v.translations; const k = 'es' in t ? 'es' : ('en' in t ? 'en' : Object.keys(t)[0] || 'en'); t[k] = text; return; }
    const k = Object.keys(v).find(x => typeof v[x] === 'string'); if (k) { v[k] = text; return; }
  }
  obj[key] = shapeIfMissing(text);
}
const IMAGE_KEYS = ['image_url', 'imageUrl', 'url', 'image', 'images', 'imageURL', 'photo', 'photoUrl', 'picture', 'img'];
function findImage(o) {
  if (!o) return '';
  for (const k of IMAGE_KEYS) {
    const v = o[k];
    if (!v) continue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) { const f = v[0]; if (typeof f === 'string') return f; if (f && typeof f === 'object') return f.url || f.src || f.default || ''; }
    if (typeof v === 'object') { if (v.url) return v.url; if (Array.isArray(v.urls)) return v.urls[0] || ''; if (v.default) return v.default; }
  }
  return '';
}
// Escribe la URL en el mismo campo/forma que findImage() lee. Devuelve true si encontró dónde escribir.
function setImageUrl(o, url) {
  if (!o) return false;
  for (const k of IMAGE_KEYS) {
    const v = o[k];
    if (!v) continue;
    if (typeof v === 'string') { o[k] = url; return true; }
    if (Array.isArray(v)) {
      const f = v[0];
      if (typeof f === 'string') { v[0] = url; return true; }
      if (f && typeof f === 'object') { for (const c of ['url', 'src', 'default']) if (f[c]) { f[c] = url; return true; } }
      continue;
    }
    if (typeof v === 'object') {
      if (v.url) { v.url = url; return true; }
      if (Array.isArray(v.urls) && v.urls[0]) { v.urls[0] = url; return true; }
      if (v.default) { v.default = url; return true; }
    }
  }
  return false;
}
function writeNumberLike(obj, key, n) { obj[key] = typeof obj[key] === 'string' ? String(n) : n; }

// ---------------- PedidosYa ----------------
const DIAS_PEYA = [
  ['MONDAY', 'SCH-LUNES', 'Lunes'],
  ['TUESDAY', 'SCH-MARTES', 'Martes'],
  ['WEDNESDAY', 'SCH-MIERCOLES', 'Miércoles'],
  ['THURSDAY', 'SCH-JUEVES', 'Jueves'],
  ['FRIDAY', 'SCH-VIERNES', 'Viernes'],
  ['SATURDAY', 'SCH-SABADOS', 'Sábado'],
  ['SUNDAY', 'SCH-DOMINGO', 'Domingo']
];
// Horarios que no son un día suelto: se ofrecen solo si el menú los define.
const HORARIOS_ESPECIALES_PEYA = ['SCH-FULL-DTO', 'SCH-DFD-RECARGADO'];
const PEYA = {
  name: 'PedidosYa',
  detect: j => !!(j && j.catalog && j.catalog.items && Object.values(j.catalog.items).some(x => x && x.type === 'Menu')),
  _items: j => j.catalog.items,
  _menu: j => Object.values(j.catalog.items).find(x => x && x.type === 'Menu'),
  // En PeYa el producto referencia ítems type "Image" (IMG-<uuid>) que contienen la url
  _image(j, it) {
    if (!it) return '';
    const items = this._items(j);
    if (it.images && typeof it.images === 'object' && !Array.isArray(it.images)) {
      for (const ref of Object.keys(it.images)) { const im = items[ref]; if (im && im.url) return im.url; }
    }
    return findImage(it);
  },
  setImage(j, catId, key, url) {
    const items = this._items(j), it = items[key];
    if (it && it.images && typeof it.images === 'object' && !Array.isArray(it.images)) {
      for (const ref of Object.keys(it.images)) { const im = items[ref]; if (im && im.url) { im.url = url; return true; } }
    }
    return setImageUrl(it, url);
  },
  imageIssues(j) {
    const items = this._items(j), out = [], seen = new Map();
    for (const [id, it] of Object.entries(items)) {
      if (!it || it.type !== 'Product' || !it.images) continue;
      for (const ref of Object.keys(it.images)) {
        const im = items[ref];
        if (!im) { out.push(`${readText(it.title).trim()}: referencia ${ref} no existe`); continue; }
        if (im.id && im.id !== ref) out.push(`${readText(it.title).trim()}: el ítem ${ref} tiene id ${im.id}`);
        if (im.url) { if (seen.has(im.url) && seen.get(im.url) !== id) out.push(`${readText(it.title).trim()}: misma imagen que ${readText(items[seen.get(im.url)].title).trim()}`); else seen.set(im.url, id); }
      }
    }
    return out;
  },
  categories(j) {
    const items = this._items(j), menu = this._menu(j);
    return Object.entries(items).filter(([, x]) => x && x.type === 'Category').map(([id, c]) => ({
      id, name: readText(c.title).trim() || id,
      order: menu.products && menu.products[id] ? menu.products[id].order : null,
      hidden: !(menu.products && menu.products[id]),
      count: Object.values(c.products || {}).filter(r => r.type === 'Product').length
    }));
  },
  products(j, catId) {
    const items = this._items(j), cat = items[catId];
    return Object.entries(cat.products || {}).filter(([, r]) => r.type === 'Product').map(([id, r]) => ({ key: id, order: r.order ?? null, ...this.detail(j, catId, id) }));
  },
  detail(j, catId, key) {
    const it = this._items(j)[key] || {};
    return { uid: key, name: readText(it.title).trim() || key, desc: readText(it.description), price: Number(it.price ?? 0), image: this._image(j, it) };
  },
  setDesc(j, catId, key, text) { writeText(this._items(j)[key], 'description', text, t => ({ default: t })); },
  setPrice(j, catId, key, n) { writeNumberLike(this._items(j)[key], 'price', n); },
  setOrder(j, catId, key, n) { const r = this._items(j)[catId].products[key]; if (n === null) delete r.order; else r.order = n; },
  move(j, key, from, to) {
    const items = this._items(j), src = items[from], dst = items[to];
    if (dst.products && dst.products[key]) throw Error('El producto ya existe en la categoría destino.');
    const ref = src.products[key]; delete src.products[key];
    dst.products = dst.products || {};
    ref.order = Math.max(0, ...Object.values(dst.products).filter(r => r.type === 'Product').map(r => Number(r.order) || 0)) + 1;
    dst.products[key] = ref;
  },
  canSetCategoryOrder: (j, catId) => !!PEYA._menu(j).products?.[catId],
  setCategoryOrder(j, catId, n) { this._menu(j).products[catId].order = n; },
  // Horarios (ScheduleEntry): la categoría solo se muestra en los días del horario que referencia.
  // Los días elegidos se agrupan en UNA entrada (se reutiliza una existente con los mismos días o se crea,
  // con las horas de los demás días); SCH-FULL-DTO / SCH-DFD-RECARGADO se ofrecen aparte. Las horas no se editan.
  categorySchedules(j, catId) {
    return Object.entries(this._items(j)[catId].products || {}).filter(([, r]) => r.type === 'ScheduleEntry').map(([id]) => id);
  },
  // Opciones de la UI y selección actual: los días de las entradas referenciadas se unen; lo que no
  // se puede traducir a días (especiales o ids sin definir) queda como opción especial.
  scheduleChoices(j, catId) {
    const items = this._items(j);
    const especiales = HORARIOS_ESPECIALES_PEYA.filter(id => items[id]).map(id => ({ id, etiqueta: id.replace(/^SCH-/, '') }));
    const dias = new Set(), seleccionEspeciales = [];

    for (const id of this.categorySchedules(j, catId)) {
      const it = items[id], porDefecto = DIAS_PEYA.find(d => d[1] === id);
      if (!HORARIOS_ESPECIALES_PEYA.includes(id) && it && (it.weekDays || []).length) it.weekDays.forEach(d => dias.add(d));
      else if (!HORARIOS_ESPECIALES_PEYA.includes(id) && !it && porDefecto) dias.add(porDefecto[0]);
      else {
        seleccionEspeciales.push(id);
        if (!especiales.some(e => e.id === id)) especiales.push({ id, etiqueta: id.replace(/^SCH-/, '') });
      }
    }

    return {
      dias: DIAS_PEYA.map(([id, , etiqueta]) => ({ id, etiqueta })),
      especiales,
      seleccion: { dias: DIAS_PEYA.map(d => d[0]).filter(d => dias.has(d)), especiales: seleccionEspeciales }
    };
  },
  scheduleLabel(j, id) {
    const it = this._items(j)[id];
    let dias = HORARIOS_ESPECIALES_PEYA.includes(id) ? [] : (it?.weekDays || []);
    if (!dias.length && !HORARIOS_ESPECIALES_PEYA.includes(id)) { const d = DIAS_PEYA.find(x => x[1] === id); if (d) dias = [d[0]]; }
    const nombres = DIAS_PEYA.filter(d => dias.includes(d[0])).map(d => d[2]);
    return nombres.length ? nombres.join(', ') : id.replace(/^SCH-/, '');
  },
  _scheduleEntryFor(j, dias) {
    const items = this._items(j);
    const porDefecto = dias.length === 1 ? DIAS_PEYA.find(d => d[0] === dias[0])[1] : null;
    const iguales = Object.entries(items)
      .filter(([id, x]) => x && x.type === 'ScheduleEntry' && !HORARIOS_ESPECIALES_PEYA.includes(id) && (x.weekDays || []).length === dias.length && dias.every(d => x.weekDays.includes(d)))
      .map(([id]) => id);
    if (iguales.length) return iguales.includes(porDefecto) ? porDefecto : iguales[0];

    const base = DIAS_PEYA.map(d => items[d[1]]).find(Boolean)
      || Object.entries(items).find(([id, x]) => x && x.type === 'ScheduleEntry' && !HORARIOS_ESPECIALES_PEYA.includes(id))?.[1];
    const raiz = porDefecto || 'SCH-' + DIAS_PEYA.filter(d => dias.includes(d[0])).map(d => d[1].slice(4, 7)).join('-');
    let id = raiz;
    for (let n = 2; items[id]; n++) id = `${raiz}-${n}`;
    items[id] = { id, type: 'ScheduleEntry', startTime: base?.startTime ?? '06:00:00', endTime: base?.endTime ?? '23:59:59', weekDays: dias };
    (j.__horariosCreados = j.__horariosCreados || []).push(id);
    return id;
  },
  // ¿Algo en el JSON (aparte de su propia definición) apunta a este id, como clave o como valor?
  _referenciado(j, id) {
    const items = this._items(j), def = items[id];
    const visita = n => {
      if (Array.isArray(n)) return n.some(visita);
      if (n && typeof n === 'object') {
        if (n === def) return false;
        return Object.entries(n).some(([k, v]) => (k === id && n !== items) || visita(v));
      }
      return n === id;
    };
    return Object.keys(j).filter(k => !k.startsWith('__')).some(k => visita(j[k]));
  },
  // Tras un cambio se quitan las entradas que quedaron sin uso: las que creó el editor y las que la categoría
  // acaba de dejar de usar. Se conservan los horarios especiales y los 7 días base (otras categorías los usarán).
  _limpiarHorarios(j, previos) {
    const items = this._items(j), creados = j.__horariosCreados || [];

    for (const id of new Set([...creados, ...previos])) {
      const x = items[id];
      if (!x || x.type !== 'ScheduleEntry' || HORARIOS_ESPECIALES_PEYA.includes(id)) continue;

      const eliminable = creados.includes(id) || !DIAS_PEYA.some(d => d[1] === id);
      if (eliminable && !this._referenciado(j, id)) delete items[id];
    }

    j.__horariosCreados = creados.filter(id => items[id]);
  },
  setCategorySchedule(j, catId, { dias = [], especiales = [] }) {
    const cat = this._items(j)[catId], actuales = cat.products || {};
    const previos = this.categorySchedules(j, catId);
    const diasOrdenados = DIAS_PEYA.map(d => d[0]).filter(d => dias.includes(d));
    const ids = [...(diasOrdenados.length ? [this._scheduleEntryFor(j, diasOrdenados)] : []), ...especiales];
    const otros = Object.entries(actuales).filter(([, r]) => r.type !== 'ScheduleEntry');
    cat.products = Object.fromEntries([...ids.map(id => [id, actuales[id] || { id, type: 'ScheduleEntry' }]), ...otros]);
    this._limpiarHorarios(j, previos);
  }
};

// ---------------- Rappi ----------------
const RAPPI = {
  name: 'Rappi',
  detect: j => !!(j && Array.isArray(j.items) && j.items.some(x => x && x.category && 'sortingPosition' in x)),
  categories(j) {
    const map = new Map();
    for (const it of j.items.filter(x => x && x.category)) {
      const c = it.category;
      if (!map.has(c.id)) map.set(c.id, { id: c.id, name: (c.name || c.id).trim(), order: c.sortingPosition ?? null, count: 0, hidden: false });
      map.get(c.id).count++;
    }
    for (const [id, c] of Object.entries(j.__rappiCatCache || {}))
      if (!map.has(id)) map.set(id, { id, name: c.name, order: c.sortingPosition, count: 0, hidden: false });
    return [...map.values()];
  },
  products(j, catId) {
    return j.items.map((it, idx) => ({ it, idx })).filter(o => o.it.category && o.it.category.id === catId)
      .map(o => ({ key: String(o.idx), order: o.it.sortingPosition ?? null, ...this.detail(j, catId, String(o.idx)) }));
  },
  detail(j, catId, key) {
    const it = j.items[Number(key)];
    return { uid: it.sku || it.id || key, name: readText(it.name).trim() || it.sku, desc: readText(it.description), price: Number(it.price ?? 0), image: findImage(it) };
  },
  setDesc(j, catId, key, text) { writeText(j.items[Number(key)], 'description', text, t => t); },
  setImage(j, catId, key, url) { return setImageUrl(j.items[Number(key)], url); },
  setPrice(j, catId, key, n) { writeNumberLike(j.items[Number(key)], 'price', n); },
  setOrder(j, catId, key, n) { j.items[Number(key)].sortingPosition = n; },
  move(j, key, from, to) {
    const it = j.items[Number(key)];
    const tpl = j.items.find(x => x.category && x.category.id === to)?.category || (j.__rappiCatCache || {})[to];
    if (!tpl) throw Error('Categoría destino no encontrada: ' + to);
    j.__rappiCatCache = j.__rappiCatCache || {};
    j.__rappiCatCache[from] = JSON.parse(JSON.stringify(it.category));
    const max = Math.max(0, ...j.items.filter(x => x.category && x.category.id === to).map(x => Number(x.sortingPosition) || 0));
    it.category = JSON.parse(JSON.stringify(tpl));
    it.sortingPosition = max + 1;
  },
  canSetCategoryOrder: () => true,
  setCategoryOrder(j, catId, n) {
    for (const it of j.items) if (it.category && it.category.id === catId) it.category.sortingPosition = n;
    if (j.__rappiCatCache && j.__rappiCatCache[catId]) j.__rappiCatCache[catId].sortingPosition = n;
  }
};

// ---------------- Uber Eats ----------------
const UBER = {
  name: 'Uber Eats',
  positional: true,
  detect: j => !!(j && Array.isArray(j.menus) && Array.isArray(j.categories) && Array.isArray(j.items) && j.categories.every(c => Array.isArray(c.entities || []))),
  _menu: j => j.menus[0],
  _cat: (j, id) => j.categories.find(c => c.id === id),
  _item: (j, id) => j.items.find(i => i.id === id),
  categories(j) {
    const ids = this._menu(j).category_ids || [];
    return j.categories.map(c => ({ id: c.id, name: readText(c.title).trim() || c.id, order: ids.includes(c.id) ? ids.indexOf(c.id) + 1 : null, hidden: !ids.includes(c.id), count: (c.entities || []).length }));
  },
  products(j, catId) {
    return (this._cat(j, catId).entities || []).map((e, i) => ({ key: e.id, order: i + 1, ...this.detail(j, catId, e.id) }));
  },
  detail(j, catId, key) {
    const it = this._item(j, key);
    if (!it) return { uid: key, name: key + ' (no existe en items)', desc: '', price: 0, image: '' };
    return { uid: key, name: readText(it.title).trim() || key, desc: readText(it.description), price: (it.price_info?.price ?? 0) / 100, image: findImage(it) };
  },
  setDesc(j, catId, key, text) { writeText(this._item(j, key), 'description', text, t => ({ translations: { en: t } })); },
  setImage(j, catId, key, url) { return setImageUrl(this._item(j, key), url); },
  setPrice(j, catId, key, n) {
    const it = this._item(j, key);
    it.price_info = it.price_info || { price: 0, overrides: [] };
    it.price_info.price = Math.round(n * 100);
  },
  _mv(arr, from, to) { const [x] = arr.splice(from, 1); arr.splice(Math.max(0, Math.min(to, arr.length)), 0, x); },
  setOrder(j, catId, key, n) { if (n === null) return; const e = this._cat(j, catId).entities, i = e.findIndex(x => x.id === key); if (i >= 0) this._mv(e, i, n - 1); },
  move(j, key, from, to) {
    const src = this._cat(j, from), dst = this._cat(j, to);
    if ((dst.entities || []).some(e => e.id === key)) throw Error('El producto ya existe en la categoría destino.');
    const [ent] = src.entities.splice(src.entities.findIndex(e => e.id === key), 1);
    (dst.entities = dst.entities || []).push(ent);
  },
  canSetCategoryOrder: (j, catId) => (j.menus[0].category_ids || []).includes(catId),
  setCategoryOrder(j, catId, n) { const ids = this._menu(j).category_ids, i = ids.indexOf(catId); if (i >= 0) this._mv(ids, i, n - 1); }
};

const ADAPTERS = [PEYA, RAPPI, UBER];
function detectAdapter(j) { return ADAPTERS.find(a => a.detect(j)) || null; }

function allProducts(adapter, j) {
  const out = [];
  for (const c of adapter.categories(j)) for (const p of adapter.products(j, c.id)) out.push({ ...p, catId: c.id, catName: c.name, catHidden: c.hidden });
  return out;
}

function serialize(j, indent, floatKeys) {
  let out = JSON.stringify(j, (k, v) => (k.startsWith('__') ? undefined : v), indent);
  for (const key of floatKeys || []) out = out.replace(new RegExp('("' + key + '": -?\\d+)(?=[,\\n\\r}])', 'g'), '$1.0');
  return out;
}
function detectFloatKeys(text) {
  const keys = new Set();
  for (const m of text.matchAll(/"(\w+)": -?\d+\.0(?=[,\s}])/g)) keys.add(m[1]);
  return [...keys].filter(k => !new RegExp('"' + k + '": -?\\d+(?=[,\\s}])').test(text));
}
function detectIndent(text) { const m = text.match(/\n( +|\t)"/); return m ? (m[1] === '\t' ? '\t' : m[1].length) : 4; }

// Cambios entre el original y el estado actual. Cada entrada trae un texto legible y los datos
// estructurados (antes/después) para poder mostrarlos gráficamente.
function diffDetalle(adapter, original, current) {
  const out = [], snap = j => { const m = {}; for (const p of allProducts(adapter, j)) { (m[p.key] = m[p.key] || []).push(p); } return m; };
  const A = snap(original), B = snap(current), fmt = n => '$' + Number(n).toLocaleString('es-CL');
  for (const [k, list] of Object.entries(B)) {
    const before = A[k]; if (!before) continue;
    const v = list[0], o = before[0];
    const base = { key: k, uid: v.uid, nombre: v.name };
    const bc = before.map(x => x.catId).sort().join(), ac = list.map(x => x.catId).sort().join();
    if (bc !== ac) out.push({ ...base, tipo: 'movido', antesIds: before.map(x => x.catId), despuesIds: list.map(x => x.catId), antes: before.map(x => x.catName).join(', '), despues: list.map(x => x.catName).join(', '), texto: `Movido: ${v.name} — ${before.map(x => x.catName).join(', ')} → ${list.map(x => x.catName).join(', ')}` });
    else if (!adapter.positional && o.order !== v.order) out.push({ ...base, tipo: 'orden', catId: v.catId, catName: v.catName, antes: o.order, despues: v.order, texto: `Orden: ${v.name} en ${v.catName} — ${o.order} → ${v.order}` });
    if (o.price !== v.price) out.push({ ...base, tipo: 'precio', antes: o.price, despues: v.price, texto: `Precio: ${v.name} — ${fmt(o.price)} → ${fmt(v.price)}` });
    if (o.image !== v.image) out.push({ ...base, tipo: 'imagen', antes: o.image, despues: v.image, texto: `Imagen: ${v.name} — ${ultimoSegmento(o.image) || '(sin imagen)'} → ${ultimoSegmento(v.image) || '(sin imagen)'}` });
    if (o.desc !== v.desc) out.push({ ...base, tipo: 'descripcion', antes: o.desc, despues: v.desc, texto: `Descripción: ${v.name} — "${o.desc}" → "${v.desc}"` });
  }
  const ca = adapter.categories(original), cb = adapter.categories(current);
  if (adapter.positional) {
    for (const c of cb) {
      if (!ca.some(x => x.id === c.id)) continue;
      const b = adapter.products(original, c.id).map(p => p.key), a = adapter.products(current, c.id).map(p => p.key);
      if (a.filter(k => b.includes(k)).join() !== b.filter(k => a.includes(k)).join()) out.push({ tipo: 'reordenado', catId: c.id, catName: c.name, texto: `Reordenado: ${c.name}` });
    }
    const seq = l => l.filter(c => c.order != null).sort((x, y) => x.order - y.order).map(c => c.name);
    if (seq(ca).join() !== seq(cb).join()) out.push({ tipo: 'orden_categorias', antes: seq(ca), despues: seq(cb), texto: 'Orden de categorías: ' + seq(cb).map((n, i) => (i + 1) + '. ' + n).join(' | ') });
  } else for (const c of cb) { const o = ca.find(x => x.id === c.id); if (o && o.order !== c.order) out.push({ tipo: 'orden_categoria', catId: c.id, catName: c.name, antes: o.order, despues: c.order, texto: `Orden categoría: ${c.name} — ${o.order} → ${c.order}` }); }
  if (adapter.categorySchedules) for (const c of cb) {
    if (!ca.some(x => x.id === c.id)) continue;
    const a = adapter.categorySchedules(original, c.id).sort(), b = adapter.categorySchedules(current, c.id).sort();
    if (a.join() !== b.join()) {
      const antes = a.map(id => adapter.scheduleLabel(original, id)), despues = b.map(id => adapter.scheduleLabel(current, id));
      out.push({ tipo: 'horario', catId: c.id, catName: c.name, antes, despues, texto: `Horario: ${c.name} — ${antes.join(', ') || '(todos los días)'} → ${despues.join(', ') || '(todos los días)'}` });
    }
  }
  return out;
}
const diff = (adapter, original, current) => diffDetalle(adapter, original, current).map(x => x.texto);

// ---------- Imágenes: identificación por nombre de archivo ----------
const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
// products: [{uid,name}] únicos. Devuelve uid o null.
function matchImage(fileName, products) {
  const raw = String(fileName).toLowerCase();
  // 1) el nombre contiene el UUID/SKU del producto (el más largo gana)
  const byId = products.filter(p => p.uid && String(p.uid).length >= 6 && raw.includes(String(p.uid).toLowerCase())).sort((a, b) => String(b.uid).length - String(a.uid).length);
  if (byId.length) return byId[0].uid;
  // 2) nombre de archivo = nombre del producto (normalizado)
  const n = normName(fileName);
  const exact = products.filter(p => normName(p.name) === n);
  if (exact.length === 1) return exact[0].uid;
  return null;
}

// ---------- ZIP (sin compresión, sin librerías) ----------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// files: [{name, data: Uint8Array}] -> Uint8Array
function makeZip(files) {
  const enc = new TextEncoder(), locals = [], centrals = []; let offset = 0;
  const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    locals.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    centrals.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = centrals.reduce((s, a) => s + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)], out = new Uint8Array(parts.reduce((s, a) => s + a.length, 0));
  let p = 0; for (const a of parts) { out.set(a, p); p += a.length; }
  return out;
}
// Nombre del archivo sin extensión ni sufijos acumulados ("-editado", marcas de fecha, " (1)"),
// para que reabrir un JSON ya exportado no vaya alargando el nombre.
function nombreBase(nombre) {
  let b = String(nombre || '').replace(/\.json$/i, '').trim(), previo;
  do { previo = b; b = b.replace(/\s*\(\d+\)$/, '').replace(/-editado(-\d{8}-\d{4})?$/, ''); } while (b !== previo);
  return b || 'menu';
}
// AAAAMMDD-HHmm en hora local
function marcaTiempo(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
// Último tramo de la ruta de una URL, sin parámetros (query / #)
function ultimoSegmento(url) {
  const ruta = String(url || '').split(/[?#]/)[0];
  return ruta.slice(ruta.lastIndexOf('/') + 1);
}
// Nombre del archivo de la URL sin extensión: es el id propio de la imagen
function idDeImagen(url) {
  return ultimoSegmento(url).replace(/\.[A-Za-z0-9]+$/, '');
}
// Misma carpeta de la URL, con otro nombre de archivo
function urlConNombre(url, nombre) {
  const ruta = String(url || '').split(/[?#]/)[0];
  return ruta.slice(0, ruta.lastIndexOf('/') + 1) + nombre;
}
// ddmmaaaa
function marcaFecha(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}`;
}

// Prepara las imágenes nuevas: calcula los nombres a partir del id de la URL actual del producto
// (<id>.jpeg y <id>-ddmmaaaa.jpeg) y devuelve una COPIA del JSON con la URL apuntando al nombre con fecha.
function aplicarImagenes(adapter, data, uids, fecha) {
  const clon = JSON.parse(JSON.stringify(data));
  const productos = new Map();
  for (const p of allProducts(adapter, clon)) if (!productos.has(p.uid)) productos.set(p.uid, p);

  const usados = new Map();
  const entradas = [];

  for (const uid of uids) {
    const p = productos.get(uid);
    const avisos = [];
    let id = p ? idDeImagen(p.image) : '';
    let modificaJson = Boolean(id);

    if (!id) {
      id = safeFile(uid);
      avisos.push('el producto no tiene URL de imagen en el JSON: se usó el UUID/SKU y el JSON no se modificó');
    }

    const base = { uid, producto: p ? p.name : '', categoria: p ? p.catName : '', urlAnterior: p ? p.image : '', archivoBase: id + '.jpeg', archivoFecha: id + '-' + fecha + '.jpeg' };

    if (usados.has(id)) {
      entradas.push({ ...base, urlNueva: '', omitida: true, avisos: ['comparte la misma imagen con otro producto (' + usados.get(id) + '): no se exportó'] });
      continue;
    }
    usados.set(id, uid);

    let urlNueva = '';
    if (modificaJson) {
      urlNueva = urlConNombre(p.image, base.archivoFecha);
      if (!adapter.setImage(clon, p.catId, p.key, urlNueva)) {
        urlNueva = '';
        avisos.push('no se pudo actualizar la URL de la imagen en el JSON');
      }
    }

    entradas.push({ ...base, urlNueva, omitida: false, avisos });
  }

  return { clon, entradas };
}

const safeFile = s => String(s).replace(/[\\/:*?"<>|]+/g, '_');

export { PEYA, RAPPI, UBER, detectAdapter, allProducts, serialize, detectIndent, detectFloatKeys, diff, diffDetalle, matchImage, makeZip, crc32, normName, safeFile, nombreBase, marcaTiempo, ultimoSegmento, idDeImagen, urlConNombre, marcaFecha, aplicarImagenes };
