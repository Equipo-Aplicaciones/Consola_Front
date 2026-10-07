import fs from "fs";
import path from "path";
import * as C from "./core";

const cargar = () =>
  fs.readFileSync(path.join(__dirname, "__fixtures__", "peya-muestra.json"), "utf8");

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

const cargarFixture = (nombre) =>
  fs.readFileSync(path.join(__dirname, "__fixtures__", nombre), "utf8");

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
