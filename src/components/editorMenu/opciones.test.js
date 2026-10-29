import * as C from "./core";

const clonar = (o) => JSON.parse(JSON.stringify(o));

// Estructura tomada de un export real de PedidosYa: producto.toppings → grupo (Topping) → products → opción (Product).
const peya = () => ({
  catalog: {
    items: {
      MENU: { id: "MENU", type: "Menu", products: { CAT: { id: "CAT", type: "Category", order: 1 } } },
      CAT: {
        id: "CAT",
        type: "Category",
        title: { default: "Combos" },
        products: { COMBO: { id: "COMBO", type: "Product", order: 1 }, COCA: { id: "COCA", type: "Product", order: 2 } }
      },
      COMBO: {
        id: "COMBO",
        type: "Product",
        title: { default: "Combo 6 piezas" },
        description: { default: "Combo familiar" },
        price: 9990,
        toppings: { BEBIDA: { id: "BEBIDA", type: "Topping", order: 1 } }
      },
      BEBIDA: {
        id: "BEBIDA",
        type: "Topping",
        title: { default: "Elige tu Bebida en Lata" },
        quantity: { minimum: 1, maximum: 1 },
        products: {
          COCA: { id: "COCA", type: "Product", price: 0 },
          ZERO: { id: "ZERO", type: "Product", price: 0 }
        }
      },
      COCA: { id: "COCA", type: "Product", title: { default: "Coca-Cola Original" }, description: { default: "Coca-Cola Original" }, price: 0, active: true },
      ZERO: { id: "ZERO", type: "Product", title: { default: "Coca-Cola Sin Azúcar" }, description: { default: "Zero" }, price: 0, active: true }
    }
  }
});

const rappi = () => ({
  items: [
    {
      sku: "P1", name: "Combo 6", price: 9990, sortingPosition: 1, category: { id: "C1", name: "Combos", sortingPosition: 1 },
      children: [
        { name: "Coca-Cola Original", sku: "OPC1", type: "TOPPING", description: "Coca-Cola Original", category: { id: "BEBIDA_1", name: "Elige tu Bebida en Lata" } },
        { name: "Sprite", sku: "OPC2", type: "TOPPING", category: { id: "BEBIDA_1", name: "Elige tu Bebida en Lata" } }
      ]
    },
    {
      sku: "P2", name: "Combo 12", price: 15990, sortingPosition: 2, category: { id: "C1", name: "Combos", sortingPosition: 1 },
      children: [{ name: "Coca-Cola Original", sku: "OPC1", type: "TOPPING", category: { id: "BEBIDA_2", name: "Elige tu Bebida" } }]
    }
  ]
});

const uber = () => ({
  menus: [{ id: "M", category_ids: ["C1"] }],
  categories: [{ id: "C1", title: { translations: { en: "Combos" } }, entities: [{ id: "P1", type: "ITEM" }] }],
  modifier_groups: [
    {
      id: "G1",
      title: { translations: { en: "Elige tu Bebida en Lata" } },
      modifier_options: [{ id: "O1", type: "ITEM" }, { id: "O2", type: "ITEM" }]
    }
  ],
  items: [
    { id: "P1", title: { translations: { en: "Combo 6" } }, price_info: { price: 999000 }, modifier_group_ids: { ids: ["G1"] } },
    { id: "O1", title: { translations: { en: "Coca-Cola Original" } }, price_info: { price: 0 } },
    { id: "O2", title: { translations: { en: "Sprite" } }, price_info: { price: 0 } }
  ]
});

