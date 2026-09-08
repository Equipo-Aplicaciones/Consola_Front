import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";
import MobileActions from "../utils/MobileActions";
import ConnectionDetalleModal from "./ConnectionDetalleModal";
import Select from "react-select";
import * as XLSX from "xlsx";
import { logout } from "../utils/logout";

function ConnectionsAdmin({ token }) {
  const emptyForm = {
    id: null,
    name: "",
    host: "",
    codLocal: "",
    kiosko: false,
    ck: "",
    kds: false,
    c_kds: "",
    llamador: false,
    c_llamador: "",
    activo: true,
    rut: "",
    razon_social: "",
    empresa_id: null,
    formato: ""
  };

  const [data, setData] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showDetalle, setShowDetalle] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [sessionExpired, setSessionExpired] = useState(false);
    
  
  // 🔥 OPCIONES EMPRESA
  const empresasOptions = [
    { rut: "89505200-0", razon_social: "Comercial Tarragona S.A" },
    { rut: "77686950-3", razon_social: "Administradora Arbal Ltda." },
    { rut: "81256700-4", razon_social: "Avicola Montserrat Ltda." },
    { rut: "84128600-6", razon_social: "Distribuidora Montserrat" },
    { rut: "83037300-4", razon_social: "Comercial Juan Batlle" },
  ];

  const [filtros, setFiltros] = useState({
    texto: "",
    empresa: "",
    razonSocial: "",
    kiosko: "",
    kds: "",
    llamador: "",
    activo: ""
  });

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const cargar = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/connections/paneladmin?search=${search}`,
        { headers }
      );

      // Sesión expirada
      if (res.status === 401) {
          setSessionExpired(true);
          alert("Su sesión ha expirado. Debe volver a iniciar sesión.");
          logout();
          return;
      }

      const json = await res.json();
      
      setData(json);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  // 🔹 Cargar Empresa
  async function cargarEmpresas() {
    try {
      const res = await fetch(`${API_BASE_URL}/empresas`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Sesión expirada
      if (res.status === 401) {

        alert("Su sesión ha expirado. Debe volver a iniciar sesión.");

        localStorage.clear();

        window.location.href = "/login";

        return;
      }

      const data = await res.json();
      setEmpresas(Array.isArray(data) ? data : []);

    } catch {
      setEmpresas([]);
    }
  }

  useEffect(() => {
    cargarEmpresas();
    cargar();
  }, []);

  const guardar = async () => {
    if (!form.empresa_id ) {
      alert("Debe seleccionar una empresa.");
      return;
    }
    try {
      const method = form.id ? "PUT" : "POST";
      const url = form.id
        ? `${API_BASE_URL}/connections/${form.id}`
        : `${API_BASE_URL}/connections`;

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al guardar el local.");
      }

      alert(
        form.id
          ? "✅ Local actualizado correctamente."
          : "✅ Local creado correctamente."
      );

      setForm(emptyForm);
      cargar();
    } catch (err) {
      console.error(err);
      alert(`❌ ${err.message}`);
    }
  };

  const editar = (row) => {
    setForm(row);
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar registro?")) return;

    await fetch(`${API_BASE_URL}/connections/${id}`, {
      method: "DELETE",
      headers
    });

    cargar();
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const toggleActivo = async (id, value) => {
      if (!window.confirm("¿Seguro de cambiar el estado del local?")) return;
  
      await fetch(`${API_BASE_URL}/connections/estado/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activo: value }),
      });
  
      cargar();
    };


    const dataFiltrada = data.filter(item => {
      const cumpleTexto =
        !filtros.texto ||

        item.name?.toLowerCase().includes(
          filtros.texto.toLowerCase()
        ) ||

        item.codLocal?.toString().includes(
          filtros.texto
        );

      const cumpleEmpresa =
        filtros.empresa === "" ||
        Number(item.empresa_id) === Number(filtros.empresa);

      const cumpleRazonSocial =
        !filtros.razonSocial ||

        item.razon_social === filtros.razonSocial;

      const cumpleKiosko =
        filtros.kiosko === "" ||

        item.kiosko ===
          (filtros.kiosko === "true");

      const cumpleKds =
        filtros.kds === "" ||

        item.kds ===
          (filtros.kds === "true");

      const cumpleActivo =
        filtros.activo === "" ||

        item.activo ===
          (filtros.activo === "true");

      return (
        cumpleTexto &&
        cumpleEmpresa &&
        cumpleRazonSocial &&
        cumpleKiosko &&
        cumpleKds &&
        cumpleActivo
      );
    });

    const exportarExcel = () => {
      const rows = dataFiltrada.map(local => ({
        "Código Local": local.codLocal,
        "Nombre Local": local.name,
        "RUT": local.rut,
        "Razón Social": local.razon_social,
        "Host": local.host,
        "Formato": local.formato || "",
        "Activo": local.activo ? "Sí" : "No",
        "Kiosko": local.kiosko ? "Sí" : "No",
        "Cant. Kiosko": local.ck || 0,
        "KDS": local.kds ? "Sí" : "No",
        "Cant. KDS": local.c_kds || 0,
        "Llamador": local.llamador ? "Sí" : "No",
        "Cant. Llamador": local.c_llamador || 0,
        "Zonal": local.zonal_nombre || ""
      }));

      const workbook = XLSX.utils.book_new();

      const worksheet =
        XLSX.utils.json_to_sheet(rows);

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Locales"
      );

      const fecha = new Date()
        .toISOString()
        .split("T")[0];

      XLSX.writeFile(
        workbook,
        `Locales_${fecha}.xlsx`
      );
    };

  if (sessionExpired) {
    return null;
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Administrar Locales</h5>

        <div className="d-flex gap-2 justify-content-end align-items-center flex-wrap">
          
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="Buscar local..."
                value={filtros.texto}
                onChange={(e) =>
                  setFiltros(prev => ({
                    ...prev,
                    texto: e.target.value
                  }))
                }
              />
            </div>

            <div className="col-md-2">
              <select className="form-select" value={filtros.empresa}
                onChange={(e) =>
                  setFiltros(prev => ({
                    ...prev,
                    empresa: e.target.value
                  }))
                } >
                <option value="">Empresa</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id} >
                    {emp.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <select className="form-select" value={filtros.razonSocial}
                onChange={(e) =>
                  setFiltros(prev => ({
                    ...prev,
                    razonSocial: e.target.value
                  }))
                } >
                <option value="">Rut</option>

                {[...new Set(data.map(x => x.razon_social))]
                  .filter(Boolean)
                  .sort()
                  .map(rs => (
                    <option key={rs} value={rs}>
                      {rs}
                    </option>
                  ))}
              </select>
            </div>

            <div className="col-md-2">
              <select className="form-select" value={filtros.kiosko}
                onChange={(e) =>
                  setFiltros(prev => ({
                    ...prev,
                    kiosko: e.target.value
                  }))
                } >
                <option value="">Kiosko</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="col-md-2">
              <select className="form-select" value={filtros.kds}
                onChange={(e) =>
                  setFiltros(prev => ({
                    ...prev,
                    kds: e.target.value
                  }))
                } >
                <option value="">KDS</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

          </div>

          <button className="btn btn-outline-secondary mx-1" onClick={() =>
              setFiltros({
                texto: "",
                empresa: "",
                razonSocial: "",
                kiosko: "",
                kds: "",
                llamador: "",
                activo: ""
              })
            } > <i className="bi bi-arrow-clockwise"></i> </button>
  
      </div>

      <div className="card-body border-bottom">
        <div className="row g-2">

          <div className="col-md-3">
            <input className="form-control" name="name" placeholder="Nombre"
              value={form.name} onChange={onChange} />
          </div>

          <div className="col-md-3">
            <input className="form-control" name="host" placeholder="Host"
              value={form.host} onChange={onChange} />
          </div>

          <div className="col-md-2">
            <input className="form-control" name="codLocal" placeholder="CodLocal"
              value={form.codLocal} onChange={onChange} />
          </div>

          <div className="col-md-2">
            <select className="form-select" name="formato" value={form.formato || ""} onChange={onChange}>
              <option value="">Formato</option>
              <option value="CALLE">Calle</option>
              <option value="MALL">Mall</option>
              <option value="SUPER">Super</option>
              <option value="TERMINAL">Terminal</option>
            </select>
          </div>

          <div className="col-md-3">
            <select className="form-select" value={`${form.rut}|${form.razon_social}`} onChange={(e) => {
                const [rut, razon_social] = e.target.value.split("|");
                setForm(prev => ({
                  ...prev,
                  rut,
                  razon_social
                }));
              }}
            >
              <option value=""> Seleccione Rut </option>
              {empresasOptions.map((empresa, index) => (
                <option key={index} value={`${empresa.rut}|${empresa.razon_social}`} >

                  {empresa.rut} {" - "}  {empresa.razon_social}

                </option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6 d-flex gap-3 align-items-center">
            <label><input type="checkbox" name="kiosko" checked={form.kiosko} onChange={onChange} />Kiosko</label>
            <input className="form-control" name="ck" placeholder="Cant. Kiosko"
            title="Cantidad de kioskos" value={form.ck} onChange={onChange}  disabled={!form.kiosko} />
            
            <label><input type="checkbox" name="kds" checked={form.kds} onChange={onChange} /> KDS</label>
            <input className="form-control" name="c_kds" placeholder="Cant. KDS" title="Cantidad de KDS"
              value={form.c_kds} onChange={onChange} disabled={!form.kds} />

            <label><input type="checkbox" name="llamador"
              checked={form.llamador} onChange={onChange} /> Llamador</label>
            <input className="form-control" name="c_llamador" title="IP del Llamador, solo ultimo octeto" placeholder="IP."
              value={form.c_llamador} onChange={onChange} disabled={!form.llamador} />
            
          </div>

          <div className="col-md-6 d-flex gap-2 justify-content-end m-auto">
            <Select className="flex-grow-1" placeholder="Empresa" isClearable
              value={ empresas .map(emp => ({ value: emp.id, label: emp.nombre }))
                      .find(opt => opt.value === form.empresa_id) || null }
              options={empresas.map(emp => ({ value: emp.id, label: emp.nombre }))}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              styles={{
                  menuPortal: base => ({
                      ...base,
                      zIndex: 9999
                  })
              }}
              onChange={(opt) => {
                  setForm(prev => ({
                      ...prev,
                      empresa_id: opt ? opt.value : null
                  }));
              }} />
            <button className="btn btn-success w-25" onClick={guardar}>
              {form.id ? "Actualizar" : "Crear"}
            </button>

            <button className="btn btn-secondary w-25"
              onClick={() => setForm(emptyForm)}>
              Limpiar
            </button>
          </div>

        </div>
      </div>

      <div className="table-responsive" style={{ maxHeight: 400, overflowY: "auto" }}>
        <table className="table table-sm table-hover mb-0">
          <thead className="table-light sticky-top align-middle">
            <tr>
              <th>Local</th>
              <th>Cod</th>
              <th>Host</th>
              <th>Formato</th>
              <th>Kiosko</th>
              <th>KDS</th>
              <th>Llamador</th>
              <th className="text-center">Acciones 
                <button className="btn btn-sm btn-outline-secondary mx-2 pr-1" onClick={exportarExcel} >
                  <i className="bi bi-file-earmark-excel m-2"></i>
                  Exportar 
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr><td colSpan="8">Cargando...</td></tr>
            )}

            {!loading && dataFiltrada.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.codLocal}</td>
                <td>{row.host}</td>
                <td>{row.formato || "-"}</td>
                <td>{row.kiosko ? `✔ (${row.ck || 0})` : "-"}</td>
                <td>{row.kds ? `✔ (${row.c_kds || 0})` : "-"}</td>
                <td>{row.llamador ? `✔ (${row.c_llamador || 0})` : "-"}</td>
                <td className="text-center">
                    <div className="d-flex justify-content-center align-items-center">
                        <div className="d-none d-md-flex gap-2">

                            <button className="btn btn-sm btn-outline-primary" title="Ver Detalle" onClick={() => {
                                setSelectedId(row.id);
                                setShowDetalle(true);
                                }}
                              > 👁️
                              </button>

                            <button title="Editar local" className="btn btn-sm btn-primary" onClick={() => editar(row)} >
                                ✏️
                            </button>
                            <button title={row.activo ? "Desactivar Local" : "Activar Local"} 
                            className={`btn btn-sm ${ row.activo
                                ? "btn-success "
                                : "btn-secondary "
                            }`}
                            onClick={() => toggleActivo(row.id, !row.activo)}>
                                {row.activo ? "⏻" : "⏻"}
                            </button>
                            <button className="btn btn-sm btn-danger" title="Eliminar local"
                                onClick={() => eliminar(row.id)} >
                                🗑️
                            </button>
                        </div>
                        <MobileActions>
                            actions={[
                                {
                                label: "Editar",
                                icon: "bi bi-pencil",
                                onClick: () => editar(row),
                                },
                                {
                                label: row.activo ? "Desactivar" : "Activar",
                                icon: row.activo ? "bi bi-toggle-on text-success" : "bi bi-toggle-off text-secondary",
                                onClick: () => toggleActivo(row.id, !row.activo),
                                },
                                {
                                label: "Eliminar",
                                icon: "bi bi-trash text-danger",
                                onClick: () => eliminar(row.id),
                                },
                            ]}
                        </MobileActions>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

      {showDetalle && (
        <ConnectionDetalleModal
          show={showDetalle}
          onHide={() => setShowDetalle(false)}
          connectionId={selectedId}
          token={token}
        />
      )}

    </div>

  );

  
}

export default ConnectionsAdmin;