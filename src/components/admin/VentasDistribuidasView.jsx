import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";

function VentasDistribuidasView({token}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/ventas/ventas-diarias`,  
        { method: "GET", headers: 
          { Authorization: `Bearer ${token} `}, 
        });
      const json = await res.json();
      
      setData(json);
    } catch (e) {
      console.error(e);
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid mt-0 p-0">
      <h4 className="mb-3">📊 Conciliación Local vs Central</h4>

      <div style={{ maxHeight: 500, overflowY: "auto" }}>
        <table className="table table-sm table-hover mb-0 align-middle">       
          <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
            <tr>
              <th>Local</th>
              <th className="text-end">Local $</th>
              <th className="text-end d-none d-md-table-cell">Central $</th>
              <th className="text-end">Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
        <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center text-muted py-4">
                  
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted py-4">
                  <i className="bi bi-info-circle me-2"></i>
                  Sin registro
                </td>
              </tr>
            ) : (
              data.map((l) => {
                const localTotal = l.local?.total ?? 0;
                const centralTotal = l.central?.total ?? 0;
                const diferenciaTotal = l.diferencia?.total ?? 0;
                const sinConexion = l.estado === "SIN_CONEXION";

                return (
                  <tr key={l.codLocal}>

                    {/* LOCAL */}
                    <td>
                      <div className="fw-semibold">
                        {l.name || "Sin nombre"}
                      </div>

                      {/* Mobile: mostrar central como secundario */}
                      <div className="d-md-none text-muted small">
                        Central: ${centralTotal.toLocaleString("es-CL")}
                      </div>
                    </td>

                    {/* LOCAL */}
                    <td className="text-end">
                      {sinConexion ? "—" : `$${localTotal.toLocaleString("es-CL")}`}
                    </td>

                    {/* CENTRAL SOLO DESKTOP */}
                    <td className="text-end d-none d-md-table-cell">
                      ${centralTotal.toLocaleString("es-CL")}
                    </td>

                    {/* DIFERENCIA */}
                    <td className="text-end fw-bold">
                      {sinConexion ? "—" : `$${diferenciaTotal.toLocaleString("es-CL")}`}
                    </td>

                    {/* ESTADO */}
                    <td>
                      {sinConexion ? (
                        <span className="badge bg-warning text-dark" title={l.error || "No se pudo consultar el local"}>
                          Sin conexión
                        </span>
                      ) : diferenciaTotal === 0 ? (
                        <span className="badge bg-success">
                          OK
                        </span>
                      ) : (
                        <span className="badge bg-danger">
                          Diferencia
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>          
        </table>
      </div>

      {loading && (
        <div className="progress mb-2">
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            style={{ width: "100%" }}
          >
            Consultando servidor... Por favor espere
          </div>
        </div>
      )}
    </div>
  );
}

export default VentasDistribuidasView;

