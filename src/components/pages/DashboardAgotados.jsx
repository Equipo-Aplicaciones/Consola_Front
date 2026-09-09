import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  LabelList
} from "recharts";
import * as XLSX from "xlsx";
import { Dropdown } from "react-bootstrap";
import DatePicker from "react-datepicker";
import "./DashboardAgotados.css";

const COLOR_OK = "#1a9850";
const COLOR_WARN = "#f2a900";
const COLOR_CRIT = "#d1352e";

// Nombre del producto/local rotado, pegado arriba de cada barra —
// reemplaza los ticks del eje X, que con muchas barras y nombres
// largos se solapaban y quedaban ilegibles.
function BarNameLabel({ x, y, width, value }) {
  if (!value) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="start"
      fill="#4a3627"
      fontSize={11}
      fontWeight={600}
      transform={`rotate(-40 ${x + width / 2} ${y - 6})`}
    >
      {value}
    </text>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip">
      <div className="tt-label">{label}</div>
      <div className="tt-val">{payload[0].value} agotados</div>
    </div>
  );
}

function EmptyState({ mensaje }) {
  return <div className="empty-msg">{mensaje}</div>;
}

function DashboardAgotados({ token }) {

  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d; // ✅ Date real
  };

  const [limit, setLimit] = useState(10);
  const [data, setData] = useState({
    productos: [],
    locales: [],
    detalle: [],
    dias: []
  });
  const [rango, setRango] = useState([getYesterday(), getYesterday()]);
  const [startDate, endDate] = rango;

  const [loading, setLoading] = useState(false);

  const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return null;
    return date.toLocaleDateString("sv-SE"); // ✅ sin problemas de zona horaria
  };

  const cargar = async () => {
    if (!startDate || !endDate) {
        console.warn("Fechas incompletas");
        return;
    }
    setLoading(true);

    const desde = formatDate(startDate);
    const hasta = formatDate(endDate);

    try {
      const qs = `?date_from=${desde}&date_to=${hasta}&limit=${limit}`;
      const res = await fetch(`${API_BASE_URL}/reports/productosagotados${qs}`,
        { headers: { Authorization: `Bearer ${token}`},
        });

       if (!res.ok) {
      console.error("Error HTTP:", res.status);
      return;
    }

    const d = await res.json();

    setData({
      productos: d.productos || [],
      locales: d.locales || [],
      detalle: d.detalle || [],
      dias: d.dias || []
    });

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!startDate || !endDate) return;
    cargar();
  }, [endDate, limit]);

  // 📊 KPIs
  const totalAgotados = data.detalle.length;
  const productosUnicos = new Set(data.detalle.map(d => d.producto)).size;
  const localesUnicos = new Set(data.detalle.map(d => d.local)).size;

  const getColor = (valor) => {
    if (valor >= 10) return COLOR_CRIT;
    if (valor >= 5) return COLOR_WARN;
    return COLOR_OK;
  };

  const getColorDia = (valor) => {
    if (valor >= 50) return COLOR_CRIT;
    if (valor >= 20) return COLOR_WARN;
    return COLOR_OK;
  };

  // 📥 Excel
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.productos),
      "Productos"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.locales),
      "Locales"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.detalle),
      "Detalle"
    );

    XLSX.writeFile(wb, `ProductosAgotados.xlsx`);
  };

  const isMobile = window.innerWidth < 768;

  const axisTickStyle = { fontSize: 11, fill: "#8a8a92" };

  return (
    <div className="agotados-dash">

      <h4 className="dash-title">Dashboard Agotados</h4>
      <div className="dash-sub">Productos sin stock reportados por local y período</div>

      {/* 🔥 FILTROS */}
      <div className="toolbar-card d-flex gap-2 mb-3 flex-wrap justify-content-between align-items-center">
        <div className="w-75 datePicker" style={{ maxWidth: 250 }} title="Seleccionar Rango de fechas">
            <DatePicker
                selectsRange={true}
                startDate={startDate}
                endDate={endDate}
                onChange={(update) => setRango(update)}
                className="form-control"
                dateFormat="yyyy-MM-dd"
                withPortal={isMobile}                // 🔥 clave
                popperPlacement={isMobile ? "bottom-start" : "auto"}
            />
        </div>

        <div className="d-flex align-items-center gap-2 justify-content-end">
            {/* 🔥 Filtro limit */}
            <Dropdown>
                <Dropdown.Toggle variant="outline-secondary">
                    Top {limit}
                </Dropdown.Toggle>

                <Dropdown.Menu>
                    {[5, 10, 15, 20].map((val) => (
                    <Dropdown.Item key={val} onClick={() => setLimit(val)}>
                        Top {val}
                    </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown>

            <button onClick={exportarExcel} className="btn btn-success">
              <i className="bi bi-file-earmark-excel me-1"></i>
              <span className="d-none d-md-inline">Exportar</span> Excel
            </button>
        </div>
      </div>

      {/* 🔥 KPIs */}
      <div className="row mb-2 g-2">

        <div className="col-md-4">
          <div className="kpi-card" style={{ "--accent": "#E40046" }}>
            <div className="kpi-top">
              <span className="kpi-label">Total Agotados</span>
              <span className="kpi-icon">🚫</span>
            </div>
            <div className="kpi-value">{totalAgotados}</div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="kpi-card" style={{ "--accent": "#f2a900" }}>
            <div className="kpi-top">
              <span className="kpi-label">Productos Afectados</span>
              <span className="kpi-icon">📦</span>
            </div>
            <div className="kpi-value">{productosUnicos}</div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="kpi-card" style={{ "--accent": "#1565C0" }}>
            <div className="kpi-top">
              <span className="kpi-label">Locales Afectados</span>
              <span className="kpi-icon">🏪</span>
            </div>
            <div className="kpi-value">{localesUnicos}</div>
          </div>
        </div>

      </div>

      <div className="severidad-legend">
        <span><span className="dot" style={{ background: COLOR_OK }}></span>Bajo</span>
        <span><span className="dot" style={{ background: COLOR_WARN }}></span>Medio</span>
        <span><span className="dot" style={{ background: COLOR_CRIT }}></span>Crítico</span>
      </div>

      {/* 🔥 GRÁFICOS */}
      <div className="row g-2">

        <div className="col-md-12">
          <div className="chart-card">
            <div className="chart-title">Top Productos Agotados</div>
            <div className="chart-sub">Cantidad de veces reportado sin stock, por producto</div>

            {data.productos.length === 0 ? (
              <EmptyState mensaje="No hay productos agotados en el período seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={data.productos} margin={{ top: 60, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ececef" />
                  <XAxis dataKey="producto" tick={false} axisLine={{ stroke: "#ececef" }} tickLine={false} />
                  <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(228,0,70,0.05)" }} />
                  <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {data.productos.map((entry, index) => (
                      <Cell key={index} fill={getColor(entry.cantidad)} />
                      ))}
                      <LabelList dataKey="producto" content={BarNameLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <div className="chart-card">
            <div className="chart-title">Locales con más Agotados</div>
            <div className="chart-sub">Ranking de locales por cantidad de reportes</div>

            {data.locales.length === 0 ? (
              <EmptyState mensaje="No hay locales con agotados en el período seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={data.locales} margin={{ top: 60, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ececef" />
                  <XAxis dataKey="local" tick={false} axisLine={{ stroke: "#ececef" }} tickLine={false} />
                  <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(228,0,70,0.05)" }} />
                  <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {data.locales.map((entry, index) => (
                      <Cell key={index} fill={getColor(entry.cantidad)} />
                      ))}
                      <LabelList dataKey="local" content={BarNameLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <div className="chart-card">
            <div className="chart-title">Agotados por Día de la Semana</div>
            <div className="chart-sub">Distribución semanal de los reportes</div>

            {data.dias.length === 0 ? (
              <EmptyState mensaje="No hay datos para el período seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dias} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ececef" />
                  <XAxis dataKey="dia" tick={axisTickStyle} axisLine={{ stroke: "#ececef" }} tickLine={false} />
                  <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(228,0,70,0.05)" }} />
                  <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {data.dias?.map((entry, index) => (
                        <Cell key={index} fill={getColorDia(entry.cantidad)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* 🔥 DETALLE */}
      <div className="detalle-card mt-2">

        <div className="card-header">
          Detalle
        </div>

        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          <table className="table table-sm table-hover mb-0">

            <thead className="table-light">
              <tr>
                <th>Producto</th>
                <th>Local</th>
                <th>Fecha</th>
              </tr>
            </thead>

            <tbody>
                { data.detalle.length === 0 ? (
                    <tr>
                    <td colSpan="3" className="text-center text-muted py-4">No hay registros</td>
                    </tr>
                ) : (
                    data.detalle.map((d, i) => (
                        <tr key={i}>
                        <td>{d.producto}</td>
                        <td>{d.local}</td>
                        <td>{new Date(d.fecha).toLocaleString("es-CL")}</td>
                        </tr>
                    ))
                )}
            </tbody>

          </table>
        </div>

      </div>

      {loading && <div className="mt-3 text-muted">Cargando...</div>}

    </div>
  );
}

export default DashboardAgotados;
