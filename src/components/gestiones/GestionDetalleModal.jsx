import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Badge, Table, Collapse } from "react-bootstrap";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../config";
import FiltroEstados from "./FiltroEstados";
import GestionInstructivos from "./GestionInstructivos";

export default function GestionDetalleModal({ show, onClose, gestionId, token, refresh }) {
  const [gestion, setGestion] = useState(null);
  const [estadosLocales, setEstadosLocales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardandoLocal, setGuardandoLocal] = useState(null);
  const [accionando, setAccionando] = useState(false);
  const [error, setError] = useState("");
  const [filtroEstados, setFiltroEstados] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [estadoMasivo, setEstadoMasivo] = useState("");
  const [comentarioMasivo, setComentarioMasivo] = useState("");
  const [guardandoMasivo, setGuardandoMasivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  // null | "suspender" | "cancelar" — qué confirmación con motivo está abierta
  const [confirmando, setConfirmando] = useState(null);
  const [editando, setEditando] = useState(false);
  const [formEdicion, setFormEdicion] = useState({
    nombre: "",
    descripcion: "",
    version: "",
    fecha_inicio: ""
  });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState("");
  const [encargados, setEncargados] = useState([]);
  const [reasignando, setReasignando] = useState(false);
  const [encargadoNuevo, setEncargadoNuevo] = useState("");
  const [guardandoEncargado, setGuardandoEncargado] = useState(false);
  const [errorEncargado, setErrorEncargado] = useState("");
  const [detallesAbiertos, setDetallesAbiertos] = useState(false);

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
    setConfirmando(null);
    setFiltroEstados([]);
    setSeleccionados([]);
    setEstadoMasivo("");
    setComentarioMasivo("");
    setEditando(false);
    setErrorEdicion("");
    setReasignando(false);
    setErrorEncargado("");
    setDetallesAbiertos(false);
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

    if (!filtroEstados.length) return locales;

    return locales.filter(
      local => filtroEstados.includes(local.estado_codigo)
    );
  }, [gestion, filtroEstados]);

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

  // Fecha tal cual (sin desfase de zona horaria) si viene solo como día; con hora si trae hora
  const fechaParaExcel = valor => {
    if (!valor) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return formatoFecha(valor);

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? String(valor) : fecha.toLocaleString("es-CL");
  };

  // Exporta a Excel los locales que se están mostrando (respeta el filtro de estados)
  const exportarExcel = () => {
    const filas = localesFiltrados.map(local => ({
      "Código Local": local.codLocal,
      "Local": local.nombre_local,
      "Estado": local.estado_nombre,
      "Comentario": local.comentario || "",
      "Fecha aplicación": fechaParaExcel(local.fecha_aplicacion),
      "Actualizado por": local.actualizado_por_nombre || "",
      "Última actualización": fechaParaExcel(local.updated_at)
    }));

    const hojaLocales = XLSX.utils.json_to_sheet(filas);
    hojaLocales["!cols"] = [{ wch: 13 }, { wch: 34 }, { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 24 }, { wch: 22 }];

    const filtroAplicado = filtroEstados.length
      ? estadosLocales
          .filter(e => filtroEstados.includes(e.codigo))
          .map(e => e.nombre)
          .join(", ")
      : "Todos los estados";

    const hojaResumen = XLSX.utils.aoa_to_sheet([
      ["Gestión", gestion.nombre],
      ["Versión", gestion.version || ""],
      ["Estado de la gestión", gestion.estado_nombre],
      ["Fecha de inicio", formatoFecha(gestion.fecha_inicio)],
      ["Total de locales", resumen.total],
      ["Terminados", resumen.terminado],
      ["Pendientes", resumen.pendiente],
      ["No aplicados", resumen.noAplicado],
      ["No aplica", resumen.noAplica],
      ["Avance", `${porcentaje}%`],
      ["Filtro aplicado en la exportación", filtroAplicado],
      ["Locales exportados", filas.length],
      ["Fecha de exportación", new Date().toLocaleString("es-CL")]
    ]);
    hojaResumen["!cols"] = [{ wch: 34 }, { wch: 40 }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hojaLocales, "Locales");
    XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen");

    const nombreSeguro = String(gestion.nombre || "gestion")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_");
    const fecha = new Date().toISOString().split("T")[0];

    XLSX.writeFile(libro, `Gestion_${nombreSeguro}_${fecha}.xlsx`);
  };

  const iniciarEdicion = () => {
    setFormEdicion({
      nombre: gestion.nombre || "",
      descripcion: gestion.descripcion || "",
      version: gestion.version || "",
      fecha_inicio: String(gestion.fecha_inicio || "").substring(0, 10)
    });
    setErrorEdicion("");
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setErrorEdicion("");
  };

  const guardarEdicion = async () => {
    if (!formEdicion.nombre.trim()) {
      setErrorEdicion("El nombre no puede estar vacío");
      return;
    }

    try {
      setGuardandoEdicion(true);
      setErrorEdicion("");

      const res = await fetch(`${API_BASE_URL}/gestiones/${gestion.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombre: formEdicion.nombre.trim(),
          descripcion: formEdicion.descripcion.trim() || null,
          version: formEdicion.version.trim() || null,
          fecha_inicio: formEdicion.fecha_inicio
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error actualizando gestión");
      }

      setGestion(prev => ({ ...prev, ...data }));
      setEditando(false);
      if (refresh) refresh();
    } catch (err) {
      console.error(err);
      setErrorEdicion(err.message || "Error actualizando gestión");
    } finally {
      setGuardandoEdicion(false);
    }
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
      setConfirmando(null);

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

  const cancelarGestion = async () => {
    if (!motivo.trim()) {
      setError(
        "Debe indicar el motivo de la cancelación."
      );
      return;
    }

    await ejecutarAccion(
      "cancelar",
      {
        motivo: motivo.trim()
      }
    );
  };

  // Al editar, el bloque de detalles se mantiene abierto para no esconder los campos.
  const detallesVisibles = detallesAbiertos || editando;

  const gestionCerrada =
    gestion?.estado_codigo === "FINALIZADA" ||
    gestion?.estado_codigo === "CANCELADA";

  const iniciarReasignacion = async () => {
    setErrorEncargado("");
    setEncargadoNuevo(String(gestion.encargado_id ?? ""));
    setReasignando(true);

    if (encargados.length) return;

    try {
      const res = await fetch(`${API_BASE_URL}/gestiones/usuarios/encargados`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error cargando encargados");

      setEncargados(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorEncargado(err.message || "Error cargando encargados");
    }
  };

  const guardarEncargado = async () => {
    if (!encargadoNuevo) {
      setErrorEncargado("Seleccione un encargado.");
      return;
    }

    if (Number(encargadoNuevo) === Number(gestion.encargado_id)) {
      setReasignando(false);
      return;
    }

    // Un N2 solo ve las gestiones que creó o que tiene asignadas: si la reasigna, la deja de ver.
    const perderaAcceso =
      role === "N2" &&
      Number(gestion.creado_por) !== Number(user.id) &&
      Number(encargadoNuevo) !== Number(user.id);

    if (
      perderaAcceso &&
      !window.confirm("Esta gestión no la creaste tú: al reasignarla dejarás de verla. ¿Continuar?")
    ) {
      return;
    }

    setGuardandoEncargado(true);
    setErrorEncargado("");

    try {
      const res = await fetch(`${API_BASE_URL}/gestiones/${gestion.id}/encargado`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ encargado_id: Number(encargadoNuevo) })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error reasignando la gestión");

      setReasignando(false);

      if (perderaAcceso) {
        if (refresh) await refresh();
        onClose();
        return;
      }

      setGestion(prev => ({
        ...prev,
        encargado_id: data.encargado_id,
        encargado_nombre: data.encargado_nombre
      }));

      if (refresh) refresh();
    } catch (err) {
      setErrorEncargado(err.message || "Error reasignando la gestión");
    } finally {
      setGuardandoEncargado(false);
    }
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
      contentClassName="gestion-detalle-content"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Detalle de gestión
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="d-flex flex-column">
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
            {/* CABECERA: nombre, resumen de estados y botón para mostrar/ocultar los detalles */}
            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
              <div className="d-flex align-items-center flex-wrap gap-2 flex-grow-1" style={{ minWidth: 0 }}>
                {editando ? (
                  <Form.Control
                    className="flex-grow-1"
                    style={{ maxWidth: 420 }}
                    value={formEdicion.nombre}
                    onChange={e =>
                      setFormEdicion(prev => ({ ...prev, nombre: e.target.value }))
                    }
                    placeholder="Nombre"
                  />
                ) : (
                  <h4 className="mb-0">
                    {gestion.nombre}
                  </h4>
                )}

                {/* RESUMEN DE ESTADOS */}
                <div className="d-flex flex-wrap gap-1">
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
              </div>

              <span className="small text-muted text-nowrap" title="Encargado de la gestión">
                <i className="bi bi-person me-1" />
                {gestion.encargado_nombre || "Sin asignar"}
                {puedeAdministrarGestion && !gestionCerrada && !editando && (
                  <Button
                    size="sm"
                    variant="link"
                    className="py-0 px-1 ms-1 align-baseline"
                    onClick={() => {
                      setDetallesAbiertos(true);
                      iniciarReasignacion();
                    }}
                  >
                    Reasignar
                  </Button>
                )}
              </span>

              <Badge
                bg={badgeGestion(gestion.estado_codigo)}
                className="fs-6"
              >
                {gestion.estado_nombre}
              </Badge>

              {!editando && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  title={detallesAbiertos ? "Ocultar detalles" : "Mostrar detalles"}
                  aria-expanded={detallesAbiertos}
                  onClick={() => setDetallesAbiertos(v => !v)}
                >
                  <i className={`bi bi-chevron-${detallesAbiertos ? "up" : "down"}`} />
                </Button>
              )}
            </div>

            {/* DETALLES (se muestran u ocultan con la flecha) */}
            <Collapse in={detallesVisibles}>
              <div className="flex-shrink-0">
              <div>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
              <div className="flex-grow-1">
                {editando ? (
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formEdicion.descripcion}
                    onChange={e =>
                      setFormEdicion(prev => ({ ...prev, descripcion: e.target.value }))
                    }
                    placeholder="Descripción"
                  />
                ) : (
                  <div className="text-muted">
                    {gestion.descripcion || "Sin descripción"}
                  </div>
                )}
              </div>

              {puedeAdministrarGestion && !editando && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="flex-shrink-0"
                  onClick={iniciarEdicion}
                >
                  <i className="bi bi-pencil me-1" />
                  Editar
                </Button>
              )}
            </div>

            {/* ENCARGADO */}
            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
              <span className="text-muted small">
                <i className="bi bi-person-check me-1" />
                Encargado:
              </span>

              {reasignando ? (
                <>
                  <Form.Select
                    size="sm"
                    style={{ width: 260 }}
                    value={encargadoNuevo}
                    disabled={guardandoEncargado}
                    onChange={e => setEncargadoNuevo(e.target.value)}
                  >
                    <option value="">Seleccione encargado</option>
                    {encargados.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                  </Form.Select>

                  <Button size="sm" variant="primary" disabled={guardandoEncargado} onClick={guardarEncargado}>
                    {guardandoEncargado ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={guardandoEncargado}
                    onClick={() => setReasignando(false)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <strong>{gestion.encargado_nombre || "Sin asignar"}</strong>

                  {puedeAdministrarGestion && !gestionCerrada && (
                    <Button size="sm" variant="outline-secondary" onClick={iniciarReasignacion}>
                      <i className="bi bi-arrow-left-right me-1" />
                      Reasignar
                    </Button>
                  )}
                </>
              )}

              {errorEncargado && <span className="text-danger small">{errorEncargado}</span>}
            </div>

            {errorEdicion && (
              <div className="alert alert-danger py-2">
                {errorEdicion}
              </div>
            )}

            {/* INFORMACIÓN GENERAL */}
            <div className="row g-3 mb-2">
              <div className="col-6 col-md-3">
                <div className="card shadow-sm h-100 p-2">
                  <div className="card-body d-flex justify-content-start gap-3 p-0 align-items-center">
                    <div className="text-muted small">
                      Versión
                    </div>

                    {editando ? (
                      <Form.Control
                        size="sm"
                        value={formEdicion.version}
                        onChange={e =>
                          setFormEdicion(prev => ({ ...prev, version: e.target.value }))
                        }
                      />
                    ) : (
                      <strong>
                        {gestion.version || "--"}
                      </strong>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card shadow-sm h-100 p-2">
                  <div className="card-body d-flex justify-content-start gap-3 p-0 align-items-center">
                    <div className="text-muted small">
                      Inicio
                    </div>

                    {editando ? (
                      <Form.Control
                        size="sm"
                        type="date"
                        value={formEdicion.fecha_inicio}
                        onChange={e =>
                          setFormEdicion(prev => ({ ...prev, fecha_inicio: e.target.value }))
                        }
                      />
                    ) : (
                      <strong>
                        {formatoFecha(gestion.fecha_inicio)}
                      </strong>
                    )}
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

            {editando && (
              <div className="d-flex justify-content-end gap-2 mb-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={cancelarEdicion}
                  disabled={guardandoEdicion}
                >
                  Cancelar
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={guardarEdicion}
                  disabled={guardandoEdicion}
                >
                  {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            )}

            <GestionInstructivos
              gestionId={gestionId}
              token={token}
              puedeAdministrar={puedeAdministrarGestion}
            />

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

              </div>
              </div>
            </Collapse>

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
              <div className="d-flex flex-wrap align-items-center gap-2" style={{ maxWidth: "560px" }}>
                <div style={{ width: "260px" }}>
                  <FiltroEstados
                    compacto
                    estados={estadosLocales}
                    value={filtroEstados}
                    onChange={setFiltroEstados}
                  />
                </div>

                <span className="text-muted small text-nowrap">
                  {localesFiltrados.length} de {resumen.total} locales
                </span>

                {filtroEstados.length > 0 && (
                  <Button type="button" size="sm" variant="outline-secondary"
                    onClick={() =>
                      setFiltroEstados([]) }
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

              <Button type="button" size="sm"
                variant="outline-success"
                className="ms-md-auto"
                onClick={exportarExcel}
                disabled={!localesFiltrados.length}
                title="Exportar a Excel el estado de los locales que se muestran" >
                <i className="bi bi-file-earmark-excel me-1" />
                Exportar
              </Button>
            </div>

            {/* TABLA DE LOCALES */}
            <div
              className="table-responsive tabla-gestion-locales"
              style={{ flex: "1 1 0", minHeight: 200, overflowY: "auto" }}
            >
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

          </>
        )}
      </Modal.Body>

      {gestion && (
        <Modal.Footer>
          {confirmando ? (
            <div className="w-100">
              <Form.Label>
                {confirmando === "suspender"
                  ? "Motivo de suspensión"
                  : "Motivo de cancelación"}
              </Form.Label>

              <Form.Control
                as="textarea"
                rows={2}
                autoFocus
                value={motivo}
                onChange={e =>
                  setMotivo(e.target.value)
                }
              />

              <div className="d-flex gap-2 mt-2 justify-content-end">
                <Button
                  variant="secondary"
                  disabled={accionando}
                  onClick={() => {
                    setConfirmando(null);
                    setMotivo("");
                    setError("");
                  }}
                >
                  Volver
                </Button>

                <Button
                  variant={confirmando === "suspender" ? "warning" : "danger"}
                  disabled={accionando}
                  onClick={
                    confirmando === "suspender"
                      ? suspender
                      : cancelarGestion
                  }
                >
                  {confirmando === "suspender"
                    ? "Confirmar suspensión"
                    : "Confirmar cancelación"}
                </Button>
              </div>
            </div>
          ) : (
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
                      setConfirmando("suspender")
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

              {/* SOLO ADMIN */}
              {role === "Admin" &&
                gestion.estado_codigo !== "FINALIZADA" &&
                gestion.estado_codigo !== "CANCELADA" && (
                <Button
                  variant="outline-danger"
                  disabled={accionando}
                  onClick={() =>
                    setConfirmando("cancelar")
                  }
                >
                  <i className="bi bi-x-circle me-1" />
                  Cancelar gestión
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
          )}
        </Modal.Footer>
      )}
    </Modal>
  );
}