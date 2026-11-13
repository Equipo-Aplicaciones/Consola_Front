import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Button, Form, Badge, Spinner, Table } from "react-bootstrap";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../config";

const dinero = (n) => "$" + Math.round(Number(n || 0)).toLocaleString("es-CL");

const fechaCorta = (iso) => (iso ? iso.split("-").reverse().join("/") : "-");

const hoySantiago = (desplazarDias = 0) => {
  const [a, m, d] = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" })
    .format(new Date())
    .split("-")
    .map(Number);

  return new Date(Date.UTC(a, m - 1, d + desplazarDias)).toISOString().slice(0, 10);
};

// Los cinco controles: clave en el resumen por local, clave de la marca en la boleta y color
const CONTROLES = [
  { clave: "boletas_efectivo", marca: "f_efectivo", etiqueta: "Pago en efectivo", color: "#dc2626" },
  { clave: "boletas_combo_cero", marca: "f_combo_cero", etiqueta: "Combo en $0", color: "#f59e0b" },
  { clave: "boletas_sin_pago", marca: "f_sin_pago", etiqueta: "Sin pago", color: "#6b7280" },
  { clave: "boletas_pago_distinto", marca: "f_pago_distinto", etiqueta: "Pagos ≠ total", color: "#2563eb" },
  { clave: "boletas_productos_distinto", marca: "f_productos_distinto", etiqueta: "Productos ≠ total", color: "#7c3aed" }
];

const suma = (locales, clave) => locales.reduce((total, l) => total + Number(l[clave] || 0), 0);

const nombreLocal = (l) => `${l.codigo_local} - ${l.nombre_local || "Sin nombre"}`;

function detalleBoleta(b) {
  const partes = [];

  if (b.f_efectivo) partes.push(`Efectivo ${dinero(b.importe_efectivo)}`);
  if (b.f_combo_cero) partes.push(`${b.combos_cero} combo(s) en $0 (ref. ${dinero(b.monto_referencial)})`);
  if (b.f_sin_pago) partes.push("Sin registros de pago");
  if (b.f_pago_distinto) partes.push(`Pagos ${dinero(b.total_formpago)} vs total ${dinero(b.total)}`);
  if (b.f_productos_distinto) partes.push(`Productos ${dinero(b.total_histfact)} vs total ${dinero(b.total)}`);

  return partes.join(" · ");
}

function Indicador({ titulo, valor, detalle, color, alerta }) {
  return (
    <div
      className="border rounded p-2 h-100 bg-white"
      style={{ borderLeft: `4px solid ${color || "#9ca3af"}`, background: alerta ? "#fef2f2" : undefined }}
    >
      <div className="small text-muted">{titulo}</div>
      <div className="fs-4 fw-semibold lh-1">{valor}</div>
      {detalle && <div className="small text-muted mt-1">{detalle}</div>}
    </div>
  );
}

