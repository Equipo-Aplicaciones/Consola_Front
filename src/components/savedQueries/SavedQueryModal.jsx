import { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function SavedQueryModal({ show, onClose, refresh, query, token }) {

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    sql_text: "",
    activo: true
  });

  useEffect(() => {
    if (!show) return;

    setForm({
      nombre: query?.nombre ?? "",
      descripcion: query?.descripcion ?? "",
      sql_text: query?.sql_text ?? "",
      activo: query?.activo ?? true
    });
  }, [show, query]);

  function onChange(e) {
    const { name, value, checked, type } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.sql_text.trim()) {
      alert("Nombre y SQL son requeridos.");
      return;
    }

    try {
      const url = query
        ? `${API_BASE_URL}/saved-queries/${query.id}`
        : `${API_BASE_URL}/saved-queries`;

      const method = query ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        throw new Error("Error guardando");
      }

      refresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert("No fue posible guardar.");
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {query ? "Editar query" : "Nueva query"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Control
            name="nombre"
            value={form.nombre}
            onChange={onChange}
            placeholder="Nombre de la query"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Control
            as="textarea"
            rows={2}
            name="descripcion"
            value={form.descripcion}
            onChange={onChange}
            placeholder="Descripción / para qué caso sirve"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="mb-1">
            SQL (SELECT, UPDATE o DELETE)
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={8}
            className="font-monospace"
            name="sql_text"
            value={form.sql_text}
            onChange={onChange}
            placeholder="SELECT * FROM articulo WHERE codigo = '...'"
          />
        </Form.Group>

        <Form.Check
          label="Activa"
          name="activo"
          checked={form.activo}
          onChange={onChange}
          title="Solo las queries activas aparecen para ejecutar desde Gestión de Conexiones"
        />
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
