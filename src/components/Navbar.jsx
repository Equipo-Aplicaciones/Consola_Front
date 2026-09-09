import React, { useCallback, useEffect, useState, useRef } from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function MyNavbar({ user, onLogout, token }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const notificacionesRef = useRef(null);
  const navigate = useNavigate();
  const role = user?.role;

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  const cargarNotificaciones = useCallback(async () => {
    if (!token) {
      setNotificaciones([]);
      setCount(0);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/notificaciones`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        setNotificaciones([]);
        setCount(0);
        return;
      }

      const data = await res.json();
      const lista = Array.isArray(data)
        ? data
        : data.notificaciones || [];

      setNotificaciones(lista);
      setCount(lista.length);
    } catch {
      setNotificaciones([]);
      setCount(0);
    }
  }, [token]);

  useEffect(() => {
    cargarNotificaciones();

    const interval = setInterval(() => {
      cargarNotificaciones();
    }, 500000);

    return () => clearInterval(interval);
  }, [cargarNotificaciones]);

  useEffect(() => {
    const actualizarNotificaciones = () => {
      cargarNotificaciones();
    };

    window.addEventListener(
      "notificacionesActualizadas",
      actualizarNotificaciones
    );

    return () => {
      window.removeEventListener(
        "notificacionesActualizadas",
        actualizarNotificaciones
      );
    };
  }, [cargarNotificaciones]);

  useEffect(() => {
    const cerrarNotificaciones = event => {
      if (
        notificacionesRef.current &&
        !notificacionesRef.current.contains(event.target)
      ) {
        setShow(false);
      }
    };

    document.addEventListener(
      "mousedown",
      cerrarNotificaciones
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        cerrarNotificaciones
      );
    };
  }, []);

  const marcarYRedirigir = async notif => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/notificaciones/leido/${notif.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        return;
      }

      setNotificaciones(prev =>
        prev.filter(n => n.id !== notif.id)
      );

      setCount(prev =>
        Math.max(0, prev - 1)
      );

      if (notif.url?.startsWith("/")) {
        navigate(notif.url);
      } else {
        navigate("/admin", {
          state: {
            tab: notif.url
          }
        });
      }

      setShow(false);
      setExpanded(false);
    } catch {}
  };

  const abrirNotificacion = async notif => {
    if (notif.url === "vendedores") {
      navigate("/vendedores");
      setShow(false);
      setExpanded(false);
      return;
    }

    await marcarYRedirigir(notif);
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm" style={{ zIndex: 1050 }}
      expanded={expanded} onToggle={() => setExpanded(!expanded)} sticky="top" >
      <Container fluid>
        <Navbar.Brand onClick={() => navigate("/")} style={{ cursor: "pointer" }} >
          <img src="T.png" alt="Logo" style={{
              height: "28px",
              marginRight: "8px"
            }} />
          Manager Crack
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="navbarNav" />

        <Navbar.Collapse id="navbarNav">
          <Nav className="me-auto">
            {role !== "Comercial" &&
              role !== "Zonal" &&
              role !== "RRHH" &&
              role !== "Gerente" && (
                <Nav.Link
                  onClick={() => {
                    navigate("/");
                    setExpanded(false);
                  }}
                >
                  Panel de Gestión
                </Nav.Link>
              )}

            {(role === "Admin" || role === "N2") && (
              <Nav.Link onClick={() => { navigate("/admin");
                  setExpanded(false);
                }} >
                Administración
              </Nav.Link>
            )}

            {(role === "Admin" ||
              role === "Comercial" ||
              role === "Zonal") && (
              <Nav.Link onClick={() => { navigate("/menu-locales");
                  setExpanded(false);
                }} >
                Menú Local
              </Nav.Link>
            )}

            {(role === "Admin" || role === "RRHH") && (
              <Nav.Link onClick={() => { navigate("/vendedores");
                  setExpanded(false);
                }} >
                Ingreso Vendedores
              </Nav.Link>
            )}

            {(role === "Admin" ||
              role === "N2" ||
              role === "N1" ||
              role === "Gerente") && (
              <Nav.Link onClick={() => { navigate("/totems");
                  setExpanded(false);
                }} >
                Monitor Totems
              </Nav.Link>
            )}

            {(role === "N1" ) && (
              <Nav.Link onClick={() => { navigate("/gestiones");
                  setExpanded(false);  }} >
                Gestiones
              </Nav.Link>
            )}

          </Nav>

          <div className="d-flex align-items-center gap-2">
            <span className="text-light">
              {user?.full_name} ({user?.role})
            </span>

            <div className="position-relative" ref={notificacionesRef}>
              <i className="bi bi-bell"
                style={{
                  fontSize: "18px",
                  color: count > 0 ? "red" : "gray",
                  cursor: "pointer" }}
                title={ count > 0
                    ? "Notificaciones Pendientes"
                    : "Sin Notificaciones" }
                onClick={() => setShow(!show)}
              ></i>

              {count > 0 && (
                <span className="badge bg-danger position-absolute top-0 start-100 translate-middle">
                  {count}
                </span>
              )}

              {show && (
                <div style={{ position: "absolute", right: 0, top: "30px", width: "300px", background: "#fff",
                    border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
                    zIndex: 1000, maxHeight: "350px", overflowY: "auto" }} >
                  {notificaciones.length === 0 ? (
                    <div className="p-2 text-center">
                      Sin notificaciones
                    </div>
                  ) : (
                    notificaciones.map(n => (
                      <div key={n.id} onClick={() => abrirNotificacion(n) }
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                          cursor: "pointer"
                        }} >
                        <div className="fw-semibold" style={{ fontSize: "12px" }} >
                          {n.titulo}
                        </div>

                        <div style={{ fontSize: "12px" }} >
                          {n.contenido}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <Button variant="outline-light" size="sm" onClick={handleLogout} >
              Cerrar sesión
            </Button>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default MyNavbar;