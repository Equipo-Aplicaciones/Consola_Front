export const IMG_W = 1440;
export const IMG_H = 1080;
export const JPG_QUALITY = 0.9;

function cargarImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const im = new Image();

    im.onload = () => resolve({ im, url });
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen (formato no soportado por el navegador)"));
    };
    im.src = url;
  });
}

// Recorta al centro a 4:3, escala a IMG_W×IMG_H y devuelve un JPG sobre fondo blanco.
export async function procesarImagen(archivo) {
  const { im, url } = await cargarImagen(archivo);
  const w = im.naturalWidth;
  const h = im.naturalHeight;
  const objetivo = IMG_W / IMG_H;
  const razon = w / h;
  let sx = 0;
  let sy = 0;
  let sw = w;
  let sh = h;

  if (razon > objetivo) {
    sw = Math.round(h * objetivo);
    sx = Math.round((w - sw) / 2);
  } else if (razon < objetivo) {
    sh = Math.round(w / objetivo);
    sy = Math.round((h - sh) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = IMG_W;
  canvas.height = IMG_H;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, IMG_W, IMG_H);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(im, sx, sy, sw, sh, 0, 0, IMG_W, IMG_H);
  URL.revokeObjectURL(url);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPG_QUALITY));
  const warn = [];
  const formato = archivo.type.split("/")[1] || "";

  if (Math.abs(razon - objetivo) > 0.02) warn.push(`proporción ${w}×${h}: se recortó al centro`);
  if (w < IMG_W || h < IMG_H) warn.push(`menor a ${IMG_W}×${IMG_H}: se amplió, puede verse borrosa`);
  if (!/jpe?g$/i.test(formato)) warn.push(`convertida de ${(formato || "?").toUpperCase()} a JPG`);

  return { blob, url: URL.createObjectURL(blob), src: archivo.name, w, h, warn };
}

export function descargar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
