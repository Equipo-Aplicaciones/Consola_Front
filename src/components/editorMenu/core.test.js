import fs from "fs";
import path from "path";
import * as C from "./core";

// Git en Windows puede entregar los fixtures con CRLF; el serializador siempre genera LF.
const leer = (nombre) =>
  fs.readFileSync(path.join(__dirname, "__fixtures__", nombre), "utf8").replace(/\r\n/g, "\n");

const cargar = () => leer("peya-muestra.json");

test("detecta PedidosYa", () => {
  expect(C.detectAdapter(JSON.parse(cargar())).name).toBe("PedidosYa");
});

test("exportar sin cambios deja el JSON idéntico", () => {
  const texto = cargar();
  const json = JSON.parse(texto);

  expect(
    C.serialize(json, C.detectIndent(texto), C.detectFloatKeys(texto))
  ).toBe(texto);
});

test("resuelve imagen PeYa por referencia IMG-<uuid>", () => {
  const json = JSON.parse(cargar());
  const producto = C.PEYA.products(json, "POSTRES").find((x) => x.name === "Helado Oreo");

  expect(producto.image).toBe("https://x/oreo.jpeg");
});

test("detecta imagen con id cruzado", () => {
  expect(C.PEYA.imageIssues(JSON.parse(cargar()))).toHaveLength(1);
});

test("identifica imagen por UUID o por nombre", () => {
  const productos = [
    { uid: "ef0c4464-5968-46fc-9693-579c1878f91b", name: "Helado Oreo" },
    { uid: "p3x123", name: "Box Gringou" }
  ];

  expect(C.matchImage("foto_ef0c4464-5968-46fc-9693-579c1878f91b.jpg", productos)).toBe(productos[0].uid);
  expect(C.matchImage("Box Gringou.PNG", productos)).toBe("p3x123");
  expect(C.matchImage("IMG_4432.jpg", productos)).toBeNull();
});

test("cambiar precio conserva el tipo texto de PeYa", () => {
  const json = JSON.parse(cargar());
  C.PEYA.setPrice(json, "POSTRES", "p3", 7990);

  expect(json.catalog.items.p3.price).toBe("7990");
});

const cargarFixture = leer;

describe("Rappi", () => {
  test("detecta el formato y exporta sin cambios idéntico, conservando los .0", () => {
    const texto = cargarFixture("rappi-muestra.json");
    const json = JSON.parse(texto);

    expect(C.detectAdapter(json).name).toBe("Rappi");
    expect(C.detectFloatKeys(texto)).toEqual(["price"]);
    expect(C.serialize(json, C.detectIndent(texto), C.detectFloatKeys(texto))).toBe(texto);
  });

  test("mover un producto cambia su categoría y lo deja al final", () => {
    const json = JSON.parse(cargarFixture("rappi-muestra.json"));
    C.RAPPI.move(json, "0", "C1", "C2");

    expect(json.items[0].category.id).toBe("C2");
    expect(json.items[0].sortingPosition).toBe(3);
  });

  test("cambiar precio escribe .0 al exportar", () => {
    const texto = cargarFixture("rappi-muestra.json");
    const json = JSON.parse(texto);
    C.RAPPI.setPrice(json, "C1", "0", 8990);

    expect(C.serialize(json, 2, ["price"])).toContain('"price": 8990.0');
  });
});

describe("Uber Eats", () => {
  test("detecta el formato y exporta sin cambios idéntico", () => {
    const texto = cargarFixture("uber-muestra.json");
    const json = JSON.parse(texto);

    expect(C.detectAdapter(json).name).toBe("Uber Eats");
    expect(C.serialize(json, C.detectIndent(texto), C.detectFloatKeys(texto))).toBe(texto);
  });

  test("el precio se guarda multiplicado por 100", () => {
    const json = JSON.parse(cargarFixture("uber-muestra.json"));
    C.UBER.setPrice(json, "C1", "I1", 8990);

    expect(json.items[0].price_info.price).toBe(899000);
  });

  test("el orden es posicional y mover agrega al final de la categoría destino", () => {
    const json = JSON.parse(cargarFixture("uber-muestra.json"));

    C.UBER.setOrder(json, "C1", "I2", 1);
    expect(json.categories[0].entities.map((e) => e.id)).toEqual(["I2", "I1"]);

    C.UBER.move(json, "I1", "C1", "C2");
    expect(json.categories[1].entities.map((e) => e.id)).toEqual(["I1"]);
  });
});

