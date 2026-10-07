import { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../../config";
import { detectAdapter } from "./core";
import Miniatura from "./Miniatura";

const dinero = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

export default function VerCambiosVersion({ version, token, fecha, onCerrar }) {
  const [detalle, setDetalle] = useState(null);
  const [menu, setMenu] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("grafica");
  const [seleccionada, setSeleccionada] = useState(null);
  const [soloModificados, setSoloModificados] = useState(false);

  useEffect(() => {
    let activo = true;
    const headers = { Authorization: `Bearer ${token}` };
    const base = `${API_BASE_URL}/editor-menu/versiones/${version.id}`;

    (async () => {
      try {
        const [resDetalle, resArchivo] = await Promise.all([
          fetch(base, { headers }),
          fetch(`${base}/archivo`, { headers })
        ]);

        if (!resDetalle.ok || !resArchivo.ok) throw new Error("No se pudo cargar la versión");

        const datosDetalle = await resDetalle.json();
        const json = JSON.parse(await resArchivo.text());
        const adapter = detectAdapter(json);

        if (!adapter) throw new Error("No se reconoce el formato del JSON guardado");
        if (!activo) return;

        const categorias = adapter
          .categories(json)
          .sort((a, b) => a.hidden - b.hidden || (a.order ?? 1e9) - (b.order ?? 1e9))
          .map((c) => ({
            ...c,
            productos: adapter.products(json, c.id).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))
          }));

        setDetalle(datosDetalle);
        setMenu({ adapter, categorias });
      } catch (err) {
        if (!activo) return;
        setError(err.message);
        setVista("lista");
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [version.id, token]);

  const cambios = useMemo(() => detalle?.cambios_detalle ?? [], [detalle]);

  const porProducto = useMemo(() => {
    const m = new Map();
    for (const c of cambios) {
      if (!c.uid) continue;
      m.set(c.uid, [...(m.get(c.uid) || []), c]);
    }
    return m;
  }, [cambios]);

  const resumenCategorias = useMemo(() => {
    if (!menu) return [];

    return menu.categorias.map((c) => {
      const modificados = c.productos.filter((p) => porProducto.has(p.uid)).length;
      const salieron = cambios.filter(
        (x) => x.tipo === "movido" && x.antesIds.includes(c.id) && !x.despuesIds.includes(c.id)
      );
      const ordenCategoria = cambios.find((x) => x.tipo === "orden_categoria" && x.catId === c.id);
      const reordenada = cambios.some((x) => x.tipo === "reordenado" && x.catId === c.id);

      return {
        ...c,
        modificados,
        salieron,
        ordenCategoria,
        reordenada,
        conCambios: modificados + salieron.length > 0 || Boolean(ordenCategoria) || reordenada
      };
    });
  }, [menu, cambios, porProducto]);

  useEffect(() => {
    if (!resumenCategorias.length || seleccionada) return;

    setSeleccionada((resumenCategorias.find((c) => c.conCambios) ?? resumenCategorias[0]).id);
  }, [resumenCategorias, seleccionada]);

  const categoria = resumenCategorias.find((c) => c.id === seleccionada);
  const ordenCategorias = cambios.find((x) => x.tipo === "orden_categorias");

  const productosVisibles = categoria
    ? categoria.productos.filter((p) => !soloModificados || porProducto.has(p.uid))
    : [];

  const renderProducto = (p) => {
    const entradas = porProducto.get(p.uid) || [];
    const precio = entradas.find((x) => x.tipo === "precio");
    const descripcion = entradas.find((x) => x.tipo === "descripcion");
    const orden = entradas.find((x) => x.tipo === "orden" && x.catId === categoria.id);
    const movido = entradas.find((x) => x.tipo === "movido" && x.despuesIds.includes(categoria.id));

    return (
      <div className={`em-vprod ${entradas.length ? "cambiado" : ""}`} key={`${p.key}-${p.uid}`}>
        <Miniatura url={p.image} />

        <div className="min-w-0">
          <div className="fw-semibold">{p.name}</div>
          <div className="em-pid">{p.uid}</div>

          {descripcion ? (
            <div className="small mt-1">
              <div className="em-antes">{descripcion.antes || "(sin descripción)"}</div>
              <div className="em-ahora">{descripcion.despues || "(sin descripción)"}</div>
            </div>
          ) : (
            <div className="em-pdesc">{p.desc}</div>
          )}

          {(movido || orden) && (
            <div className="mt-1 d-flex gap-1 flex-wrap">
              {movido && <span className="em-chip">Movido desde: {movido.antes}</span>}
              {orden && (
                <span className="em-chip">
                  Orden {orden.antes ?? "—"} → {orden.despues ?? "—"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="em-precio">
          {precio ? (
            <>
              <div className="em-antes">{dinero(precio.antes)}</div>
              <div className="em-ahora">{dinero(precio.despues)}</div>
            </>
          ) : (
            dinero(p.price)
          )}
        </div>

        <div className="text-center small text-muted">#{p.order ?? "—"}</div>
      </div>
    );
  };

  return (
    <Modal show onHide={onCerrar} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">Cambios de la versión</Modal.Title>
      </Modal.Header>

      <Modal.Body className="editor-menu">
        <div className="small text-muted mb-1">
          {fecha(version.created_at)} · {version.usuario_nombre || "-"} · {version.agregador} ·{" "}
          {version.nombre_archivo}
        </div>
        <p className="mb-2">{version.descripcion}</p>

        <ul className="nav nav-pills mb-3">
          {[
            ["grafica", "Vista gráfica"],
            ["lista", `Lista de cambios (${version.cambios.length})`]
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

        {error && <div className="alert alert-warning py-2 small">{error}</div>}

        {cargando && (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        )}

        {!cargando && vista === "lista" &&
          (version.cambios.length === 0 ? (
            <div className="text-muted small">Esta versión se exportó sin cambios respecto al original.</div>
          ) : (
            <ul className="small mb-0">
              {version.cambios.map((c, i) => (
                <li key={i} className="mb-1 text-break">
                  {c}
                </li>
              ))}
            </ul>
          ))}

        {!cargando && vista === "grafica" && menu && (
          <>
            {ordenCategorias && (
              <div className="alert alert-info py-2 small">
                <b>Orden de categorías:</b> antes {ordenCategorias.antes.join(" · ")} → ahora{" "}
                {ordenCategorias.despues.join(" · ")}
              </div>
            )}

            <div className="em-vlayout">
              <aside className="em-vcats">
                {resumenCategorias.map((c) => (
                  <div
                    key={c.id}
                    className={`em-cat em-vcat ${c.id === seleccionada ? "active" : ""} ${c.hidden ? "oculta" : ""}`}
                    onClick={() => setSeleccionada(c.id)}
                    title={c.id + (c.hidden ? " (no publicada en el menú)" : "")}
                  >
                    <span className="small text-muted text-center">{c.order ?? "—"}</span>
                    <span className="em-cat-nombre">{c.name}</span>
                    <span className={`badge ${c.conCambios ? "text-bg-warning" : "text-bg-light border"}`}>
                      {c.conCambios ? c.modificados + c.salieron.length || "•" : c.productos.length}
                    </span>
                  </div>
                ))}
              </aside>

              <div className="min-w-0">
                {categoria && (
                  <>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                      <h6 className="mb-0 me-auto">{categoria.name}</h6>
                      {categoria.ordenCategoria && (
                        <span className="em-chip">
                          Orden de categoría {categoria.ordenCategoria.antes ?? "—"} →{" "}
                          {categoria.ordenCategoria.despues ?? "—"}
                        </span>
                      )}
                      {categoria.reordenada && <span className="em-chip">Productos reordenados</span>}
                      <Form.Check
                        type="switch"
                        id="solo-modificados"
                        label="Solo modificados"
                        checked={soloModificados}
                        onChange={(e) => setSoloModificados(e.target.checked)}
                      />
                    </div>

                    <div className="em-lista">
                      {productosVisibles.length === 0 && (
                        <div className="em-empty">
                          {soloModificados
                            ? "No hay productos modificados en esta categoría."
                            : "Esta categoría no tiene productos."}
                        </div>
                      )}
                      {productosVisibles.map(renderProducto)}
                    </div>

                    {categoria.salieron.length > 0 && (
                      <div className="mt-3">
                        <div className="small fw-semibold mb-1">Salieron de esta categoría</div>
                        {categoria.salieron.map((x) => (
                          <div className="em-vprod cambiado" key={x.uid}>
                            <div />
                            <div>
                              <div className="fw-semibold">{x.nombre}</div>
                              <div className="em-pid">{x.uid}</div>
                            </div>
                            <div className="small text-end">
                              <span className="em-chip">Ahora en: {x.despues}</span>
                            </div>
                            <div />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
