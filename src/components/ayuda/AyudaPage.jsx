import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

const MAX_BYTES = 10 * 1024 * 1024;
const ROLES = ["Admin", "N1", "N2", "Gerente", "RRHH", "Comercial", "Zonal"];
const LIMITE_LINEAS = (lineas) => ({
  display: "-webkit-box",
  WebkitLineClamp: lineas,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
});
const FORM_VACIO = { titulo: "", categoria: "", descripcion: "", roles: [] };

function formatoTamano(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function AyudaPage({ token, role }) {
  const esAdmin = role === "Admin";
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [visor, setVisor] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  const base = `${API_BASE_URL}/docs-ayuda`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(base, { headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error cargando la documentación");

      setDocumentos(data);
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

  useEffect(() => {
    return () => {
      if (visor?.url) URL.revokeObjectURL(visor.url);
    };
  }, [visor]);

  const categorias = useMemo(
    () => [...new Set(documentos.map((d) => d.categoria).filter(Boolean))].sort(),
    [documentos]
  );

  const filtrados = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);

    return documentos.filter((d) => {
      if (categoria && d.categoria !== categoria) return false;

      const texto = normalizar(
        `${d.titulo} ${d.descripcion} ${d.categoria} ${d.nombre_archivo}`
      );

      return terminos.every((t) => texto.includes(t));
    });
  }, [documentos, busqueda, categoria]);

  const ver = async (documento) => {
    setError("");

    try {
      const res = await fetch(`${base}/${documento.id}/archivo`, { headers });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error abriendo el documento");
      }

      setVisor({
        nombre: documento.titulo,
        url: URL.createObjectURL(await res.blob())
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const abrirFormulario = (documento = null) => {
    setErrorForm("");
    setArchivo(null);
    setForm(
      documento
        ? {
            titulo: documento.titulo,
            categoria: documento.categoria || "",
            descripcion: documento.descripcion || "",
            roles: documento.roles_visibles || []
          }
        : FORM_VACIO
    );
    setFormulario(documento || {});
  };

  const alternarRol = (rol) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(rol)
        ? prev.roles.filter((r) => r !== rol)
        : [...prev.roles, rol]
    }));
  };

  const elegirArchivo = (e) => {
    const elegido = e.target.files?.[0];

    if (!elegido) return;

    if (elegido.type !== "application/pdf") {
      setErrorForm("Solo se permiten archivos PDF");
      e.target.value = "";
      return;
    }

    if (elegido.size > MAX_BYTES) {
      setErrorForm("El PDF supera el máximo de 10 MB");
      e.target.value = "";
      return;
    }

    setErrorForm("");
    setArchivo(elegido);

    if (!form.titulo.trim()) {
      setForm((prev) => ({ ...prev, titulo: elegido.name.replace(/\.pdf$/i, "") }));
    }
  };

  const guardar = async () => {
    const editando = Boolean(formulario?.id);

    if (!form.titulo.trim()) {
      setErrorForm("El título es obligatorio");
      return;
    }

    if (!editando && !archivo) {
      setErrorForm("Debe seleccionar un PDF");
      return;
    }

    setGuardando(true);
    setErrorForm("");

    try {
      let res;

      if (editando) {
        res = await fetch(`${base}/${formulario.id}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
      } else {
        const datos = new FormData();
        datos.append("titulo", form.titulo);
        datos.append("categoria", form.categoria);
        datos.append("descripcion", form.descripcion);
        datos.append("roles", JSON.stringify(form.roles));
        datos.append("file", archivo);

        res = await fetch(base, { method: "POST", headers, body: datos });
      }

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error guardando el documento");

      setFormulario(null);
      await cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (documento) => {
    if (!window.confirm(`¿Eliminar el documento "${documento.titulo}"?`)) return;

    setError("");

    try {
      const res = await fetch(`${base}/${documento.id}`, { method: "DELETE", headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error eliminando el documento");

      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
        <h4 className="mb-0">
          <i className="bi bi-question-circle me-2" />
          Ayuda
        </h4>

        {esAdmin && (
          <Button size="sm" variant="primary" onClick={() => abrirFormulario()}>
            <i className="bi bi-upload me-1" />
            Subir documento
          </Button>
        )}
      </div>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-8">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search" />
            </span>
            <Form.Control
              placeholder="Buscar por título, descripción o categoría..."
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

        <div className="col-12 col-md-4">
          <Form.Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {cargando ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-muted py-5">
          {documentos.length === 0
            ? "Aún no hay documentos de ayuda cargados."
            : "No hay documentos que coincidan con la búsqueda."}
        </div>
      ) : (
        <div className="row g-3">
          {filtrados.map((d) => (
            <div className="col-12 col-md-6 col-xl-4" key={d.id}>
              <div className="card shadow-sm h-100">
                <div className="card-body d-flex flex-column gap-2" style={{ overflowWrap: "anywhere" }}>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <h6
                      className="mb-0"
                      title={d.titulo}
                      style={{ minWidth: 0, overflowWrap: "anywhere", ...LIMITE_LINEAS(2) }}
                    >
                      <i className="bi bi-file-earmark-pdf text-danger me-1" />
                      {d.titulo}
                    </h6>
                    {d.categoria && (
                      <Badge bg="secondary" className="flex-shrink-0">
                        {d.categoria}
                      </Badge>
                    )}
                  </div>

                  {d.descripcion && (
                    <div className="text-muted small" title={d.descripcion} style={LIMITE_LINEAS(3)}>
                      {d.descripcion}
                    </div>
                  )}

                  {esAdmin && (
                    <div className="small text-muted">
                      <i className="bi bi-people me-1" />
                      {d.roles_visibles?.length ? d.roles_visibles.join(", ") : "Todos los roles"}
                    </div>
                  )}

                  <div className="text-muted small mt-auto">
                    {formatoTamano(d.tamano)} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("es-CL")}
                  </div>

                  <div className="d-flex gap-1">
                    <Button size="sm" variant="outline-primary" className="flex-grow-1" onClick={() => ver(d)}>
                      <i className="bi bi-eye me-1" />
                      Ver
                    </Button>

                    {esAdmin && (
                      <>
                        <Button size="sm" variant="outline-secondary" title="Editar" onClick={() => abrirFormulario(d)}>
                          <i className="bi bi-pencil" />
                        </Button>
                        <Button size="sm" variant="outline-danger" title="Eliminar" onClick={() => eliminar(d)}>
                          <i className="bi bi-trash" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={Boolean(visor)} onHide={() => setVisor(null)} size="xl" centered scrollable>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 text-truncate">{visor?.nombre}</Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-0">
          {visor && (
            <iframe
              title={visor.nombre}
              src={visor.url}
              style={{ width: "100%", height: "75vh", border: 0 }}
            />
          )}
        </Modal.Body>

        <Modal.Footer className="py-2">
          {visor && (
            <a className="btn btn-sm btn-outline-secondary" href={visor.url} target="_blank" rel="noreferrer">
              <i className="bi bi-box-arrow-up-right me-1" />
              Abrir en pestaña nueva
            </a>
          )}
          <Button size="sm" variant="secondary" onClick={() => setVisor(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(formulario)} onHide={() => !guardando && setFormulario(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">
            {formulario?.id ? "Editar documento" : "Subir documento"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {errorForm && <div className="alert alert-danger py-2">{errorForm}</div>}

          {!formulario?.id && (
            <Form.Group className="mb-3">
              <Form.Label>Archivo PDF</Form.Label>
              <Form.Control
                type="file"
                accept="application/pdf,.pdf"
                onChange={elegirArchivo}
              />
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Título</Form.Label>
            <Form.Control
              value={form.titulo}
              maxLength={200}
              onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Categoría (opcional)</Form.Label>
            <Form.Control
              list="categorias-ayuda"
              value={form.categoria}
              maxLength={100}
              onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
            />
            <datalist id="categorias-ayuda">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Descripción (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={2000}
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Quién puede verlo</Form.Label>
            <div className="d-flex flex-wrap gap-3">
              {ROLES.map((rol) => (
                <Form.Check
                  key={rol}
                  type="checkbox"
                  id={`rol-ayuda-${rol}`}
                  label={rol}
                  checked={form.roles.includes(rol)}
                  onChange={() => alternarRol(rol)}
                />
              ))}
            </div>
            <Form.Text className="text-muted">
              Sin selección, el documento es visible para todos los roles. Admin siempre lo ve.
            </Form.Text>
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
