// components/rrhh/Vendedores.jsx
import { useState, useEffect } from "react";
import { Alert, Button, Card, Spinner, Form, Row, Col } from "react-bootstrap";
import UploadExcel from "./UploadExcel";
import ImportSummary from "./ImportSummary";
import VendorsTable from "./VendorsTable";
import { API_BASE_URL } from "../../config";

export default function Vendedores({ token }) {

  const [file, setFile] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [isValidFile, setIsValidFile] = useState(false);
  const [empresa, setEmpresa] = useState("QA");
  const [notificaciones, setNotificaciones] = useState([]);
  const [filtroNotificaciones, setFiltroNotificaciones] = useState("false");
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(false);

  async function generarPreview() {
    if (!file) {
      alert("Seleccione un archivo Excel.");
      return;

    }
    if (!empresa){
      alert("Debe selecionar una empresa");
      return;
    }
    
    setPreview([]);
    setSummary(null);
    setPreviewId(null);
    setResultado(null);

    try {
      setLoadingPreview(true);
      setResultado(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("empresa", empresa);

      const res = await fetch(`${API_BASE_URL}/vendedores/preview`,{
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Error generando vista previa."
        );

      }

      setPreviewId(data.previewId);
      setSummary(data.summary);
      setPreview(data.preview);

    } catch (err) {
      alert(err.message);

    } finally {
      setLoadingPreview(false);

    }

  }

  async function ejecutarImportacion() {
    if (!previewId) return;
    try {
      setLoadingImport(true);

      const res = await fetch(`${API_BASE_URL}/vendedores/importar/${previewId}`,{
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Error al importar."
        );

      }

      setResultado(data);
      // limpiar pantalla
      setFile(null);
      setPreview([]);
      setPreviewId(null);
      setSummary(null);
      setIsValidFile(false);

    } catch (err) {
      alert(err.message);

    } finally {
      setLoadingImport(false);

    }

  }
  function limpiar() {
    setFile(null);
    setIsValidFile(false);

    setPreview([]);
    setSummary(null);
    setPreviewId(null);
    setResultado(null);

  }

  const cargarNotificaciones = async () => {
    setCargandoNotificaciones(true);
    try {
      const res = await fetch( `${API_BASE_URL}/notificaciones/url?url=vendedores&leido=${filtroNotificaciones}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await res.json();
      if (res.ok) {
        setNotificaciones(data.notificaciones || []);
      }
    } catch {
      setNotificaciones([]);
    } finally {
      setCargandoNotificaciones(false);
    }
  };

  const marcarLeida = async id => {
    try {
    //const res = await fetch(`${API_BASE_URL}/notificaciones/${id}/estado`,{
      const res = await fetch(`${API_BASE_URL}/notificaciones/leido/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ leido: true })
        }
      );

      if (res.ok) {
        setNotificaciones(prev =>
          prev.filter(notificacion => notificacion.id !== id)
        );
        window.dispatchEvent(new Event("notificacionesActualizadas"));
      }
    } catch {}
  };

  useEffect(() => {
    cargarNotificaciones();
  }, [filtroNotificaciones]);

  return (
    <>
      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-people-fill me-2"></i>
            Gestión de Vendedores
          </h5>
        </Card.Header>
        <Card.Body>
          <div className="card shadow-sm">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">
                  Modificación de Vendedor en Locales
                </h6>
                <select className="form-select form-select-sm w-auto" value={filtroNotificaciones}
                  onChange={e => setFiltroNotificaciones(e.target.value)} >
                  <option value="false">Pendientes</option>
                  <option value="true">Leídas</option>
                </select>
              </div>

              <div className="table-responsive" style={{ maxHeight: 200, overflowY: "auto" }}>
                <table className="table table-sm table-hover align-middle mb-0 small" >
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Notificación</th>
                      <th className="text-center">Estado</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargandoNotificaciones ? (
                      <tr>
                        <td colSpan="4" className="text-center text-muted py-2">
                          Cargando...
                        </td>
                      </tr>
                    ) : notificaciones.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-muted py-2">
                          No hay notificaciones.
                        </td>
                      </tr>
                    ) : (
                      notificaciones.map(notificacion => (
                        <tr key={notificacion.id}>
                          <td className="text-nowrap py-0">
                            {new Date(notificacion.created_at).toLocaleDateString("es-CL")}
                          </td>
                          <td>
                            <small className="text-muted py-0">
                              {notificacion.contenido}
                            </small>
                          </td>
                          <td className="text-end py-0">
                            {!notificacion.leido && (
                              <button type="button" className="btn btn-sm btn-outline-success text-nowrap py-0"
                                onClick={() => marcarLeida(notificacion.id)} >
                                <i className="bi bi-check2 me-1"></i>
                                Leída
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <Alert variant="info p-2 small">
            Seleccione una empresa y archivo Excel. El sistema generará una vista previa con
            los cambios que serán realizados.
          </Alert>
          <Row>
             <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    Empresa
                  </Form.Label>
                  <Form.Select value={empresa} onChange={(e) => setEmpresa(e.target.value)} >
                    <option value="">Seleccione Empresa</option>
                    <option value="EMPRESA1">Tarragona</option>
                    <option value="EMPRESA2">Elemental - PolloStop</option>
                  </Form.Select>
                </Form.Group>
             </Col>
              <Col md={8}>
                <UploadExcel file={file} setFile={setFile} setIsValidFile={setIsValidFile} />
              </Col>
          </Row>

          <div className="mt-4 d-flex gap-2">
            <Button variant="primary"
              disabled={ loadingPreview || loadingImport || !isValidFile } onClick={generarPreview} >
              {loadingPreview ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Generando...
                </>
              ) : (
                <>
                  <i className="bi bi-search me-2"></i>
                  Generar Vista Previa
                </>
              )}

            </Button>
            <Button variant="outline-secondary" onClick={limpiar}
              disabled={ loadingPreview || loadingImport || (
                  !file && !preview.length && !resultado
                )  } >
              <i className="bi bi-x-circle me-2"></i>
              Limpiar
            </Button>
                        {previewId && (
              <>
              <Button variant="success" disabled={ loadingImport || loadingPreview }
                onClick={ejecutarImportacion} >
                {loadingImport ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Importando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-upload me-2"></i>
                    Ejecutar Importación
                  </>
                )}
              </Button>
              
              </>
              
            )}
          </div>
        </Card.Body>
      </Card>
      {resultado && (
        <Alert variant="success" className="mt-4" >
          <Alert.Heading>
            Importación finalizada correctamente
          </Alert.Heading>
          <hr />
          <div>
            <strong>Creados:</strong>{" "}
            {resultado.creados}
          </div>
          <div>
            <strong>Actualizados:</strong>{" "}
            {resultado.actualizados}
          </div>
          <div>
            <strong>Desactivados:</strong>{" "}
            {resultado.desactivados}
          </div>
        </Alert>
      )}
      {summary && (
        <Card className="mt-4 shadow-sm">
          <Card.Header>
            Vista previa de la importación
          </Card.Header>
          <Card.Body>
            <ImportSummary summary={summary} />
            <VendorsTable data={preview} />
          </Card.Body>
        </Card>
      )}
    </>
  );
}