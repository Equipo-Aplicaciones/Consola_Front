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
    <div className="card shadow-sm mb-3">
      <div className="card-body p-2">
        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <strong>
            <i className="bi bi-file-earmark-pdf me-1" />
            Instructivos
          </strong>

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
                disabled={subiendo}
                onClick={() => inputRef.current?.click()}
              >
                {subiendo ? (
                  <Spinner size="sm" animation="border" className="me-1" />
                ) : (
                  <i className="bi bi-upload me-1" />
                )}
                Subir PDF
              </Button>
            </>
          )}
        </div>

        {error && <div className="alert alert-danger py-1 px-2 small mt-2 mb-0">{error}</div>}

        {instructivos.length === 0 ? (
          <div className="text-muted small mt-2">Sin instructivos cargados.</div>
        ) : (
          <ul className="list-unstyled mb-0 mt-2">
            {instructivos.map((instructivo) => (
              <li
                key={instructivo.id}
                className="d-flex justify-content-between align-items-center gap-2 py-1 border-top"
              >
                <div className="text-truncate" style={{ minWidth: 0 }}>
                  <i className="bi bi-file-earmark-pdf text-danger me-1" />
                  {instructivo.nombre_archivo}
                  <span className="text-muted small ms-2">
                    {formatoTamano(instructivo.tamano)}
                  </span>
                </div>

                <div className="d-flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="outline-secondary" onClick={() => ver(instructivo)}>
                    <i className="bi bi-eye me-1" />
                    Ver
                  </Button>

                  {puedeAdministrar && (
                    <Button
                      size="sm"
                      variant="outline-danger"
                      title="Eliminar"
                      onClick={() => eliminar(instructivo)}
                    >
                      <i className="bi bi-trash" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
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
