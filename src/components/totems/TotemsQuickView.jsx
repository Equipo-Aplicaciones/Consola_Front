import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

/* =====================================================
   UTILIDADES DE FECHA / ESTADO
   (mismo criterio que TotemsDashboard.jsx: un registro
   solo cuenta como "ON" si además es de hoy)
===================================================== */

const obtenerFechaHoy = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = tipo => parts.find(p => p.type === tipo)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
};

const obtenerFechaRegistro = fecha => (fecha ? String(fecha).substring(0, 10) : "");

const esRegistroHoy = item => obtenerFechaRegistro(item.fecha) === obtenerFechaHoy();

const estaEncendido = item => esRegistroHoy(item) && item.estado === "ON" && item.hora_encendido;

const formatoHora = fecha => {
  if (!fecha) return "-";

  return new Date(fecha).toLocaleTimeString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit"
  });
};

// "2h 14m" desde una fecha hasta ahora — sirve tanto para
// tiempo encendido (desde hora_encendido) como apagado (desde hora_apagado)
const tiempoTranscurrido = (fecha, ahora) => {
  if (!fecha) return "-";

  const desde = new Date(fecha).getTime();
  const totalMin = Math.max(0, Math.floor((ahora - desde) / 60000));

  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;

  if (horas === 0) return `${minutos}m`;

  return `${horas}h ${minutos}m`;
};

function TotemsQuickView({ token }) {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | on | off
  const [ahora, setAhora] = useState(Date.now());

  const cargarDatos = useCallback(async (mostrarLoading = false) => {
    if (!token) return;

    if (mostrarLoading) setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/totems`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "No fue posible obtener los tótems.");
      }

      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("Error cargando tótems:", err);
      setError(err.message || "Error consultando estado de tótems.");
    } finally {
      if (mostrarLoading) setLoading(false);
    }
  }, [token]);

  // Carga inicial + refresco de datos cada 60s
  useEffect(() => {
    cargarDatos(true);

    const interval = setInterval(() => cargarDatos(false), 60 * 1000);
    return () => clearInterval(interval);
  }, [cargarDatos]);

  // Reloj propio para que "tiempo encendido" avance solo, sin re-pedir datos
  useEffect(() => {
    const interval = setInterval(() => setAhora(Date.now()), 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Agrupa por local: una fila por tienda, no una por tótem
  const locales = useMemo(() => {
    const mapa = new Map();

    data.forEach(item => {
      const key = item.connection_id;

      if (!mapa.has(key)) {
        mapa.set(key, {
          connection_id: key,
          codLocal: item.codLocal,
          nombre: item.local_nombre || "Sin nombre",
          totems: []
        });
      }

      mapa.get(key).totems.push(item);
    });

    const resultado = [...mapa.values()];

    resultado.forEach(local => {
      local.totems.sort((a, b) => Number(a.totem_numero) - Number(b.totem_numero));
      local.cantidad = local.totems.length;
      local.on = local.totems.filter(estaEncendido).length;
      local.off = local.cantidad - local.on;
    });

    return resultado;
  }, [data]);

  const filas = useMemo(() => {
    const texto = search.trim().toLowerCase();

    return locales
      .filter(local => {
        if (filtro === "on" && local.on === 0) return false;
        if (filtro === "off" && local.off === 0) return false;

        if (!texto) return true;

        return (
          String(local.nombre || "").toLowerCase().includes(texto) ||
          String(local.codLocal || "").includes(texto)
        );
      })
      .sort((a, b) => {
        // locales con algún apagado primero: es lo que Operaciones necesita ver más rápido
        const aTieneOff = a.off > 0;
        const bTieneOff = b.off > 0;

        if (aTieneOff !== bTieneOff) return aTieneOff ? -1 : 1;

        return Number(a.codLocal) - Number(b.codLocal);
      });
  }, [locales, search, filtro]);

  const resumen = useMemo(() => {
    const total = data.length;
    const on = data.filter(estaEncendido).length;

    return { total, on, off: total - on };
  }, [data]);

  return (
    <div className="container-fluid p-2">

      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <h4 className="mb-0">Estado de Equipos</h4>
        <span className="badge bg-warning text-dark">Vista rápida · Testing</span>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => navigate("/totems")}>
          <i className="bi bi-arrow-left me-1" /> Volver a Monitor Tótems
        </button>
      </div>
      <div className="text-muted small mb-3">
        Pensada para Operaciones: quién está prendido, quién está apagado, y hace cuánto.
      </div>

      {/* RESUMEN */}
      <div className="d-flex flex-wrap gap-3 align-items-center mb-3 p-2 bg-light rounded border">
        <div><strong>{resumen.total}</strong> <span className="text-muted">equipos</span></div>
        <div className="text-success"><i className="bi bi-circle-fill me-1" style={{ fontSize: 8 }} /><strong>{resumen.on}</strong> prendidos</div>
        <div className="text-danger"><i className="bi bi-circle-fill me-1" style={{ fontSize: 8 }} /><strong>{resumen.off}</strong> apagados</div>

        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => cargarDatos(true)} title="Refrescar ahora">
          <i className="bi bi-arrow-clockwise" /> Refrescar
        </button>
      </div>

      {/* FILTROS */}
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <div className="btn-group btn-group-sm" role="group">
          <button className={`btn ${filtro === "todos" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setFiltro("todos")}>Todos</button>
          <button className={`btn ${filtro === "off" ? "btn-danger" : "btn-outline-danger"}`} onClick={() => setFiltro("off")}>Apagados</button>
          <button className={`btn ${filtro === "on" ? "btn-success" : "btn-outline-success"}`} onClick={() => setFiltro("on")}>Prendidos</button>
        </div>

        <input
          type="text"
          className="form-control form-control-sm"
          style={{ maxWidth: 220 }}
          placeholder="Buscar local..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && data.length === 0 && (
        <div className="text-center text-muted py-4">
          <div className="spinner-border spinner-border-sm me-2" />
          Consultando equipos...
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="table-responsive" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light sticky-top">
              <tr>
                <th>Local</th>
                <th>Kioscos</th>
                <th>Detalle por kiosco</th>
              </tr>
            </thead>

            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center text-muted py-4">
                    No hay locales que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                filas.map(local => (
                  <tr key={local.connection_id} className={local.off > 0 ? "table-danger" : ""}>
                    <td className="fw-semibold">{local.codLocal} - {local.nombre}</td>
                    <td>
                      <span className="badge bg-secondary me-1">{local.cantidad}</span>
                      {local.off > 0 && (
                        <span className="badge bg-danger me-1">{local.off} OFF</span>
                      )}
                      {local.on > 0 && (
                        <span className="badge bg-success">{local.on} ON</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {local.totems.map(totem => {
                          const on = estaEncendido(totem);
                          const detalleApagado = !on && totem.hora_apagado
                            ? `hace ${tiempoTranscurrido(totem.hora_apagado, ahora)}`
                            : !on ? "desde hora desconocida" : "";

                          return (
                            <span
                              key={totem.id}
                              className={`badge ${on ? "bg-success" : "bg-danger"}`}
                              title={on
                                ? `Tótem ${totem.totem_numero} · encendido ${formatoHora(totem.hora_encendido)}`
                                : `Tótem ${totem.totem_numero} · apagado ${detalleApagado}`}
                            >
                              T{totem.totem_numero}
                              {on && ` · ${formatoHora(totem.hora_encendido)} (${tiempoTranscurrido(totem.hora_encendido, ahora)})`}
                              {!on && totem.hora_apagado && ` · ${detalleApagado}`}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TotemsQuickView;
