import { useCallback, useEffect, useState } from "react";
import { Modal, Button, Form, Badge, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

const BADGE_ESTADO = {
  ABIERTA: "danger",
  EN_SEGUIMIENTO: "warning",
  RESUELTA: "success"
};

const fecha = (valor) =>
  valor
    ? new Date(valor).toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        dateStyle: "short",
        timeStyle: "short"
      })
    : "-";

// Valor para <input type="datetime-local"> en la hora del navegador
const paraInput = (valor) => {
  const d = valor ? new Date(valor) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const FORM_VACIO = () => ({
  titulo: "",
  categoria: "",
  descripcion: "",
  fecha_incidencia: paraInput()
});

function EstadoBadge({ codigo, nombre }) {
  return (
    <Badge bg={BADGE_ESTADO[codigo] || "secondary"} text={codigo === "EN_SEGUIMIENTO" ? "dark" : undefined}>
      {nombre}
    </Badge>
  );
}

export default function IncidenciasLocalModal({ show, onClose, connection, token }) {
  const [vista, setVista] = useState("lista"); // lista | form | detalle
  const [incidencias, setIncidencias] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [estados, setEstados] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState(FORM_VACIO());
  const [editandoId, setEditandoId] = useState(null);

  const [detalle, setDetalle] = useState(null);
  const [comentario, setComentario] = useState("");
  const [estadoNuevo, setEstadoNuevo] = useState("");

  const user = JSON.parse(localStorage.getItem("authUser") || "{}");
  const esAdmin = user.role === "Admin";

  const api = useCallback(
    async (ruta, opciones = {}) => {
      const res = await fetch(`${API_BASE_URL}${ruta}`, {
        ...opciones,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return null;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Error en la solicitud");
      }

      return data;
    },
    [token]
  );

  const cargarLista = useCallback(async () => {
    if (!connection) return;

    setCargando(true);
    setError("");

    try {
      const params = new URLSearchParams({ connection_id: connection.id });
      if (filtroEstado) params.set("estado", filtroEstado);

      const data = await api(`/incidencias?${params}`);
      setIncidencias(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [api, connection, filtroEstado]);

  useEffect(() => {
    if (!show) return;

    setVista("lista");
    setFiltroEstado("");
    setDetalle(null);
    setError("");

    Promise.all([api("/estados?grupo=INCIDENCIA"), api("/incidencias/categorias")])
      .then(([est, cats]) => {
        setEstados(est || []);
        setCategorias(cats || []);
      })
      .catch((err) => setError(err.message));
  }, [show, api]);

  useEffect(() => {
    if (show) cargarLista();
  }, [show, cargarLista]);

  const abrirNueva = () => {
    setEditandoId(null);
    setForm(FORM_VACIO());
    setError("");
    setVista("form");
  };

  const abrirDetalle = async (id) => {
    setError("");
    setComentario("");
    setEstadoNuevo("");

    try {
      const data = await api(`/incidencias/${id}`);
      if (!data) return;
      setDetalle(data);
      setVista("detalle");
    } catch (err) {
      setError(err.message);
    }
  };

  const abrirEdicion = () => {
    setEditandoId(detalle.id);
    setForm({
      titulo: detalle.titulo,
      categoria: detalle.categoria || "",
      descripcion: detalle.descripcion || "",
      fecha_incidencia: paraInput(detalle.fecha_incidencia)
    });
    setError("");
    setVista("form");
  };

  const guardarIncidencia = async (e) => {
    e.preventDefault();

    if (!form.titulo.trim()) {
      setError("Debe ingresar un título.");
      return;
    }

    setGuardando(true);
    setError("");

    try {
      const cuerpo = {
        titulo: form.titulo.trim(),
        categoria: form.categoria.trim(),
        descripcion: form.descripcion.trim(),
        fecha_incidencia: new Date(form.fecha_incidencia).toISOString()
      };

      if (editandoId) {
        await api(`/incidencias/${editandoId}`, { method: "PUT", body: JSON.stringify(cuerpo) });
        await abrirDetalle(editandoId);
      } else {
        const creada = await api("/incidencias", {
          method: "POST",
          body: JSON.stringify({ ...cuerpo, connection_id: connection.id })
        });
        if (!creada) return;
        await abrirDetalle(creada.id);
      }

      cargarLista();
      api("/incidencias/categorias").then((c) => setCategorias(c || [])).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const registrarSeguimiento = async (e) => {
    e.preventDefault();

    if (!comentario.trim()) {
      setError("Debe ingresar un comentario.");
      return;
    }

    setGuardando(true);
    setError("");

    try {
      await api(`/incidencias/${detalle.id}/seguimientos`, {
        method: "POST",
        body: JSON.stringify({
          comentario: comentario.trim(),
          estado_codigo: estadoNuevo || undefined
        })
      });

      await abrirDetalle(detalle.id);
      cargarLista();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar la incidencia "${detalle.titulo}" y todo su seguimiento? No se puede deshacer.`)) {
      return;
    }

    try {
      await api(`/incidencias/${detalle.id}`, { method: "DELETE" });
      setDetalle(null);
      setVista("lista");
      cargarLista();
    } catch (err) {
      setError(err.message);
    }
  };

  const titulo = connection ? `Incidencias · ${connection.codLocal} - ${connection.name}` : "Incidencias";

  return (
    <Modal show={show} onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">{titulo}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {/* ================= LISTA ================= */}
        {vista === "lista" && (
          <>
            <div className="d-flex gap-2 align-items-center mb-3">
              <Form.Select
                size="sm"
                style={{ maxWidth: 220 }}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {estados.map((est) => (
                  <option key={est.id} value={est.codigo}>
                    {est.nombre}
                  </option>
                ))}
              </Form.Select>

              <Button size="sm" className="ms-auto" onClick={abrirNueva}>
                <i className="bi bi-plus-lg me-1" />
                Nueva incidencia
              </Button>
            </div>

            {cargando && (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" />
              </div>
            )}

            {!cargando && incidencias.length === 0 && (
              <div className="text-muted text-center py-4">Este local no tiene incidencias registradas.</div>
            )}

            <div className="list-group">
              {incidencias.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  className="list-group-item list-group-item-action"
                  onClick={() => abrirDetalle(i.id)}
                >
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="fw-semibold">{i.titulo}</span>
                    <EstadoBadge codigo={i.estado_codigo} nombre={i.estado_nombre} />
                    {i.categoria && (
                      <Badge bg="light" text="dark" className="border">
                        {i.categoria}
                      </Badge>
                    )}
                    <span className="ms-auto small text-muted">{fecha(i.fecha_incidencia)}</span>
                  </div>
                  <div className="small text-muted">
                    {i.seguimientos} seguimiento(s) · registrada por {i.creado_por_nombre || "-"}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ================= FORMULARIO ================= */}
        {vista === "form" && (
          <Form onSubmit={guardarIncidencia} id="form-incidencia">
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                value={form.titulo}
                maxLength={200}
                placeholder="Ej: Falla de base de datos, cambio de IIS..."
                onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                autoFocus
              />
            </Form.Group>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <Form.Label>Categoría (opcional)</Form.Label>
                <Form.Control
                  list="categorias-incidencias"
                  value={form.categoria}
                  maxLength={100}
                  placeholder="Escriba o elija una existente"
                  onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                />
                <datalist id="categorias-incidencias">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="col-md-6">
                <Form.Label>Fecha y hora en que ocurrió</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={form.fecha_incidencia}
                  onChange={(e) => setForm((p) => ({ ...p, fecha_incidencia: e.target.value }))}
                />
              </div>
            </div>

            <Form.Group>
              <Form.Label>Descripción (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={form.descripcion}
                maxLength={5000}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </Form.Group>
          </Form>
        )}

        {/* ================= DETALLE ================= */}
        {vista === "detalle" && detalle && (
          <>
            <div className="d-flex align-items-start gap-2 flex-wrap mb-2">
              <h6 className="mb-0 me-auto">{detalle.titulo}</h6>
              <EstadoBadge codigo={detalle.estado_codigo} nombre={detalle.estado_nombre} />
              {detalle.categoria && (
                <Badge bg="light" text="dark" className="border">
                  {detalle.categoria}
                </Badge>
              )}
            </div>

            <div className="small text-muted mb-2">
              Ocurrió: {fecha(detalle.fecha_incidencia)} · Registrada por {detalle.creado_por_nombre || "-"} el{" "}
              {fecha(detalle.created_at)}
              {detalle.resuelta_at && <> · Resuelta: {fecha(detalle.resuelta_at)}</>}
            </div>

            {detalle.descripcion && <p className="text-break" style={{ whiteSpace: "pre-wrap" }}>{detalle.descripcion}</p>}

            <div className="d-flex gap-2 mb-3">
              <Button size="sm" variant="outline-primary" onClick={abrirEdicion}>
                <i className="bi bi-pencil me-1" />
                Editar
              </Button>
              {esAdmin && (
                <Button size="sm" variant="outline-danger" onClick={eliminar}>
                  <i className="bi bi-trash me-1" />
                  Eliminar
                </Button>
              )}
            </div>

            <hr />
            <div className="fw-semibold mb-2">Seguimiento</div>

            {detalle.seguimientos.length === 0 && (
              <div className="text-muted small mb-3">Aún no hay seguimiento registrado.</div>
            )}

            <div className="mb-3">
              {detalle.seguimientos.map((s) => (
                <div key={s.id} className="border-start border-3 ps-3 mb-3">
                  <div className="small text-muted">
                    {fecha(s.created_at)} · {s.usuario_nombre || "-"}
                    {s.estado_codigo && (
                      <span className="ms-2">
                        pasó a <EstadoBadge codigo={s.estado_codigo} nombre={s.estado_nombre} />
                      </span>
                    )}
                  </div>
                  <div className="text-break" style={{ whiteSpace: "pre-wrap" }}>{s.comentario}</div>
                </div>
              ))}
            </div>

            <Form onSubmit={registrarSeguimiento} className="bg-light rounded p-3">
              <Form.Control
                as="textarea"
                rows={2}
                className="mb-2"
                placeholder="Agregar seguimiento (qué se hizo, qué se encontró...)"
                value={comentario}
                maxLength={5000}
                onChange={(e) => setComentario(e.target.value)}
              />

              <div className="d-flex gap-2 align-items-center flex-wrap">
                <Form.Select
                  size="sm"
                  style={{ maxWidth: 230 }}
                  value={estadoNuevo}
                  onChange={(e) => setEstadoNuevo(e.target.value)}
                >
                  <option value="">Mantener estado ({detalle.estado_nombre})</option>
                  {estados
                    .filter((est) => est.codigo !== detalle.estado_codigo)
                    .map((est) => (
                      <option key={est.id} value={est.codigo}>
                        Pasar a: {est.nombre}
                      </option>
                    ))}
                </Form.Select>

                <Button type="submit" size="sm" className="ms-auto" disabled={guardando}>
                  {guardando ? "Guardando..." : "Registrar seguimiento"}
                </Button>
              </div>
            </Form>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        {vista === "form" ? (
          <>
            <Button
              variant="danger"
              disabled={guardando}
              onClick={() => (editandoId ? setVista("detalle") : setVista("lista"))}
            >
              Cancelar
            </Button>
            <Button type="submit" form="form-incidencia" disabled={guardando}>
              {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Registrar incidencia"}
            </Button>
          </>
        ) : vista === "detalle" ? (
          <Button variant="secondary" onClick={() => setVista("lista")}>
            <i className="bi bi-arrow-left me-1" />
            Volver a la lista
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
