import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config";
import GestionModal from "./GestionModal";
import GestionDetalleModal from "./GestionDetalleModal";

export default function GestionesPage({ token }) {
  const [gestiones, setGestiones] = useState([]);
  const [estados, setEstados] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [gestionSeleccionada, setGestionSeleccionada] = useState(null);

  const user = JSON.parse(localStorage.getItem("authUser") || "{}");
  const role = user.role;
  const puedeAdministrar = role === "Admin" || role === "N2";
  const esN1 = role === "N1";

  /* =====================================================
     EMPRESAS
  ===================================================== */

  const cargarEmpresas = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/empresas`, {
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
        throw new Error(
          data.error || "Error cargando empresas"
        );
      }

      setEmpresas(
        Array.isArray(data)
          ? data
          : data.data || []
      );

    } catch (err) {
      console.error(
        "Error cargando empresas:",
        err
      );
    }
  }, [token]);

  /* =====================================================
     ESTADOS
  ===================================================== */

  const cargarEstados = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/estados?grupo=GESTION`,
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
          "Error cargando estados"
        );
      }

      setEstados(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (err) {
      console.error(
        "Error cargando estados:",
        err
      );
    }
  }, [token]);

  /* =====================================================
     GESTIONES
  ===================================================== */

  const cargarGestiones = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.append(
          "search",
          search.trim()
        );
      }

      if (estado) {
        params.append(
          "estado",
          estado
        );
      }

      if (empresa) {
        params.append(
          "empresa_id",
          empresa
        );
      }

      const query = params.toString();

      const res = await fetch(
        `${API_BASE_URL}/gestiones${
          query
            ? `?${query}`
            : ""
        }`,
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
          "Error cargando gestiones"
        );
      }

      setGestiones(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Error cargando gestiones"
      );

    } finally {
      setLoading(false);
    }
  }, [
    token,
    search,
    estado,
    empresa
  ]);

  /* =====================================================
     EFECTOS
  ===================================================== */

  useEffect(() => {
    cargarEstados();
    cargarEmpresas();
  }, [
    cargarEstados,
    cargarEmpresas
  ]);

  useEffect(() => {
    cargarGestiones();
  }, [
    cargarGestiones
  ]);

  /* =====================================================
     RESUMEN
     Solo Admin y N2
  ===================================================== */

  const total = gestiones.length;

  const pendientes = useMemo(
    () =>
      gestiones.filter(
        x =>
          x.estado_codigo ===
          "PENDIENTE"
      ).length,
    [gestiones]
  );

  const enEjecucion = useMemo(
    () =>
      gestiones.filter(
        x =>
          x.estado_codigo ===
          "EN_EJECUCION"
      ).length,
    [gestiones]
  );

  const suspendidas = useMemo(
    () =>
      gestiones.filter(
        x =>
          x.estado_codigo ===
          "SUSPENDIDA"
      ).length,
    [gestiones]
  );

  /* =====================================================
     HELPERS
  ===================================================== */

  const badgeEstado = codigo => {
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

  const formatoFecha = fecha => {
    if (!fecha) return "--";

    const [year, month, day] =
      String(fecha)
        .substring(0, 10)
        .split("-");

    return `${day}/${month}/${year}`;
  };

  const nombreEmpresa = empresaId => {
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
     RENDER
  ===================================================== */

  return (
    <div className="container-fluid">

      {/* =========================
          CABECERA
      ========================= */}

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-2">
        <div>
          <h3 className="mb-1">
            Gestiones
          </h3>

          <div className="text-muted small">
            {esN1
              ? "Gestiones asignadas"
              : "Histórico de operaciones realizadas en locales"
            }
          </div>
        </div>

        {puedeAdministrar && (
          <button
            className="btn btn-primary"
            onClick={() =>
              setShowModal(true)
            }
          >
            <i className="bi bi-plus-lg me-2" />
            Nueva Gestión
          </button>
        )}
      </div>

      {/* =========================
          TARJETAS RESUMEN
          Solo Admin / N2
      ========================= */}

      {puedeAdministrar && (
        <div className="row g-3 mb-2">

          <div className="col-6 col-md-3">
            <div className="card shadow-sm h-100 p-2">
              <div className="card-body d-flex justify-content-start gap-3 p-0">
                <div className="text-muted small">
                  Total:
                </div>

                <div className="fs-5 fw-bold">
                  {total}
                </div>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm h-100 p-2">
              <div className="card-body d-flex justify-content-start gap-3 p-0">
                <div className="text-muted small">
                  Pendientes
                </div>

                <div className="fs-5 fw-bold">
                  {pendientes}
                </div>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm h-100 p-2">
              <div className="card-body d-flex justify-content-start gap-3 p-0">
                <div className="text-muted small">
                  En ejecución
                </div>

                <div className="fs-5 fw-bold">
                  {enEjecucion}
                </div>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm h-100 p-2">
              <div className="card-body d-flex justify-content-start gap-3 p-0">
                <div className="text-muted small">
                  Suspendidas
                </div>

                <div className="fs-5 fw-bold">
                  {suspendidas}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================
          LISTADO
      ========================= */}

      <div className="card shadow-sm">
        <div className="card-body">

          {/* =========================
              FILTROS
          ========================= */}

          <div className="row g-2 mb-2">

            <div className="col-12 col-lg-6">
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search" />
                </span>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar gestión, versión o descripción..."
                  value={search}
                  onChange={e =>
                    setSearch(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <select
                className="form-select"
                value={empresa}
                onChange={e =>
                  setEmpresa(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Todas las empresas
                </option>

                {empresas.map(item => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <select
                className="form-select"
                value={estado}
                onChange={e =>
                  setEstado(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Todos los estados
                </option>

                {estados.map(item => (
                  <option
                    key={item.id}
                    value={item.codigo}
                  >
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* =========================
              ERROR
          ========================= */}

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {/* =========================
              CONTENIDO
          ========================= */}

          {loading ? (

            <div className="text-center py-5">
              <div className="spinner-border" />

              <div className="mt-2 text-muted">
                Cargando gestiones...
              </div>
            </div>

          ) : gestiones.length === 0 ? (

            <div className="text-center text-muted py-5">
              {esN1
                ? "No tienes gestiones asignadas."
                : "No se encontraron gestiones."
              }
            </div>

          ) : (

            <div className="table-responsive">

              <table className="table table-hover align-middle">

                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Gestión</th>
                    <th>Versión</th>
                    <th>Estado</th>
                    <th>Locales</th>
                    <th>Avance</th>
                    <th />
                  </tr>
                </thead>

                <tbody>

                  {gestiones.map(gestion => {
                    const resumen =
                      gestion.resumen || {};

                    const totalLocales =
                      resumen.total || 0;

                    const resueltos =
                      (resumen.terminado || 0) +
                      (resumen.no_aplicado || 0) +
                      (resumen.no_aplica || 0);

                    const porcentaje =
                      totalLocales > 0
                        ? Math.round(
                            (
                              resueltos /
                              totalLocales
                            ) * 100
                          )
                        : 0;

                    return (
                      <tr key={gestion.id}>

                        <td>
                          {formatoFecha(
                            gestion.fecha_inicio
                          )}
                        </td>

                        <td>
                          <div className="fw-semibold">
                            {gestion.nombre}
                          </div>

                          {gestion.descripcion && (
                            <div
                              className="small text-muted text-truncate"
                              style={{
                                maxWidth: 300
                              }}
                            >
                              {gestion.descripcion}
                            </div>
                          )}
                        </td>

                        <td>
                          {gestion.version || "--"}
                        </td>

                        <td>
                          <span
                            className={`badge bg-${badgeEstado(
                              gestion.estado_codigo
                            )}`}
                          >
                            {gestion.estado_nombre}
                          </span>
                        </td>

                        <td>
                          {totalLocales}
                        </td>

                        <td
                          style={{
                            minWidth: 160
                          }}
                        >
                          <div className="d-flex justify-content-between small mb-1">

                            <span>
                              {resueltos}/
                              {totalLocales}
                            </span>

                            <span>
                              {porcentaje}%
                            </span>

                          </div>

                          <div
                            className="progress"
                            style={{
                              height: 6
                            }}
                          >
                            <div
                              className="progress-bar"
                              style={{
                                width:
                                  `${porcentaje}%`
                              }}
                            />
                          </div>

                        </td>

                        <td className="text-end">

                          <button
                            className="btn btn-sm btn-outline-primary"
                            title="Ver detalle"
                            onClick={() =>
                              setGestionSeleccionada(
                                gestion.id
                              )
                            }
                          >
                            <i className="bi bi-eye" />
                          </button>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </div>
      </div>

      {/* =========================
          NUEVA GESTIÓN
          Solo Admin / N2
      ========================= */}

      {puedeAdministrar && (
        <GestionModal
          show={showModal}
          onClose={() =>
            setShowModal(false)
          }
          refresh={cargarGestiones}
          token={token}
          empresas={empresas}
        />
      )}

      {/* =========================
          DETALLE
          Admin / N2 / N1
      ========================= */}

      <GestionDetalleModal
        show={Boolean(
          gestionSeleccionada
        )}
        gestionId={
          gestionSeleccionada
        }
        token={token}
        empresas={empresas}
        refresh={cargarGestiones}
        onClose={() =>
          setGestionSeleccionada(
            null
          )
        }
      />

    </div>
  );
}