import { useState } from "react";

// tamano: "" (64×48), "md" (128×96) o "lg" (192×144)
export default function Miniatura({ imagenNueva, url, tamano = "" }) {
  const [fallida, setFallida] = useState(false);
  const clase = `em-thumb ${tamano ? `em-thumb-${tamano}` : ""}`;

  if (imagenNueva) {
    return (
      <div className={`em-tw ${tamano ? `em-tw-${tamano}` : ""}`}>
        <img className={`${clase} em-thumb-nueva`} src={imagenNueva.url} alt="" />
        <span className="em-newtag">NUEVA</span>
      </div>
    );
  }

  return (
    <div className={`em-tw ${tamano ? `em-tw-${tamano}` : ""}`}>
      {url && !fallida ? (
        <img
          className={clase}
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFallida(true)}
        />
      ) : (
        <div className={`em-nothumb ${tamano ? `em-thumb-${tamano}` : ""}`}>Sin foto</div>
      )}
    </div>
  );
}
