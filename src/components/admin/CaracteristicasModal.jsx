import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function CaracteristicasModal({ show, onClose, refresh, connection, token }) {

  const [pares, setPares] = useState([]);

  useEffect(() => {
    if (!show) return;

    const caracteristicas = connection?.caracteristicas || {};

    const iniciales = Object.entries(caracteristicas).map(([key, value]) => ({
      key,
      value: String(value ?? "")
    }));

    setPares(iniciales.length ? iniciales : [{ key: "", value: "" }]);
  }, [show, connection]);

  function actualizarPar(index, campo, valor) {
    setPares(prev =>
      prev.map((par, i) => (i === index ? { ...par, [campo]: valor } : par))
    );
  }

  function agregarPar() {
    setPares(prev => [...prev, { key: "", value: "" }]);
  }

  function eliminarPar(index) {
    setPares(prev => prev.filter((_, i) => i !== index));
  }

  async function guardar() {
    const caracteristicas = {};

    for (const par of pares) {
      const key = par.key.trim();
      if (key) {
        caracteristicas[key] = par.value;
      }
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/connections/${connection.id}/caracteristicas`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ caracteristicas })
        }
      );

      if (!res.ok) {
        throw new Error("Error guardando");
      }

      refresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert("No fue posible guardar las características.");
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Características — {connection?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Agrega los datos que necesites (RAM, disco, tarjeta de video, etc.) — no hay
          campos fijos, defines el nombre de cada uno.
        </p>

        {pares.map((par, index) => (
          <Row key={index} className="g-2 mb-2 align-items-center">
            <Col md={4}>
              <Form.Control
                placeholder="Ej: RAM"
                value={par.key}
                onChange={e => actualizarPar(index, "key", e.target.value)}
              />
            </Col>
            <Col md={7}>
              <Form.Control
                placeholder="Ej: 16GB"
                value={par.value}
                onChange={e => actualizarPar(index, "value", e.target.value)}
              />
            </Col>
            <Col md={1}>
              <Button
                variant="link"
                className="text-danger p-0"
                title="Eliminar"
                onClick={() => eliminarPar(index)}
              >
                <i className="bi bi-x-lg"></i>
              </Button>
            </Col>
          </Row>
        ))}

        <Button variant="outline-secondary" size="sm" onClick={agregarPar}>
          ➕ Agregar característica
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={guardar}>
          Guardar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
