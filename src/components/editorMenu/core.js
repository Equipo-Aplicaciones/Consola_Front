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
function findImage(o) {
  if (!o) return '';
  for (const k of ['image_url', 'imageUrl', 'image', 'images', 'imageURL', 'photo', 'photoUrl', 'picture', 'img']) {
    const v = o[k];
    if (!v) continue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) { const f = v[0]; if (typeof f === 'string') return f; if (f && typeof f === 'object') return f.url || f.src || f.default || ''; }
    if (typeof v === 'object') { if (v.url) return v.url; if (Array.isArray(v.urls)) return v.urls[0] || ''; if (v.default) return v.default; }
  }
  return '';
}
function writeNumberLike(obj, key, n) { obj[key] = typeof obj[key] === 'string' ? String(n) : n; }

// ---------------- PedidosYa ----------------
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
  setCategoryOrder(j, catId, n) { this._menu(j).products[catId].order = n; }
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

function diff(adapter, original, current) {
  const out = [], snap = j => { const m = {}; for (const p of allProducts(adapter, j)) { (m[p.key] = m[p.key] || []).push(p); } return m; };
  const A = snap(original), B = snap(current), fmt = n => '$' + Number(n).toLocaleString('es-CL');
  for (const [k, list] of Object.entries(B)) {
    const before = A[k]; if (!before) continue;
    const v = list[0], o = before[0];
    const bc = before.map(x => x.catId).sort().join(), ac = list.map(x => x.catId).sort().join();
    if (bc !== ac) out.push(`Movido: ${v.name} — ${before.map(x => x.catName).join(', ')} → ${list.map(x => x.catName).join(', ')}`);
    else if (!adapter.positional && o.order !== v.order) out.push(`Orden: ${v.name} en ${v.catName} — ${o.order} → ${v.order}`);
    if (o.price !== v.price) out.push(`Precio: ${v.name} — ${fmt(o.price)} → ${fmt(v.price)}`);
    if (o.desc !== v.desc) out.push(`Descripción: ${v.name} — "${o.desc}" → "${v.desc}"`);
  }
  const ca = adapter.categories(original), cb = adapter.categories(current);
  if (adapter.positional) {
    for (const c of cb) {
      if (!ca.some(x => x.id === c.id)) continue;
      const b = adapter.products(original, c.id).map(p => p.key), a = adapter.products(current, c.id).map(p => p.key);
      if (a.filter(k => b.includes(k)).join() !== b.filter(k => a.includes(k)).join()) out.push(`Reordenado: ${c.name}`);
    }
    const seq = l => l.filter(c => c.order != null).sort((x, y) => x.order - y.order).map(c => c.name);
    if (seq(ca).join() !== seq(cb).join()) out.push('Orden de categorías: ' + seq(cb).map((n, i) => (i + 1) + '. ' + n).join(' | '));
  } else for (const c of cb) { const o = ca.find(x => x.id === c.id); if (o && o.order !== c.order) out.push(`Orden categoría: ${c.name} — ${o.order} → ${c.order}`); }
  return out;
}

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
const safeFile = s => String(s).replace(/[\\/:*?"<>|]+/g, '_');

export { PEYA, RAPPI, UBER, detectAdapter, allProducts, serialize, detectIndent, detectFloatKeys, diff, matchImage, makeZip, crc32, normName, safeFile };
