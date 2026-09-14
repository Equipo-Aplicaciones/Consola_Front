import React, { useEffect, useMemo, useState } from "react";
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
import { Dropdown, Modal } from "react-bootstrap";
import DatePicker from "react-datepicker";
import "./DashboardAgotados.css";

// Rampa secuencial (un solo hue — el rojo de marca —, claro a oscuro),
// validada como ramp ordinal: luminosidad monótona, saltos >= 0.06 entre
// escalones, y el extremo claro todavía se distingue del fondo (>= 2:1).
// Reemplaza los 3 colores fijos de semáforo (bajo/medio/crítico) que antes
// coloreaban "Top Productos Agotados": ese chart no tiene 3 categorías de
// estado, es un ranking por cantidad, así que le corresponde una rampa de
// magnitud, no colores de estado reciclados.
const SEQ_ROJO = ["#e69497", "#dd747b", "#d24b5b", "#bd1f3f", "#a1002a", "#750017"];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
function interpolarColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}
// Mapea un valor a un punto de la rampa según su magnitud relativa al resto
// del conjunto (0 = el más chico, 1 = el más grande). Se usa raíz cuadrada en
// vez de una escala lineal: con una cola larga (pocos productos grandes,
// muchos chicos parejos) lo lineal aplasta casi todas las barras contra el
// extremo claro de la rampa y se ven todas iguales — la raíz cuadrada les da
// más rango de color a los valores chicos sin perder el orden ni saturar
// antes de tiempo a los grandes.
function colorPorMagnitud(valor, min, max) {
  const t = max > min ? Math.sqrt((valor - min) / (max - min)) : 1;
  const pos = t * (SEQ_ROJO.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, SEQ_ROJO.length - 1);
  return interpolarColor(SEQ_ROJO[i0], SEQ_ROJO[i1], pos - i0);
}

// Paleta categórica validada (11 tonos, CVD-safe en pares adyacentes — la
// combinación que importa en una barra apilada) + gris neutro para "Otros".
// Cada producto se queda con el mismo color en todas las barras.
//
// Se probó llevarla a 20+ colores para cubrir el 80% de los productos, pero
// con la cola larga real de agotados (~185 productos distintos por mes) eso
// exigiría 60+ tonos — imposible de distinguir a simple vista, y peor con
// daltonismo. Se optó por el máximo de colores que siguen pasando la
// validación (Delta E >= 8 en pares adyacentes, piso de visión normal >= 15)
// y se compensa con el label de "más agotado" sobre cada barra + el tooltip
// completo, que sí lista el 100% de los productos.
const STACK_PALETTE = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // aqua
  "#eda100", // amarillo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // rojo
  "#0096b1", // teal
  "#82439d", // púrpura
  "#716500"  // oliva
];
const STACK_OTROS_COLOR = "#c3c2b7";

function colorDeProducto(nombre, productosStack) {
  if (nombre === "Otros") return STACK_OTROS_COLOR;
  const idx = productosStack.indexOf(nombre);
  return idx >= 0 ? STACK_PALETTE[idx % STACK_PALETTE.length] : STACK_OTROS_COLOR;
}

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

  const fila = payload[0].payload || {};

  return (
    <div className="custom-tooltip">
      <div className="tt-label">{label}</div>
      <div className="tt-val">{payload[0].value} agotados</div>
      {fila.topProducto && (
        <div className="tt-val">
          Más agotado: <strong>{fila.topProducto}</strong> ({fila.topProductoPct}% del mix)
        </div>
      )}
    </div>
  );
}

function EmptyState({ mensaje }) {
  return <div className="empty-msg">{mensaje}</div>;
}

