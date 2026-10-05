import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

const MAX_BYTES = 10 * 1024 * 1024;

function formatoTamano(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function GestionInstructivos({ gestionId, token, puedeAdministrar }) {
  const [instructivos, setInstructivos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [visor, setVisor] = useState(null);
  const inputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };
  const base = `${API_BASE_URL}/gestiones/${gestionId}/instructivos`;

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error cargando instructivos");

      setInstructivos(data);
    } catch (err) {
      setError(err.message);
    }
  }, [base, token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    return () => {
      if (visor?.url) URL.revokeObjectURL(visor.url);
    };
  }, [visor]);

  const subir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";

    if (!archivo) return;

    setError("");

    if (archivo.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF");
      return;
    }

    if (archivo.size > MAX_BYTES) {
      setError("El PDF supera el máximo de 10 MB");
      return;
    }

    setSubiendo(true);

    try {
      const formData = new FormData();
      formData.append("file", archivo);

      const res = await fetch(base, { method: "POST", headers, body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error subiendo instructivo");

      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const ver = async (instructivo) => {
    setError("");

    try {
      const res = await fetch(`${base}/${instructivo.id}/archivo`, { headers });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error abriendo instructivo");
      }

      const blob = await res.blob();

      setVisor({
        nombre: instructivo.nombre_archivo,
        url: URL.createObjectURL(blob)
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminar = async (instructivo) => {
    if (!window.confirm(`¿Eliminar el instructivo "${instructivo.nombre_archivo}"?`)) return;

    setError("");

    try {
      const res = await fetch(`${base}/${instructivo.id}`, { method: "DELETE", headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error eliminando instructivo");

      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!puedeAdministrar && instructivos.length === 0 && !error) return null;

  return (
    <div className="card shadow-sm mb-2">
      <div className="card-body py-1 px-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <strong className="small">
            <i className="bi bi-file-earmark-pdf me-1" />
            Instructivos
          </strong>

          {instructivos.length === 0 && (
            <span className="text-muted small">Sin instructivos cargados.</span>
          )}

          {instructivos.map((instructivo) => (
            <div className="btn-group btn-group-sm" key={instructivo.id}>
              <Button
                variant="outline-secondary"
                title={`${instructivo.nombre_archivo} (${formatoTamano(instructivo.tamano)})`}
                onClick={() => ver(instructivo)}
              >
                <i className="bi bi-eye me-1" />
                <span
                  className="d-inline-block text-truncate align-bottom"
                  style={{ maxWidth: 180 }}
                >
                  {instructivo.nombre_archivo}
                </span>
              </Button>

              {puedeAdministrar && (
                <Button
                  variant="outline-danger"
                  title="Eliminar"
                  onClick={() => eliminar(instructivo)}
                >
                  <i className="bi bi-trash" />
                </Button>
              )}
            </div>
          ))}

          {puedeAdministrar && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="d-none"
                onChange={subir}
              />

              <Button
                size="sm"
                variant="outline-primary"
                className="ms-auto"
                title="Subir PDF"
                disabled={subiendo}
                onClick={() => inputRef.current?.click()}
              >
                {subiendo ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <i className="bi bi-upload" />
                )}
                <span className="d-none d-md-inline ms-1">Subir PDF</span>
              </Button>
            </>
          )}
        </div>

        {error && <div className="alert alert-danger py-1 px-2 small mt-1 mb-0">{error}</div>}
      </div>

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
    </div>
  );
}
