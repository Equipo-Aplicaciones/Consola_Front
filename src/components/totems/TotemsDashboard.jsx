import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import DatePicker from "react-datepicker";
import "./TotemsDashboard.css";
import * as XLSX from "xlsx";

/* =====================================================
   UTILIDADES DE FECHA / ESTADO
===================================================== */

const obtenerFechaHoy = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = tipo =>
    parts.find(p => p.type === tipo)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
};

const obtenerFechaRegistro = fecha =>
  fecha ? String(fecha).substring(0, 10) : "";

const esRegistroHoy = item =>
  obtenerFechaRegistro(item.fecha) === obtenerFechaHoy();

const obtenerEstadoVisual = item =>
  esRegistroHoy(item) && item.estado === "ON"
    ? "ON"
    : "OFF";

const formatoHora = fecha => {
  if (!fecha) return "-";

  return new Date(fecha).toLocaleTimeString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatoFecha = fecha => {
  const valor = obtenerFechaRegistro(fecha);

  if (!valor) return "-";

  const [year, month, day] = valor.split("-");

  return `${day}/${month}/${year}`;
};

function TotemsDashboard({ token }) {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [popover, setPopover] = useState(null);
  const [rango, setRango] = useState([null, null]);
  const [startDate, endDate] = rango;
  const isMobile = window.innerWidth <= 768;
  const [empresas, setEmpresas] = useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("");
  const [panelAbierto, setPanelAbierto] = useState(null);

  const user = JSON.parse(localStorage.getItem("authUser") || "{}");

  const isAdmin = user.role !== "N1";

  const cargarDatos = useCallback(async (mostrarLoading = false) => {
    if (!token) return; 

    if (mostrarLoading) setLoading(true);

    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/totems`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.message || "No fue posible obtener los tótems."
        );
      }

      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("Error cargando tótems:", err);

      setError(
        err.message || "Error consultando estado de tótems."
      );
    } finally {
      if (mostrarLoading) setLoading(false);
    }
  }, [token]);

  const cargarEmpresas = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/empresas`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const json = await res.json();
      setEmpresas( Array.isArray(json) ? json : [] );

    } catch (err) {
      console.error("Error cargando empresas:", err);
      setEmpresas([]);
    }
  }, [token]);

  useEffect(() => {
    cargarDatos(true);
    cargarEmpresas();
  }, [cargarDatos, cargarEmpresas]);

  useEffect(() => {
    const interval = setInterval(
      () => cargarDatos(false),
      10 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [cargarDatos]);

  const locales = useMemo(() => {
    const mapa = new Map();

    data.forEach(item => {
      if (!mapa.has(item.connection_id)) {
        mapa.set(item.connection_id, {
          connection_id: item.connection_id,
          empresa_id: item.empresa_id,
          codLocal: item.codLocal,
          nombre: item.local_nombre || "Sin nombre",
          totems: []
        });
      }

      mapa.get(item.connection_id).totems.push(item);
    });

    const resultado = [...mapa.values()];

    resultado.forEach(local => {
      local.totems.sort(
        (a, b) =>
          Number(a.totem_numero) -
          Number(b.totem_numero)
      );
    });

    resultado.sort((a, b) => {
      const aOff = a.totems.some(
        t => obtenerEstadoVisual(t) === "OFF"
      );

      const bOff = b.totems.some(
        t => obtenerEstadoVisual(t) === "OFF"
      );

      if (aOff !== bOff) return aOff ? -1 : 1;

      return Number(a.codLocal) - Number(b.codLocal);
    });

    return resultado;
  }, [data]);

  const localesFiltrados = useMemo(() => {
    const texto = search.trim().toLowerCase();

    return locales.filter(local => {
      const cumpleEmpresa =
        !empresaSeleccionada ||
        String(local.empresa_id) === String(empresaSeleccionada);

      const cumpleTexto =
        !texto ||
        String(local.nombre || "").toLowerCase().includes(texto) ||
        String(local.codLocal || "").includes(texto);

      return cumpleEmpresa && cumpleTexto;
    });

  }, [locales, search, empresaSeleccionada]);

  const dataFiltrada = useMemo(() => {
    if (!empresaSeleccionada) {
      return data;
    }

    return data.filter(
      item =>
        String(item.empresa_id) ===
        String(empresaSeleccionada)
    );
  }, [data, empresaSeleccionada]);

  const resumen = useMemo(() => {
    const totalTotems = dataFiltrada.length;

    const on = dataFiltrada.filter(
      item => obtenerEstadoVisual(item) === "ON"
    ).length;

    const off = totalTotems - on;

    const porcentaje = totalTotems
      ? Math.round((on / totalTotems) * 100)
      : 0;

    const localesFiltradosEmpresa = locales.filter(local =>
      !empresaSeleccionada ||
      String(local.empresa_id) === String(empresaSeleccionada)
    );

    const localesConProblemas = localesFiltradosEmpresa.filter(local =>
      local.totems.some(
        t => obtenerEstadoVisual(t) === "OFF"
      )
    ).length;

    return {
      totalLocales: localesFiltradosEmpresa.length,
      totalTotems,
      on,
      off,
      porcentaje,
      localesConProblemas
    };

  }, [
    dataFiltrada,
    locales,
    empresaSeleccionada
  ]);

  /**
   * Mostrar popover fuera de las cards
   */
  const mostrarPopover = (totem, event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    const ancho = 230;
    const altoEstimado = 155;
    const margen = 10;

    const espacioArriba = rect.top;
    const espacioAbajo = window.innerHeight - rect.bottom;

    const abrirAbajo =
      espacioArriba < altoEstimado + margen &&
      espacioAbajo > espacioArriba;

    let left =
      rect.left +
      rect.width / 2 -
      ancho / 2;

    if (left < 8) left = 8;

    if (left + ancho > window.innerWidth - 8) {
      left = window.innerWidth - ancho - 8;
    }

    const top = abrirAbajo
      ? rect.bottom + margen
      : rect.top - altoEstimado - margen;

    setPopover({
      totem,
      left,
      top,
      direction: abrirAbajo ? "down" : "up",
      anchorX: rect.left + rect.width / 2
    });
  };

  const ocultarPopover = () => {
    setPopover(null);
  };

  const formatearFecha = (fecha) => {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const exportarReporte = async () => {
    if (!startDate || !endDate) {
      alert("Debe seleccionar un rango de fechas.");
      return;
    }

    if (startDate > endDate) {
      alert("La fecha desde no puede ser mayor a la fecha hasta.");
      return;
    }

    const desde = formatearFecha(startDate);
    const hasta = formatearFecha(endDate);

    try {
      let url = `${API_BASE_URL}/totems/reporte?desde=${desde}&hasta=${hasta}`;

      if (empresaSeleccionada) { url += `&empresa_id=${empresaSeleccionada}`; }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      const registros = await res.json();

      if (!res.ok) {
        throw new Error(
          registros.message || "No fue posible generar el reporte."
        );
      }

      if (!Array.isArray(registros) || registros.length === 0) {
        alert("No existen registros para el rango seleccionado.");
        return;
      }

      /**
       * Crear lista de días del rango.
       */
      const dias = [];
      const cursor = new Date(startDate);

      while (cursor <= endDate) {
        dias.push(formatearFecha(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      /**
       * Agrupar por local + tótem
       */
      const mapa = new Map();

      registros.forEach(registro => {
        const key = `${registro.connection_id}-${registro.totem_numero}`;

        if (!mapa.has(key)) {
          mapa.set(key, {
            empresaId: registro.empresa_id,
            empresa: registro.empresa_nombre || "Sin empresa",
            codLocal: registro.codLocal,
            local: registro.local_nombre,
            totem: registro.totem_numero,
            dias: {}
          });
        }

        const fecha = String(registro.fecha).substring(0, 10);

        mapa.get(key).dias[fecha] = registro.hora_encendido
          ? formatoHora(registro.hora_encendido)
          : "--";
      });

      /**
       * Construir filas Excel
       */
      const rows = Array.from(mapa.values())
        .sort((a, b) => {
          const empresaA = String(a.empresa || "");
          const empresaB = String(b.empresa || "");

          const comparacionEmpresa =
            empresaA.localeCompare(empresaB, "es");

          if (comparacionEmpresa !== 0) {
            return comparacionEmpresa;
          }

          const localA = Number(a.codLocal);
          const localB = Number(b.codLocal);

          if (localA !== localB) {
            return localA - localB;
          }

          return Number(a.totem) - Number(b.totem);
        })
        .map(item => {
          const row = {
            "Empresa": item.empresa,
            "Código Local": item.codLocal,
            "Local": item.local,
            "Tótem": item.totem
          };

          dias.forEach(fecha => {
            const [, month, day] = fecha.split("-");
            const columna = `${day}/${month}`;

            row[columna] = item.dias[fecha] || "--";
          });

          return row;
        });

      /**
       * Crear Excel
       */
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);

      /**
       * Ajustar anchos
       */
      worksheet["!cols"] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 25 },
        { wch: 8 },
        ...dias.map(() => ({ wch: 10 }))
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Encendido Tótems"
      );

      XLSX.writeFile(
        workbook,
        `Reporte_Totems_${desde}_${hasta}.xlsx`
      );

    } catch (err) {
      console.error("Error exportando reporte:", err);

      alert(
        `❌ ${err.message || "Error al generar el reporte."}`
      );
    }
  };

  return (
    <div className="totems-dashboard">

      {/* CABECERA */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-2 px-3 position-relative">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">

            <div className="d-flex flex-wrap align-items-center gap-3 totem-dashboard-header">
              <h5 className="mb-0 me-2">
                Estado de Tótems
              </h5>

              <div className="totem-summary-item">
                <span className="text-muted">Locales</span>
                <strong className="ms-1">
                  {resumen.totalLocales}
                </strong>
              </div>

              <div className="totem-summary-item">
                <span className="text-muted">Tótems</span>
                <strong className="ms-1">
                  {resumen.totalTotems}
                </strong>
              </div>

              <div className="totem-summary-item text-success">
                <i className="bi bi-circle-fill me-1 totem-summary-dot" />
                <strong>{resumen.on}</strong>
                <span className="ms-1">ON</span>
              </div>

              <div className="totem-summary-item text-danger">
                <i className="bi bi-circle-fill me-1 totem-summary-dot" />
                <strong>{resumen.off}</strong>
                <span className="ms-1">OFF</span>
              </div>

              <div className="totem-summary-item">
                <strong>{resumen.porcentaje}%</strong>
                <span className="text-muted ms-1">
                  operativo
                </span>
              </div>

              {resumen.localesConProblemas > 0 && (
                <div className="totem-summary-item text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-1" />
                  <strong>
                    {resumen.localesConProblemas}
                  </strong>
                  <span className="ms-1">alertas</span>
                </div>
              )}
            </div>
            <div className="totem-actions">
              {/* VISTA RÁPIDA (TESTING) */}
              <button type="button" className="btn btn-sm btn-outline-warning" title="Vista rápida para Operaciones (testing)"
                onClick={() => navigate("/totems-quickview")} >
                <i className="bi bi-speedometer2 me-1" />
                Vista Rápida
              </button>

              {/** FILTRO POR EMPRESA */}
              {panelAbierto !== "buscar" && (
                <div className="totem-company-wrapper">
                  <button type="button"className={`btn btn-sm btn-outline-secondary border-0 totem-company-button ${
                      panelAbierto === "empresa" ? "d-none" : ""}`} title="Filtrar por empresa" onClick={() => setPanelAbierto("empresa")}>
                    <i className="bi bi-building fs-5" />
                  </button>

                  <div className={`totem-company-expanded ${ panelAbierto === "empresa"
                        ? "company-open" : "company-closed" }`} >
                    <select className="form-select form-select-sm" value={empresaSeleccionada}
                      onChange={(e) => setEmpresaSeleccionada(e.target.value)} >
                      <option value="">Todas las empresas</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>

                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPanelAbierto(null)} >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>

                </div>
              )}

              {/* REPORTE - SOLO ADMIN */}
              {isAdmin && !isMobile && panelAbierto !== "buscar" && (
                <div className="totem-report-wrapper">
                  <button type="button" className={`btn btn-sm btn-outline-secondary border-0 totem-report-button ${
                    panelAbierto === "reporte" ? "d-none" : "" }`} title="Reporte"
                    onClick={() => setPanelAbierto("reporte")} >
                    <i className="bi bi-file-earmark-bar-graph fs-5" />
                  </button>

                  <div className={`totem-report-expanded ${ panelAbierto === "reporte" ? "report-open" : "report-closed" }`} >
                    <DatePicker selectsRange startDate={startDate} endDate={endDate} onChange={(update) => setRango(update)}
                      className="form-control form-control-sm" dateFormat="yyyy-MM-dd"
                      placeholderText="Seleccionar rango"
                      withPortal={isMobile}
                      popperPlacement={isMobile ? "bottom-start" : "bottom-end"}
                      isClearable/>

                    <button type="button" className="btn btn-sm btn-outline-success" title="Exportar Excel" onClick={exportarReporte} >
                      <i className="bi bi-file-earmark-excel" />
                    </button>

                    <button type="button" className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setRango([null, null]);
                        setPanelAbierto(null);
                      }} >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>

                </div>
              )}

              {/* BUSCADOR */}
              <div className="totem-search-wrapper">
                <button type="button" className={`btn btn-sm btn-outline-secondary border-0 totem-search-button ${
                    panelAbierto === "buscar" ? "d-none" : "" }`} title="Buscar local"
                    onClick={() => setPanelAbierto("buscar")} >
                  <i className="bi bi-search fs-5" />
                </button>

                <div className={`input-group input-group-sm totem-search-expanded ${
                    panelAbierto === "buscar" ? "search-open" : "search-closed" }`} >
                  <span className="input-group-text">
                    <i className="bi bi-search" />
                  </span>

                  <input autoFocus={panelAbierto === "buscar"} type="text" className="form-control"
                    placeholder="Buscar local..." value={search} onChange={(e) => setSearch(e.target.value)} />

                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => { setSearch(""); setPanelAbierto(null); }} >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>

      {loading && data.length === 0 && (
        <div className="text-center text-muted py-4">
          <div className="spinner-border spinner-border-sm me-2" />
          Consultando tótems...
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        localesFiltrados.length === 0 && (
          <div className="card shadow-sm">
            <div className="card-body text-center py-4 text-muted">
              <i className="bi bi-info-circle fs-4" />

              <div className="mt-2">
                {search
                  ? "No existen locales que coincidan con la búsqueda."
                  : "No existen registros de tótems."}
              </div>
            </div>
          </div>
        )}

      {/* LOCALES */}
      <div className="totems-grid">
        {localesFiltrados.map(local => {
          const cantidadOff = local.totems.filter(
            t => obtenerEstadoVisual(t) === "OFF"
          ).length;

          const todosOn = cantidadOff === 0;

          return (
            <div key={local.connection_id} >
              <div className={`card shadow-sm h-100 ${ todosOn ? "" : "border-danger" }`} >
                <div className="card-body py-2 px-3">

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="text-truncate" style={{ maxWidth: "55%" }} >
                      <span className="fw-semibold" title={local.nombre} >
                        {local.codLocal}-{local.nombre}
                      </span>
                    </div>

                    {todosOn ? (
                      <span className="badge bg-success-subtle text-success">
                        <i className="bi bi-check-circle-fill me-1" />
                        OK
                      </span>
                    ) : (
                      <span className="badge bg-danger-subtle text-danger">
                        <i className="bi bi-exclamation-circle-fill me-1" />
                        {cantidadOff} OFF
                      </span>
                    )}
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    {local.totems.map(totem => {
                      const online =
                        obtenerEstadoVisual(totem) === "ON";

                      return (
                        <div key={totem.id} className={`totem-mini ${
                            online ? "totem-mini-on" : "totem-mini-off" }`}
                            onMouseEnter={e => mostrarPopover(totem, e) }
                            onMouseLeave={ocultarPopover}
                            onClick={e => mostrarPopover(totem, e) } >
                          <i className={`bi bi-tablet ${
                              online ? "text-success" : "text-danger" }`} />

                          <span className={`totem-mini-number ${
                              online ? "text-success" : "text-danger" }`} >
                              {totem.totem_numero}
                          </span>

                          <span className={`totem-status-dot ${
                              online ? "bg-success" : "bg-danger" }`} />
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* POPOVER GLOBAL */}
      {popover &&
        createPortal(
          <div className={`totem-floating-popover ${popover.direction}`}
            style={{ left: `${popover.left}px`, top: `${popover.top}px` }} >
            {(() => {
              const totem = popover.totem;
              const online = obtenerEstadoVisual(totem) === "ON";
              const registroHoy = esRegistroHoy(totem);

              return (
                <>
                  <div className="totem-popover-title">
                    <span> Tótem {totem.totem_numero} </span>

                    <span className={`badge ${ online  ? "bg-success" : "bg-danger" }`} >
                      {online ? "ON" : "OFF"}
                    </span>
                  </div>

                  <div className="totem-popover-row">
                    <span>IP</span>
                    <strong>{totem.ip || "-"}</strong>
                  </div>

                  {registroHoy && online && (
                    <div className="totem-popover-row">
                      <span>Encendido</span>
                      <strong>
                        {formatoHora(
                          totem.hora_encendido
                        )}
                      </strong>
                    </div>
                  )}

                  {registroHoy ? (
                    <div className="totem-popover-row">
                      <span>Última revisión</span>
                      <strong>
                        {formatoHora( totem.ultima_revision )}
                      </strong>
                    </div>
                  ) : (
                    <>
                      <div className="totem-popover-warning">
                        <i className="bi bi-clock-history me-1" />
                        Sin revisión hoy
                      </div>

                      <div className="totem-popover-row">
                        <span>Último registro</span>
                        <strong>
                          {formatoFecha(totem.fecha)}
                        </strong>
                      </div>

                      <div className="totem-popover-row">
                        <span>Último estado</span>
                        <strong>
                          {totem.estado || "-"}
                        </strong>
                      </div>

                      <div className="totem-popover-row">
                        <span>Última revisión</span>
                        <strong>
                          {formatoHora(
                            totem.ultima_revision
                          )}
                        </strong>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>,
          document.body
        )}

    </div>
  );
}

export default TotemsDashboard;