import { Modal, Button } from "react-bootstrap";

// Nombre con el que se guarda el archivo: el original, siempre con extensión .pdf
function nombreDescarga(visor) {
  const nombre = String(visor?.archivo || visor?.nombre || "documento").trim() || "documento";
  return /\.pdf$/i.test(nombre) ? nombre : `${nombre}.pdf`;
}

/**
 * Visor de PDF en una ventana. `visor` es { nombre, archivo, url }: `nombre` es el título que se
 * muestra, `archivo` el nombre original del archivo y `url` el blob del PDF.
 *
 * El PDF se muestra desde un blob; el botón de descarga del visor del navegador guarda ese blob con
 * un nombre interno aleatorio, que una página no puede cambiar. Por eso se ofrece "Descargar", que
 * guarda con el nombre real del archivo.
 */
export default function VisorPdf({ visor, onClose }) {
  return (
    <Modal show={Boolean(visor)} onHide={onClose} size="xl" centered scrollable>
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
          <>
            <span className="small text-muted me-auto">
              Para guardarlo con su nombre use «Descargar»; el ícono de descarga del visor usa un nombre interno.
            </span>

            <a className="btn btn-sm btn-primary" href={visor.url} download={nombreDescarga(visor)}>
              <i className="bi bi-download me-1" />
              Descargar
            </a>

            <a className="btn btn-sm btn-outline-secondary" href={visor.url} target="_blank" rel="noreferrer">
              <i className="bi bi-box-arrow-up-right me-1" />
              Abrir en pestaña nueva
            </a>
          </>
        )}

        <Button size="sm" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
