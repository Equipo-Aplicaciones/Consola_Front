import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, Form, Modal, Overlay, Popover, Row, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../../config";
import { ROLES } from "./roles";

const FORM_VACIO = { nombre: "", telefono: "", link: "", descripcion: "", roles: [] };

const LIMITE_LINEAS = (lineas) => ({
  display: "-webkit-box",
  WebkitLineClamp: lineas,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function ContactosAyuda({ token, role }) {
  const esAdmin = role === "Admin";
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [abierto, setAbierto] = useState(null);
  const anclas = useRef({});

  // El detalle (descripción, roles, enlace y botones) se muestra en un panel flotante al hacer clic en el
  // contacto, para que la tarjeta no cambie de tamaño.
  const alternarDetalle = (contacto) => {
    if (!contacto.descripcion && !contacto.link && !esAdmin) return;

    setAbierto((prev) => (prev === contacto.id ? null : contacto.id));
  };

  const base = `${API_BASE_URL}/docs-ayuda/contactos`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(base, { headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error cargando los contactos");

      setContactos(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [base, headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);

    return contactos.filter((c) => {
      const texto = normalizar(`${c.nombre} ${c.telefono} ${c.descripcion}`);
      return terminos.every((t) => texto.includes(t));
    });
  }, [contactos, busqueda]);

  const abrirFormulario = (contacto = null) => {
    setErrorForm("");
    setForm(
      contacto
        ? {
            nombre: contacto.nombre,
            telefono: contacto.telefono,
            link: contacto.link || "",
            descripcion: contacto.descripcion || "",
            roles: contacto.roles_visibles || []
          }
        : FORM_VACIO
    );
    setFormulario(contacto || {});
  };

  const alternarRol = (rol) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(rol)
        ? prev.roles.filter((r) => r !== rol)
        : [...prev.roles, rol]
    }));
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setErrorForm("El nombre es obligatorio");
      return;
    }

    if (!form.telefono.trim()) {
      setErrorForm("El teléfono es obligatorio");
      return;
    }

    setGuardando(true);
    setErrorForm("");

    try {
      const editando = Boolean(formulario?.id);
      const res = await fetch(editando ? `${base}/${formulario.id}` : base, {
        method: editando ? "PUT" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error guardando el contacto");

      setFormulario(null);
      await cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (contacto) => {
    if (!window.confirm(`¿Eliminar el contacto "${contacto.nombre}"?`)) return;

    setError("");

    try {
      const res = await fetch(`${base}/${contacto.id}`, { method: "DELETE", headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error eliminando el contacto");

      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="row g-2 mb-3 align-items-center">
        <div className="col">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search" />
            </span>
            <Form.Control
              placeholder="Buscar por nombre, teléfono o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <Button variant="outline-secondary" onClick={() => setBusqueda("")} title="Limpiar">
                <i className="bi bi-x-lg" />
              </Button>
            )}
          </div>
        </div>

        {esAdmin && (
          <div className="col-auto">
            <Button size="sm" variant="primary" onClick={() => abrirFormulario()}>
              <i className="bi bi-plus-lg me-1" />
              Agregar contacto
            </Button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {cargando ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-muted py-5">
          {contactos.length === 0
            ? "Aún no hay contactos cargados."
            : "No hay contactos que coincidan con la búsqueda."}
        </div>
      ) : (
        <div className="row g-3">
          {filtrados.map((c) => (
            <div className="col-12 col-md-6 col-xl-4" key={c.id}>
              <div className="card shadow-sm h-100">
                <div className="card-body d-flex flex-column gap-2" style={{ overflowWrap: "anywhere" }}>
                  <button
                    type="button"
                    ref={(el) => {
                      anclas.current[c.id] = el;
                    }}
                    className="btn p-0 border-0 text-start d-flex align-items-start justify-content-between gap-2 w-100"
                    style={{ cursor: c.descripcion || c.link || esAdmin ? "pointer" : "default" }}
                    aria-expanded={abierto === c.id}
                    title={c.descripcion || c.link || esAdmin ? "Clic para ver el detalle" : undefined}
                    onClick={() => alternarDetalle(c)}
                  >
                    <span className="h6 mb-0" title={c.nombre} style={LIMITE_LINEAS(2)}>
                      <i className="bi bi-person-lines-fill text-primary me-1" />
                      {c.nombre}
                    </span>

                    {(c.descripcion || c.link || esAdmin) && (
                      <i
                        className={`bi bi-chevron-${abierto === c.id ? "up" : "down"} text-muted flex-shrink-0`}
                      />
                    )}
                  </button>

                  <div className="fw-semibold">
                    <i className="bi bi-telephone me-1" />
                    {c.telefono}
                  </div>

                </div>

                <Overlay
                  show={abierto === c.id}
                  target={anclas.current[c.id]}
                  placement="bottom-start"
                  rootClose
                  onHide={() => setAbierto((prev) => (prev === c.id ? null : prev))}
                >
                  <Popover id={`contacto-${c.id}`} style={{ maxWidth: 340, zIndex: 1050 }}>
                    <Popover.Body className="d-flex flex-column gap-2" style={{ overflowWrap: "anywhere" }}>
                      {c.descripcion && (
                        <div className="text-muted small" style={{ maxHeight: 180, overflowY: "auto" }}>
                          {c.descripcion}
                        </div>
                      )}

                      {esAdmin && (
                        <div className="small text-muted">
                          <i className="bi bi-people me-1" />
                          {c.roles_visibles?.length ? c.roles_visibles.join(", ") : "Todos los roles"}
                        </div>
                      )}

                      <div className="d-flex gap-1">
                        {c.link ? (
                          <a
                            className="btn btn-sm btn-outline-primary flex-grow-1"
                            href={c.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <i className="bi bi-box-arrow-up-right me-1" />
                            Abrir enlace
                          </a>
                        ) : (
                          <span className="flex-grow-1" />
                        )}

                        {esAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              title="Editar"
                              onClick={() => {
                                setAbierto(null);
                                abrirFormulario(c);
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              title="Eliminar"
                              onClick={() => {
                                setAbierto(null);
                                eliminar(c);
                              }}
                            >
                              <i className="bi bi-trash" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Popover.Body>
                  </Popover>
                </Overlay>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={Boolean(formulario)} onHide={() => !guardando && setFormulario(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">
            {formulario?.id ? "Editar contacto" : "Agregar contacto"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {errorForm && <div className="alert alert-danger py-2">{errorForm}</div>}

          <Form.Group as={Row} className="mb-3 align-items-center">
            <Form.Label column sm={3}>Nombre</Form.Label>
            <Col sm={9}>
              <Form.Control
                value={form.nombre}
                maxLength={200}
                placeholder="Persona o área"
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </Col>
          </Form.Group>

          <Form.Group as={Row} className="mb-3 align-items-center">
            <Form.Label column sm={3}>Teléfono</Form.Label>
            <Col sm={9}>
              <Form.Control
                value={form.telefono}
                maxLength={80}
                placeholder="+56 9 1234 5678"
                onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
              />
            </Col>
          </Form.Group>

          <Form.Group as={Row} className="mb-3 align-items-center">
            <Form.Label column sm={3}>Enlace</Form.Label>
            <Col sm={9}>
              <Form.Control
                value={form.link}
                maxLength={500}
                placeholder="Opcional, ej. https://wa.me/56912345678"
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
              />
            </Col>
          </Form.Group>

          <Form.Group as={Row} className="mb-3">
            <Form.Label column sm={3}>Descripción</Form.Label>
            <Col sm={9}>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={2000}
                placeholder="Opcional"
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              />
            </Col>
          </Form.Group>

          <Form.Group as={Row}>
            <Form.Label column sm={3}>Quién puede verlo</Form.Label>
            <Col sm={9}>
              <div className="d-flex flex-wrap gap-3 pt-md-2">
                {ROLES.map((rol) => (
                  <Form.Check
                    key={rol}
                    type="checkbox"
                    id={`rol-contacto-${rol}`}
                    label={rol}
                    checked={form.roles.includes(rol)}
                    onChange={() => alternarRol(rol)}
                  />
                ))}
              </div>
              <Form.Text className="text-muted">
                Sin selección, el contacto es visible para todos los roles. Admin siempre lo ve.
              </Form.Text>
            </Col>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" disabled={guardando} onClick={() => setFormulario(null)}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
