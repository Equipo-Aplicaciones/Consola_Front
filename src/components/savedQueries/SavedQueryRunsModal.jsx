import { useEffect, useState } from "react";
import { Modal, Table, Badge, Spinner, Alert, Button } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function SavedQueryRunsModal({ show, onClose, query, token }) {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    if (!show || !query) return;
    cargarRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, query]);

  async function cargarRuns() {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/saved-queries/${query.id}/runs`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        throw new Error("Error cargando historial");
      }

      const data = await res.json();
      setRuns(data);
    } catch (err) {
      console.error(err);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  const ok = runs.filter(r => r.estado === "OK").length;
  const error = runs.filter(r => r.estado !== "OK").length;

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Historial de ejecuciones — {query?.nombre}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <Badge bg="success" className="me-2">OK: {ok}</Badge>
          <Badge bg="danger">Error: {error}</Badge>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : runs.length === 0 ? (
          <Alert variant="warning">
            Esta query aún no se ha ejecutado.
          </Alert>
        ) : (
          <div style={{ minHeight: 200, overflowY: "auto", maxHeight: 400 }}>
            <Table striped bordered hover responsive size="sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Local</th>
                  <th>Estado</th>
                  <th>Mensaje</th>
                  <th>SQL ejecutado</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-nowrap">
                      {new Date(r.created_at).toLocaleString("es-CL")}
                    </td>
                    <td>{r.username || "-"}</td>
                    <td>
                      {r.codLocal
                        ? `${r.codLocal} — ${r.nombreLocal}`
                        : "-"}
                    </td>
                    <td>
                      {r.estado === "OK" ? (
                        <Badge bg="success">OK</Badge>
                      ) : (
                        <Badge bg="danger">ERROR</Badge>
                      )}
                    </td>
                    <td>{r.mensaje}</td>
                    <td>
                      <code style={{ whiteSpace: "pre-wrap" }}>
                        {r.sql_ejecutado}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