export default function AuditoriaBoletas({ token }) {
  const [desde, setDesde] = useState(() => hoySantiago(-1));
  const [hasta, setHasta] = useState(() => hoySantiago(-1));
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [soloConDiferencias, setSoloConDiferencias] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError("");
    setAbierto(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auditoria-boletas?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.replace("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error consultando la auditoría");
      }

      setDatos(data);
    } catch (err) {
      setDatos(null);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, token]);

  useEffect(() => {
    consultar();
    // Solo al abrir la pantalla; después se consulta con el botón
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locales = useMemo(() => datos?.locales || [], [datos]);

  const boletasPorLocal = useMemo(() => {
    const mapa = new Map();

    for (const b of datos?.boletas || []) {
      mapa.set(b.codigo_local, [...(mapa.get(b.codigo_local) || []), b]);
    }

    return mapa;
  }, [datos]);

  const totales = useMemo(
    () => ({
      revisadas: suma(locales, "boletas_revisadas"),
      anuladas: suma(locales, "boletas_anuladas"),
      conDiferencias: suma(locales, "boletas_con_diferencias"),
      combosCero: suma(locales, "boletas_combo_cero"),
      montoReferencial: suma(locales, "monto_referencial"),
      sinPago: suma(locales, "boletas_sin_pago"),
      pagoDistinto: suma(locales, "boletas_pago_distinto"),
      productosDistinto: suma(locales, "boletas_productos_distinto"),
      efectivo: suma(locales, "boletas_efectivo"),
      importeEfectivo: suma(locales, "importe_efectivo"),
      localesConDiferencias: locales.filter((l) => l.boletas_con_diferencias > 0).length
    }),
    [locales]
  );

  const grafico = useMemo(
    () =>
      locales
        .filter((l) => l.boletas_con_diferencias > 0)
        .slice()
        .sort((a, b) => b.boletas_con_diferencias - a.boletas_con_diferencias)
        .slice(0, 10)
        .map((l) => ({ nombre: `${l.codigo_local} ${l.nombre_local || ""}`.trim(), ...l })),
    [locales]
  );

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return locales.filter((l) => {
      if (soloConDiferencias && l.boletas_con_diferencias === 0) return false;
      return !texto || nombreLocal(l).toLowerCase().includes(texto);
    });
  }, [locales, soloConDiferencias, busqueda]);

  const exportar = () => {
    const hojaResumen = locales.map((l) => ({
      "Cód. local": l.codigo_local,
      Local: l.nombre_local,
      "Boletas revisadas": l.boletas_revisadas,
      "Boletas anuladas": l.boletas_anuladas,
      "Boletas con diferencias": l.boletas_con_diferencias,
      "Pago en efectivo": l.boletas_efectivo,
      "Importe efectivo": l.importe_efectivo,
      "Combo en $0": l.boletas_combo_cero,
      "Combos en $0 (unidades)": l.combos_cero,
      "Monto referencial": l.monto_referencial,
      "Sin pago": l.boletas_sin_pago,
      "Pagos ≠ total": l.boletas_pago_distinto,
      "Productos ≠ total": l.boletas_productos_distinto
    }));

    const nombres = new Map(locales.map((l) => [l.codigo_local, l.nombre_local]));

    const hojaBoletas = (datos?.boletas || []).map((b) => ({
      "Cód. local": b.codigo_local,
      Local: nombres.get(b.codigo_local),
      Fecha: b.fecha,
      Hora: b.hora,
      "N° boleta": b.numero,
      Mesa: b.mesa,
      Total: b.total,
      Problemas: CONTROLES.filter((c) => b[c.marca])
        .map((c) => c.etiqueta)
        .join(", "),
      Detalle: detalleBoleta(b)
    }));

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(hojaResumen), "Resumen");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(hojaBoletas), "Boletas");
    XLSX.writeFile(libro, `auditoria_boletas_${desde}_${hasta}.xlsx`);
  };

  return (
    <div className="p-3">
      <div className="d-flex align-items-end gap-2 flex-wrap mb-3">
        <div>
          <Form.Label className="small mb-0">Desde</Form.Label>
          <Form.Control type="date" size="sm" value={desde} max={hoySantiago()} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <Form.Label className="small mb-0">Hasta (incluido)</Form.Label>
          <Form.Control type="date" size="sm" value={hasta} max={hoySantiago()} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <Button size="sm" onClick={consultar} disabled={cargando || !desde || !hasta}>
          {cargando ? <Spinner animation="border" size="sm" /> : <i className="bi bi-search me-1" />}
          Consultar
        </Button>
        <Button size="sm" variant="outline-success" onClick={exportar} disabled={!datos}>
          <i className="bi bi-file-earmark-excel me-1" />
          Exportar
        </Button>
        <div className="small text-muted ms-auto">
          Mesas {datos?.mesas?.desde ?? 500} a {datos?.mesas?.hasta ?? 599} · máximo 7 días · las anuladas no se revisan
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {cargando && !datos && (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <div className="small text-muted mt-2">Consultando la central...</div>
        </div>
      )}

      {datos && (
        <>
          {datos.boletas_truncadas && (
            <div className="alert alert-warning py-2 small">
              Hay más boletas con diferencias de las que se muestran en el detalle. Acote el rango de fechas.
            </div>
          )}

          <div className="row g-2 mb-2">
            <div className="col-6 col-md-3">
              <Indicador titulo="Boletas revisadas" valor={totales.revisadas.toLocaleString("es-CL")} detalle={`${totales.anuladas} anulada(s) no revisadas`} />
            </div>
            <div className="col-6 col-md-3">
              <Indicador
                titulo="Con diferencias"
                valor={totales.conDiferencias.toLocaleString("es-CL")}
                detalle={`en ${totales.localesConDiferencias} de ${locales.length} local(es)`}
                color={totales.conDiferencias ? "#f59e0b" : "#16a34a"}
              />
            </div>
            <div className="col-6 col-md-3">
              <Indicador
                titulo="Pago en efectivo (error)"
                valor={totales.efectivo}
                detalle={totales.efectivo ? `${dinero(totales.importeEfectivo)} cobrados en efectivo` : "Sin pagos en efectivo"}
                color={totales.efectivo ? "#dc2626" : "#16a34a"}
                alerta={totales.efectivo > 0}
              />
            </div>
            <div className="col-6 col-md-3">
              <Indicador
                titulo="Combos en $0"
                valor={totales.combosCero}
                detalle={`${dinero(totales.montoReferencial)} de monto referencial`}
                color={totales.combosCero ? "#f59e0b" : "#16a34a"}
              />
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <Indicador titulo="Sin pago" valor={totales.sinPago} color={totales.sinPago ? "#6b7280" : "#16a34a"} />
            </div>
            <div className="col-3">
              <Indicador titulo="Pagos ≠ total" valor={totales.pagoDistinto} color={totales.pagoDistinto ? "#2563eb" : "#16a34a"} />
            </div>
            <div className="col-3">
              <Indicador titulo="Productos ≠ total" valor={totales.productosDistinto} color={totales.productosDistinto ? "#7c3aed" : "#16a34a"} />
            </div>
          </div>

          {grafico.length > 0 ? (
            <div className="border rounded bg-white p-2 mb-3">
              <div className="fw-semibold small mb-1">Locales con más boletas con diferencias (top {grafico.length})</div>
              <ResponsiveContainer width="100%" height={Math.max(180, grafico.length * 34 + 60)}>
                <BarChart data={grafico} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={190} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {CONTROLES.map((c) => (
                    <Bar key={c.clave} dataKey={c.clave} name={c.etiqueta} stackId="a" fill={c.color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="alert alert-success py-2 small">
              <i className="bi bi-check-circle me-1" />
              No hay diferencias en el período consultado.
            </div>
          )}

          <div className="d-flex align-items-center gap-3 flex-wrap mb-2">
            <Form.Control
              size="sm"
              style={{ maxWidth: 260 }}
              placeholder="Buscar local..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <Form.Check
              type="switch"
              id="solo-con-diferencias"
              label="Solo locales con diferencias"
              checked={soloConDiferencias}
              onChange={(e) => setSoloConDiferencias(e.target.checked)}
            />
          </div>

          <div className="table-responsive" style={{ maxHeight: 520, overflowY: "auto" }}>
            <Table size="sm" hover className="align-middle mb-0">
              <thead className="table-light sticky-top">
                <tr>
                  <th>Local</th>
                  <th className="text-end">Revisadas</th>
                  <th className="text-end">Con difer.</th>
                  {CONTROLES.map((c) => (
                    <th key={c.clave} className="text-end">
                      <span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, background: c.color }} />
                      {c.etiqueta}
                    </th>
                  ))}
                  <th className="text-end">Monto ref. combos</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={CONTROLES.length + 4} className="text-center text-muted py-3">
                      No hay locales para mostrar.
                    </td>
                  </tr>
                )}

                {filas.map((l) => {
                  const detalle = boletasPorLocal.get(l.codigo_local) || [];
                  const expandido = abierto === l.codigo_local;

                  return (
                    <Fragment key={l.codigo_local}>
                      <tr
                        role={l.boletas_con_diferencias > 0 ? "button" : undefined}
                        onClick={() => l.boletas_con_diferencias > 0 && setAbierto(expandido ? null : l.codigo_local)}
                      >
                        <td className="fw-semibold">
                          {l.boletas_con_diferencias > 0 && (
                            <i className={`bi bi-chevron-${expandido ? "down" : "right"} me-1 small`} />
                          )}
                          {nombreLocal(l)}
                        </td>
                        <td className="text-end">{l.boletas_revisadas}</td>
                        <td className="text-end">
                          {l.boletas_con_diferencias > 0 ? <Badge bg="warning" text="dark">{l.boletas_con_diferencias}</Badge> : "-"}
                        </td>
                        {CONTROLES.map((c) => (
                          <td key={c.clave} className="text-end">
                            {l[c.clave] > 0 ? (
                              <span className="fw-semibold" style={{ color: c.color }}>{l[c.clave]}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        ))}
                        <td className="text-end">{l.monto_referencial > 0 ? dinero(l.monto_referencial) : "-"}</td>
                      </tr>

                      {expandido && (
                        <tr>
                          <td colSpan={CONTROLES.length + 4} className="bg-light">
                            <Table size="sm" className="mb-0 bg-white">
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Hora</th>
                                  <th>N° boleta</th>
                                  <th>Mesa</th>
                                  <th className="text-end">Total</th>
                                  <th>Problemas</th>
                                  <th>Detalle</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalle.map((b) => (
                                  <tr key={b.idk}>
                                    <td>{fechaCorta(b.fecha)}</td>
                                    <td>{b.hora}</td>
                                    <td>{b.numero}</td>
                                    <td>{b.mesa}</td>
                                    <td className="text-end">{dinero(b.total)}</td>
                                    <td>
                                      {CONTROLES.filter((c) => b[c.marca]).map((c) => (
                                        <Badge key={c.marca} className="me-1" style={{ background: c.color }}>
                                          {c.etiqueta}
                                        </Badge>
                                      ))}
                                    </td>
                                    <td className="small text-muted">{detalleBoleta(b)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
