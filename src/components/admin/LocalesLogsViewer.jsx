import React, { useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "../../config";

function describirLog(l) {
  const local = l.local_nombre
    ? `${l.codlocal ? `${l.codlocal} - ` : ""}${l.local_nombre}`
    : `local #${l.entidad_id}`;

  if (l.entidad === "horario_base") {
    if (l.campo === "reemplazo_horario") {
      return `Reemplazó el horario base de ${local}: "${l.valor_anterior}" → "${l.valor_nuevo}".`;
    }
    if (l.campo === "bulk_horario") {
      return `Asignó horario masivo a ${local}: ${l.valor_nuevo}.`;
    }
    return `Cambió el horario base de ${local} (${l.campo}): "${l.valor_anterior}" → "${l.valor_nuevo}".`;
  }

  if (l.campo === "alta_local") {
    return `Creó el local ${l.valor_nuevo}.`;
  }

  if (l.campo === "baja_local") {
    return `Eliminó el local ${l.valor_anterior}.`;
  }

  if (l.campo === "activo") {
    return `Cambió el estado de ${local} a ${l.valor_nuevo === "true" ? "Activo" : "Inactivo"}.`;
  }

  return `Cambió el campo "${l.campo}" de ${local}: "${l.valor_anterior ?? "-"}" → "${l.valor_nuevo ?? "-"}".`;
}

function LocalesLogsViewer({ token }) {
  const [logs, setLogs] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [usuario, setUsuario] = useState("");
  const [local, setLocal] = useState("");
  const [message, setMessage] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (usuario) params.append("usuario", usuario);
      if (local) params.append("local", local);

      const res = await fetch(`${API_BASE_URL}/connections/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        alert("Su sesión ha expirado. Debe volver a iniciar sesión.");
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      if (!res.ok) {
        setMessage("Error al cargar los logs.");
        setLogs([]);
        return;
      }

      const json = await res.json();

      if (json.success) {
        setLogs(json.data || []);
        setMessage("");
      } else {
        setMessage(json.message || "Error al cargar logs.");
        setLogs([]);
      }
    } catch {
      setMessage("Error de conexión con el servidor.");
      setLogs([]);
    }
  }, [token, dateFrom, usuario, local]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center gap-2">
        <h5 className="mb-0">Logs de Locales y Horarios</h5>

        <button className="btn btn-sm btn-outline-secondary m-0" onClick={loadLogs}>
          <i className="bi bi-arrow-clockwise"></i>{" "}
          <span className="d-none d-md-inline ms-1">Refrescar</span>
        </button>
      </div>

      <div className="card-body">
        <div className="row g-2 mb-2 align-items-end">
          <div className="d-flex flex-row col-md-4 gap-1 align-items-center m-0">
            <label className="form-label small text-muted mb-0" style={{ width: "20%" }}>
              Fecha:
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="d-flex flex-row col-md-4 gap-1 align-items-center m-0">
            <label className="form-label small text-muted mb-0" style={{ width: "20%" }}>
              Usuario:
            </label>
            <input
              placeholder="Filtrar por usuario"
              className="form-control form-control-sm"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>

          <div className="d-flex flex-row col-md-4 gap-1 align-items-center m-0">
            <label className="form-label small text-muted mb-0" style={{ width: "20%" }}>
              Local:
            </label>
            <input
              placeholder="Filtrar por local"
              className="form-control form-control-sm"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>
        </div>

        {message && <div className="alert alert-warning small">{message}</div>}

        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <table className="table table-hover table-sm mb-0">
            <thead className="sticky-top bg-white shadow-sm" style={{ zIndex: 1 }}>
              <tr className="table-secondary">
                <th style={{ width: "15%" }}>Fecha</th>
                <th style={{ width: "15%" }}>Usuario</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((l) => {
                const formattedDate = new Date(l.created_at).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).replace(",", "");

                return (
                  <tr key={l.id}>
                    <td>{formattedDate}</td>
                    <td>
                      {l.usuario} <span className="text-muted small">({l.rol})</span>
                    </td>
                    <td>{describirLog(l)}</td>
                  </tr>
                );
              })}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="3" className="text-center text-muted py-3">
                    {message ? "No se pudieron cargar los registros." : "No hay registros que coincidan con el filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LocalesLogsViewer;
