import { useEffect, useState, useCallback } from "react";
import HorarioBaseFormModal from "./HorarioBaseFormModal";
import HorarioEspecialModal from "./HorarioEspecialModal";
import Pagination from "../common/Pagination";
import { API_BASE_URL } from "../../config";
import MobileActions from "../utils/MobileActions";

export default function HorariosBasePage({ token }) {
  const [horarios, setHorarios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingHorario, setEditingHorario] = useState(null);

  const [showEspecialModal, setShowEspecialModal] = useState(false);
  const [horarioEspecial, setHorarioEspecial] = useState(null);

  const [searchLocal, setSearchLocal] = useState("");
  const [conHorario, setConHorario] = useState("");

  const limit = 10;

  /* ==========================================
     CARGAR EMPRESAS
  ========================================== */
  useEffect(() => {
    const cargarEmpresas = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/empresas`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
          alert("Su sesión ha expirado. Debe volver a iniciar sesión.");
          localStorage.clear();
          window.location.replace("/login");
          return;
        }

        if (!res.ok) throw new Error("Error cargando empresas");

        const data = await res.json();
        setEmpresas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Error cargando empresas:", err);
        setEmpresas([]);
      }
    };

    cargarEmpresas();
  }, [token]);


  /* ==========================================
     CARGAR HORARIOS BASE AGRUPADOS
  ========================================== */
  const fetchHorarios = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });

      if (searchLocal.trim()) {
        params.append("search", searchLocal.trim());
      }

      if (empresaSeleccionada) {
        params.append("empresa_id", empresaSeleccionada);
      }

      if (conHorario) {
        params.append("con_horario", conHorario);
      }

      const res = await fetch(`${API_BASE_URL}/horarios-base?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        alert("Su sesión ha expirado. Debe volver a iniciar sesión.");
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      if (!res.ok) {
        console.error("❌ Error cargando horarios base");
        return;
      }

      const data = await res.json();

      setHorarios(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total || 0);

    } catch (err) {
      console.error("❌ Error inesperado:", err);
    }
  }, [page, searchLocal, empresaSeleccionada, conHorario, token]);


  useEffect(() => {
    fetchHorarios();
  }, [fetchHorarios]);


  /* ==========================================
     CAMBIO DE EMPRESA
  ========================================== */
  const handleEmpresaChange = (e) => {
    setEmpresaSeleccionada(e.target.value);
    setPage(1);
  };


  /* ==========================================
     EXPORTAR EXCEL
  ========================================== */
  const exportarExcel = async () => {
    try {
      const params = new URLSearchParams();

      if (empresaSeleccionada) {
        params.append("empresa_id", empresaSeleccionada);
      }

      if (searchLocal.trim()) {
        params.append("search", searchLocal.trim());
      }

      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(
        `${API_BASE_URL}/horarios-base/export/excel${query}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.status === 401) {
        alert("Su sesión ha expirado. Debe volver a iniciar sesión.");
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      if (!response.ok) throw new Error("Error exportando");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "horarios.xlsx";
      a.click();

      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("No se pudo exportar el Excel");
    }
  };


  /* ==========================================
     RENDER
  ========================================== */
  return (
    <div className="cardpad card p-3 shadow-sm">

      <div className="d-flex justify-content-between align-items-center mb-2 gap-2 mlocalfilter">
        <h4 className="mb-0">Horarios Base</h4>

        <div className="d-flex gap-2 justify-content-end flex-wrap">

          {/* FILTRO EMPRESA */}
          <select className="form-select m-0"
            value={empresaSeleccionada}
            onChange={handleEmpresaChange}
            style={{ width: "190px" }}>
            <option value="">Todas las Empresas</option>

            {empresas.map(empresa => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nombre}
              </option>
            ))}
          </select>

          {/* FILTRO CON/SIN HORARIO */}
          <select className="form-select m-0"
            value={conHorario}
            onChange={(e) => {
              setConHorario(e.target.value);
              setPage(1);
            }}
            style={{ width: "170px" }}>
            <option value="">Con y sin horario</option>
            <option value="true">Con horario</option>
            <option value="false">Sin horario</option>
          </select>

          {/* BUSCADOR */}
          <input type="text" className="form-control m-0"
            placeholder="Buscar local..."
            value={searchLocal}
            onChange={(e) => {
              setSearchLocal(e.target.value);
              setPage(1);
            }}
            style={{ width: "220px" }} />

          {/* EXPORTAR */}
          <button className="btn btn-success" onClick={exportarExcel} title="Exportar Excel">
            <i className="bi bi-file-earmark-excel"></i>{" "}
            <span className="d-none d-md-inline ms-1">Exportar</span>
          </button>

          {/* NUEVO HORARIO */}
          <button className="btn btn-primary m-0" title="Asignar nuevo horario"
            onClick={() => {
              setEditingHorario(null);
              setShowModal(true);
            }}>
            ➕ <span className="d-none d-md-inline ms-1">Nuevo Horario</span>
          </button>

        </div>
      </div>


      <div style={{ maxHeight: 500, overflowY: "auto" }}>
        <table className="table table-bordered table-hover table-sm align-middle">

          <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
            <tr className="text-center table-secondary">
              <th>
                <span className="d-none d-md-inline ms-1">Nombre </span>
                Local
              </th>

              <th className="d-none d-md-table-cell">Formato Local</th>
              <th className="d-none d-md-table-cell">Zonal</th>
              <th className="d-none d-md-table-cell">Días</th>
              <th className="d-none d-md-table-cell">Apertura - Cierre</th>
              <th>Acciones</th>
            </tr>
          </thead>


          <tbody>
            {horarios.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center">
                  No hay horarios registrados
                </td>
              </tr>
            ) : (
              horarios.map(local => (
                <tr key={local.connection_id}>

                  {/* LOCAL */}
                  <td>
                    <strong>
                      {local.codlocal ? `${local.codlocal} - ` : ""}
                      {local.local_nombre}
                    </strong>

                    <div className="d-md-none text-muted small text-left" style={{ width: "100%" }}>
                      {local.horarios.length === 0 ? (
                        <div className="text-danger">Sin horario asignado</div>
                      ) : (
                        local.horarios.map((h, i) => (
                          <div key={i}>
                            {h.dias} - {h.cerrado ? "CERRADO" : h.horario}
                          </div>
                        ))
                      )}
                    </div>
                  </td>


                  {/* FORMATO LOCAL */}
                  <td className="d-none d-md-table-cell">
                    {local.formato || "-"}
                  </td>

                  {/* ZONAL */}
                  <td className="d-none d-md-table-cell">
                    {local.zonal_nombre || "-"}
                  </td>


                  {/* DÍAS */}
                  <td className="d-none d-md-table-cell">
                    {local.horarios.length === 0 ? (
                      <span className="text-danger">Sin horario asignado</span>
                    ) : (
                      local.horarios.map((h, i) => (
                        <div key={i}>{h.dias}</div>
                      ))
                    )}
                  </td>


                  {/* HORARIO */}
                  <td className="d-none d-md-table-cell">
                    {local.horarios.map((h, i) => (
                      <div key={i}>
                        {h.cerrado ? "CERRADO" : h.horario}
                      </div>
                    ))}
                  </td>


                  {/* ACCIONES */}
                  <td className="text-center">

                    <div className="d-none d-md-flex gap-2 justify-content-center">

                      {/* REEMPLAZAR HORARIO BASE */}
                      <button className="btn btn-sm btn-outline-primary"
                        title="Reemplazar Horario"
                        onClick={() => {
                          setEditingHorario({
                            connection_id: local.connection_id,
                            codlocal: local.codlocal,
                            local_nombre: local.local_nombre,
                            empresa_id: local.empresa_id
                          });

                          setShowModal(true);
                        }}>
                        🔁
                      </button>


                      {/* HORARIO ESPECIAL */}
                      <button className="btn btn-sm btn-outline-warning"
                        title="Asignar Horario Especial"
                        onClick={() => {
                          setHorarioEspecial({
                            connection_id: local.connection_id,
                            codlocal: local.codlocal,
                            local_nombre: local.local_nombre,
                            empresa_id: local.empresa_id
                          });

                          setShowEspecialModal(true);
                        }}>
                        ⏰
                      </button>

                    </div>


                    {/* MOBILE */}
                    <MobileActions
                      actions={[
                        {
                          label: "Reemplazar Horario",
                          icon: "🔁",
                          onClick: () => {
                            setEditingHorario({
                              connection_id: local.connection_id,
                              codlocal: local.codlocal,
                              local_nombre: local.local_nombre,
                              empresa_id: local.empresa_id
                            });

                            setShowModal(true);
                          }
                        },
                        {
                          label: "Asignar Horario Especial",
                          icon: "⏰",
                          onClick: () => {
                            setHorarioEspecial({
                              connection_id: local.connection_id,
                              codlocal: local.codlocal,
                              local_nombre: local.local_nombre,
                              empresa_id: local.empresa_id
                            });

                            setShowEspecialModal(true);
                          }
                        }
                      ]}
                    />

                  </td>
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>


      <Pagination
        page={page}
        total={total}
        limit={limit}
        onPageChange={setPage}
      />


      {/* MODAL HORARIO BASE */}
      {showModal && (
        <HorarioBaseFormModal
          token={token}
          localReemplazo={editingHorario}
          show={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingHorario(null);
          }}
          onSaved={fetchHorarios}
        />
      )}


      {/* MODAL HORARIO ESPECIAL */}
      {showEspecialModal && (
        <HorarioEspecialModal
          token={token}
          data={horarioEspecial}
          onClose={() => {
            setShowEspecialModal(false);
            setHorarioEspecial(null);
          }}
          onSaved={fetchHorarios}
        />
      )}

    </div>
  );
}