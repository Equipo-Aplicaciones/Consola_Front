import { useCallback, useEffect, useState } from "react";
import { Badge } from "react-bootstrap";
import SavedQueryModal from "./SavedQueryModal";
import { API_BASE_URL } from "../../config";

function SavedQueries({ token }) {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editQuery, setEditQuery] = useState(null);

  const cargarQueries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/saved-queries`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Error cargando queries");
      }

      const data = await res.json();
      setQueries(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarQueries();
  }, [cargarQueries]);

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta query guardada?")) return;

    try {
      await fetch(`${API_BASE_URL}/saved-queries/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      cargarQueries();
    } catch (err) {
      console.error(err);
      alert("No fue posible eliminar la query.");
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center gap-2 px-2">
        <h4>Consultas SQL</h4>
        <button
          className="btn btn-sm btn-success m-0"
          onClick={() => {
            setEditQuery(null);
            setShowModal(true);
          }}
        >
          ➕ Query
        </button>
      </div>
      <div className="card-body p-0">
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div style={{ minHeight: 350, overflowY: "auto", maxHeight: 500 }}>
            <table className="table table-hover table-sm mb-0">
              <thead className="sticky-top bg-white shadow-sm">
                <tr className="table-secondary">
                  <th style={{ width: "20%" }}>Nombre</th>
                  <th style={{ width: "50%" }}>Descripción</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {queries.map(query => (
                  <tr key={query.id}>
                    <td className="text-nowrap fw-semibold">{query.nombre}</td>
                    <td className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
                      {query.descripcion || <span className="fst-italic">Sin descripción</span>}
                    </td>
                    <td className="text-center">
                      {query.activo ? (
                        <Badge bg="success">Activa</Badge>
                      ) : (
                        <Badge bg="secondary">Inactiva</Badge>
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-secondary me-1"
                        title="Editar"
                        onClick={() => {
                          setEditQuery(query);
                          setShowModal(true);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        title="Eliminar"
                        onClick={() => eliminar(query.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SavedQueryModal
        show={showModal}
        query={editQuery}
        onClose={() => setShowModal(false)}
        refresh={cargarQueries}
        token={token}
      />
    </div>
  );
}

export default SavedQueries;