describe("diffDetalle", () => {
  test("entrega datos estructurados y diff() devuelve los mismos textos", () => {
    const texto = cargarFixture("rappi-muestra.json");
    const original = JSON.parse(texto);
    const actual = JSON.parse(texto);
    C.RAPPI.setPrice(actual, "C1", "0", 8990);
    C.RAPPI.setDesc(actual, "C1", "0", "Más rico");
    C.RAPPI.move(actual, "1", "C2", "C1");

    const detalle = C.diffDetalle(C.RAPPI, original, actual);
    const tipos = detalle.map((d) => d.tipo).sort();

    expect(tipos).toEqual(["descripcion", "movido", "precio"]);

    const precio = detalle.find((d) => d.tipo === "precio");
    expect(precio).toMatchObject({ uid: "S1", nombre: "Pollo", antes: 7990, despues: 8990 });

    const movido = detalle.find((d) => d.tipo === "movido");
    expect(movido).toMatchObject({ uid: "S2", antesIds: ["C2"], despuesIds: ["C1"] });

    expect(C.diff(C.RAPPI, original, actual)).toEqual(detalle.map((d) => d.texto));
  });

  test("sin cambios no devuelve entradas", () => {
    const json = JSON.parse(cargarFixture("uber-muestra.json"));

    expect(C.diffDetalle(C.UBER, json, JSON.parse(JSON.stringify(json)))).toEqual([]);
  });
});

describe("nombres de archivo exportado", () => {
  test("nombreBase quita los sufijos acumulados de exportaciones anteriores", () => {
    expect(C.nombreBase("pyapi-ta-ma-menu-071026-editado-editado (1)-editado.json")).toBe("pyapi-ta-ma-menu-071026");
    expect(C.nombreBase("menu-editado-20261013-1124.json")).toBe("menu");
    expect(C.nombreBase("menu-editado-20261013-1124 (2).json")).toBe("menu");
    expect(C.nombreBase("menu (3).JSON")).toBe("menu");
  });

  test("nombreBase conserva nombres normales aunque contengan la palabra editado", () => {
    expect(C.nombreBase("menu.json")).toBe("menu");
    expect(C.nombreBase("mi-editado-menu.json")).toBe("mi-editado-menu");
    expect(C.nombreBase("")).toBe("menu");
  });

  test("marcaTiempo entrega AAAAMMDD-HHmm en hora local", () => {
    expect(C.marcaTiempo(new Date(2026, 9, 13, 9, 5))).toBe("20261013-0905");
  });
});

