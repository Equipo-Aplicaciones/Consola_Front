import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

export default function HorarioCategoriaModal({ categoria, opciones, seleccionados, onGuardar, onCerrar }) {
  const [marcados, setMarcados] = useState(seleccionados);

  const alternar = (id) =>
    setMarcados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal show onHide={onCerrar} centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">Horario de la categoría</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="fw-semibold mb-1">{categoria.name}</div>
        <div className="small text-muted mb-3">
          La categoría solo se muestra los días marcados. Sin ninguno marcado, se muestra todos los días.
        </div>

        <div className="row g-2">
          {opciones.map((o) => (
            <div className="col-6" key={o.id}>
              <Form.Check
                type="checkbox"
                id={`horario-${o.id}`}
                label={o.etiqueta}
                checked={marcados.includes(o.id)}
                onChange={() => alternar(o.id)}
              />
            </div>
          ))}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => onGuardar(marcados)}>
          Aplicar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
