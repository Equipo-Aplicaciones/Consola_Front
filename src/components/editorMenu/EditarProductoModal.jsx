import { useRef, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import Miniatura from "./Miniatura";
import { safeFile } from "./core";

export default function EditarProductoModal({
  producto,
  categorias,
  imagenNueva,
  nota,
  onGuardar,
  onCerrar,
  onImagen,
  onQuitarImagen
}) {
  const [desc, setDesc] = useState(producto.desc);
  const [precio, setPrecio] = useState(String(producto.price));
  const [categoria, setCategoria] = useState(producto.catId);
  const [orden, setOrden] = useState(producto.order ?? "");
  const inputImagen = useRef(null);

  const guardar = () => onGuardar({ desc, precio, categoria, orden });

  return (
    <Modal show onHide={onCerrar} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">{producto.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="editor-menu">
        <div className="em-dlg-top mb-3">
          <Miniatura imagenNueva={imagenNueva} url={producto.image} tamano="lg" />

          <div>
            <div className="small text-muted text-break">
              UUID / SKU: <b>{producto.uid}</b>
            </div>
            <div className="small text-muted text-break mt-1">
              Imagen actual:{" "}
              {producto.image ? (
                <a href={producto.image} target="_blank" rel="noreferrer">
                  {producto.image}
                </a>
              ) : (
                "sin imagen"
              )}
            </div>

            <div className="d-flex gap-2 flex-wrap mt-2">
              <input
                ref={inputImagen}
                type="file"
                accept="image/*"
                className="d-none"
                onChange={(e) => {
                  const archivo = e.target.files[0];
                  e.target.value = "";
                  if (archivo) onImagen(archivo);
                }}
              />
              <Button size="sm" variant="outline-secondary" onClick={() => inputImagen.current.click()}>
                Cambiar imagen
              </Button>
              {imagenNueva && (
                <Button size="sm" variant="outline-secondary" onClick={onQuitarImagen}>
                  Quitar imagen nueva
                </Button>
              )}
            </div>

            {imagenNueva && (
              <div className="small text-warning-emphasis mt-2">
                Nueva: {imagenNueva.src} → <b>{safeFile(producto.uid)}.jpg</b>
                {imagenNueva.warn.map((w) => (
                  <div key={w}>⚠ {w}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Form.Group className="mb-2">
          <Form.Label className="small fw-semibold">Descripción</Form.Label>
          <Form.Control as="textarea" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Form.Group>

        <div className="row g-2">
          <div className="col-12 col-md-4">
            <Form.Label className="small fw-semibold">Precio ($)</Form.Label>
            <Form.Control
              type="number"
              step="1"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <Form.Label className="small fw-semibold">Categoría</Form.Label>
            <Form.Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-12 col-md-4">
            <Form.Label className="small fw-semibold">Orden</Form.Label>
            <Form.Control
              type="number"
              step="1"
              min="1"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            />
          </div>
        </div>

        {nota && <div className="small text-warning-emphasis mt-2">{nota}</div>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
        <Button variant="primary" onClick={guardar}>
          Guardar cambios
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
