import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import UserManagement from "./UsersManager";
import Reports from "./ReportsPanel";
import Logs from "./LogsViewer";
import VentasDistribuidasView from "./VentasDistribuidasView";
import UltimaVentaLocal from "./UltimaVentaLocal";
import Actualizaciones from "./Actualizaciones";
import DashboardAgotados from "../pages/DashboardAgotados";
import ConnectionsAdmin from "./ConnectionsAdmin";
import ScheduledTasks from "../scheduledTasks/ScheduledTasks";
import GestionesPage from "../gestiones/GestionesPage";

import "./AdminDashboard.css";

function AdminDashboard({ token, role }) {
  const location = useLocation();
  const menuRef = useRef(null);

  const [openMenu, setOpenMenu] = useState(null);

  // roles: si no se declara, el tab es visible para cualquiera con acceso
  // al Panel de Administración (Admin, N2). N2 no ve Ventas/Agotados/
  // Reportes/Logs/Usuarios.
  const gruposBase = [
    {
      key: "operacion",
      label: "Operación",
      icon: "bi bi-grid",
      tabs: [
        { key: "ultima-venta", label: "Distribución", icon: "bi bi-diagram-3" },
        { key: "ventas", label: "Ventas", icon: "bi bi-graph-up-arrow", roles: ["Admin"] },
        { key: "agotados", label: "Agotados", icon: "bi bi-exclamation-circle", roles: ["Admin"] }
      ]
    },
    {
      key: "control",
      label: "Control",
      icon: "bi bi-clipboard-data",
      tabs: [
        { key: "reports", label: "Reportes", icon: "bi bi-bar-chart", roles: ["Admin"] },
        { key: "logs", label: "Logs", icon: "bi bi-journal-text", roles: ["Admin"] },
        { key: "actualizaciones", label: "Actualización POS", icon: "bi bi-arrow-repeat" }
      ]
    },
    {
      key: "administracion",
      label: "Administración",
      icon: "bi bi-gear",
      tabs: [
        { key: "users", label: "Usuarios", icon: "bi bi-people", roles: ["Admin"] },
        { key: "scheduled-tasks", label: "Tareas", icon: "bi bi-list-check" },
        { key: "gestiones", label: "Gestiones", icon: "bi bi-sliders" },
        { key: "connections", label: "Locales", icon: "bi bi-shop" }
      ]
    }
  ];

  const grupos = gruposBase
    .map(grupo => ({
      ...grupo,
      tabs: grupo.tabs.filter(tab => !tab.roles || tab.roles.includes(role))
    }))
    .filter(grupo => grupo.tabs.length > 0);

  const allTabs = grupos.flatMap(grupo => grupo.tabs);

  const [activeTab, setActiveTab] = useState(
    location.state?.tab || "connections"
  );

  useEffect(() => {
    if (!location.state?.tab) return;

    const existe = allTabs.some(tab => tab.key === location.state.tab);

    if (existe) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  /* CERRAR POPUP AL HACER CLICK FUERA */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const seleccionarTab = (tabKey) => {
    setActiveTab(tabKey);
    setOpenMenu(null);
  };

  const grupoActivo = (grupo) =>
    grupo.tabs.some(tab => tab.key === activeTab);

  const tabActivo = allTabs.find(tab => tab.key === activeTab);

  const renderTab = () => {
    switch (activeTab) {
      case "users":
        return <UserManagement token={token} />;

      case "reports":
        return <Reports token={token} />;

      case "logs":
        return <Logs token={token} />;

      case "ultima-venta":
        return <UltimaVentaLocal token={token} />;

      case "ventas":
        return <VentasDistribuidasView token={token} />;

      case "actualizaciones":
        return <Actualizaciones token={token} />;

      case "agotados":
        return <DashboardAgotados token={token} />;

      case "connections":
        return <ConnectionsAdmin token={token} />;

      case "scheduled-tasks":
        return <ScheduledTasks token={token} />;

      case "gestiones":
        return <GestionesPage token={token} />;

      default:
        return null;
    }
  };

  return (
    <div className="container-fluid p-0">

      <div className="admin-header">
        <div>
          <h4 className="fw-bold mb-0">Panel de Administración</h4>
        </div>
      </div>

      <div className="admin-menu" ref={menuRef}>
        {grupos.map(grupo => (
          <div className="admin-menu-group" key={grupo.key}>

            <button className={`admin-menu-button ${grupoActivo(grupo) ? "active" : ""}`}
              onClick={() => setOpenMenu(openMenu === grupo.key ? null : grupo.key)}>
              <i className={grupo.icon}></i>
              <span>{grupo.label}</span>
              <i className={`bi bi-chevron-${openMenu === grupo.key ? "up" : "down"} admin-chevron`}></i>
            </button>

            {openMenu === grupo.key && (
              <div className="admin-popup-menu">
                {grupo.tabs.map(tab => (
                  <button key={tab.key}
                    className={`admin-popup-item ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => seleccionarTab(tab.key)}>
                    <i className={tab.icon}></i>

                    <span>{tab.label}</span>

                    {activeTab === tab.key && (
                      <i className="bi bi-check-lg ms-auto"></i>
                    )}
                  </button>
                ))}
              </div>
            )}

          </div>
        ))}
      </div>

      <div className="admin-content">
        {renderTab()}
      </div>

    </div>
  );
}

export default AdminDashboard;