import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

export default function ExportarVersionModal({
  cantidadCambios,
  cantidadImagenes,
  nombreArchivo,
  guardando,
  error,
  onConfirmar,
  onExportarSinGuardar,
  onCerrar
}) {
  const [descripcion, setDescripcion] = useState("");
  const lista = descripcion.trim();

  return (
    <Modal show onHide={onCerrar} centered>
      <Modal.Header closeButton={!guardando}>
        <Modal.Title className="fs-5">Exportar y guardar en el historial</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="small text-muted mb-3">
          Se guardará una copia del JSON editado (<b>{nombreArchivo}</b>) en el historial y luego se
          descargará. Cambios: <b>{cantidadCambios}</b> · Imágenes nuevas: <b>{cantidadImagenes}</b>
          {cantidadImagenes > 0 ? " (el .zip de imágenes solo se descarga, no se guarda)" : ""}.
        </p>

        <Form.Group>
          <Form.Label className="fw-semibold">Descripción de los cambios</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            autoFocus
            maxLength={2000}
            placeholder="Ej: Se reordenaron los combos y se actualizó el precio de las alitas"
            value={descripcion}
            disabled={guardando}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Form.Group>

        {error && (
          <div className="alert alert-danger py-2 small mt-3 mb-0">
            {error}. Puedes reintentar o exportar sin guardar en el historial.
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {error && (
          <Button variant="outline-secondary" className="me-auto" onClick={onExportarSinGuardar}>
            Exportar sin guardar
          </Button>
        )}
        <Button variant="secondary" disabled={guardando} onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="primary" disabled={guardando || !lista} onClick={() => onConfirmar(lista)}>
          {guardando ? "Guardando..." : "Guardar y exportar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
