import { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function SavedQueryModal({ show, onClose, refresh, query, token }) {

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    sql_text: "",
    activo: true,
    roles_ejecutan: []
  });

  useEffect(() => {
    if (!show) return;

    setForm({
      nombre: query?.nombre ?? "",
      descripcion: query?.descripcion ?? "",
      sql_text: query?.sql_text ?? "",
      activo: query?.activo ?? true,
      roles_ejecutan: query?.roles_ejecutan ?? []
    });
  }, [show, query]);

  function alternarRol(rol) {
    setForm(prev => ({
      ...prev,
      roles_ejecutan: prev.roles_ejecutan.includes(rol)
        ? prev.roles_ejecutan.filter(r => r !== rol)
        : [...prev.roles_ejecutan, rol]
    }));
  }

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

        <Form.Group className="mt-3">
          <Form.Label className="mb-1 fw-semibold">Quién puede ejecutarla</Form.Label>
          <div className="d-flex flex-wrap gap-3">
            {["N1", "N2"].map(rol => (
              <Form.Check
                key={rol}
                type="checkbox"
                id={`rol-ejecuta-${rol}`}
                label={rol}
                checked={form.roles_ejecutan.includes(rol)}
                onChange={() => alternarRol(rol)}
              />
            ))}
          </div>
          <Form.Text className="text-muted">
            Aparece en el Panel de Gestión de quienes marques. Admin siempre puede ejecutarla; sin selección, solo Admin.
          </Form.Text>
        </Form.Group>
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
