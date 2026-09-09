import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Badge, Table } from "react-bootstrap";
import { API_BASE_URL } from "../../config";

export default function GestionDetalleModal({ show, onClose, gestionId, token, refresh }) {
  const [gestion, setGestion] = useState(null);
  const [estadosLocales, setEstadosLocales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardandoLocal, setGuardandoLocal] = useState(null);
  const [accionando, setAccionando] = useState(false);
  const [error, setError] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [estadoMasivo, setEstadoMasivo] = useState("");
  const [comentarioMasivo, setComentarioMasivo] = useState("");
  const [guardandoMasivo, setGuardandoMasivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showSuspender, setShowSuspender] = useState(false);

  const user = JSON.parse(localStorage.getItem("authUser") || "{}");
  const role = user.role;
  const puedeAdministrarGestion = role === "Admin" || role === "N2";

  const cargarEstados = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/estados?grupo=GESTION_LOCAL`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando estados");
      }

      setEstadosLocales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const cargarGestion = useCallback(async () => {
    if (!gestionId || !token) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/gestiones/${gestionId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando gestión");
      }

      setGestion(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando gestión");
    } finally {
      setLoading(false);
    }
  }, [gestionId, token]);

  useEffect(() => {
    if (!show) return;

    setGestion(null);
    setError("");
    setMotivo("");
    setShowSuspender(false);
    setFiltroEstado("");
    setSeleccionados([]);
    setEstadoMasivo("");
    setComentarioMasivo("");
    cargarEstados();
    cargarGestion();
  }, [show, cargarEstados, cargarGestion]);

  const resumen = useMemo(() => {
    const locales = gestion?.locales || [];

    return {
      total: locales.length,
      terminado: locales.filter(x => x.estado_codigo === "TERMINADO").length,
      pendiente: locales.filter(x => x.estado_codigo === "PENDIENTE").length,
      noAplicado: locales.filter(x => x.estado_codigo === "NO_APLICADO").length,
      noAplica: locales.filter(x => x.estado_codigo === "NO_APLICA").length
    };
  }, [gestion]);

  const porcentaje = useMemo(() => {
    if (!resumen.total) return 0;

    const resueltos =
      resumen.terminado +
      resumen.noAplicado +
      resumen.noAplica;

    return Math.round((resueltos / resumen.total) * 100);
  }, [resumen]);

  const estadoMasivoSeleccionado = useMemo(() => {
    return estadosLocales.find(
      estado => Number(estado.id) === Number(estadoMasivo)
    ) || null;
  }, [estadosLocales, estadoMasivo]);

  const localesFiltrados = useMemo(() => {
    const locales = gestion?.locales || [];

    if (!filtroEstado) return locales;

    return locales.filter(
      local => local.estado_codigo === filtroEstado
    );
  }, [gestion, filtroEstado]);

  const todosSeleccionados = useMemo(() => {
    if (!localesFiltrados.length) return false;

    return localesFiltrados.every(
      local => seleccionados.includes(local.connection_id)
    );
  }, [localesFiltrados, seleccionados]);

  const formatoFecha = fecha => {
    if (!fecha) return "--";

    const valor = String(fecha).substring(0, 10);
    const [year, month, day] = valor.split("-");

    return `${day}/${month}/${year}`;
  };

  const badgeGestion = codigo => {
    switch (codigo) {
      case "FINALIZADA":
        return "success";
      case "EN_EJECUCION":
        return "primary";
      case "SUSPENDIDA":
        return "warning";
      case "CANCELADA":
        return "danger";
      default:
        return "secondary";
    }
  };

  const badgeLocal = codigo => {
    switch (codigo) {
      case "TERMINADO":
        return "success";
      case "NO_APLICADO":
        return "danger";
      case "NO_APLICA":
        return "secondary";
      default:
        return "warning";
    }
  };

  const actualizarLocalState = (connectionId, cambios) => {
    setGestion(actual => {
      if (!actual) return actual;

      return {
        ...actual,
        locales: actual.locales.map(local =>
          local.connection_id === connectionId
            ? { ...local, ...cambios }
            : local
        )
      };
    });
  };

  const guardarEstadoLocal = async (
    local,
    estadoId = local.estado_id,
    comentario = local.comentario
  ) => {
    const estado = estadosLocales.find(
      x => Number(x.id) === Number(estadoId)
    );

    if (!estado) {
      setError("Estado no válido.");
      return false;
    }

    if (
      estado.codigo === "NO_APLICADO" &&
      !comentario?.trim()
    ) {
      setError(
        `Debe ingresar un comentario para el local ${local.codLocal}.`
      );
      return false;
    }

    try {
      setGuardandoLocal(local.connection_id);
      setError("");

      const res = await fetch(
        `${API_BASE_URL}/gestiones/${gestion.id}/locales/${local.connection_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            estado_id: Number(estadoId),
            comentario: comentario?.trim() || null
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error actualizando local");
      }

      actualizarLocalState(local.connection_id, {
        estado_id: Number(estadoId),
        estado_codigo: estado.codigo,
        estado_nombre: estado.nombre,
        comentario: comentario?.trim() || ""
      });

      if (refresh) {
        await refresh();
      }

      return true;
    } catch (err) {
      console.error(err);
      setError(err.message || "Error actualizando local");
      await cargarGestion();
      return false;
    } finally {
      setGuardandoLocal(null);
    }
  };

  const cambiarEstadoLocal = async (local, nuevoEstadoId) => {
    const estado = estadosLocales.find(
      x => Number(x.id) === Number(nuevoEstadoId)
    );

    if (!estado) {
      setError("Estado no válido.");
      return;
    }

    actualizarLocalState(local.connection_id, {
      estado_id: Number(nuevoEstadoId),
      estado_codigo: estado.codigo,
      estado_nombre: estado.nombre
    });

    if (
      estado.codigo === "NO_APLICADO" &&
      !local.comentario?.trim()
    ) {
      setError(
        `Ingrese el motivo de "No aplicado" para el local ${local.codLocal}.`
      );
      return;
    }

    await guardarEstadoLocal(
      local,
      Number(nuevoEstadoId),
      local.comentario
    );
  };

  const guardarComentarioLocal = async local => {
    const estado = estadosLocales.find(
      x => Number(x.id) === Number(local.estado_id)
    );

    if (!estado) return;

    if (
      estado.codigo === "NO_APLICADO" &&
      !local.comentario?.trim()
    ) {
      setError(
        `Debe ingresar un comentario para el local ${local.codLocal}.`
      );
      return;
    }

    await guardarEstadoLocal(
      local,
      local.estado_id,
      local.comentario
    );
  };

  const toggleSeleccion = connectionId => {
    setSeleccionados(actual =>
      actual.includes(connectionId)
        ? actual.filter(id => id !== connectionId)
        : [...actual, connectionId]
    );
  };

  const toggleTodos = () => {
    if (!localesFiltrados.length) return;

    const idsVisibles = localesFiltrados.map(
      local => local.connection_id
    );

    if (todosSeleccionados) {
      const visibles = new Set(idsVisibles);

      setSeleccionados(actual =>
        actual.filter(id => !visibles.has(id))
      );

      return;
    }

    setSeleccionados(actual => [
      ...new Set([
        ...actual,
        ...idsVisibles
      ])
    ]);
  };

  const aplicarEstadoMasivo = async () => {
    if (!estadoMasivo) {
      setError("Seleccione un estado para aplicar.");
      return;
    }

    if (!seleccionados.length) {
      setError("Seleccione al menos un local.");
      return;
    }

    if (
      estadoMasivoSeleccionado?.codigo === "NO_APLICADO" &&
      !comentarioMasivo.trim()
    ) {
      setError(
        'Debe ingresar un comentario para aplicar el estado "No aplicado".'
      );
      return;
    }

    try {
      setGuardandoMasivo(true);
      setError("");

      const resultados = await Promise.all(
        seleccionados.map(async connectionId => {
          const local = gestion.locales.find(
            item =>
              Number(item.connection_id) ===
              Number(connectionId)
          );

          if (!local) {
            return {
              ok: false,
              connectionId
            };
          }

          const comentario =
            estadoMasivoSeleccionado?.codigo === "NO_APLICADO"
              ? comentarioMasivo.trim()
              : local.comentario?.trim() || null;

          const res = await fetch(
            `${API_BASE_URL}/gestiones/${gestion.id}/locales/${connectionId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                estado_id: Number(estadoMasivo),
                comentario
              })
            }
          );

          const data = await res.json();

          if (!res.ok) {
            return {
              ok: false,
              connectionId,
              codLocal: local.codLocal,
              error: data.error || "Error actualizando local"
            };
          }

          return {
            ok: true,
            connectionId
          };
        })
      );

      const fallidos = resultados.filter(
        resultado => !resultado.ok
      );

      await cargarGestion();

      if (refresh) {
        await refresh();
      }

      if (fallidos.length) {
        setError(
          `Se actualizaron ${
            resultados.length - fallidos.length
          } locales, pero ${
            fallidos.length
          } presentaron error.`
        );
        return;
      }

      setSeleccionados([]);
      setEstadoMasivo("");
      setComentarioMasivo("");
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
        "Error realizando actualización masiva"
      );
      await cargarGestion();
    } finally {
      setGuardandoMasivo(false);
    }
  };

  const ejecutarAccion = async (accion, body = null) => {
    try {
      setAccionando(true);
      setError("");

      const opciones = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      };

      if (body) {
        opciones.body = JSON.stringify(body);
      }

      const res = await fetch(
        `${API_BASE_URL}/gestiones/${gestion.id}/${accion}`,
        opciones
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Error realizando operación"
        );
      }

      setMotivo("");
      setShowSuspender(false);

      await cargarGestion();

      if (refresh) {
        await refresh();
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
        "Error realizando operación"
      );
    } finally {
      setAccionando(false);
    }
  };

  const suspender = async () => {
    if (!motivo.trim()) {
      setError(
        "Debe indicar el motivo de la suspensión."
      );
      return;
    }

    await ejecutarAccion(
      "suspender",
      {
        motivo: motivo.trim()
      }
    );
  };

  const gestionBloqueada =
    gestion?.estado_codigo === "SUSPENDIDA" ||
    gestion?.estado_codigo === "FINALIZADA" ||
    gestion?.estado_codigo === "CANCELADA";

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="xl"
      centered
      scrollable
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Detalle de gestión
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div className="alert alert-danger py-2">
            {error}
          </div>
        )}

        {loading || !gestion ? (
          <div className="text-center py-5">
            <div className="spinner-border" />

            <div className="text-muted mt-2">
              Cargando gestión...
            </div>
          </div>
        ) : (
          <>
            {/* CABECERA */}
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-2">
              <div>
                <h4 className="mb-1">
                  {gestion.nombre}
                </h4>

                <div className="text-muted">
                  {gestion.descripcion || "Sin descripción"}
                </div>
              </div>

              <div className="text-md-end">
                <Badge
                  bg={badgeGestion(gestion.estado_codigo)}
                  className="fs-6"
                >
                  {gestion.estado_nombre}
                </Badge>
              </div>
            </div>

            {/* INFORMACIÓN GENERAL */}
            <div className="row g-3 mb-2">
              <div className="col-6 col-md-3">
                <div className="card shadow-sm h-100 p-2">
                  <div className="card-body d-flex justify-content-start gap-3 p-0">
                    <div className="text-muted small">
                      Versión
                    </div>

                    <strong>
                      {gestion.version || "--"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card shadow-sm h-100 p-2">
                  <div className="card-body d-flex justify-content-start gap-3 p-0">
                    <div className="text-muted small">
                      Inicio
                    </div>

                    <strong>
                      {formatoFecha(gestion.fecha_inicio)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card shadow-sm h-100 p-2">
                  <div className="card-body d-flex justify-content-start gap-3 p-0">
                    <div className="text-muted small">
                      Locales
                    </div>

                    <strong>
                      {resumen.total}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card shadow-sm h-100 p-2">
                  <div className="card-body d-flex justify-content-start gap-3 p-0">
                    <div className="text-muted small">
                      Avance
                    </div>

                    <strong>
                      {porcentaje}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* PROGRESO */}
            <div className="progress mb-3">
              <div
                className="progress-bar"
                style={{
                  width: `${porcentaje}%`
                }}
              >
                {porcentaje}%
              </div>
            </div>

            {/* RESUMEN DE ESTADOS */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Badge bg="success">
                Terminados: {resumen.terminado}
              </Badge>

              <Badge
                bg="warning"
                text="dark"
              >
                Pendientes: {resumen.pendiente}
              </Badge>

              <Badge bg="danger">
                No aplicados: {resumen.noAplicado}
              </Badge>

              <Badge bg="secondary">
                No aplica: {resumen.noAplica}
              </Badge>
            </div>

            {/* GESTIÓN SUSPENDIDA */}
            {gestion.estado_codigo === "SUSPENDIDA" && (
              <div className="alert alert-warning py-2">
                <strong>
                  Gestión suspendida
                </strong>

                {gestion.motivo_suspension && (
                  <div className="mt-1">
                    {gestion.motivo_suspension}
                  </div>
                )}
              </div>
            )}

            {/* FILTRO + ACCIONES MASIVAS */}
            <div className="d-flex flex-wrap align-items-center justify-content-start gap-2 mb-2">
              <div className="d-flex flex-wrap align-items-center gap-2" style={{ width: "450px" }}>
                <Form.Select size="sm" value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value) }
                  style={{ width: "180px" }} >
                  <option value="">
                    Todos los estados
                  </option>

                  {estadosLocales.map(estado => (
                    <option key={estado.id} value={estado.codigo} >
                      {estado.nombre}
                    </option>
                  ))}
                </Form.Select>

                <span className="text-muted small text-nowrap">
                  {localesFiltrados.length} de {resumen.total} locales
                </span>

                {filtroEstado && (
                  <Button type="button" size="sm" variant="outline-secondary"
                    onClick={() =>
                      setFiltroEstado("") }
                    title="Limpiar filtro" >
                    <i className="bi bi-x-lg" />
                  </Button>
                )}
              </div>

              <div className="vr d-none d-md-block" />

              {!gestionBloqueada && (
                <Button type="button" size="sm"
                  variant={
                    todosSeleccionados
                      ? "outline-secondary"
                      : "outline-primary" }
                  onClick={toggleTodos}
                  disabled={!localesFiltrados.length} >
                  <i className={`bi ${
                      todosSeleccionados
                        ? "bi-square"
                        : "bi-check2-square"
                    } me-1`} />

                  {todosSeleccionados
                    ? "Quitar todos"
                    : "Seleccionar Todos"}
                </Button>
              )}

              {!gestionBloqueada &&
                seleccionados.length > 0 && (
                <>
                  <Badge bg="primary">
                    {seleccionados.length} seleccionados
                  </Badge>

                  <Form.Select size="sm" value={estadoMasivo}
                    onChange={e => {
                      setEstadoMasivo(e.target.value);
                      setComentarioMasivo(""); }}
                    style={{ width: "180px" }} >
                    <option value="">
                      Cambiar estado...
                    </option>

                    {estadosLocales.map(estado => (
                      <option key={estado.id} value={estado.id} >
                        {estado.nombre}
                      </option>
                    ))}
                  </Form.Select>

                  {estadoMasivoSeleccionado?.codigo === "NO_APLICADO" && (
                    <Form.Control size="sm" value={comentarioMasivo}
                      onChange={e =>
                        setComentarioMasivo(e.target.value) }
                      placeholder="Motivo..."
                      style={{
                        minWidth: "180px",
                        flex: "1 1 180px"
                      }}
                    />
                  )}

                  <Button type="button" size="sm"
                    variant="primary"
                    disabled={
                      !estadoMasivo ||
                      guardandoMasivo
                    }
                    onClick={aplicarEstadoMasivo}
                  >
                    {guardandoMasivo ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-all me-1" />
                        Aplicar
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* TABLA DE LOCALES */}
            <div className="table-responsive">
              <Table
                hover
                bordered
                align="middle"
                size="sm"
                style={{
                  fontSize: "0.80rem"
                }}
              >
                <thead>
                  <tr>
                    <th
                      className="text-center"
                      style={{
                        width: 38
                      }}
                    >
                      {!gestionBloqueada && (
                        <Form.Check
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                          title="Seleccionar visibles"
                        />
                      )}
                    </th>

                    <th>
                      Local
                    </th>

                    <th
                      style={{
                        minWidth: 170
                      }}
                    >
                      Estado
                    </th>

                    <th
                      style={{
                        minWidth: 250
                      }}
                    >
                      Comentario
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {localesFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center text-muted py-4"
                      >
                        No hay locales para el estado seleccionado.
                      </td>
                    </tr>
                  ) : (
                    localesFiltrados.map(local => {
                      const guardando =
                        guardandoLocal === local.connection_id;

                      const requiereComentario =
                        local.estado_codigo === "NO_APLICADO";

                      return (
                        <tr key={local.id}>
                          <td className="text-center p-1">
                            {!gestionBloqueada && (
                              <Form.Check
                                type="checkbox"
                                checked={
                                  seleccionados.includes(
                                    local.connection_id
                                  )
                                }
                                onChange={() =>
                                  toggleSeleccion(
                                    local.connection_id
                                  )
                                }
                              />
                            )}
                          </td>

                          <td className="p-1 align-center">
                            <div className="fw-semibold">
                              {local.codLocal} - {local.nombre_local}
                            </div>
                          </td>

                          <td className="p-1">
                            {gestionBloqueada ? (
                              <Badge
                                bg={badgeLocal(local.estado_codigo)}
                              >
                                {local.estado_nombre}
                              </Badge>
                            ) : (
                              <div className="d-flex align-items-center gap-2">
                                <Form.Select
                                  value={local.estado_id}
                                  disabled={guardando}
                                  onChange={e =>
                                    cambiarEstadoLocal(
                                      local,
                                      Number(e.target.value)
                                    )
                                  }
                                >
                                  {estadosLocales.map(estado => (
                                    <option
                                      key={estado.id}
                                      value={estado.id}
                                    >
                                      {estado.nombre}
                                    </option>
                                  ))}
                                </Form.Select>

                                {guardando && (
                                  <span
                                    className="spinner-border spinner-border-sm text-primary flex-shrink-0"
                                    title="Guardando..."
                                  />
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-1">
                            <Form.Control
                              value={local.comentario || ""}
                              disabled={
                                gestionBloqueada ||
                                guardando
                              }
                              className={
                                requiereComentario &&
                                !local.comentario?.trim()
                                  ? "border-danger"
                                  : ""
                              }
                              placeholder={
                                requiereComentario
                                  ? "Indique motivo..."
                                  : "Comentario opcional"
                              }
                              onChange={e =>
                                actualizarLocalState(
                                  local.connection_id,
                                  {
                                    comentario: e.target.value
                                  }
                                )
                              }
                              onBlur={() => {
                                if (
                                  !gestionBloqueada &&
                                  !guardando
                                ) {
                                  guardarComentarioLocal(local);
                                }
                              }}
                            />

                            {requiereComentario &&
                              !local.comentario?.trim() && (
                              <div className="text-danger small mt-1">
                                El motivo es obligatorio y se guardará al salir del campo.
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>

            {/* SUSPENSIÓN - SOLO ADMIN / N2 */}
            {puedeAdministrarGestion &&
              showSuspender && (
              <div className="border rounded p-3 mt-3">
                <Form.Label>
                  Motivo de suspensión
                </Form.Label>

                <Form.Control
                  as="textarea"
                  rows={2}
                  value={motivo}
                  onChange={e =>
                    setMotivo(e.target.value)
                  }
                />

                <div className="d-flex gap-2 mt-2">
                  <Button
                    variant="warning"
                    onClick={suspender}
                    disabled={accionando}
                  >
                    Confirmar suspensión
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowSuspender(false);
                      setMotivo("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal.Body>

      {gestion && (
        <Modal.Footer>
          <div className="d-flex flex-wrap gap-2 w-100">

            {/* ADMIN / N2 / N1 */}
            {gestion.estado_codigo === "PENDIENTE" && (
              <Button
                variant="primary"
                disabled={accionando}
                onClick={() =>
                  ejecutarAccion("iniciar")
                }
              >
                <i className="bi bi-play-fill me-1" />
                Iniciar
              </Button>
            )}

            {/* SOLO ADMIN / N2 */}
            {puedeAdministrarGestion &&
              gestion.estado_codigo === "EN_EJECUCION" && (
              <>
                <Button
                  variant="warning"
                  disabled={accionando}
                  onClick={() =>
                    setShowSuspender(true)
                  }
                >
                  <i className="bi bi-pause-fill me-1" />
                  Suspender
                </Button>

                <Button
                  variant="success"
                  disabled={
                    accionando ||
                    resumen.pendiente > 0
                  }
                  onClick={() =>
                    ejecutarAccion("finalizar")
                  }
                >
                  <i className="bi bi-check-circle me-1" />
                  Finalizar
                </Button>
              </>
            )}

            {/* ADMIN / N2 / N1 */}
            {gestion.estado_codigo === "SUSPENDIDA" && (
              <Button
                variant="primary"
                disabled={accionando}
                onClick={() =>
                  ejecutarAccion("reanudar")
                }
              >
                <i className="bi bi-play-fill me-1" />
                Reanudar
              </Button>
            )}

            <Button
              variant="secondary"
              className="ms-auto"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </Modal.Footer>
      )}
    </Modal>
  );
}