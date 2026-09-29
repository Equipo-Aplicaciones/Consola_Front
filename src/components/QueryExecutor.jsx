import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config"; 

function QueryExecutor({ token }) {
  const [connectionId, setConnectionId] = useState(localStorage.getItem("connectedConnectionId") || "");
  const [connectionName, setConnectionName] = useState(localStorage.getItem("connectedConnectionName") || "");
  const [connectionStatus, setConnectionStatus] = useState(localStorage.getItem("connectionStatus") || "");
  const [isConnected, setIsConnected] = useState(!!localStorage.getItem("connectedConnectionId"));
  

  const [articulos, setArticulos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [codLocal, setCodLocal] = useState("");
  const itemsPerPage = 20;

  // 🔹 Detectar cambios de conexión (en tiempo real)
  useEffect(() => {
    //const codLocal = localStorage.getItem("codLocal")|| "";
    //const user = JSON.parse(localStorage.getItem("authUser"));

    const updateConnection = () => {
      /*const id = localStorage.getItem("connectedConnectionId") || "";
      const name = localStorage.getItem("connectedConnectionName") || "";*/
      const newId = localStorage.getItem("connectedConnectionId") || "";
      const newName = localStorage.getItem("connectedConnectionName") || "";
      const status = localStorage.getItem("connectionStatus") || "";
      const storedUser = JSON.parse(localStorage.getItem("authUser"));
      const storedCodLocal = localStorage.getItem("codLocal");

      setCurrentUser(storedUser);
      setCodLocal(storedCodLocal);
      setConnectionId(newId);
      setConnectionName(newName);
      setConnectionStatus(status);

      // 🧹 Limpia artículos si cambia la conexión o está pendiente
      if (status === "PENDING" || !newId) {
        setArticulos([]);
        setMessage("Esperando validación de la conexión...");
        setSearchTerm("");
        setCurrentPage(1);
      }

      
      setIsConnected(newId && status === "OK");
    };

    updateConnection();
    window.addEventListener("storage", updateConnection);
    return () => window.removeEventListener("storage", updateConnection);
  }, []);

  const loadArticulos = async () => {
    if (!connectionId) return setMessage("Selecciona y prueba una conexión primero (en Conexiones)");
    setLoading(true);
    setMessage("Cargando artículos...");
    try {
      const res = await fetch(`${API_BASE_URL}/query/articulos/${connectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setArticulos(data.data || []);
        setFiltered(data.data || []);
        setMessage(`Se cargaron ${data.data.length} artículos`);
      } else {
        setMessage(data.message || "Error al cargar artículos");
        setArticulos([]);
        setFiltered([]);
      }
    } catch (err) {
      setMessage("Error al conectar al backend");
      setArticulos([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Filtro por código o descripción
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filteredData = articulos.filter(
      (a) =>
        a.Codigo.toString().toLowerCase().includes(term) ||
        (a.Descrip && a.Observac.toLowerCase().includes(term))
    );
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [searchTerm, articulos]);

  // 🔹 Paginación
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const toggleWeb = async (codigo, currentWeb,user,codLocal,nombre_articulo) => {
    const ok = window.confirm(`¿Confirma cambiar Web para artículo ${codigo} a ${currentWeb ? "OFF" : "ON"}?`);
    if (!ok) return;
    setMessage("Actualizando...");
    
    const nombreArticulo = nombre_articulo
      .trim()
      .replace(/\s+/g, " ");
      
    try {
      const res = await fetch(`${API_BASE_URL}/query/toggle-web`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connectionId, codigo, username: user.full_name,codLocal,nombreArticulo }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        await loadArticulos();
      } else {
        setMessage(data.message || "No se pudo actualizar");
      }
    } catch (err) {
      setMessage("Error al actualizar Web");
    }
  };

  const getPages = () => {
    const pages = [];

    const start = Math.max(1, currentPage - 1);
    const end = Math.min(totalPages, currentPage + 1);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="card p-3 p-md-4 shadow-sm mt-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
        <div>
          <h5 className="mb-0">Artículos (KIOSKO)</h5>
          {connectionName && (
            <small className="text-muted d-block">
              Conexión activa: <strong>{connectionName}</strong>
            </small>
          )}
        </div>

        <button className="btn btn-outline-primary w-100 w-md-auto"
            onClick={loadArticulos}
            disabled={connectionStatus !== "OK" || loading} >
          {loading ? "Cargando..." : connectionStatus === "OK" ? "Cargar Artículos" : "Conexión no establecida"}
        </button>
      </div>

      {/* 🔹 Campo de búsqueda */}
      <div className="mb-3">
        <input type="text" placeholder="Buscar por código o descripción..."
          className="form-control" value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={!isConnected} />
      </div>

      {message && (
        <div className={`p-2 alert ${message.includes("Error") ? "alert-danger" : "alert-info"}`}>
          {message}
        </div>
      )}

      {/* 🔹 Tabla */}
      <div className="table-responsive">
        <table className="table table-striped table-sm">
          <thead>
            <tr className="table-secondary">
              <th>Cód<span className="d-none d-md-inline ms-1">igo</span></th>
              <th>Articulo</th>
              {/*<th>Precio</th>*/}
              <th className="d-none d-md-table-cell">Descripción</th>
              <th>Kiosko</th>
              {/*<th>Acción</th>*/}
            </tr>
          </thead>
          <tbody>
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted">No hay artículos cargados</td>
              </tr>
            ) : (
              currentItems.map((a) => (
                <tr key={a.Codigo}>
                  <td>{a.Codigo}</td>
                  <td>{a.Descrip}</td>
                  {/*<td>{a.Precio}</td>*/}
                  <td className="d-none d-md-table-cell">{a.Observac}</td>
                  <td>
                    <button className={`btn btn-sm ${a.Web ? "btn-success" : "btn-danger"}`} 
                      onClick={() => toggleWeb(a.Codigo, a.Web, currentUser,codLocal,a.Descrip)} title={a.Web ? "Desactivar en Totem" : "Activar en Totem"}>
                      {a.Web ? "ON" : "OFF"}
                    </button>
                  </td>
                  {/*<td>
                    <button
                      className={`btn btn-sm ${a.Web ? "btn-warning" : "btn-outline-success"}`}
                      onClick={() => toggleWeb(a.Codigo, a.Web)}>                    
                      {a.Web ? "Desactivar" : "Activar"}
                    </button>
                  </td>*/}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 🔹 Paginador */}
      {totalPages > 1 && (
        <nav>
          <ul className="pagination justify-content-center flex-wrap">

            {getPages().map((p, i) => (
              <li
                key={i}
                className={`page-item ${currentPage === p ? "active" : ""} ${p === "..." ? "disabled" : ""}`}
              >
                <button
                  className="page-link"
                  onClick={() => typeof p === "number" && setCurrentPage(p)}
                >
                  {p}
                </button>
              </li>
            ))}

          </ul>
        </nav>
      )}
    </div>
  );
}

export default QueryExecutor;
