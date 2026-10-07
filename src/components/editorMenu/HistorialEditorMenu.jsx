import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../../config";
import { descargar } from "./imagenes";

function formatoTamano(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const normalizar = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function HistorialEditorMenu({ token }) {
  const [versiones, setVersiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const res = await fetch(`${API_BASE_URL}/editor-menu/versiones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error cargando el historial");

      setVersiones(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);

    return versiones.filter((v) => {
      const texto = normalizar(`${v.descripcion} ${v.usuario_nombre} ${v.nombre_archivo} ${v.agregador}`);
      return terminos.every((t) => texto.includes(t));
    });
  }, [versiones, busqueda]);

  const descargarVersion = async (version) => {
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/editor-menu/versiones/${version.id}/archivo`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error descargando la versión");
      }

      descargar(await res.blob(), version.nombre_archivo);
    } catch (err) {
      setError(err.message);
    }
  };

  const fecha = (valor) =>
    new Date(valor).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

  return (
    <div>
      <div className="d-flex gap-2 mb-3">
        <Form.Control
          placeholder="Buscar por descripción, usuario, archivo o agregador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button variant="outline-secondary" title="Actualizar" onClick={cargar}>
          <i className="bi bi-arrow-clockwise" />
        </Button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {cargando ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="em-empty">
          {versiones.length === 0
            ? "Aún no hay versiones guardadas. Se registran al exportar desde el editor."
            : "No hay versiones que coincidan con la búsqueda."}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle small">
            <thead className="table-light">
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Agregador</th>
                <th>Archivo</th>
                <th>Descripción</th>
                <th className="text-center">Cambios</th>
                <th className="text-center">Imágenes</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((v) => (
                <tr key={v.id}>
                  <td className="text-nowrap">{fecha(v.created_at)}</td>
                  <td>{v.usuario_nombre || "-"}</td>
                  <td>
                    <Badge bg="secondary">{v.agregador}</Badge>
                  </td>
                  <td className="text-break">
                    {v.nombre_archivo}
                    <div className="text-muted">{formatoTamano(v.tamano)}</div>
                  </td>
                  <td style={{ minWidth: 220 }}>{v.descripcion}</td>
                  <td className="text-center">{v.cambios.length}</td>
                  <td className="text-center">{v.cantidad_imagenes}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => setDetalle(v)}>
                      <i className="bi bi-list-ul me-1" />
                      Ver cambios
                    </Button>
                    <Button size="sm" variant="outline-primary" title="Descargar JSON" onClick={() => descargarVersion(v)}>
                      <i className="bi bi-download" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal show={Boolean(detalle)} onHide={() => setDetalle(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">Cambios de la versión</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {detalle && (
            <>
              <div className="small text-muted mb-2">
                {fecha(detalle.created_at)} · {detalle.usuario_nombre || "-"} · {detalle.agregador} ·{" "}
                {detalle.nombre_archivo}
              </div>
              <p className="mb-3">{detalle.descripcion}</p>

              {detalle.cambios.length === 0 ? (
                <div className="text-muted small">Esta versión se exportó sin cambios respecto al original.</div>
              ) : (
                <ul className="small mb-0">
                  {detalle.cambios.map((c, i) => (
                    <li key={i} className="mb-1 text-break">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDetalle(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