// Tooltip de la barra apilada: lista TODOS los productos agotados ese día,
// uno por uno (ninguno se agrupa en "Otros" acá — eso solo pasa en el color
// de la barra, que sí tiene que limitarse a una paleta chica).
function ProductStackTooltip({ active, payload, label, productosStack }) {
  if (!active || !payload || !payload.length) return null;

  const fila = payload[0].payload || {};
  const items = fila.productosDetalle || [];
  const top = items[0];

  // "Otros" = todo lo que no entra en la paleta de colores (ver STACK_PALETTE
  // más arriba). Se separan acá para que quede claro qué suma ese gris de la
  // barra, en vez de mezclarlo con los productos que sí tienen color propio.
  const conColor = items.filter((it) => colorDeProducto(it.producto, productosStack) !== STACK_OTROS_COLOR);
  const enOtros = items.filter((it) => colorDeProducto(it.producto, productosStack) === STACK_OTROS_COLOR);
  const totalOtros = enOtros.reduce((acc, it) => acc + it.cantidad, 0);

  return (
    <div className="custom-tooltip tt-scroll">
      <div className="tt-label">{label} · {fila.cantidad} agotados</div>
      {top && (
        <div className="tt-val mb-1">
          Más agotado: <strong>{top.producto}</strong> ({top.cantidad})
        </div>
      )}

      {conColor.map((item) => (
        <div className="tt-stack-row" key={item.producto}>
          <span className="tt-stack-dot" style={{ background: colorDeProducto(item.producto, productosStack) }} />
          <span className="tt-stack-nombre">{item.producto}</span>
          <span className="tt-stack-valor">{item.cantidad}</span>
        </div>
      ))}

      {enOtros.length > 0 && (
        <>
          <div className="tt-otros-header">
            <span className="tt-stack-dot" style={{ background: STACK_OTROS_COLOR }} />
            Otros ({enOtros.length} productos) — {totalOtros}
          </div>
          {enOtros.map((item) => (
            <div className="tt-stack-row tt-stack-row-otros" key={item.producto}>
              <span className="tt-stack-nombre">{item.producto}</span>
              <span className="tt-stack-valor">{item.cantidad}</span>
            </div>
          ))}
        </>
      )}

      <div className="tt-hint">Clic en la barra para ver el detalle completo</div>
    </div>
  );
}

/* =====================================================
   SEMANA DE NEGOCIO (ISO 8601: lunes a domingo, semana 1
   es la que contiene el primer jueves del año — da 52 o
   53 semanas según el año)
===================================================== */

function getISOWeekInfo(fecha) {
  const target = new Date(fecha);
  target.setHours(0, 0, 0, 0);

  const dayNr = (target.getDay() + 6) % 7; // lunes = 0 ... domingo = 6
  target.setDate(target.getDate() - dayNr + 3); // jueves de esa semana

  const primerJueves = new Date(target.getFullYear(), 0, 4);
  const primerJuevesDayNr = (primerJueves.getDay() + 6) % 7;
  primerJueves.setDate(primerJueves.getDate() - primerJuevesDayNr + 3);

  const semana = 1 + Math.round((target - primerJueves) / (7 * 24 * 3600 * 1000));

  return { semana, anio: target.getFullYear() };
}

function getLunesDeSemana(anio, semana) {
  const enero4 = new Date(anio, 0, 4);
  const enero4DayNr = (enero4.getDay() + 6) % 7;
  const lunesSemana1 = new Date(anio, 0, 4 - enero4DayNr);

  const lunes = new Date(lunesSemana1);
  lunes.setDate(lunesSemana1.getDate() + (semana - 1) * 7);

  return lunes;
}

function getCantidadSemanas(anio) {
  return getISOWeekInfo(new Date(anio, 11, 28)).semana;
}

