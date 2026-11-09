import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Por defecto es el menú de acciones de móvil (⋮); con className="" e icon="bi-three-dots" sirve
// también en escritorio como botón "más funciones".
function MobileActions({
  actions = [],
  className = "d-md-none",
  icon = "bi-three-dots-vertical",
  title
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: null, bottom: null, right: 0 });
  const ref = useRef();

  const toggleMenu = () => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 180;

    setCoords({
      top: openUp ? null : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : null,
      right: window.innerWidth - rect.right
    });

    setOpen(prev => !prev);
  };

  // cerrar al hacer click fuera (del botón o del menú, que ahora vive en un portal)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        !e.target.closest(".mobile-dropdown")
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // cerrar si la página se desplaza o cambia de tamaño, para no dejar el
  // menú "flotando" en una posición que ya no corresponde al botón
  useEffect(() => {
    if (!open) return;

    const cerrar = () => setOpen(false);

    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);

    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [open]);

  return (
    <div className={`${className} position-relative`} ref={ref}>
      <button
        className="btn btn-sm btn-outline-secondary"
        title={title}
        onClick={toggleMenu}
      >
        <i className={`bi ${icon}`}></i>
      </button>

      {open && createPortal(
        <div
          className="mobile-dropdown shadow"
          style={{
            position: "fixed",
            top: coords.top ?? undefined,
            bottom: coords.bottom ?? undefined,
            right: coords.right
          }}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              className={`dropdown-item-action ${action.className || ""}`}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
            >
              <i className={`${action.icon} me-2`}></i>
              {action.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default MobileActions;
