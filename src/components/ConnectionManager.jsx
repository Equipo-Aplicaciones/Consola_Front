import React, { useEffect, useState, useCallback, useMemo } from "react";
import { API_BASE_URL } from "../config";
import { apiFetch } from "./utils/api";
import Select from "react-select";

function ConnectionManager({ token }) {
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [connectedId, setConnectedId] = useState(localStorage.getItem("connectedConnectionId") || "");
  const [empresas, setEmpresas] = useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(2);
  const [rutVendedor, setRutVendedor] = useState("");
  const [vendedorEncontrado, setVendedorEncontrado] = useState(null);
  const [puestoVendedor, setPuestoVendedor] = useState("");
  const [estadoVendedor, setEstadoVendedor] = useState("");
  const [localesVendedor, setLocalesVendedor] = useState("");
  const [consultandoVendedor, setConsultandoVendedor] = useState(false);
  const [guardandoVendedor, setGuardandoVendedor] = useState(false);
  const [mensajeVendedor, setMensajeVendedor] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("vendedor");
  const [savedQueries, setSavedQueries] = useState([]);
  const [selectedQueryId, setSelectedQueryId] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [ejecutandoQuery, setEjecutandoQuery] = useState(false);
  const [resultadoQuery, setResultadoQuery] = useState(null);
  const [errorQuery, setErrorQuery] = useState("");
  const user = JSON.parse(localStorage.getItem("authUser") || "{}");
  const isAdmin = user.role === "Admin" || user.role === "N2";
  const isAdminOnly = user.role === "Admin";

  const cargarSavedQueries = useCallback(async () => {
    try {
      const data = await apiFetch("/saved-queries");
      setSavedQueries((data || []).filter(q => q.activo));
    } catch {
      setSavedQueries([]);
    }
  }, []);

  useEffect(() => {
    if (isAdminOnly) {
      cargarSavedQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOnly]);

  const limpiarQuery = () => {
    setSelectedQueryId("");
    setSqlText("");
    setResultadoQuery(null);
    setErrorQuery("");
  };

  function onSeleccionarQuery(opt) {
    const id = opt?.value || "";
    setSelectedQueryId(id);
    setResultadoQuery(null);
    setErrorQuery("");
    const q = savedQueries.find(sq => String(sq.id) === String(id));
    setSqlText(q?.sql_text || "");
  }

  const ejecutarQuery = async () => {
    if (!selectedQueryId || !sqlText.trim()) return;

    const esSelect = sqlText.trim().toUpperCase().startsWith("SELECT");
    const nombreLocal = selectedConnection
      ? `${selectedConnection.codLocal} — ${selectedConnection.name}`
      : "el local conectado";

    const ok = window.confirm(
      esSelect
        ? `¿Confirma ejecutar esta consulta en ${nombreLocal}?`
        : `Esta query modificará datos reales en ${nombreLocal}. ¿Confirma ejecutarla?`
    );
    if (!ok) return;

    setEjecutandoQuery(true);
    setResultadoQuery(null);
    setErrorQuery("");

    try {
      const res = await fetch(`${API_BASE_URL}/saved-queries/${selectedQueryId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ connectionId: selected, sql: sqlText })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorQuery(data.message || "Error ejecutando la query.");
        return;
      }

      setResultadoQuery(data);
    } catch {
      setErrorQuery("Error de conexión al backend.");
    } finally {
      setEjecutandoQuery(false);
    }
  };

  async function cargarEmpresas() {
    const res = await fetch(`${API_BASE_URL}/empresas`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.status === 401) {
      alert("Su sesión ha expirado. Debe volver a iniciar sesión.");
      localStorage.clear();
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setEmpresas(Array.isArray(data) ? data : []);
  }

  const fetchConnections = useCallback(async () => {
    try {
      const data = await apiFetch("/connections");
      const sorted = [...data].sort((a, b) => {
        if (a.codLocal && b.codLocal) {
          if (!isNaN(a.codLocal) && !isNaN(b.codLocal)) return Number(a.codLocal) - Number(b.codLocal);
          return String(a.codLocal).localeCompare(String(b.codLocal));
        }
        return a.id - b.id;
      });
      setConnections(sorted);
    } catch {
      setMessage("❌ No se pudieron cargar las conexiones");
    }
  }, []);

  const filteredConnections = useMemo(() => {
    return connections.filter(c => Number(c.empresa_id) === Number(empresaSeleccionada));
  }, [connections, empresaSeleccionada]);

  const selectedConnection = useMemo(() => {
    return connections.find(c => String(c.id) === String(selected)) || null;
  }, [connections, selected]);

  const queryDescripcionActual = useMemo(() => {
    return savedQueries.find(q => String(q.id) === String(selectedQueryId))?.descripcion || "";
  }, [savedQueries, selectedQueryId]);

  useEffect(() => {
    cargarEmpresas();
    fetchConnections();
  }, [fetchConnections]);

  const limpiarVendedor = () => {
    setRutVendedor("");
    setVendedorEncontrado(null);
    setPuestoVendedor("");
    setEstadoVendedor("");
    setLocalesVendedor("");
    setMensajeVendedor("");
  };

  const handleTestConnection = async id => {
    setMessage("⏳ Probando conexión...");
    try {
      const res = await fetch(`${API_BASE_URL}/connections/test/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? "Conexión OK" : "Error"));
      if (data.success) {
        const connection = connections.find(c => String(c.id) === String(id));
        if (connection) {
          localStorage.setItem("connectedConnectionId", String(id));
          localStorage.setItem("connectedConnectionName", connection.name || "");
          localStorage.setItem("connectionStatus", "OK");
          localStorage.setItem("codLocal", connection.codLocal);
          setConnectedId(String(id));
          window.dispatchEvent(new Event("storage"));
        }
      } else {
        localStorage.removeItem("connectedConnectionId");
        localStorage.removeItem("connectedConnectionName");
        localStorage.removeItem("connectionStatus");
        setConnectedId("");
        window.dispatchEvent(new Event("storage"));
      }
    } catch {
      setMessage("❌ Error al intentar conectar");
    }
  };

  const consultarVendedor = async () => {
    if (!selected) {
      setMensajeVendedor("Debe seleccionar un local.");
      return;
    }
    if (!rutVendedor.trim()) {
      setMensajeVendedor("Debe ingresar un RUT.");
      return;
    }
    setConsultandoVendedor(true);
    setMensajeVendedor("");
    setVendedorEncontrado(null);
    setPuestoVendedor("");
    setEstadoVendedor("");
    setLocalesVendedor("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/connections/${selected}/vendedor/${encodeURIComponent(rutVendedor.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMensajeVendedor(data.message || "No fue posible consultar el vendedor.");
        return;
      }
      setVendedorEncontrado(data);
      setPuestoVendedor(String(data.puesto || "").trim().toUpperCase());
      setLocalesVendedor(String(data.locales || ""));
      const activo = Number(data.debaja) === 0 && Number(data.inhab) === 0;
      setEstadoVendedor(activo ? "ACTIVO" : "INACTIVO");
    } catch {
      setMensajeVendedor("Error consultando el vendedor.");
    } finally {
      setConsultandoVendedor(false);
    }
  };

  const guardarVendedor = async () => {
    if (!vendedorEncontrado) return;
    if (!puestoVendedor || !estadoVendedor) {
      setMensajeVendedor("Debe seleccionar puesto y estado.");
      return;
    }
    const confirmar = window.confirm(`¿Desea guardar los cambios para ${vendedorEncontrado.nombre}?`);
    if (!confirmar) return;
    setGuardandoVendedor(true);
    setMensajeVendedor("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/connections/${selected}/vendedor/${encodeURIComponent(vendedorEncontrado.cuil)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            vendedor: vendedorEncontrado.vendedor,
            puesto: puestoVendedor,
            estado: estadoVendedor,
            locales: localesVendedor
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMensajeVendedor(data.message || "No fue posible guardar los cambios.");
        return;
      }
      const activo = estadoVendedor === "ACTIVO";
      setVendedorEncontrado(prev => ({
        ...prev,
        puesto: puestoVendedor,
        locales: localesVendedor,
        debaja: activo ? 0 : 1,
        inhab: activo ? 0 : 1
      }));
      setMensajeVendedor(data.message || "Vendedor actualizado correctamente. RRHH fue notificado.");
    } catch {
      setMensajeVendedor("Error guardando los cambios.");
    } finally {
      setGuardandoVendedor(false);
    }
  };

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage("");
    }, 10000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="card p-4 shadow-sm">
      <h4 className="mb-3">Gestión de Conexiones</h4>

      <div className="d-flex gap-4 align-items-center flex-wrap">
        <label className="form-label fw-bold mb-0">Empresa:</label>
        <Select
          styles={{ container: base => ({ ...base, width: 220, flex: "0 0 220px" }) }}
          value={empresas
            .map(emp => ({
              value: emp.id,
              label: emp.nombre
            }))
            .find(opt => Number(opt.value) === Number(empresaSeleccionada)) || null}
          options={empresas.map(emp => ({
            value: emp.id,
            label: emp.nombre
          }))}
          onChange={opt => {
            setEmpresaSeleccionada(opt?.value || "");
            setSelected("");
            limpiarVendedor();
            limpiarQuery();
            localStorage.removeItem("connectedConnectionId");
            localStorage.removeItem("connectedConnectionName");
            localStorage.removeItem("connectionStatus");
            localStorage.removeItem("codLocal");
            setConnectedId("");
            window.dispatchEvent(new Event("storage"));
          }}
        />

        <Select styles={{ container: base => ({ ...base, flex: "1 1 0%", minWidth: 200 }) }}
          options={filteredConnections.map(c => ({
            value: c.id, label: `${c.codLocal ? `${c.codLocal} — ` : ""}${c.name} (${c.host})`
          }))}
          placeholder="Selecciona local o escribe para buscar..." value={filteredConnections
            .map(c => ({
              value: c.id,
              label: `${c.codLocal ? `${c.codLocal} — ` : ""}${c.name} (${c.host})`
            }))
            .find(opt => String(opt.value) === String(selected)) || null}
          onChange={opt => {
            const id = opt?.value || "";
            setSelected(id);
            limpiarVendedor();
            limpiarQuery();
            localStorage.setItem("connectedConnectionId", "");
            localStorage.setItem("connectedConnectionName", "");
            localStorage.setItem("connectionStatus", "PENDING");
            window.dispatchEvent(new Event("storage"));
            if (id) handleTestConnection(id);
          }}
        />
      </div>

      {message && (
        <div className={`alert my-2 p-2 ${
            message.includes("OK")
              ? "alert-success"
              : message.includes("⏳")
              ? "alert-info"
              : "alert-warning"
          }`} >
          {message}
        </div>
      )}

      {isAdmin && (
        <>
          <hr className="my-3" />

          {!selected || String(connectedId) !== String(selected) ? (
            <div className="alert alert-secondary mb-0 p-1 px-2">
              Seleccione un local para consultar un vendedor{isAdminOnly ? " o ejecutar una query" : ""}.
            </div>
          ) : (
            <>
              {isAdminOnly && (
                <ul className="nav nav-tabs mb-3">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${activeSubTab === "vendedor" ? "active" : ""}`}
                      onClick={() => setActiveSubTab("vendedor")}
                    >
                      Consultar Vendedor
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${activeSubTab === "querys" ? "active" : ""}`}
                      onClick={() => setActiveSubTab("querys")}
                    >
                      Acciones Querys
                    </button>
                  </li>
                </ul>
              )}

              {(activeSubTab === "vendedor" || !isAdminOnly) && (
            <div>
              <div className="row g-3 align-items-center">
                {selectedConnection && (
                  <div className="col-md-4">
                    <div className="d-flex align-items-end gap-2">
                      <span className="fw-bold">Local:</span>
                      <span className="small text-truncate">{selectedConnection.codLocal} — {selectedConnection.name}</span>
                    </div>
                  </div>
                )}
                <div className={selectedConnection ? "col-md-5" : "col-md-8"}>
                  <div className="d-flex align-items-end gap-2">
                    <label className="form-label fw-bold">RUT:</label>
                    <input type="text" className="form-control" placeholder="Ingrese RUT" value={rutVendedor}
                      onChange={e => {
                        setRutVendedor(e.target.value);
                        setVendedorEncontrado(null);
                        setPuestoVendedor("");
                        setEstadoVendedor("");
                        setMensajeVendedor("");
                      }}
                      onKeyDown={e => { if (e.key === "Enter") consultarVendedor(); }} />
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="d-flex align-items-center gap-2">
                    <button type="button" className="btn btn-primary w-100" onClick={consultarVendedor}
                      disabled={!rutVendedor.trim() || consultandoVendedor} >
                      {consultandoVendedor ? "Consultando..." : "Consultar"}
                    </button>
                  </div>
                </div>
              </div>

              {vendedorEncontrado && (
                <div className="border rounded p-2 mt-3">
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <div className="d-flex align-items-end gap-2">
                        <small className="text-muted d-block">Nombre:</small>
                        <strong className="text-truncate" title={vendedorEncontrado.nombre}>{vendedorEncontrado.nombre}</strong>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex align-items-end gap-2">
                        <small className="text-muted d-block">RUT:</small>
                        <strong>{vendedorEncontrado.cuil}</strong>
                      </div>
                    </div>
                    
                    <div className="col-md-4">
                      <div className="d-flex align-items-end gap-2">
                        <small className="text-muted d-block">Estado Actual:</small>
                        {Number(vendedorEncontrado.debaja) === 0 && Number(vendedorEncontrado.inhab) === 0 ? (
                          <span className="badge bg-success">ACTIVO</span>
                        ) : (
                          <span className="badge bg-danger">INACTIVO</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 align-items-end">
                    <div className="col-md-3">
                      <label className="form-label fw-bold">Puesto</label>
                      <select className="form-select" value={puestoVendedor}
                        onChange={e => setPuestoVendedor(e.target.value)} >
                        <option value="">Seleccione...</option>
                        <option value="CAJERO">CAJERO</option>
                        <option value="GERENTE">GERENTE</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-bold">Estado</label>
                      <select className="form-select" value={estadoVendedor}
                        onChange={e => setEstadoVendedor(e.target.value)} >
                        <option value="">Seleccione...</option>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-bold">Locales</label>
                      <input type="text" className="form-control" value={localesVendedor}
                        placeholder="0,codLocal"
                        onChange={e => setLocalesVendedor(e.target.value)} />
                    </div>
                    <div className="col-md-3">
                      <button type="button" className="btn btn-success w-100" onClick={guardarVendedor}
                        disabled={guardandoVendedor || !puestoVendedor || !estadoVendedor} >
                        {guardandoVendedor ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {mensajeVendedor && (
                <div className="alert alert-info mt-3 mb-0">
                  {mensajeVendedor}
                </div>
              )}
            </div>
              )}

              {isAdminOnly && activeSubTab === "querys" && (
                <div>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <label className="form-label fw-bold mb-0 text-nowrap">Query guardada:</label>
                    <div style={{ minWidth: 280 }} className="flex-grow-1">
                      <Select
                        options={savedQueries.map(q => ({ value: q.id, label: q.nombre }))}
                        value={savedQueries
                          .map(q => ({ value: q.id, label: q.nombre }))
                          .find(opt => String(opt.value) === String(selectedQueryId)) || null}
                        onChange={onSeleccionarQuery}
                        placeholder="Selecciona una query..."
                      />
                    </div>
                  </div>

                  {selectedQueryId && (
                    <>
                      {queryDescripcionActual && (
                        <div className="alert alert-secondary py-2 px-3 mb-3">
                          {queryDescripcionActual}
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="form-label fw-bold">SQL a ejecutar</label>
                        <pre className="bg-light border rounded p-2 mb-0" style={{ whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto" }}>
                          {sqlText}
                        </pre>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={ejecutarQuery}
                        disabled={ejecutandoQuery || !sqlText.trim()}
                      >
                        {ejecutandoQuery ? "Ejecutando..." : "Ejecutar"}
                      </button>
                    </>
                  )}

                  {errorQuery && (
                    <div className="alert alert-danger mt-3 mb-0">
                      ❌ {errorQuery}
                    </div>
                  )}

                  {resultadoQuery && (
                    <div className="alert alert-success mt-3 mb-0">
                      ✅ {resultadoQuery.message}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default ConnectionManager;
