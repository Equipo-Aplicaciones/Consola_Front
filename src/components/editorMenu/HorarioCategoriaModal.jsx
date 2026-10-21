import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

const DIAS = {
  MONDAY: "Lun",
  TUESDAY: "Mar",
  WEDNESDAY: "Mié",
  THURSDAY: "Jue",
  FRIDAY: "Vie",
  SATURDAY: "Sáb",
  SUNDAY: "Dom"
};

const hora = (valor) => String(valor || "").slice(0, 5);

export const descripcionHorario = (horario) => {
  const dias = horario.days.map((d) => DIAS[d] ?? d).join(", ") || "sin días";
  const franja = horario.start || horario.end ? ` · ${hora(horario.start)}–${hora(horario.end)}` : "";

  return `${dias}${franja}`;
};

export default function HorarioCategoriaModal({ categoria, horarios, seleccionados, onGuardar, onCerrar }) {
  const [marcados, setMarcados] = useState(seleccionados);

  const desconocidos = seleccionados
    .filter((id) => !horarios.some((h) => h.id === id))
    .map((id) => ({ id, days: [], start: "", end: "", desconocido: true }));
  const opciones = [...horarios, ...desconocidos];

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
          La categoría solo se muestra en los horarios marcados. Sin ninguno marcado, se muestra todos los días.
        </div>

        {opciones.length === 0 && (
          <div className="text-muted">Este menú no tiene horarios definidos.</div>
        )}

        {opciones.map((h) => (
          <Form.Check
            key={h.id}
            type="checkbox"
            id={`horario-${h.id}`}
            className="mb-2"
            checked={marcados.includes(h.id)}
            onChange={() => alternar(h.id)}
            label={
              <>
                <b>{h.id}</b>
                <span className="text-muted small ms-2">
                  {h.desconocido ? "(no está definido en el menú)" : descripcionHorario(h)}
                </span>
              </>
            }
          />
        ))}
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