describe("imágenes: nombres a partir de la URL del JSON", () => {
  const URL_BASE = "https://storesvc0001.blob.core.windows.net/images/tarragona/ta/";
  const ID = "7a3b5add-1185-44b4-9c5e-f52883c901c2";

  test("idDeImagen y urlConNombre", () => {
    expect(C.idDeImagen(`${URL_BASE}${ID}.jpeg`)).toBe(ID);
    expect(C.idDeImagen(`${URL_BASE}${ID}.jpeg?v=2#x`)).toBe(ID);
    expect(C.idDeImagen("")).toBe("");
    expect(C.idDeImagen(URL_BASE)).toBe("");
    expect(C.urlConNombre(`${URL_BASE}${ID}.jpeg?v=2`, `${ID}-13102026.jpeg`)).toBe(`${URL_BASE}${ID}-13102026.jpeg`);
  });

  test("marcaFecha entrega ddmmaaaa", () => {
    expect(C.marcaFecha(new Date(2026, 9, 3, 15, 30))).toBe("03102026");
  });

  test("PedidosYa: nombra con el id de la URL y actualiza el ítem IMG del JSON (sin tocar el original)", () => {
    const json = JSON.parse(cargar());
    const oreo = "ef0c4464-5968-46fc-9693-579c1878f91b";
    json.catalog.items["IMG-" + oreo].url = `${URL_BASE}${ID}.jpeg`;

    const { clon, entradas } = C.aplicarImagenes(C.PEYA, json, [oreo], "13102026");

    expect(entradas[0]).toMatchObject({
      archivoBase: `${ID}.jpeg`,
      archivoFecha: `${ID}-13102026.jpeg`,
      urlAnterior: `${URL_BASE}${ID}.jpeg`,
      urlNueva: `${URL_BASE}${ID}-13102026.jpeg`,
      omitida: false
    });
    expect(clon.catalog.items["IMG-" + oreo].url).toBe(`${URL_BASE}${ID}-13102026.jpeg`);
    expect(json.catalog.items["IMG-" + oreo].url).toBe(`${URL_BASE}${ID}.jpeg`);
  });

  test("sin URL previa usa el UUID del producto y no modifica el JSON", () => {
    const json = JSON.parse(cargar());
    const { clon, entradas } = C.aplicarImagenes(C.PEYA, json, ["p3"], "13102026");

    expect(entradas[0].archivoBase).toBe("p3.jpeg");
    expect(entradas[0].archivoFecha).toBe("p3-13102026.jpeg");
    expect(entradas[0].urlNueva).toBe("");
    expect(entradas[0].avisos).toHaveLength(1);
    expect(clon).toEqual(json);
  });

  test("dos productos con la misma imagen: el segundo no se exporta", () => {
    const json = JSON.parse(cargar());
    const oreo = "ef0c4464-5968-46fc-9693-579c1878f91b";
    const brownie = "f8dc512b-ebbf-41ed-bc39-5adf6da7bc49";
    json.catalog.items["IMG-" + oreo].url = `${URL_BASE}${ID}.jpeg`;
    json.catalog.items["IMG-" + brownie].url = `${URL_BASE}${ID}.jpeg`;

    const { entradas } = C.aplicarImagenes(C.PEYA, json, [oreo, brownie], "13102026");

    expect(entradas.map((e) => e.omitida)).toEqual([false, true]);
  });

  test("Rappi y Uber: escriben en el campo de imagen que ya existe (image_url / imageUrl / url)", () => {
    const rappi = JSON.parse(cargarFixture("rappi-muestra.json"));
    rappi.items[0].image_url = `${URL_BASE}${ID}.jpeg`;
    const r = C.aplicarImagenes(C.RAPPI, rappi, ["S1"], "13102026");
    expect(r.entradas[0].archivoFecha).toBe(`${ID}-13102026.jpeg`);
    expect(r.clon.items[0].image_url).toBe(`${URL_BASE}${ID}-13102026.jpeg`);

    const uber = JSON.parse(cargarFixture("uber-muestra.json"));
    uber.items[0].imageUrl = `${URL_BASE}${ID}.jpeg`;
    const u = C.aplicarImagenes(C.UBER, uber, ["I1"], "13102026");
    expect(u.clon.items[0].imageUrl).toBe(`${URL_BASE}${ID}-13102026.jpeg`);
  });

  test("también reconoce el campo url directo en el producto", () => {
    const rappi = JSON.parse(cargarFixture("rappi-muestra.json"));
    rappi.items[1].url = `${URL_BASE}${ID}.jpeg`;

    const r = C.aplicarImagenes(C.RAPPI, rappi, ["S2"], "13102026");

    expect(r.entradas[0].archivoBase).toBe(`${ID}.jpeg`);
    expect(r.clon.items[1].url).toBe(`${URL_BASE}${ID}-13102026.jpeg`);
  });

  test("diffDetalle informa el cambio de imagen", () => {
    const json = JSON.parse(cargar());
    const oreo = "ef0c4464-5968-46fc-9693-579c1878f91b";
    json.catalog.items["IMG-" + oreo].url = `${URL_BASE}${ID}.jpeg`;
    const { clon } = C.aplicarImagenes(C.PEYA, json, [oreo], "13102026");

    const imagen = C.diffDetalle(C.PEYA, json, clon).find((d) => d.tipo === "imagen");

    expect(imagen).toMatchObject({ uid: oreo, antes: `${URL_BASE}${ID}.jpeg`, despues: `${URL_BASE}${ID}-13102026.jpeg` });
    expect(imagen.texto).toContain(`${ID}.jpeg → ${ID}-13102026.jpeg`);
  });
});
