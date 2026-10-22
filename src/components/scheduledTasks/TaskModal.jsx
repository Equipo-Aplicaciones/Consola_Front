import { useCallback, useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

const dias = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" }
];

const tiposAccion = [
  { value: "TOGGLE_ARTICULO", label: "Activar/Desactivar artículos" },
  { value: "VACIAR_TABLA", label: "Vaciar tabla" },
  { value: "OTRO", label: "Otros (gestionado por otro proceso)" }
];

// Debe reflejar CAMPOS_TOGGLE_PERMITIDOS en src/services/scheduledTaskRunner.js
const camposToggle = [
  { value: "invisibl", label: "Visible en POS (invisibl)" },
  { value: "web", label: "Visible en Web (web)" }
];

// Debe reflejar TABLAS_VACIABLES en src/services/scheduledTaskRunner.js
const tablasVaciables = [
  { value: "comandae", label: "comandae" }
];

export default function TaskModal({show,onClose,refresh,task,token}) {

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
    visible: true,
    requiere_confirmacion: false,
    dia_activar: "",
    dia_desactivar: "",
    omitir_proxima_desactivacion: false,
    tipo_accion: "",
    campo_objetivo: "invisibl",
    tabla_objetivo: ""
  });
  const [nuevoArticulo, setNuevoArticulo] = useState("");
  const [articulos, setArticulos] = useState([]);
  const [automatico, setAutomatico] = useState(false);
  const [empresasDisponibles, setEmpresasDisponibles] = useState([]);
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState([]);

  useEffect(() => {
    async function cargarEmpresas() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/scheduled-tasks/empresas-disponibles`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const data = await res.json();
        if (res.ok) {
          setEmpresasDisponibles(data);
        }
      } catch (err) {
        console.error("Error cargando empresas:", err);
      }
    }

    cargarEmpresas();
  }, [token]);

  function toggleEmpresa(empresaId) {
    setEmpresasSeleccionadas(prev =>
      prev.includes(empresaId)
        ? prev.filter(id => id !== empresaId)
        : [...prev, empresaId]
    );
  }

  const cargarTask = useCallback(async (id) => {
    try {
      const res = await fetch( `${API_BASE_URL}/scheduled-tasks/tarea/${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Error cargando la tarea"
        );
      }

      setForm({
        nombre: data.nombre,
        descripcion: data.descripcion ?? "",
        activo: data.activo,
        visible: data.visible,
        requiere_confirmacion: data.requiere_confirmacion,
        dia_activar: data.dia_activar ?? "",
        dia_desactivar: data.dia_desactivar ?? "",
        omitir_proxima_desactivacion:
          data.omitir_proxima_desactivacion,
        tipo_accion: data.tipo_accion || "TOGGLE_ARTICULO",
        campo_objetivo: data.campo_objetivo || "invisibl",
        tabla_objetivo: data.tabla_objetivo ?? ""
      });

      setAutomatico(!!data.dia_activar);

      setEmpresasSeleccionadas(data.empresas ?? []);

      setArticulos(
        data.articulos?.length
          ? data.articulos.map(x => x.codigo_articulo)
          : []
      );

    } catch (err) {
      console.error("Error cargando tarea:", err);
    }
  }, [token]);


  /* CARGAR / LIMPIAR MODAL */

  useEffect(() => {
    if (!show) return;

    if (task) {
      cargarTask(task.id);
      return;
    }

    setForm({
      nombre: "",
      descripcion: "",
      activo: true,
      visible: true,
      requiere_confirmacion: false,
      dia_activar: "",
      dia_desactivar: "",
      omitir_proxima_desactivacion: false,
      tipo_accion: "",
      campo_objetivo: "invisibl",
      tabla_objetivo: ""
    });

    setArticulos([]);
    setAutomatico(false);
    setEmpresasSeleccionadas([]);

  }, [show, task, cargarTask]);

  function onChange(e) {

    const { name, value, checked, type } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox"
        ? checked
        : value
    }));

  }

  /*function cambiarArticulo(index, value) {

    const copia = [...articulos];

    copia[index] = value;

    setArticulos(copia);

  }*/

