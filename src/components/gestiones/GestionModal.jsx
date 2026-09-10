import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function GestionModal({
  show,
  onClose,
  refresh,
  token,
  empresas = []
}) {
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    version: "",
    fecha_inicio: "",
    encargado_id: ""
  });
  const [locales, setLocales] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEncargados, setLoadingEncargados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  /* =====================================================
     FECHA CHILE
  ===================================================== */

  const obtenerHoy = () => {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const valores = {};

    partes.forEach(parte => {
      valores[parte.type] = parte.value;
    });

    return (
      `${valores.year}-` +
      `${valores.month}-` +
      `${valores.day}`
    );
  };

  /* =====================================================
     LOCALES
  ===================================================== */

  const cargarLocales = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/connections`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Error cargando locales"
        );
      }

      const lista = Array.isArray(data)
        ? data
        : data.data || [];

      setLocales(
        lista
          .filter(x => x.activo !== false)
          .sort((a, b) => {
            const empresaA = Number(
              a.empresa_id || 0
            );

            const empresaB = Number(
              b.empresa_id || 0
            );

            if (empresaA !== empresaB) {
              return empresaA - empresaB;
            }

            return (
              Number(a.codLocal) -
              Number(b.codLocal)
            );
          })
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Error cargando locales"
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  /* =====================================================
     ENCARGADOS (N1, N2, Admin)
  ===================================================== */

  const cargarEncargados = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingEncargados(true);

      const res = await fetch(
        `${API_BASE_URL}/gestiones/usuarios/encargados`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Error cargando encargados"
        );
      }

      setEncargados(
        Array.isArray(data)
          ? data
          : data.data || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Error cargando encargados"
      );
    } finally {
      setLoadingEncargados(false);
    }
  }, [token]);

  /* =====================================================
     ABRIR MODAL
  ===================================================== */

  useEffect(() => {
    if (!show) return;

    setForm({
      nombre: "",
      descripcion: "",
      version: "",
      fecha_inicio: obtenerHoy(),
      encargado_id: ""
    });

    setSeleccionados([]);
    setEmpresaFiltro("");
    setSearch("");
    setShowSearch(false);
    setError("");

    cargarLocales();
    cargarEncargados();
  }, [
    show,
    cargarLocales,
    cargarEncargados
  ]);

  /* =====================================================
     FILTRO
  ===================================================== */

  const localesFiltrados = useMemo(() => {
    const texto = search
      .trim()
      .toLowerCase();

    return locales.filter(local => {
      const coincideEmpresa =
        !empresaFiltro ||
        Number(local.empresa_id) ===
        Number(empresaFiltro);

      const coincideTexto =
        !texto ||
        String(local.codLocal)
          .toLowerCase()
          .includes(texto) ||
        String(local.name || "")
          .toLowerCase()
          .includes(texto);

      return (
        coincideEmpresa &&
        coincideTexto
      );
    });
  }, [
    locales,
    search,
    empresaFiltro
  ]);

  const todosVisiblesSeleccionados =
    useMemo(() => {
      if (!localesFiltrados.length) {
        return false;
      }

      return localesFiltrados.every(
        local =>
          seleccionados.includes(
            local.id
          )
      );
    }, [
      localesFiltrados,
      seleccionados
    ]);

  /* =====================================================
     EMPRESAS SELECCIONADAS
  ===================================================== */

  const empresasSeleccionadas =
    useMemo(() => {
      const ids = new Set(
        seleccionados
      );

      return [
        ...new Set(
          locales
            .filter(
              local =>
                ids.has(local.id)
            )
            .map(
              local =>
                Number(
                  local.empresa_id
                )
            )
        )
      ];
    }, [
      locales,
      seleccionados
    ]);

  /* =====================================================
     SELECCIÓN
  ===================================================== */

  const toggleLocal = id => {
    setSeleccionados(actual => {
      if (actual.includes(id)) {
        return actual.filter(
          x => x !== id
        );
      }

      return [
        ...actual,
        id
      ];
    });
  };

  const toggleSeleccionVisibles = () => {
    const idsVisibles =
      localesFiltrados.map(
        local => local.id
      );

    if (
      todosVisiblesSeleccionados
    ) {
      const visiblesSet =
        new Set(idsVisibles);

      setSeleccionados(
        actual =>
          actual.filter(
            id =>
              !visiblesSet.has(id)
          )
      );

      return;
    }

    setSeleccionados(
      actual => [
        ...new Set([
          ...actual,
          ...idsVisibles
        ])
      ]
    );
  };

  const nombreEmpresa =
    empresaId => {
      const encontrada =
        empresas.find(
          x =>
            Number(x.id) ===
            Number(empresaId)
        );

      return (
        encontrada?.nombre ||
        `Empresa ${empresaId}`
      );
    };

  /* =====================================================
     GUARDAR
  ===================================================== */

  const guardar = async e => {
    e.preventDefault();

    if (!form.nombre.trim()) {
      setError(
        "Debe ingresar un nombre para la gestión."
      );
      return;
    }

    if (!form.encargado_id) {
      setError(
        "Debe seleccionar un encargado para la gestión."
      );
      return;
    }

    if (!seleccionados.length) {
      setError(
        "Debe seleccionar al menos un local."
      );
      return;
    }

    try {
      setGuardando(true);
      setError("");

      /* =================================================
         1. CREAR GESTIÓN
      ================================================= */

      const res = await fetch(
        `${API_BASE_URL}/gestiones`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            nombre:
              form.nombre.trim(),
            descripcion:
              form.descripcion
                .trim() ||
              null,
            version:
              form.version
                .trim() ||
              null,
            fecha_inicio:
              form.fecha_inicio,
            connection_ids:
              seleccionados
          })
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Error creando gestión"
        );
      }

      if (!data.id) {
        throw new Error(
          "La gestión fue creada, pero no se recibió su identificador."
        );
      }

      /* =================================================
         2. ASIGNAR ENCARGADO
      ================================================= */

      const resEncargado =
        await fetch(
          `${API_BASE_URL}/gestiones/${data.id}/encargado`,
          {
            method: "PUT",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              encargado_id:
                Number(
                  form.encargado_id
                )
            })
          }
        );

      const dataEncargado =
        await resEncargado.json();

      if (!resEncargado.ok) {
        throw new Error(
          dataEncargado.error ||
          "La gestión fue creada, pero no se pudo asignar el encargado."
        );
      }

      await refresh();
      onClose();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Error creando gestión"
      );
    } finally {
      setGuardando(false);
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="lg"
      centered
      scrollable
    >
      <Form onSubmit={guardar}>

        <Modal.Header closeButton>
          <Modal.Title>
            Nueva gestión
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {/* =================================================
              INFORMACIÓN GENERAL
          ================================================= */}

          <Row className="g-3">

            <Col md={6}>
              <div className="d-flex justify-content-start gap-3">
                <Form.Label>
                  Nombre
                </Form.Label>

                <Form.Control
                  value={form.nombre}
                  onChange={e =>
                    setForm({
                      ...form,
                      nombre:
                        e.target.value
                    })
                  }
                  placeholder="Ej. Actualización KDS"
                  required
                />
              </div>
            </Col>

            <Col md={6}>
              <div className="d-flex justify-content-start gap-3">
                <Form.Label>
                  Versión
                </Form.Label>

                <Form.Control
                  value={form.version}
                  onChange={e =>
                    setForm({
                      ...form,
                      version:
                        e.target.value
                    })
                  }
                  placeholder="Ej. 4.2.1"
                />
              </div>
            </Col>

            <Col md={8}>
              <div className="d-flex justify-content-start gap-3">
                <Form.Label>
                  Descripción
                </Form.Label>

                <Form.Control
                  as="textarea"
                  rows={2}
                  value={
                    form.descripcion
                  }
                  onChange={e =>
                    setForm({
                      ...form,
                      descripcion:
                        e.target.value
                    })
                  }
                />
              </div>
            </Col>

            <Col md={4}>
              <div className="d-flex justify-content-start gap-3">
                <Form.Label>
                  Inicio
                </Form.Label>

                <Form.Control
                  type="date"
                  value={
                    form.fecha_inicio
                  }
                  onChange={e =>
                    setForm({
                      ...form,
                      fecha_inicio:
                        e.target.value
                    })
                  }
                  required
                />
              </div>
            </Col>

            {/* =============================================
                ENCARGADO
            ============================================= */}

            <Col md={8}>
              <div className="d-flex align-items-center gap-3">

                <Form.Label className="mb-0 text-nowrap">
                  Encargado
                </Form.Label>

                <Form.Select
                  value={
                    form.encargado_id
                  }
                  disabled={
                    loadingEncargados
                  }
                  onChange={e =>
                    setForm({
                      ...form,
                      encargado_id:
                        e.target.value
                    })
                  }
                  required
                >
                  <option value="">
                    {loadingEncargados
                      ? "Cargando usuarios..."
                      : "Seleccione encargado"
                    }
                  </option>

                  {encargados.map(
                    usuario => (
                      <option
                        key={usuario.id}
                        value={usuario.id}
                      >
                        {usuario.full_name} ({usuario.role})
                      </option>
                    )
                  )}

                </Form.Select>

              </div>
            </Col>

          </Row>

          <hr className="m-3" />

          {/* =================================================
              SELECCIÓN DE LOCALES
          ================================================= */}

          <div className="d-flex justify-content-between align-items-center mb-2">

            <strong>
              Seleccionar Locales
            </strong>

            {empresasSeleccionadas.length >
              0 && (
              <div className="d-flex flex-wrap gap-1 align-items-center">

                <span className="small text-muted me-1">
                  Empresas:
                </span>

                {empresasSeleccionadas.map(
                  empresaId => (
                    <span
                      key={empresaId}
                      className="badge bg-light text-dark border"
                    >
                      {nombreEmpresa(
                        empresaId
                      )}
                    </span>
                  )
                )}

              </div>
            )}

            <span className="badge bg-primary">
              {seleccionados.length} Seleccionados
            </span>

          </div>

          {/* =================================================
              FILTRO EMPRESA + BUSCADOR
          ================================================= */}

          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">

            <Form.Select
              value={
                empresaFiltro
              }
              onChange={e =>
                setEmpresaFiltro(
                  e.target.value
                )
              }
              style={{
                maxWidth: "220px"
              }}
            >
              <option value="">
                Todas las empresas
              </option>

              {empresas.map(
                empresa => (
                  <option
                    key={empresa.id}
                    value={empresa.id}
                  >
                    {empresa.nombre}
                  </option>
                )
              )}
            </Form.Select>

            <button
              type="button"
              className={`btn ${
                showSearch ||
                search
                  ? "btn-primary"
                  : "btn-outline-primary"
              }`}
              title={
                showSearch
                  ? "Cerrar búsqueda"
                  : "Buscar local"
              }
              onClick={() => {
                setShowSearch(
                  actual =>
                    !actual
                );
              }}
            >
              <i className="bi bi-search" />
            </button>

            {showSearch && (
              <div
                className="input-group"
                style={{
                  maxWidth:
                    "300px"
                }}
              >
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar código o local..."
                  value={search}
                  autoFocus
                  onChange={e =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

                {search && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title="Limpiar búsqueda"
                    onClick={() =>
                      setSearch("")
                    }
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            )}

            <div className="ms-auto">

              <button
                type="button"
                className={`btn btn-sm ${
                  todosVisiblesSeleccionados
                    ? "btn-outline-secondary"
                    : "btn-outline-primary"
                }`}
                onClick={
                  toggleSeleccionVisibles
                }
                disabled={
                  !localesFiltrados.length
                }
              >
                <i
                  className={`bi ${
                    todosVisiblesSeleccionados
                      ? "bi-square"
                      : "bi-check2-square"
                  } me-1`}
                />

                {todosVisiblesSeleccionados
                  ? "Quitar todos"
                  : "Seleccionar Todos"
                }
              </button>

            </div>

          </div>

          {/* =================================================
              LISTA LOCALES
          ================================================= */}

          <div
            className="border rounded p-2"
            style={{
              maxHeight: 100,
              overflowY: "auto"
            }}
          >

            {loading ? (

              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm" />
              </div>

            ) : localesFiltrados.length ===
              0 ? (

              <div className="text-muted text-center py-3">
                No se encontraron locales.
              </div>

            ) : (

              localesFiltrados.map(
                local => (
                  <div
                    key={local.id}
                    className="form-check py-1 border-bottom"
                  >

                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`local-${local.id}`}
                      checked={
                        seleccionados.includes(
                          local.id
                        )
                      }
                      onChange={() =>
                        toggleLocal(
                          local.id
                        )
                      }
                    />

                    <label
                      className="form-check-label w-100"
                      htmlFor={`local-${local.id}`}
                    >

                      <div className="d-flex justify-content-between align-items-center gap-2">

                        <span>
                          <strong>
                            {local.codLocal}
                          </strong>
                          {" - "}
                          {local.name}
                        </span>

                        <span className="badge bg-light text-dark border">
                          {nombreEmpresa(
                            local.empresa_id
                          )}
                        </span>

                      </div>

                    </label>

                  </div>
                )
              )
            )}

          </div>

        </Modal.Body>

        <Modal.Footer>

          <Button
            variant="secondary"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={
              guardando ||
              loadingEncargados
            }
          >
            {guardando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Guardando...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2" />
                Crear gestión
              </>
            )}
          </Button>

        </Modal.Footer>

      </Form>
    </Modal>
  );
}