import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function CaracteristicasModal({ show, onClose, refresh, connection, token }) {

  const [categorias, setCategorias] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);

  useEffect(() => {
    if (!show) return;

    const data = connection?.caracteristicas || {};

    const iniciales = Object.entries(data).map(([nombre, valores]) => ({
      nombre,
      pares: Object.entries(valores || {}).map(([key, value]) => ({
        key,
        value: String(value ?? "")
      }))
    }));

    setCategorias(
      iniciales.length
        ? iniciales
        : [{ nombre: "", pares: [{ key: "", value: "" }] }]
    );

    setModoEdicion(false);
  }, [show, connection]);

  const hayDatosGuardados = Object.keys(connection?.caracteristicas || {}).length > 0;

  function iniciarEdicion(conCategoriaNueva) {
    setModoEdicion(true);
    if (conCategoriaNueva) {
      agregarCategoria();
    }
  }

  function actualizarNombreCategoria(catIndex, nombre) {
    setCategorias(prev =>
      prev.map((cat, i) => (i === catIndex ? { ...cat, nombre } : cat))
    );
  }

  function agregarCategoria() {
    setCategorias(prev => [
      ...prev,
      { nombre: "", pares: [{ key: "", value: "" }] }
    ]);
  }

  function eliminarCategoria(catIndex) {
    setCategorias(prev => prev.filter((_, i) => i !== catIndex));
  }

  function actualizarPar(catIndex, parIndex, campo, valor) {
    setCategorias(prev =>
      prev.map((cat, i) =>
        i === catIndex
          ? {
              ...cat,
              pares: cat.pares.map((par, j) =>
                j === parIndex ? { ...par, [campo]: valor } : par
              )
            }
          : cat
      )
    );
  }

  function agregarPar(catIndex) {
    setCategorias(prev =>
      prev.map((cat, i) =>
        i === catIndex
          ? { ...cat, pares: [...cat.pares, { key: "", value: "" }] }
          : cat
      )
    );
  }

  function eliminarPar(catIndex, parIndex) {
    setCategorias(prev =>
      prev.map((cat, i) =>
        i === catIndex
          ? { ...cat, pares: cat.pares.filter((_, j) => j !== parIndex) }
          : cat
      )
    );
  }

  async function guardar() {
    const caracteristicas = {};

    for (const cat of categorias) {
      const nombre = cat.nombre.trim();
      if (!nombre) continue;

      const valores = {};
      for (const par of cat.pares) {
        const key = par.key.trim();
        if (key) {
          valores[key] = par.value;
        }
      }

      caracteristicas[nombre] = valores;
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
        {!modoEdicion && (
          <>
            {!hayDatosGuardados ? (
              <p className="text-muted">Sin características registradas.</p>
            ) : (
              categorias.map((cat, catIndex) => (
                <div key={catIndex} className="mb-3">
                  <div className="fw-bold mb-1">{cat.nombre}</div>
                  {cat.pares.filter(p => p.key.trim()).length === 0 ? (
                    <div className="text-muted small">Sin datos.</div>
                  ) : (
                    <ul className="list-unstyled mb-0 ps-3">
                      {cat.pares
                        .filter(p => p.key.trim())
                        .map((p, parIndex) => (
                          <li key={parIndex}>
                            <strong>{p.key}:</strong> {p.value}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))
            )}

            <div className="d-flex gap-2 mt-3">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => iniciarEdicion(true)}
              >
                ➕ Agregar categoría
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => iniciarEdicion(false)}
              >
                ✏️ Editar
              </Button>
            </div>
          </>
        )}

        {modoEdicion && (
        <>
        <p className="text-muted small">
          Agrupa los datos por categoría (ej: PC1, PC2, Impresoras) — dentro de cada
          una defines los pares que necesites, sin campos fijos.
        </p>

        {categorias.map((cat, catIndex) => (
          <div key={catIndex} className="border rounded p-3 mb-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Form.Control
                className="fw-bold"
                placeholder="Nombre de la categoría (ej: PC1)"
                value={cat.nombre}
                onChange={e => actualizarNombreCategoria(catIndex, e.target.value)}
              />
              <Button
                variant="link"
                className="text-danger p-0"
                title="Eliminar categoría"
                onClick={() => eliminarCategoria(catIndex)}
              >
                <i className="bi bi-trash"></i>
              </Button>
            </div>

            {cat.pares.map((par, parIndex) => (
              <Row key={parIndex} className="g-2 mb-2 align-items-center">
                <Col md={4}>
                  <Form.Control
                    placeholder="Ej: RAM"
                    value={par.key}
                    onChange={e =>
                      actualizarPar(catIndex, parIndex, "key", e.target.value)
                    }
                  />
                </Col>
                <Col md={7}>
                  <Form.Control
                    placeholder="Ej: 16GB"
                    value={par.value}
                    onChange={e =>
                      actualizarPar(catIndex, parIndex, "value", e.target.value)
                    }
                  />
                </Col>
                <Col md={1}>
                  <Button
                    variant="link"
                    className="text-danger p-0"
                    title="Eliminar"
                    onClick={() => eliminarPar(catIndex, parIndex)}
                  >
                    <i className="bi bi-x-lg"></i>
                  </Button>
                </Col>
              </Row>
            ))}

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => agregarPar(catIndex)}
            >
              ➕ Agregar dato
            </Button>
          </div>
        ))}

        <Button variant="outline-primary" size="sm" onClick={agregarCategoria}>
          ➕ Agregar categoría
        </Button>
        </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {modoEdicion ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar}>
              Guardar
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
