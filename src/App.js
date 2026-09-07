import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";

import Navbar from "./components/Navbar";
import ConnectionManager from "./components/ConnectionManager";
import QueryExecutor from "./components/QueryExecutor";
import LoginForm from "./components/LoginForm";
import AdminDashboard from "./components/admin/AdminDashboard";
import DashMenu from "./components/pages/DashMenu";
import Articulos from "./components/articles/ArticlesPage";
import Vendedores from "./components/rrhh/Vendedores";
import Totems from "./components/totems/TotemsDashboard";
import ProtectedByRole from "./components/ProtectedByRole";
import { useAuthGuard } from "./hooks/useAuthGuard";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";


function getHomeByRole(role) {
  switch (role) {
    case "Gerente":
      return "/totems";

    case "RRHH":
      return "/vendedores";

    case "Admin":
    case "N1":
    case "N2":
      return "/";

    case "Comercial":
    case "Zonal":
      return "/menu-locales";

    default:
      return "/";
  }
}
/* -------------------- LAYOUT -------------------- */

function Layout({ token, user }) {
  const location = useLocation();

  const MANAGEMENT_ROUTES = ["/admin", "/menu-locales","/vendedores","/totems","/articulos"];

  const isManagementView = MANAGEMENT_ROUTES.some((path) =>
    location.pathname.startsWith(path)
  );

  const isOperationalUser = ["Admin", "N1", "N2"].includes(user?.role);

  return (
    <>
      {/* OPERACIÓN: SOLO CUANDO LA RUTA LO PERMITE */}
      {!isManagementView && isOperationalUser && (
        <>
          <ConnectionManager token={token} />
          <QueryExecutor token={token} />
        </>
      )}

      <Routes>
        <Route path="/" element={
            ["Gerente", "RRHH", "Comercial", "Zonal"].includes(user?.role)
              ? <Navigate to={getHomeByRole(user?.role)} replace />
              : null
          }
        />
        {/* ADMIN */}
        <Route
          path="/admin/*"
          element={
            <ProtectedByRole user={user} roles={["Admin", "N2"]}>
              <AdminDashboard token={token} />
            </ProtectedByRole>
            
          }
        />

        {/* MENU POR LOCAL */}
        <Route
          path="/menu-locales"
          element={
            <ProtectedByRole user={user} roles={["Admin", "Comercial", "Zonal"]}>
              <DashMenu token={token} role={user?.role} />
            </ProtectedByRole>
          }
        />

        {/* ARTÍCULOS */}
        <Route
          path="/articulos"
          element={
            <ProtectedByRole user={user} roles={["Admin", "Comercial"]}>
              <Articulos token={token} />
            </ProtectedByRole>
          }
        />

        <Route
          path="/vendedores"
          element={
            <ProtectedByRole user={user} roles={["Admin", "RRHH"]}>
              <Vendedores token={token} />
            </ProtectedByRole>
          }
        />

        <Route
          path="/totems"
          element={
            <ProtectedByRole user={user} roles={["Admin", "N1", "Gerente","N2"]}>
              <Totems token={token} />
            </ProtectedByRole>
          }
        />  

        {/* RUTA POR DEFECTO */}

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

/* -------------------- FOOTER -------------------- */

const FooterContent = () => (
  <footer className="bg-light text-center p-2 mt-3 border-top">
    <p className="text-muted small mb-0">
      &copy; {new Date().getFullYear()} By Aplicaciones Tarragona. Todos los derechos reservados.
    </p>
  </footer>
);

/* -------------------- APP -------------------- */

function App() {
  const [token, setToken] = useState(localStorage.getItem("authToken") || "");
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("authUser");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const vistaAmplia =
    location.pathname.includes("/totems");

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem("authToken", newToken);
    localStorage.setItem("authUser", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken("");
    setUser(null);
    window.dispatchEvent(new Event("storage"));
  };

  useAuthGuard();

  return (
  <>
    {!token ? (
      <LoginForm onLogin={handleLogin} />
    ) : (
      <div className="d-flex flex-column min-vh-100">
        <Navbar
          user={user}
          onLogout={handleLogout}
          token={token}
        />

        <main className={`main-content mt-4 flex-grow-1 ${ vistaAmplia ? "main-content-wide" : "" }`} >
          <Layout token={token} user={user} />
        </main>

        <FooterContent />
      </div>
    )}
  </>
);
}

export default App;
