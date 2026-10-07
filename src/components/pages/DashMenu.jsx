// src/components/pages/DashMenu.jsx
import React, { useEffect, useRef, useState } from "react";
import ArticlesPage from "../articles/ArticlesPage";
import MenuLocales from "./MenuLocales";
import LocalHorariosBasePage from "../horarios/HorariosBasePage";
import VentasDistribuidasView from "../horarios/VentasDistribuidasView";
import LocalesLogsViewer from "../admin/LocalesLogsViewer";
import EditorMenu from "../editorMenu/EditorMenu";

import "../admin/AdminDashboard.css";

function DashMenu({ token, role }) {
  const isZonal = role === "Zonal";
  const menuRef = useRef(null);

  const [openMenu, setOpenMenu] = useState(null);
  const [activeTab, setActiveTab] = useState(
    isZonal ? "horarios-base" : "menu-locales"
  );

  /* ===============================
     GRUPOS Y TABS SEGÚN ROL
     (mismo estilo del Panel de Administración)
  =============================== */
  const gruposBase = [
    {
      key: "menu",
      label: "Menú",
      icon: "bi bi-journal-richtext",
      tabs: [
        { key: "menu-locales", label: "Menú Locales", icon: "bi bi-list-ul", visible: !isZonal },
        { key: "articulos", label: "Artículos", icon: "bi bi-basket", visible: !isZonal },
        { key: "editor-menu", label: "Editor de menú", icon: "bi bi-pencil-square", visible: role === "Admin" }
      ]
    },
    {
      key: "locales",
      label: "Locales",
      icon: "bi bi-shop",
      tabs: [
        { key: "horarios-base", label: "Horarios", icon: "bi bi-clock" },
        { key: "ventas", label: "Ventas Diarias", icon: "bi bi-graph-up-arrow" },
        { key: "logs", label: "Logs", icon: "bi bi-journal-text", visible: !isZonal }
      ]
    }
  ];

  const grupos = gruposBase
    .map((grupo) => ({
      ...grupo,
      tabs: grupo.tabs.filter((tab) => tab.visible !== false)
    }))
    .filter((grupo) => grupo.tabs.length > 0);

  /* ===============================
     VALIDACIÓN ZONAL
  =============================== */
  useEffect(() => {
    const zonalTabs = ["horarios-base", "ventas"];
    if (isZonal && !zonalTabs.includes(activeTab)) {
      setActiveTab("ventas");
    }
  }, [isZonal, activeTab]);

  /* ===============================
     CERRAR POPUP AL HACER CLICK FUERA
  =============================== */
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

  const grupoActivo = (grupo) => grupo.tabs.some((tab) => tab.key === activeTab);

  /* ===============================
     RENDER TABS
  =============================== */
  const renderTab = () => {
    switch (activeTab) {
      case "menu-locales":
        return <MenuLocales token={token} />;
      case "articulos":
        return <ArticlesPage token={token} />;
      case "horarios-base":
        return <LocalHorariosBasePage token={token} />;
      case "ventas":
        return <VentasDistribuidasView token={token} />;
      case "logs":
        return <LocalesLogsViewer token={token} />;
      case "editor-menu":
        return role === "Admin" ? <EditorMenu token={token} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="admin-header">
        <div>
          <h4 className="fw-bold mb-0">Administración de Locales</h4>
        </div>
      </div>

      <div className="admin-menu" ref={menuRef}>
        {grupos.map((grupo) => (
          <div className="admin-menu-group" key={grupo.key}>
            <button
              className={`admin-menu-button ${grupoActivo(grupo) ? "active" : ""}`}
              onClick={() => setOpenMenu(openMenu === grupo.key ? null : grupo.key)}
            >
              <i className={grupo.icon}></i>
              <span>{grupo.label}</span>
              <i className={`bi bi-chevron-${openMenu === grupo.key ? "up" : "down"} admin-chevron`}></i>
            </button>

            {openMenu === grupo.key && (
              <div className="admin-popup-menu">
                {grupo.tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`admin-popup-item ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => seleccionarTab(tab.key)}
                  >
                    <i className={tab.icon}></i>
                    <span>{tab.label}</span>

                    {activeTab === tab.key && <i className="bi bi-check-lg ms-auto"></i>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="admin-content">{renderTab()}</div>
    </div>
  );
}

export default DashMenu;