function agregarArticulo() {

  const codigo = nuevoArticulo.trim();

  if (!codigo) return;

  if (!/^\d+$/.test(codigo)) {
    alert("Ingrese un código de artículo válido.");
    return;
  }

  if (articulos.includes(codigo)) {
    alert("El artículo ya fue agregado.");
    return;
  }

  setArticulos(prev => [...prev, codigo]);
  setNuevoArticulo("");

}

  function eliminarArticulo(index) {

    setArticulos(prev =>
      prev.filter((_, i) => i !== index)
    );

  }

  async function guardar() {

    if (!form.tipo_accion) {
      alert("Seleccione un tipo de tarea.");
      return;
    }

    const esOtro = form.tipo_accion === "OTRO";

    if (!esOtro && !empresasSeleccionadas.length) {
      alert("Seleccione al menos una empresa.");
      return;
    }

    try {

      const esVaciarTabla = form.tipo_accion === "VACIAR_TABLA";

      const payload = {
        ...form,
        empresas: esOtro ? [] : empresasSeleccionadas,
        dia_activar:
          esVaciarTabla && !automatico
            ? null
            : (esOtro || form.dia_activar === "" ? null : Number(form.dia_activar)),
        dia_desactivar: esVaciarTabla || esOtro
          ? null
          : (form.dia_desactivar === "" ? null : Number(form.dia_desactivar)),
        articulos: esVaciarTabla || esOtro
          ? []
          : articulos.filter(x => x !== "")
      };

      const url = task
        ? `${API_BASE_URL}/scheduled-tasks/${task.id}`
        : `${API_BASE_URL}/scheduled-tasks`;

      const method = task
        ? "PUT"
        : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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

    <Modal show={show} onHide={onClose} size="lg" centered >
      <Modal.Header closeButton>
        <Modal.Title>
          {task ? "Editar tarea" : "Nueva tarea"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={8}>
            <Form.Group className="mb-3">
              <Form.Control name="nombre" value={form.nombre} onChange={onChange} placeholder="Nombre de la Tarea"/>
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Select name="tipo_accion" value={form.tipo_accion} onChange={onChange} >
                <option value="">
                  Tipo de tarea
                </option>
                {tiposAccion.map(t => (
                  <option key={t.value} value={t.value} >
                    {t.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <Form.Group className="mb-3">
          <Form.Control as="textarea" rows={2} name="descripcion" value={form.descripcion}
            onChange={onChange} placeholder="Descripción"/>
        </Form.Group>

        {form.tipo_accion !== "OTRO" && (
          <Form.Group className="mb-3 d-flex align-items-center">
            <Form.Label className="me-2 mb-0">
              Empresas
            </Form.Label>
            {empresasDisponibles.map(empresa => (
              <Form.Check
                key={empresa.id}
                inline
                className="mb-0"
                label={empresa.nombre}
                checked={empresasSeleccionadas.includes(empresa.id)}
                onChange={() => toggleEmpresa(empresa.id)}
              />
            ))}
          </Form.Group>
        )}

        {form.tipo_accion === "OTRO" && (
          <div className="text-muted small mb-3">
            Esta tarea se ejecuta mediante su propio proceso (cron aparte). Este
            módulo solo muestra su estado, no permite configurarla ni ejecutarla.
          </div>
        )}

        <hr />

        {form.tipo_accion === "TOGGLE_ARTICULO" && (
          <>
            <Row>
              <Col md={4} className="d-flex align-items-center">
                <Form.Label className="me-2">
                  Activar
                </Form.Label>
                <Form.Select name="dia_activar" value={form.dia_activar} onChange={onChange} >
                  <option value="">
                    Seleccione Día
                  </option>
                  {dias.map(d => (
                    <option key={d.value} value={d.value} >
                      {d.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4} className="d-flex align-items-center">
                <Form.Label className="me-2">
                  Desactivar
                </Form.Label>
                <Form.Select name="dia_desactivar" value={form.dia_desactivar} onChange={onChange} >
                  <option value="">
                    Seleccione Día
                  </option>
                  {dias.map(d => (
                    <option key={d.value} value={d.value} >
                      {d.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4} className="d-flex flex-column justify-content-center">
                <Form.Check className="text-nowrap" label="Producto Visible" name="visible" checked={form.visible}
                  onChange={onChange} title="Marque si quiere que el producto sea visible en el local" />

                <Form.Check className="text-nowrap" label="Requiere confirmación" name="requiere_confirmacion" checked={form.requiere_confirmacion}
                  onChange={onChange} title="Tarea no se ejecuta automaticamente, requiere ejecución manual"
                />
              </Col>
            </Row>

            <hr />

            <Form.Group className="mb-3">
              <Form.Label className="me-2 mb-0">
                Campo a modificar
              </Form.Label>
              <Form.Select name="campo_objetivo" value={form.campo_objetivo} onChange={onChange} >
                {camposToggle.map(c => (
                  <option key={c.value} value={c.value} >
                    {c.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <hr />
            <Row className="align-items-center mb-3">

              <Col xs="auto">
                <Form.Label className="mb-0">
                  Artículo
                </Form.Label>
              </Col>

              <Col xs="auto">
                <Form.Control
                  style={{ width: "140px" }}
                  value={nuevoArticulo}
                  placeholder="Código"
                  onChange={(e) => setNuevoArticulo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarArticulo();
                    }
                  }}
                />
              </Col>
                <Col xs="auto">
                  <Button onClick={agregarArticulo}>
                    <i className="bi bi-plus-lg"></i>
                  </Button>
                </Col>
            </Row>

            <div className="d-flex flex-wrap gap-2 mb-2">
              {articulos.map((codigo, index) => (
                <div key={index} className="badge bg-primary d-flex align-items-center px-3 py-2"
                style={{ fontSize: "0.95rem" }} >
                  <span>{codigo}</span>
                  <Button variant="link" className="text-white p-0 ms-2"
                    style={{ textDecoration: "none", fontSize: "1rem", lineHeight: 1 }}
                    onClick={() => eliminarArticulo(index)} >
                    <i className="bi bi-x-lg"></i>
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {form.tipo_accion === "VACIAR_TABLA" && (
          <>
            <Form.Group className="mb-3">
              <Form.Label className="me-2 mb-0">
                Tabla a vaciar
              </Form.Label>
              <Form.Select name="tabla_objetivo" value={form.tabla_objetivo} onChange={onChange} >
                <option value="">
                  Seleccione tabla
                </option>
                {tablasVaciables.map(t => (
                  <option key={t.value} value={t.value} >
                    {t.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Check
              label="Ejecutar automáticamente"
              checked={automatico}
              onChange={(e) => setAutomatico(e.target.checked)}
              title="Si no se marca, la tarea solo se ejecuta con el botón Ejecutar"
            />

            {automatico && (
              <Row className="mt-2">
                <Col md={4} className="d-flex align-items-center">
                  <Form.Label className="me-2">
                    Día de ejecución
                  </Form.Label>
                  <Form.Select name="dia_activar" value={form.dia_activar} onChange={onChange} >
                    <option value="">
                      Seleccione Día
                    </option>
                    {dias.map(d => (
                      <option key={d.value} value={d.value} >
                        {d.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            )}
          </>
        )}

      </Modal.Body>
      <Modal.Footer>

        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>

        <Button onClick={guardar} >
          Guardar
        </Button>

      </Modal.Footer>
    </Modal>
  );
}