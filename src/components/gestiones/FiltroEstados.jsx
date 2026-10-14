import Select from "react-select";

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
      options={opciones}
      value={opciones.filter((o) => value.includes(o.value))}
      onChange={(seleccion) => onChange((seleccion || []).map((o) => o.value))}
      placeholder={placeholder}
      noOptionsMessage={() => "Sin estados"}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      styles={{
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        control: (base) =>
          compacto ? { ...base, minHeight: 31, fontSize: "0.875rem" } : base
      }}
    />
  );
}