function DashboardAgotados({ token }) {

  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d; // ✅ Date real
  };

  const [limit, setLimit] = useState(20);
  const [data, setData] = useState({
    productos: [],
    locales: [],
    detalle: [],
    dias: [],
    productosStack: []
  });
  const [rango, setRango] = useState([getYesterday(), getYesterday()]);
  const [startDate, endDate] = rango;

  const [loading, setLoading] = useState(false);
  const [grupoDetalle, setGrupoDetalle] = useState(null); // fila clickeada (local o día) para el modal de detalle completo
  const [mixExpandido, setMixExpandido] = useState(() => new Set()); // productos agrupados (ej. "mozzarella stick") expandidos dentro del modal

  const toggleMix = (producto) => {
    setMixExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(producto)) next.delete(producto);
      else next.add(producto);
      return next;
    });
  };

  const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return null;
    return date.toLocaleDateString("sv-SE"); // ✅ sin problemas de zona horaria
  };

  /* ===== NAVEGACIÓN POR SEMANA DE NEGOCIO (52/53 semanas del año) ===== */

  const semanaInfo = useMemo(
    () => (startDate ? getISOWeekInfo(startDate) : null),
    [startDate]
  );

  const esSemanaCompleta = useMemo(() => {
    if (!startDate || !endDate || !semanaInfo) return false;

    const lunes = getLunesDeSemana(semanaInfo.anio, semanaInfo.semana);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    return (
      formatDate(lunes) === formatDate(startDate) &&
      formatDate(domingo) === formatDate(endDate)
    );
  }, [startDate, endDate, semanaInfo]);

  const irASemana = (anio, semana) => {
    let anioDestino = anio;
    let semanaDestino = semana;

    if (semanaDestino < 1) {
      anioDestino -= 1;
      semanaDestino = getCantidadSemanas(anioDestino);
    } else if (semanaDestino > getCantidadSemanas(anioDestino)) {
      anioDestino += 1;
      semanaDestino = 1;
    }

    const lunes = getLunesDeSemana(anioDestino, semanaDestino);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    setRango([lunes, domingo]);
  };

  const semanaAnterior = () => semanaInfo && irASemana(semanaInfo.anio, semanaInfo.semana - 1);
  const semanaSiguiente = () => semanaInfo && irASemana(semanaInfo.anio, semanaInfo.semana + 1);

  /* ===== LÍMITE DE EXPORTACIÓN: MÁXIMO 2 MESES HACIA ATRÁS ===== */

  const EXPORT_MAX_MESES = 2;

  const excedeLimiteExport = (desde, hasta) => {
    if (!desde || !hasta) return false;

    const limite = new Date(hasta);
    limite.setMonth(limite.getMonth() - EXPORT_MAX_MESES);

    return desde < limite;
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
      dias: d.dias || [],
      productosStack: d.productosStack || []
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

  const minMax = (cantidades) => ({
    min: cantidades.length ? Math.min(...cantidades) : 0,
    max: cantidades.length ? Math.max(...cantidades) : 0
  });
  const { min: minCantidadProducto, max: maxCantidadProducto } = minMax(data.productos.map((p) => p.cantidad));
  const { min: minCantidadLocal, max: maxCantidadLocal } = minMax(data.locales.map((l) => l.cantidad));
  const { min: minCantidadDia, max: maxCantidadDia } = minMax(data.dias.map((d) => d.cantidad));

  // 📥 Excel
  const exportarExcel = () => {
    if (excedeLimiteExport(startDate, endDate)) {
      alert(
        `⚠️ El rango seleccionado supera el máximo permitido para exportar (${EXPORT_MAX_MESES} meses hacia atrás).\n\n` +
        "Achicá el rango de fechas del calendario e intentá de nuevo."
      );
      return;
    }

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

      {/* 🔥 BARRA DE FILTROS (semana + rango + top N + export) */}
      <div className="toolbar-card d-flex gap-3 mb-3 flex-wrap align-items-center">

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={semanaAnterior}
            title="Semana anterior"
          >
            <i className="bi bi-chevron-left" />
          </button>

          <div className="text-center" style={{ minWidth: 170 }}>
            {semanaInfo && (
              <>
                <div className="fw-semibold">
                  Semana {semanaInfo.semana} de {semanaInfo.anio}
                  {!esSemanaCompleta && (
                    <span className="badge bg-secondary-subtle text-secondary ms-2">
                      rango personalizado
                    </span>
                  )}
                </div>
                <div className="text-muted small">
                  {formatDate(getLunesDeSemana(semanaInfo.anio, semanaInfo.semana))} al{" "}
                  {formatDate((() => {
                    const d = getLunesDeSemana(semanaInfo.anio, semanaInfo.semana);
                    d.setDate(d.getDate() + 6);
                    return d;
                  })())}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={semanaSiguiente}
            title="Semana siguiente"
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>

        <div className="vr d-none d-md-block" />

        <div className="datePicker" style={{ maxWidth: 230 }} title="Rango personalizado">
            <div className="text-muted small mb-1">Elegir fecha o rango de fecha</div>
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

        <div className="d-flex align-items-center gap-2 ms-md-auto">
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
        <span>Menos agotado</span>
        <span
          className="severidad-gradiente"
          style={{ background: `linear-gradient(90deg, ${SEQ_ROJO.join(", ")})` }}
        />
        <span>Más agotado</span>
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
                <BarChart data={data.productos} margin={{ top: 60, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#ececef" />
                  <XAxis dataKey="producto" tick={false} axisLine={{ stroke: "#ececef" }} tickLine={false} />
                  <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(228,0,70,0.05)" }} />
                  <Bar dataKey="cantidad" radius={[5, 5, 0, 0]} maxBarSize={40}>
                      {data.productos.map((entry, index) => (
                      <Cell key={index} fill={colorPorMagnitud(entry.cantidad, minCantidadProducto, maxCantidadProducto)} />
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
            <div className="chart-sub">Ranking de locales por cantidad de reportes — más oscuro, más se agotó</div>

            {data.locales.length === 0 ? (
              <EmptyState mensaje="No hay locales con agotados en el período seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={data.locales} margin={{ top: 60, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ececef" />
                  <XAxis dataKey="local" tick={false} axisLine={{ stroke: "#ececef" }} tickLine={false} />
                  <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={<ProductStackTooltip productosStack={data.productosStack} />}
                    cursor={{ fill: "rgba(228,0,70,0.05)" }}
                  />
                  <Bar
                    dataKey="cantidad"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                    cursor="pointer"
                    onClick={(barData) => setGrupoDetalle(barData.payload)}
                  >
                    {data.locales.map((entry, index) => (
                      <Cell key={index} fill={colorPorMagnitud(entry.cantidad, minCantidadLocal, maxCantidadLocal)} />
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
            <div className="chart-sub">Total de agotados por día — más oscuro, más se agotó</div>

            {data.dias.length === 0 ? (
              <EmptyState mensaje="No hay datos para el período seleccionado." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.dias} margin={{ top: 26, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#ececef" />
                    <XAxis dataKey="dia" tick={axisTickStyle} axisLine={{ stroke: "#ececef" }} tickLine={false} />
                    <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      content={<ProductStackTooltip productosStack={data.productosStack} />}
                      cursor={{ fill: "rgba(228,0,70,0.05)" }}
                    />
                    <Bar
                      dataKey="cantidad"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                      cursor="pointer"
                      onClick={(barData) => setGrupoDetalle(barData.payload)}
                    >
                      {data.dias.map((entry, index) => (
                        <Cell key={index} fill={colorPorMagnitud(entry.cantidad, minCantidadDia, maxCantidadDia)} />
                      ))}
                      <LabelList
                        dataKey="cantidad"
                        position="top"
                        style={{ fontFamily: "var(--font-condensed)", fontWeight: 700, fontSize: 12, fill: "#4a3627" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
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

      <Modal
        show={!!grupoDetalle}
        onHide={() => { setGrupoDetalle(null); setMixExpandido(new Set()); }}
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
            {grupoDetalle?.local || grupoDetalle?.dia}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted mb-3" style={{ fontSize: 13 }}>
            {grupoDetalle?.cantidad} agotados en total · {grupoDetalle?.productosDetalle?.length || 0} productos distintos
          </div>
          <table className="table table-sm table-hover mb-0" style={{ fontSize: 12.5 }}>
            <thead className="table-light">
              <tr>
                <th>Producto</th>
                <th className="text-end">Veces</th>
                <th className="text-end">% del total</th>
              </tr>
            </thead>
            <tbody>
              {(grupoDetalle?.productosDetalle || []).map((item) => {
                const tieneMix = item.mix && item.mix.length > 0;
                const expandido = mixExpandido.has(item.producto);

                return (
                  <React.Fragment key={item.producto}>
                    <tr
                      onClick={tieneMix ? () => toggleMix(item.producto) : undefined}
                      style={tieneMix ? { cursor: "pointer" } : undefined}
                      title={tieneMix ? "Ver el mix real de este grupo" : undefined}
                    >
                      <td>
                        <span
                          className="stack-legend-dot d-inline-block me-2"
                          style={{ background: colorDeProducto(item.producto, data.productosStack) }}
                        />
                        {item.producto}
                        {tieneMix && (
                          <i className={`bi bi-chevron-${expandido ? "up" : "down"} ms-2 text-muted`} style={{ fontSize: 10 }} />
                        )}
                      </td>
                      <td className="text-end">{item.cantidad}</td>
                      <td className="text-end text-muted">
                        {grupoDetalle?.cantidad ? Math.round((item.cantidad / grupoDetalle.cantidad) * 100) : 0}%
                      </td>
                    </tr>
                    {tieneMix && expandido && item.mix.map((sub) => (
                      <tr key={item.producto + "__" + sub.producto} className="tt-mix-row">
                        <td className="ps-4 text-muted">{sub.producto}</td>
                        <td className="text-end text-muted">{sub.cantidad}</td>
                        <td className="text-end text-muted">
                          {item.cantidad ? Math.round((sub.cantidad / item.cantidad) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Modal.Body>
      </Modal>

    </div>
  );
}

export default DashboardAgotados;
