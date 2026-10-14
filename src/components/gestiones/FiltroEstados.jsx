import Select, { components } from "react-select";

// Muestra solo el primer estado como etiqueta y el resto como "+N", para que el
// cuadro no crezca en alto al seleccionar varios.
function EtiquetaEstado(props) {
  const total = props.selectProps.value.length;

  if (props.index === 0) return <components.MultiValue {...props} />;

  if (props.index === 1) {
    return (
      <div
        title={props.selectProps.value.slice(1).map((o) => o.label).join(", ")}
        style={{
          background: "hsl(0, 0%, 90%)",
          borderRadius: 2,
          fontSize: "85%",
          margin: 2,
          padding: "3px 6px",
          flexShrink: 0
        }}
      >
        +{total - 1}
      </div>
    );
  }

  return null;
}

// Selector de varios estados a la vez. `value` es la lista de códigos seleccionados.
export default function FiltroEstados({
  estados,
  value,
  onChange,
  placeholder = "Todos los estados",
  compacto = false
}) {
  const opciones = estados.map((e) => ({ value: e.codigo, label: e.nombre }));

  return (
    <Select
      isMulti
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      options={opciones}
      value={opciones.filter((o) => value.includes(o.value))}
      onChange={(seleccion) => onChange((seleccion || []).map((o) => o.value))}
      placeholder={placeholder}
      noOptionsMessage={() => "Sin estados"}
      components={{ MultiValue: EtiquetaEstado }}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      styles={{
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        control: (base) =>
          compacto ? { ...base, minHeight: 31, fontSize: "0.875rem" } : base,
        valueContainer: (base) => ({ ...base, flexWrap: "nowrap", overflow: "hidden" })
      }}
    />
  );
}
