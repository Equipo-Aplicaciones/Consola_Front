import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function CaracteristicasModal({ show, onClose, refresh, connection, token }) {

  const [categorias, setCategorias] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [sugerencias, setSugerencias] = useState({ categorias: [], claves: [] });

  useEffect(() => {
    if (!show) return;

    fetch(`${API_BASE_URL}/connections/caracteristicas/sugerencias`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setSugerencias({
        categorias: data.categorias || [],
        claves: data.claves || []
      }))
      .catch(() => setSugerencias({ categorias: [], claves: [] }));
  }, [show, token]);

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
    <Modal show={show} onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6">
          Características — {connection?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!modoEdicion && (
          <>
            {!hayDatosGuardados ? (
              <p className="text-muted">Sin características registradas.</p>
            ) : (
              <Row className="g-3">
                {categorias.map((cat, catIndex) => (
                  <Col key={catIndex} md={6}>
                    <div className="border rounded p-2 h-100">
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
                  </Col>
                ))}
              </Row>
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
        <datalist id="sugerencias-categorias">
          {sugerencias.categorias.map(c => <option key={c} value={c} />)}
        </datalist>
        <datalist id="sugerencias-claves">
          {sugerencias.claves.map(c => <option key={c} value={c} />)}
        </datalist>

        <p className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>
          Agrupa los datos por categoría (ej: PC1, PC2, Impresoras) — dentro de cada
          una defines los pares que necesites, sin campos fijos.
        </p>

        {categorias.map((cat, catIndex) => (
          <div key={catIndex} className="border rounded p-2 p-md-3 mb-2">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Form.Control
                size="sm"
                className="fw-bold"
                placeholder="Nombre de la categoría (ej: PC1)"
                value={cat.nombre}
                onChange={e => actualizarNombreCategoria(catIndex, e.target.value)}
                list="sugerencias-categorias"
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
              <Row key={parIndex} className="gx-2 gy-1 mb-1 align-items-center">
                <Col xs={5} md={4}>
                  <Form.Control
                    size="sm"
                    placeholder="Ej: RAM"
                    value={par.key}
                    onChange={e =>
                      actualizarPar(catIndex, parIndex, "key", e.target.value)
                    }
                    list="sugerencias-claves"
                  />
                </Col>
                <Col xs={6} md={7}>
                  <Form.Control
                    size="sm"
                    placeholder="Ej: 16GB"
                    value={par.value}
                    onChange={e =>
                      actualizarPar(catIndex, parIndex, "value", e.target.value)
                    }
                  />
                </Col>
                <Col xs={1} md={1} className="ps-0">
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
      <Modal.Footer className="py-2">
        {modoEdicion ? (
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={guardar}>
              Guardar
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
