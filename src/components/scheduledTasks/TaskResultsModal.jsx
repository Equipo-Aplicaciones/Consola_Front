import { useEffect, useState } from "react";
import { Modal, Table, Badge, Spinner, Alert, Button } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function TaskResultsModal({ show,onClose,task,token }) {
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [soloErrores, setSoloErrores] = useState(false);

  useEffect(() => {
    if (!show || !task) return;
    setSoloErrores(false);
    cargarResultados();
  }, [show, task]);

  async function cargarResultados() {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/scheduled-tasks/${task.id}/results`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        throw new Error("Error cargando resultados");
      }

      const data = await res.json();
      setResultados(data);
    } catch (err) {
      console.error(err);
      setResultados([]);
    } finally {
      setLoading(false);
    }

  }

  const ok = resultados.filter(r => r.estado === "OK").length;
  const error = resultados.filter(r => r.estado !== "OK").length;
  const visibles = soloErrores
    ? resultados.filter(r => r.estado !== "OK")
    : resultados;

  return (

    <Modal show={show} onHide={onClose} size="xl" centered >
      <Modal.Header closeButton>
        <Modal.Title>
          Resultado de la tarea
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {task && (
          <Alert variant="light">
            <strong>Tarea:</strong> {task.nombre}
            <br />
            <strong>Última ejecución:</strong>{" "}
            {task.ultima_ejecucion || "Sin ejecutar"}

          </Alert>

        )}

        <div className="mb-3">

          <Badge bg="success" className="me-2"> OK: {ok} </Badge>
          <Badge
            as="button"
            type="button"
            bg="danger"
            disabled={error === 0}
            title={
              soloErrores
                ? "Clic para volver a mostrar todos los locales"
                : "Clic para ver solo los locales con error"
            }
            onClick={() => setSoloErrores(v => !v)}
            style={{
              border: 0,
              cursor: error === 0 ? "default" : "pointer",
              boxShadow: soloErrores ? "0 0 0 3px rgba(220, 53, 69, 0.35)" : "none"
            }}
          >
            Error: {error}
          </Badge>

          {soloErrores && (
            <span className="ms-2 small text-muted">
              Mostrando solo los locales con error. Haz clic en Error para ver todos.
            </span>
          )}

        </div>

        {loading ? (
          <div className="text-center py-5"> <Spinner animation="border" /> </div>
          ) : resultados.length === 0 ? (
          <Alert variant="warning">
            No existen resultados para mostrar.
          </Alert>
        ) : (
          <div style={{ minHeight: 200, overflowY: "auto",maxHeight: 300 }}>
            <Table striped bordered hover responsive >
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Mensaje</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r, index) => (
                  <tr key={index}>
                    <td>{r.codLocal}</td>
                    <td>{r.nombre}</td>
                    <td>
                      {r.estado === "OK" ? (
                        <Badge bg="success"> OK </Badge>
                      ) : (
                        <Badge bg="danger"> ERROR </Badge>
                      )}
                    </td>
                    <td>{r.mensaje}</td>
                    <td> {new Date(r.created_at).toLocaleString("es-CL")} </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} > Cerrar </Button>
      </Modal.Footer>
    </Modal>
  );

}