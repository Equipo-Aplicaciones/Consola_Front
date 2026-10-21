import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

export default function HorarioCategoriaModal({ categoria, opciones, onGuardar, onCerrar }) {
  const [dias, setDias] = useState(opciones.seleccion.dias);
  const [especiales, setEspeciales] = useState(opciones.seleccion.especiales);

  // Un horario especial reemplaza a los días y viceversa: la categoría queda con una sola referencia.
  const alternarDia = (id) => {
    setEspeciales([]);
    setDias((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const alternarEspecial = (id) => {
    setDias([]);
    setEspeciales((prev) => (prev.includes(id) ? [] : [id]));
  };

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
          {opciones.dias.map((d) => (
            <div className="col-6" key={d.id}>
              <Form.Check
                type="checkbox"
                id={`horario-${d.id}`}
                label={d.etiqueta}
                checked={dias.includes(d.id)}
                onChange={() => alternarDia(d.id)}
              />
            </div>
          ))}
        </div>

        {opciones.especiales.length > 0 && (
          <>
            <hr />
            <div className="small text-muted mb-2">Horarios especiales (reemplazan a los días)</div>
            <div className="row g-2">
              {opciones.especiales.map((e) => (
                <div className="col-6" key={e.id}>
                  <Form.Check
                    type="checkbox"
                    id={`horario-${e.id}`}
                    label={e.etiqueta}
                    checked={especiales.includes(e.id)}
                    onChange={() => alternarEspecial(e.id)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => onGuardar({ dias, especiales })}>
          Aplicar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
