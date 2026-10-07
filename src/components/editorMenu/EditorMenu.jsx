import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { API_BASE_URL } from "../../config";
import {
  allProducts,
  detectAdapter,
  detectFloatKeys,
  detectIndent,
  diff,
  makeZip,
  matchImage,
  safeFile,
  serialize
} from "./core";
import { IMG_H, IMG_W, descargar, procesarImagen } from "./imagenes";
import Miniatura from "./Miniatura";
import EditarProductoModal from "./EditarProductoModal";
import ExportarVersionModal from "./ExportarVersionModal";
import HistorialEditorMenu from "./HistorialEditorMenu";
import "./editorMenu.css";

const MAX_HISTORIAL = 80;
const MENSAJE_INICIAL =
  "Carga un JSON de PedidosYa, Rappi o Uber Eats. Solo se puede editar descripción, precio, categoría, orden e imagen.";

const dinero = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
const ordenarCategorias = (lista) =>
  lista.sort((a, b) => a.hidden - b.hidden || (a.order ?? 1e9) - (b.order ?? 1e9));

export default function EditorMenu({ token }) {
  // El núcleo edita el JSON en el lugar: se guarda en una ref y `refrescar` fuerza el render.
  const store = useRef({
    data: null,
    original: null,
    adapter: null,
    indent: 4,
    floatKeys: [],
    fileName: "menu-editado.json",
    baseName: "menu",
    history: [],
    imgs: new Map(), // uid -> {blob,url,src,w,h,warn}
    sinIdentificar: [] // [{blob,url,src,w,h,warn}]
  });
  const [, refrescar] = useReducer((n) => n + 1, 0);
  const [seleccionada, setSeleccionada] = useState(null);
  const [busquedaCat, setBusquedaCat] = useState("");
  const [busquedaItem, setBusquedaItem] = useState("");
  const [mensaje, setMensaje] = useState({ tipo: "", contenido: MENSAJE_INICIAL });
  const [editando, setEditando] = useState(null);
  const [ordenArrastre, setOrdenArrastre] = useState(null);
  const [destacada, setDestacada] = useState(null);
  const [vista, setVista] = useState("editor");
  const [exportando, setExportando] = useState(false);
  const [guardandoVersion, setGuardandoVersion] = useState(false);
  const [errorVersion, setErrorVersion] = useState("");
  const arrastrando = useRef(null);
  const listaRef = useRef(null);

  const { data, original, adapter, history, imgs, sinIdentificar } = store.current;
  const cargado = Boolean(adapter);

  useEffect(() => {
    const actual = store.current;

    return () => {
      actual.imgs.forEach((i) => URL.revokeObjectURL(i.url));
      actual.sinIdentificar.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  useEffect(() => {
    if (!destacada) return undefined;

    const fila = [...document.querySelectorAll(".em-prod")].find((r) => r.dataset.key === destacada);
    if (fila) fila.scrollIntoView({ block: "center" });

    const t = setTimeout(() => setDestacada(null), 1500);
    return () => clearTimeout(t);
  }, [destacada]);

  const avisar = (tipo, contenido) => setMensaje({ tipo, contenido });
  const snap = () => {
    history.push(JSON.stringify(data));
    if (history.length > MAX_HISTORIAL) history.shift();
  };
  const descartarSnap = () => history.pop();

  const categorias = cargado ? ordenarCategorias(adapter.categories(data)) : [];
  const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.name ?? id;
  const productosUnicos = () => {
    const m = new Map();
    for (const p of allProducts(adapter, data)) if (!m.has(p.uid)) m.set(p.uid, p);
    return [...m.values()];
  };
  const opcionesCategoria = (seleccion) =>
    categorias.filter((c) => !c.hidden || c.id === seleccion);

  /* ---------- Abrir JSON ---------- */
  const abrirJson = async (e) => {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;

    try {
      const texto = await archivo.text();
      const obj = JSON.parse(texto);
      const a = detectAdapter(obj);

      if (!a) throw new Error("Formato no reconocido. Soportados: PedidosYa, Rappi y Uber Eats.");

      const s = store.current;
      s.imgs.forEach((i) => URL.revokeObjectURL(i.url));
      s.imgs.clear();
      s.sinIdentificar.forEach((i) => URL.revokeObjectURL(i.url));
      s.sinIdentificar = [];
      s.history = [];
      s.data = obj;
      s.original = JSON.parse(texto);
      s.adapter = a;
      s.indent = detectIndent(texto);
      s.floatKeys = detectFloatKeys(texto);
      s.baseName = archivo.name.replace(/\.json$/i, "");
      s.fileName = s.baseName + "-editado.json";

      setBusquedaItem("");
      setSeleccionada(ordenarCategorias(a.categories(obj)).find((c) => !c.hidden)?.id ?? null);
      avisar("ok", <>Archivo cargado: <b>{archivo.name}</b> ({a.name}).</>);
      refrescar();
    } catch (err) {
      avisar("warn", "No se pudo cargar: " + err.message);
    }
  };

  /* ---------- Imágenes ---------- */
  const guardarImagen = (uid, img) => {
    const anterior = imgs.get(uid);
    if (anterior) URL.revokeObjectURL(anterior.url);
    imgs.set(uid, img);
  };

  const cargarImagenes = async (e) => {
    const archivos = [...e.target.files];
    e.target.value = "";
    if (!archivos.length) return;

    const productos = productosUnicos();
    let ok = 0;
    let no = 0;
    const errores = [];

    avisar("", `Procesando ${archivos.length} imagen(es)...`);

    for (const f of archivos) {
      try {
        const img = await procesarImagen(f);
        const uid = matchImage(f.name, productos);

        if (uid) {
          guardarImagen(uid, img);
          ok++;
        } else {
          store.current.sinIdentificar.push(img);
          no++;
        }
      } catch {
        errores.push(f.name);
      }
    }

    avisar(
      no || errores.length ? "warn" : "ok",
      <>
        Imágenes: <b>{ok}</b> identificadas
        {no ? <>, <b>{no}</b> sin identificar (asígnalas en el panel derecho)</> : null}
        {errores.length ? <>, <b>{errores.length}</b> con error: {errores.join(", ")}</> : null}.
      </>
    );
    refrescar();
  };

  const asignarSinIdentificar = (indice, uid) => {
    if (!uid) return;

    const [img] = sinIdentificar.splice(indice, 1);
    guardarImagen(uid, img);
    refrescar();
  };

  const descartarSinIdentificar = (indice) => {
    const [img] = sinIdentificar.splice(indice, 1);
    URL.revokeObjectURL(img.url);
    refrescar();
  };

  const quitarImagenNueva = (uid) => {
    const img = imgs.get(uid);
    if (img) URL.revokeObjectURL(img.url);
    imgs.delete(uid);
    refrescar();
  };

  /* ---------- Edición ---------- */
  const cambiarOrdenCategoria = (cat, valor) => {
    if (valor === "") return;

    snap();
    adapter.setCategoryOrder(data, cat.id, Number(valor));
    avisar("ok", <>Orden de categoría actualizado: <b>{cat.name}</b>.</>);
    refrescar();
  };

  const cambiarOrdenProducto = (p, valor) => {
    snap();
    adapter.setOrder(data, seleccionada, p.key, valor === "" ? null : Number(valor));
    avisar("ok", "Orden actualizado.");
    refrescar();
  };

  const mover = (p, desde, hasta) => {
    if (desde === hasta) return;

    snap();

    try {
      adapter.move(data, p.key, desde, hasta);
      avisar("ok", <><b>{p.name}</b> movido a <b>{nombreCategoria(hasta)}</b> (queda al final).</>);
    } catch (err) {
      descartarSnap();
      avisar("warn", err.message);
    }

    refrescar();
  };

  const renumerar = () => {
    snap();
    adapter
      .products(data, seleccionada)
      .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))
      .forEach((p, i) => adapter.setOrder(data, seleccionada, p.key, i + 1));
    avisar("ok", "Categoría renumerada desde 1.");
    refrescar();
  };

  const deshacer = () => {
    if (!history.length) return;

    store.current.data = JSON.parse(history.pop());
    avisar("", "Último cambio deshecho.");
    refrescar();
  };

  const guardarProducto = ({ desc, precio, categoria, orden }) => {
    const { catId, key } = editando;
    const p = editando;
    const nuevoPrecio = precio === "" ? p.price : Number(precio);
    const nuevoOrden = orden === "" ? null : Number(orden);

    if (!(nuevoPrecio >= 0)) {
      setEditando(null);
      avisar("warn", "Precio inválido.");
      return;
    }

    snap();
    const hecho = [];

    try {
      if (desc !== p.desc) {
        adapter.setDesc(data, catId, key, desc);
        hecho.push("descripción");
      }
      if (nuevoPrecio !== p.price) {
        adapter.setPrice(data, catId, key, nuevoPrecio);
        hecho.push("precio");
      }

      let cat = catId;
      if (categoria !== catId) {
        adapter.move(data, key, catId, categoria);
        cat = categoria;
        hecho.push("categoría");
      }

      const actual = adapter.products(data, cat).find((x) => x.key === key);
      if (nuevoOrden !== null && actual && actual.order !== nuevoOrden) {
        adapter.setOrder(data, cat, key, nuevoOrden);
        hecho.push("orden");
      }

      if (!hecho.length) {
        descartarSnap();
      } else {
        avisar("ok", <><b>{p.name}</b>: {hecho.join(", ")} actualizado(s).</>);
      }
    } catch (err) {
      store.current.data = JSON.parse(history.pop());
      avisar("warn", err.message);
    }

    setEditando(null);
    refrescar();
  };

  const abrirEdicion = (catId, key) => {
    const p = adapter.products(data, catId).find((x) => x.key === key);
    if (p) setEditando({ ...p, catId });
  };

  const imagenDeEdicion = editando ? imgs.get(editando.uid) : null;
  const notaEdicion = editando
    ? (() => {
        const n = allProducts(adapter, data).filter((x) => x.uid === editando.uid).length;
        return (
          (n > 1
            ? `Este producto aparece en ${n} categorías: descripción, precio e imagen se cambian en todas. `
            : "") + (adapter.name === "Uber Eats" ? "En Uber el precio se guarda ×100 automáticamente." : "")
        );
      })()
    : "";

  const imagenDesdeModal = async (archivo) => {
    try {
      guardarImagen(editando.uid, await procesarImagen(archivo));
      avisar("ok", <>Imagen asignada a <b>{editando.name}</b>.</>);
    } catch (err) {
      avisar("warn", err.message);
    }
    refrescar();
  };

  /* ---------- Arrastrar para ordenar ---------- */
  const reordenarMientrasSeArrastra = (e, clavesActuales) => {
    e.preventDefault();
    if (!arrastrando.current) return;

    const sinArrastrada = clavesActuales.filter((k) => k !== arrastrando.current);
    const filas = [...listaRef.current.querySelectorAll(".em-prod")].filter(
      (r) => r.dataset.key !== arrastrando.current
    );
    const despues = filas.find((r) => e.clientY <= r.getBoundingClientRect().top + r.offsetHeight / 2);
    const indice = despues ? sinArrastrada.indexOf(despues.dataset.key) : sinArrastrada.length;
    const nuevoOrden = [...sinArrastrada.slice(0, indice), arrastrando.current, ...sinArrastrada.slice(indice)];

    if (nuevoOrden.join("\u0000") !== clavesActuales.join("\u0000")) setOrdenArrastre(nuevoOrden);
  };

  const terminarArrastre = (clavesOriginales) => {
    const nuevoOrden = ordenArrastre;
    arrastrando.current = null;
    setOrdenArrastre(null);

    if (!nuevoOrden || nuevoOrden.join("\u0000") === clavesOriginales.join("\u0000")) return;

    snap();
    nuevoOrden.forEach((k, i) => adapter.setOrder(data, seleccionada, k, i + 1));
    avisar("ok", "Orden actualizado según la posición.");
    refrescar();
  };

  /* ---------- Exportar ---------- */
  const abrirExportacion = () => {
    setErrorVersion("");
    setExportando(true);
  };

  const cerrarExportacion = () => {
    if (!guardandoVersion) setExportando(false);
  };

  const confirmarExportacion = async (descripcion) => {
    const s = store.current;
    const formulario = new FormData();
    formulario.append(
      "file",
      new Blob([serialize(data, s.indent, s.floatKeys)], { type: "application/json" }),
      s.fileName
    );
    formulario.append("descripcion", descripcion);
    formulario.append("agregador", adapter.name);
    formulario.append("cambios", JSON.stringify(diff(adapter, original, data)));
    formulario.append("cantidad_imagenes", String(imgs.size));

    setGuardandoVersion(true);
    setErrorVersion("");

    try {
      const res = await fetch(`${API_BASE_URL}/editor-menu/versiones`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formulario
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json.error || "No se pudo guardar en el historial");
    } catch (err) {
      setErrorVersion(err.message);
      setGuardandoVersion(false);
      return;
    }

    setGuardandoVersion(false);
    setExportando(false);
    await exportarArchivos(true);
  };

  const exportarSinGuardar = async () => {
    setExportando(false);
    await exportarArchivos(false);
  };

  const exportarArchivos = async (guardada) => {
    const s = store.current;
    descargar(
      new Blob([serialize(data, s.indent, s.floatKeys)], { type: "application/json;charset=utf-8" }),
      s.fileName
    );

    const aviso = sinIdentificar.length;

    if (!imgs.size) {
      avisar(
        aviso ? "warn" : "ok",
        <>Exportado{guardada ? " y guardado en el historial" : ""}: <b>{s.fileName}</b>{aviso ? " · ⚠ hay imágenes sin identificar que no se exportaron" : ""}.</>
      );
      return;
    }

    const productos = new Map(allProducts(adapter, data).map((p) => [p.uid, p]));
    const archivos = [];
    const filas = [["uuid", "producto", "categoria", "archivo", "archivo_original", "tamano_original", "avisos"]];

    for (const [uid, im] of imgs) {
      const p = productos.get(uid) || { name: "", catName: "" };
      const nombre = safeFile(uid) + ".jpg";

      archivos.push({ name: nombre, data: new Uint8Array(await im.blob.arrayBuffer()) });
      filas.push([uid, p.name, p.catName, nombre, im.src, `${im.w}x${im.h}`, im.warn.join(" | ")]);
    }

    const csv =
      "\ufeff" +
      filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    archivos.push({ name: "imagenes.csv", data: new TextEncoder().encode(csv) });

    const nombreZip = s.baseName + "-imagenes.zip";
    setTimeout(() => descargar(new Blob([makeZip(archivos)], { type: "application/zip" }), nombreZip), 400);

    avisar(
      aviso ? "warn" : "ok",
      <>
        Exportado{guardada ? " y guardado en el historial" : ""}: <b>{s.fileName}</b> + <b>{nombreZip}</b> ({imgs.size} imagen(es) JPG {IMG_W}×{IMG_H}). Si el
        navegador pregunta por descargas múltiples, elige Permitir.
        {aviso ? " ⚠ Hay imágenes sin identificar que no se exportaron." : ""}
      </>
    );
  };

  /* ---------- Render ---------- */
  const consultaItem = busquedaItem.trim();
  const consultaCat = busquedaCat.toLowerCase();
  const categoriaActual = categorias.find((c) => c.id === seleccionada);

  let productos = [];
  if (cargado && seleccionada && categoriaActual) {
    productos = adapter.products(data, seleccionada).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  }
  const clavesOriginales = productos.map((p) => p.key);
  if (ordenArrastre) {
    const porClave = new Map(productos.map((p) => [p.key, p]));
    productos = ordenArrastre.map((k) => porClave.get(k)).filter(Boolean);
  }
  const repetidos = {};
  productos.forEach((p) => {
    repetidos[p.order] = (repetidos[p.order] || 0) + 1;
  });

  const resultados = cargado && consultaItem
    ? allProducts(adapter, data).filter((p) => {
        const q = normalizar(consultaItem);
        return normalizar(p.name).includes(q) || normalizar(p.uid).includes(q) || normalizar(p.desc).includes(q);
      })
    : [];

  const cambios = cargado ? diff(adapter, original, data) : [];
  const problemasImagenes = cargado && adapter.imageIssues ? adapter.imageIssues(data) : [];
  const productosPorUid = cargado ? new Map(productosUnicos().map((p) => [p.uid, p])) : new Map();

  return (
    <div className="editor-menu">
      <ul className="nav nav-pills mb-3">
        {[
          ["editor", "Editor"],
          ["historial", "Historial de cambios"]
        ].map(([clave, etiqueta]) => (
          <li className="nav-item" key={clave}>
            <button
              type="button"
              className={`nav-link py-1 ${vista === clave ? "active" : ""}`}
              onClick={() => setVista(clave)}
            >
              {etiqueta}
            </button>
          </li>
        ))}
      </ul>

      {vista === "historial" && <HistorialEditorMenu token={token} />}

      <div className={vista === "editor" ? "" : "d-none"}>
        <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
          <h5 className="mb-0 me-auto">Editor de menú</h5>
          <span className="badge text-bg-secondary">{cargado ? adapter.name : "Sin archivo"}</span>

          <label className="btn btn-sm btn-outline-secondary mb-0">
            Abrir JSON
            <input type="file" accept=".json,application/json" className="d-none" onChange={abrirJson} />
          </label>
          <label className={`btn btn-sm btn-outline-secondary mb-0 ${cargado ? "" : "disabled"}`}>
            Cargar imágenes
            <input type="file" accept="image/*" multiple className="d-none" onChange={cargarImagenes} />
          </label>
          <Button size="sm" variant="outline-secondary" disabled={!history.length} onClick={deshacer}>
            Deshacer
          </Button>
          <Button size="sm" variant="primary" disabled={!cargado} onClick={abrirExportacion}>
            Exportar JSON
          </Button>
        </div>

        <div
          className={`alert py-2 mb-2 small alert-${
            mensaje.tipo === "ok" ? "success" : mensaje.tipo === "warn" ? "danger" : "info"
          }`}
        >
          {mensaje.contenido}
        </div>

        <div className="em-layout">
          <aside className="em-panel">
            <input
              className="form-control form-control-sm mb-2"
              placeholder="Buscar categoría..."
              value={busquedaCat}
              onChange={(e) => setBusquedaCat(e.target.value)}
            />
            <div className="small text-muted mb-1">Orden · Categoría · Productos</div>

            {categorias
              .filter(
                (c) =>
                  !consultaCat ||
                  c.name.toLowerCase().includes(consultaCat) ||
                  c.id.toLowerCase().includes(consultaCat)
              )
              .map((c) => (
                <div
                  key={c.id}
                  className={`em-cat ${c.id === seleccionada && !consultaItem ? "active" : ""} ${
                    c.hidden ? "oculta" : ""
                  }`}
                  title={c.id + (c.hidden ? " (no publicada en el menú)" : "")}
                  onClick={() => {
                    setSeleccionada(c.id);
                    setBusquedaItem("");
                  }}
                >
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="form-control form-control-sm"
                    defaultValue={c.order ?? ""}
                    key={`${c.id}-${c.order}`}
                    disabled={c.hidden || !adapter.canSetCategoryOrder(data, c.id)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      if (e.target.value !== String(c.order ?? "")) cambiarOrdenCategoria(c, e.target.value);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  />
                  <span className="em-cat-nombre">{c.name}</span>
                  <span className="badge text-bg-light border">{c.count}</span>
                </div>
              ))}
          </aside>

          <main className="em-main">
            <input
              className="form-control mb-3"
              placeholder="🔍 Buscar ítem por nombre, UUID/SKU o descripción..."
              disabled={!cargado}
              value={busquedaItem}
              onChange={(e) => setBusquedaItem(e.target.value)}
            />

            {!cargado && <div className="em-empty">Abre un archivo JSON para comenzar.</div>}

            {cargado && consultaItem && (
              <div>
                <p className="small text-muted">
                  {resultados.length} resultado(s). Clic en el UUID para copiarlo.
                </p>
                {resultados.length === 0 && <div className="em-empty">Sin resultados.</div>}

                <div className="em-lista">
                  {resultados.slice(0, 200).map((p) => (
                    <div className="em-res" key={`${p.catId}-${p.key}`}>
                      <Miniatura imagenNueva={imgs.get(p.uid)} url={p.image} tamano="md" />

                      <div>
                        <div className="fw-semibold">{p.name}</div>
                        <div className="small text-muted mt-1">
                          UUID/SKU:{" "}
                          <span
                            className="em-uuid"
                            title="Copiar"
                            onClick={() => {
                              navigator.clipboard?.writeText(p.uid);
                              avisar("ok", <>UUID copiado: <b>{p.uid}</b></>);
                            }}
                          >
                            {p.uid}
                          </span>
                        </div>
                        <div className="small text-muted mt-1">
                          Categoría: <b>{p.catName}</b>
                          {p.catHidden ? " (oculta)" : ""} · Orden: <b>{p.order ?? "—"}</b> · Precio:{" "}
                          <b>{dinero(p.price)}</b>
                        </div>
                        <div className="mt-2">
                          {p.desc || <i className="text-muted">Sin descripción</i>}
                        </div>
                        {p.image && (
                          <div className="small text-muted mt-1 text-break">
                            Imagen:{" "}
                            <a href={p.image} target="_blank" rel="noreferrer">
                              {p.image}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="d-flex flex-column gap-1">
                        <Button size="sm" variant="primary" onClick={() => abrirEdicion(p.catId, p.key)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => {
                            setSeleccionada(p.catId);
                            setBusquedaItem("");
                            setDestacada(p.key);
                          }}
                        >
                          Ver en categoría
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cargado && !consultaItem && categoriaActual && (
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                  <h5 className="mb-0 me-auto">{categoriaActual.name}</h5>
                  {!adapter.positional && (
                    <Button size="sm" variant="outline-secondary" onClick={renumerar}>
                      Renumerar 1, 2, 3…
                    </Button>
                  )}
                </div>

                <p className="small text-muted">
                  {adapter.positional
                    ? "En Uber el orden es la posición: arrastra o escribe la posición. "
                    : "Arrastra o escribe el orden. Los órdenes repetidos se marcan en naranjo. "}
                  Usa "Editar" para descripción, precio e imagen.
                </p>

                <div
                  className="em-lista"
                  ref={listaRef}
                  onDragOver={(e) => reordenarMientrasSeArrastra(e, ordenArrastre ?? clavesOriginales)}
                >
                  {productos.length === 0 && <div className="em-empty">Esta categoría no tiene productos.</div>}

                  {productos.map((p) => (
                    <div
                      key={p.key}
                      data-key={p.key}
                      className={`em-prod ${p.order != null && repetidos[p.order] > 1 ? "dup" : ""} ${
                        ordenArrastre && arrastrando.current === p.key ? "arrastrando" : ""
                      } ${destacada === p.key ? "destacada" : ""}`}
                      draggable
                      onDragStart={() => {
                        arrastrando.current = p.key;
                      }}
                      onDragEnd={() => terminarArrastre(clavesOriginales)}
                    >
                      <div className="em-handle">⋮⋮</div>
                      <Miniatura imagenNueva={imgs.get(p.uid)} url={p.image} />

                      <div>
                        <div className="fw-semibold">{p.name}</div>
                        <div className="em-pid">{p.uid}</div>
                        <div className="em-pdesc">{p.desc}</div>
                      </div>

                      <div className="em-precio">{dinero(p.price)}</div>

                      <input
                        type="number"
                        step="1"
                        min="1"
                        title="Orden"
                        className="form-control form-control-sm"
                        defaultValue={p.order ?? ""}
                        key={`${p.key}-${p.order}`}
                        onBlur={(e) => {
                          if (e.target.value !== String(p.order ?? "")) cambiarOrdenProducto(p, e.target.value);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      />

                      <select
                        title="Categoría"
                        className="form-select form-select-sm"
                        value={seleccionada}
                        onChange={(e) => mover(p, seleccionada, e.target.value)}
                      >
                        {opcionesCategoria(seleccionada).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <Button size="sm" variant="outline-secondary" onClick={() => abrirEdicion(seleccionada, p.key)}>
                        Editar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>

          <section className="em-panel">
            <h6>Cambios respecto al original</h6>
            {cambios.length ? (
              <ul className="small ps-3 mb-0">
                {cambios.map((c, i) => (
                  <li key={i + c} className="mb-1 text-break">
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="small text-muted">Sin cambios.</div>
            )}

            <h6 className="em-sep">
              Imágenes nuevas <span className="badge text-bg-light border">{imgs.size}</span>
            </h6>
            <div className="small text-muted mb-2">JPG 1440×1080 · se exportan en .zip como &lt;uuid&gt;.jpg</div>

            {imgs.size === 0 && <div className="small text-muted">Sin imágenes.</div>}
            {[...imgs].map(([uid, im]) => (
              <div className="em-img" key={uid}>
                <img className="em-thumb" src={im.url} alt="" />
                <div>
                  <b>{productosPorUid.get(uid)?.name ?? "(no existe en el menú)"}</b>
                  <div className="em-fn">
                    {im.src} → {safeFile(uid)}.jpg
                  </div>
                  {im.warn.map((w) => (
                    <div className="em-aviso" key={w}>
                      ⚠ {w}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline-secondary" onClick={() => quitarImagenNueva(uid)}>
                  Quitar
                </Button>
              </div>
            ))}

            {sinIdentificar.length > 0 && (
              <>
                <h6 className="em-sep text-warning-emphasis">
                  Sin identificar <span className="badge text-bg-light border">{sinIdentificar.length}</span>
                </h6>
                <div className="small text-muted mb-2">
                  Tip: nombra el archivo como el producto o con su UUID para que se identifique solo.
                </div>
                {sinIdentificar.map((im, i) => (
                  <div className="em-img" key={im.url}>
                    <img className="em-thumb" src={im.url} alt="" />
                    <div>
                      <div className="em-fn">{im.src}</div>
                      <select
                        className="form-select form-select-sm mt-1"
                        value=""
                        onChange={(e) => asignarSinIdentificar(i, e.target.value)}
                      >
                        <option value="">Asignar a producto…</option>
                        {[...productosPorUid.values()]
                          .sort((a, b) => a.name.localeCompare(b.name, "es"))
                          .map((p) => (
                            <option key={p.uid} value={p.uid}>
                              {p.name}
                              {imgs.has(p.uid) ? " (ya tiene nueva)" : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    <Button size="sm" variant="outline-secondary" onClick={() => descartarSinIdentificar(i)}>
                      Descartar
                    </Button>
                  </div>
                ))}
              </>
            )}

            {problemasImagenes.length > 0 && (
              <>
                <h6 className="em-sep text-warning-emphasis">
                  Revisión imágenes del JSON <span className="badge text-bg-light border">{problemasImagenes.length}</span>
                </h6>
                {problemasImagenes.slice(0, 50).map((x, i) => (
                  <div className="em-aviso mb-1" key={i + x}>
                    ⚠ {x}
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      </div>

      {editando && (
        <EditarProductoModal
          key={`${editando.catId}-${editando.key}`}
          producto={editando}
          categorias={opcionesCategoria(editando.catId)}
          imagenNueva={imagenDeEdicion}
          nota={notaEdicion}
          onGuardar={guardarProducto}
          onCerrar={() => setEditando(null)}
          onImagen={imagenDesdeModal}
          onQuitarImagen={() => quitarImagenNueva(editando.uid)}
        />
      )}

      {exportando && (
        <ExportarVersionModal
          cantidadCambios={diff(adapter, original, data).length}
          cantidadImagenes={imgs.size}
          nombreArchivo={store.current.fileName}
          guardando={guardandoVersion}
          error={errorVersion}
          onConfirmar={confirmarExportacion}
          onExportarSinGuardar={exportarSinGuardar}
          onCerrar={cerrarExportacion}
        />
      )}
    </div>
  );
}