describe("PedidosYa", () => {
  test("lista grupos (solo lectura) con sus opciones", () => {
    const [g] = C.PEYA.optionGroups(peya(), "CAT", "COMBO");

    expect(g.id).toBe("BEBIDA");
    expect(g.name).toBe("Elige tu Bebida en Lata");
    expect(g.options.map((o) => o.name)).toEqual(["Coca-Cola Original", "Coca-Cola Sin Azúcar"]);
  });

  test("marca las opciones que además son productos del menú", () => {
    const [g] = C.PEYA.optionGroups(peya(), "CAT", "COMBO");

    expect(g.options.find((o) => o.id === "COCA").tambienProducto).toBe(true);
    expect(g.options.find((o) => o.id === "ZERO").tambienProducto).toBe(false);
  });

  test("renombrar cambia solo title.default de la opción", () => {
    const original = peya(), j = clonar(original);
    C.PEYA.setOptionName(j, "ZERO", "  Coca-Cola Zero 350 cc ");

    const esperado = clonar(original);
    esperado.catalog.items.ZERO.title.default = "Coca-Cola Zero 350 cc";
    expect(j).toEqual(esperado);
  });

  test("no toca el grupo, la descripción ni los ids", () => {
    const j = peya();
    C.PEYA.setOptionName(j, "ZERO", "Otro");

    expect(j.catalog.items.BEBIDA.title.default).toBe("Elige tu Bebida en Lata");
    expect(j.catalog.items.ZERO.description.default).toBe("Zero");
    expect(j.catalog.items.ZERO.id).toBe("ZERO");
    expect(Object.keys(j.catalog.items.BEBIDA.products)).toEqual(["COCA", "ZERO"]);
  });

  test("rechaza nombre vacío u opción inexistente", () => {
    expect(() => C.PEYA.setOptionName(peya(), "ZERO", "   ")).toThrow(/vacío/);
    expect(() => C.PEYA.setOptionName(peya(), "NOEXISTE", "x")).toThrow(/no existe/);
  });

  test("el diff reporta la opción renombrada una sola vez", () => {
    const original = peya(), j = clonar(original);
    C.PEYA.setOptionName(j, "ZERO", "Coca-Cola Zero 350 cc");

    const cambios = C.diffDetalle(C.PEYA, original, j).filter((x) => x.tipo === "opcion");
    expect(cambios).toEqual([
      expect.objectContaining({ opcionId: "ZERO", antes: "Coca-Cola Sin Azúcar", despues: "Coca-Cola Zero 350 cc" })
    ]);
  });

  test("verificarOpciones acepta un renombrado y detecta cambios de estructura", () => {
    const original = peya(), j = clonar(original);
    C.PEYA.setOptionName(j, "ZERO", "Zero 350");
    expect(C.verificarOpciones(C.PEYA, original, j)).toEqual([]);

    delete j.catalog.items.BEBIDA.products.ZERO;
    expect(C.verificarOpciones(C.PEYA, original, j)).toHaveLength(1);
  });
});

describe("Rappi", () => {
  test("agrupa las opciones por category del hijo (nombre del grupo de solo lectura)", () => {
    const [g] = C.RAPPI.optionGroups(rappi(), "C1", "0");

    expect(g.name).toBe("Elige tu Bebida en Lata");
    expect(g.options.map((o) => [o.id, o.name])).toEqual([["OPC1", "Coca-Cola Original"], ["OPC2", "Sprite"]]);
  });

  test("renombra todas las apariciones del mismo sku sin tocar nada más", () => {
    const original = rappi(), j = clonar(original);
    C.RAPPI.setOptionName(j, "OPC1", "Coca-Cola 350 cc");

    const esperado = clonar(original);
    esperado.items[0].children[0].name = "Coca-Cola 350 cc";
    esperado.items[1].children[0].name = "Coca-Cola 350 cc";
    expect(j).toEqual(esperado);
    expect(j.items[0].children[0].description).toBe("Coca-Cola Original");
    expect(j.items[0].children[0].category.name).toBe("Elige tu Bebida en Lata");
  });

  test("falla si el sku no existe o el nombre está vacío", () => {
    expect(() => C.RAPPI.setOptionName(rappi(), "NOPE", "x")).toThrow(/SKU/);
    expect(() => C.RAPPI.setOptionName(rappi(), "OPC1", "")).toThrow(/vacío/);
  });

  test("el diff reporta una sola opción aunque se repita en varios productos", () => {
    const original = rappi(), j = clonar(original);
    C.RAPPI.setOptionName(j, "OPC1", "Coca-Cola 350 cc");

    expect(C.diffDetalle(C.RAPPI, original, j).filter((x) => x.tipo === "opcion")).toHaveLength(1);
    expect(C.verificarOpciones(C.RAPPI, original, j)).toEqual([]);
  });
});

describe("Uber Eats", () => {
  test("resuelve producto → grupo → opciones por id", () => {
    const [g] = C.UBER.optionGroups(uber(), "C1", "P1");

    expect(g.id).toBe("G1");
    expect(g.name).toBe("Elige tu Bebida en Lata");
    expect(g.options.map((o) => o.name)).toEqual(["Coca-Cola Original", "Sprite"]);
  });

  test("renombra solo items[].title.translations.en", () => {
    const original = uber(), j = clonar(original);
    C.UBER.setOptionName(j, "O1", "Coca-Cola 350 cc");

    const esperado = clonar(original);
    esperado.items[1].title.translations.en = "Coca-Cola 350 cc";
    expect(j).toEqual(esperado);
    expect(j.modifier_groups[0].title.translations.en).toBe("Elige tu Bebida en Lata");
  });

  test("diff y validación", () => {
    const original = uber(), j = clonar(original);
    C.UBER.setOptionName(j, "O2", "Sprite 350 cc");

    expect(C.diffDetalle(C.UBER, original, j).filter((x) => x.tipo === "opcion")).toHaveLength(1);
    expect(C.verificarOpciones(C.UBER, original, j)).toEqual([]);
  });

  test("falla con nombre vacío o id inexistente", () => {
    expect(() => C.UBER.setOptionName(uber(), "O1", " ")).toThrow(/vacío/);
    expect(() => C.UBER.setOptionName(uber(), "ZZZ", "x")).toThrow(/no existe/);
  });
});
