// src/components/AdminDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import ArticlesPage from "../articles/ArticlesPage";
import MenuLocales from "./MenuLocales";
import LocalHorariosBasePage from "../horarios/HorariosBasePage";
import VentasDistribuidasView from "../horarios/VentasDistribuidasView";
import LocalesLogsViewer from "../admin/LocalesLogsViewer";

function DashMenu({ token, role }) {
  const isZonal = role === "Zonal";

  const [activeTab, setActiveTab] = useState(
    isZonal ? "horarios-base" : "menu-locales"
  );

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [visibleCount, setVisibleCount] = useState(3);
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  /* ===============================
     TABS SEGÚN ROL
  =============================== */
  const tabs = [
    ...(!isZonal
      ? [
          { key: "menu-locales", label: "Menú Locales" },
          { key: "articulos", label: "Artículos" },
        ]
      : []),
    { key: "horarios-base", label: "Horarios" },
    { key: "ventas", label: "Ventas Diarias" },
    ...(!isZonal ? [{ key: "logs", label: "Logs" }] : []),
  ];

  /* ===============================
     CONTROL RESPONSIVE
  =============================== */
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
     CÁLCULO DINÁMICO MOBILE
  =============================== */
  useEffect(() => {
    if (!isMobile) return;

    const calculateTabs = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.offsetWidth;
      const tabWidth = 80;
      const moreWidth = 60;

      let count = Math.floor(width / tabWidth);

      if (count < tabs.length) {
        count = Math.floor((width - moreWidth) / tabWidth);
      }

      setVisibleCount(count > 0 ? count : 1);
    };

    calculateTabs();
    window.addEventListener("resize", calculateTabs);

    return () => window.removeEventListener("resize", calculateTabs);
  }, [isMobile, tabs.length]);

  const visibleTabs = tabs.slice(0, visibleCount);
  const hiddenTabs = tabs.slice(visibleCount);

  /* ===============================
     CERRAR DROPDOWN
  =============================== */
  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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
      default:
        return null;
    }
  };

  return (
    <div className="container-fluid p-0">
      <h4 className="fw-bold mb-2">Administración de Locales</h4>

      {/* ===============================
          DESKTOP → Bootstrap Tabs
      =============================== */}
      {!isMobile && (
        <ul className="nav nav-tabs mb-2">
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.key}>
              <button
                className={`nav-link ${
                  activeTab === tab.key ? "active" : ""
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ===============================
          MOBILE → Tabs dinámicos
      =============================== */}
      {isMobile && (
        <div className="tabs-line mb-3 gap-2" ref={containerRef}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-line ${
                activeTab === tab.key ? "active" : ""
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}

          {hiddenTabs.length > 0 && (
            <div className="dropdown-custom" ref={dropdownRef}>
              <button
                className="tab-line more-btn"
                onClick={() => setOpen((prev) => !prev)}
              >
                ...
              </button>

              {open && (
                <div className="dropdown-menu-custom">
                  {hiddenTabs.map((tab) => (
                    <div
                      key={tab.key}
                      className="dropdown-item-custom"
                      onClick={() => {
                        setActiveTab(tab.key);
                        setOpen(false);
                      }}
                    >
                      {tab.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO */}
      <div >{renderTab()}</div>
    </div>
  );
}

export default DashMenu;