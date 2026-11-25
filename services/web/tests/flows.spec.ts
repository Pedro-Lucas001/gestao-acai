import { test, expect } from "@playwright/test";
// Contract fixtures stay in tests. The application has no mock mode or seed data.
const ingredient = {
  id: "ingredient-1",
  name: "Polpa de açaí",
  unit: "g",
  purchaseQuantity: 1000,
  purchasePrice: 20,
};
const product = {
  id: "product-1",
  name: "Tradicional",
  size: "300 ml",
  price: 10,
  feePercent: 6,
  feePerUnit: 0.5,
  recipe: [{ ingredientId: ingredient.id, quantity: 250 }],
  unitCost: 5,
  variableFee: 1.1,
  contribution: 3.9,
};
const summary = {
  revenue: 20,
  contribution: 7.8,
  salesCount: 1,
  averageMargin: 39,
  cost: 10,
  fees: 2.2,
  expenses: 3,
  netResult: 4.8,
  quantity: 2,
  monthlyFixedCosts: 100,
  breakEvenUnits: 26,
  daily: [{ date: "2026-11-23", revenue: 20 }],
};
test("animated entry, direct access, responsive navigation, saving and API error recovery", async ({
  page,
}, info) => {
  let rejectSave = false;
  let rejectLoad = false;
  const writes: { route: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    if (!new URL(req.url()).pathname.startsWith("/api/"))
      return route.continue();
    const path = new URL(req.url()).pathname.split("/").pop()!;
    expect(path).not.toBe("login");
    expect(req.headers().authorization).toBeUndefined();
    if (req.method() !== "GET") {
      if (rejectSave)
        return route.fulfill({
          status: 503,
          json: { error: "Banco temporariamente indisponível." },
        });
      writes.push({ route: path, body: req.postDataJSON() });
      return route.fulfill({ json: { id: "saved-id" } });
    }
    if (rejectLoad)
      return route.fulfill({
        status: 503,
        json: { error: "Banco indisponível." },
      });
    return route.fulfill({
      json:
        path === "dashboard"
          ? summary
          : path === "ingredients"
            ? [ingredient]
            : path === "products"
              ? [product]
              : [],
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "Netuno Açaí", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seu negócio, em perspectiva." }),
  ).toBeVisible();
  await expect(page.locator(".metric-card").first()).toContainText("20,00");
  await expect(page.locator(".metric-card").last()).toContainText("4,80");
  await expect(page.getByText("Carregando os dados")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/netuno-dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  async function navigate(name: string) {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  }
  await navigate("Insumos");
  await page.getByRole("button", { name: "Novo insumo" }).click();
  await page.getByLabel("Nome do insumo").fill("Garrafa");
  await page.getByLabel("Unidade base").selectOption("un");
  await page.getByLabel("Quantidade comprada").fill("100");
  await page.getByLabel("Valor total da compra").fill("50");
  rejectSave = true;
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Banco temporariamente indisponível",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Nome do insumo")).toHaveValue("Garrafa");
  rejectSave = false;
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Registro salvo");
  expect(writes[0].body).toEqual({
    name: "Garrafa",
    unit: "un",
    purchaseQuantity: 100,
    purchasePrice: 50,
  });
  await navigate("Produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();
  await page.getByLabel("Nome / sabor").fill("Morango");
  await page.getByLabel("Tamanho", { exact: true }).fill("300 ml");
  await page.getByLabel("Preço de venda").fill("12");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Insumo", exact: true })
    .selectOption(ingredient.id);
  await page.getByLabel("Quantidade do insumo 1").fill("200");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[1].body.recipe).toEqual([
    { ingredientId: ingredient.id, quantity: 200 },
  ]);
  await navigate("Vendas");
  await page
    .getByRole("button", { name: "Registrar venda", exact: true })
    .click();
  await page.getByLabel("Quantidade de garrafas").fill("2");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[2].body).toMatchObject({
    productId: product.id,
    price: 10,
    quantity: 2,
    feePercent: 6,
    feePerUnit: 0.5,
  });
  await navigate("Precificação");
  await expect(page.getByText("Estimativa de 26 garrafas")).toBeVisible();
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await page.getByLabel("Previsão mensal").fill("120");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[3]).toEqual({
    route: "fixed-costs",
    body: { monthlyAmount: 120 },
  });
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByLabel("De", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Até", { exact: true }).fill("2026-10-31");
  const filtered = page.waitForRequest((req) =>
    req.url().includes("dashboard?from=2026-10-01&to=2026-10-31"),
  );
  await page.getByRole("button", { name: "Aplicar" }).click();
  await filtered;
  await expect(page.getByText("Rentabilidade por produto")).toBeVisible();
  rejectLoad = true;
  await page.getByRole("button", { name: "Atualizar dados" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar",
  );
  await expect(page.getByText("Rentabilidade por produto")).toHaveCount(0);
  rejectLoad = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Rentabilidade por produto")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Seu negócio, em perspectiva." }),
  ).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
});

async function unavailableApi(page: import("@playwright/test").Page) {
  await page.route("**/api/**", (route) =>
    new URL(route.request().url()).pathname.startsWith("/api/")
      ? route.fulfill({ status: 503, json: { error: "Banco indisponível." } })
      : route.continue(),
  );
}

test("intro can be skipped with the keyboard and never blocks an API error", async ({
  page,
}) => {
  await unavailableApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("main", { name: "Abertura Netuno Açaí" }),
  ).toBeVisible();
  const skip = page.getByRole("button", { name: "Entrar agora" });
  await skip.focus();
  await skip.press("Enter");
  await expect(
    page.getByRole("main", { name: "Abertura Netuno Açaí" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Seu negócio, em perspectiva." }),
  ).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("Banco indisponível");
  await expect(page.getByLabel("Usuário", { exact: true })).toHaveCount(0);
});

test("reduced motion opens the dashboard directly", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await unavailableApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio, em perspectiva." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar agora" })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
});

test("static host 404 automatically enables browser local mode with full persistence", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", (route) =>
    new URL(route.request().url()).pathname.startsWith("/api/")
      ? route.fulfill({ status: 404, body: "Not Found" })
      : route.continue(),
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu negócio, em perspectiva." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Verify 7 dias preset highlights correctly
  const sevenDays = page.getByRole("button", { name: "7 dias" });
  await sevenDays.click();
  await expect(sevenDays).toHaveClass(/selected/);

  async function navigate(name: string) {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  }

  // Create ingredient
  await navigate("Insumos");
  await page.getByRole("button", { name: "Novo insumo" }).click();
  await page.getByLabel("Nome do insumo").fill("Polpa especial");
  await page.getByLabel("Unidade base").selectOption("g");
  await page.getByLabel("Quantidade comprada").fill("1000");
  await page.getByLabel("Valor total da compra").fill("25");
  await expect(page.locator(".live-preview")).toContainText("0,025");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("Polpa especial")).toBeVisible();

  // Create product
  await navigate("Produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();
  await page.getByLabel("Nome / sabor").fill("Açaí Puro");
  await page.getByLabel("Tamanho", { exact: true }).fill("500 ml");
  await page.getByLabel("Preço de venda").fill("18");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Insumo", exact: true })
    .selectOption({ index: 1 });
  await page.getByLabel("Quantidade do insumo 1").fill("400");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("Açaí Puro")).toBeVisible();

  // Register sale & verify persistence after reload
  await navigate("Vendas");
  await page
    .getByRole("button", { name: "Registrar venda", exact: true })
    .click();
  await page.getByLabel("Quantidade de garrafas").fill("2");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.locator("table").getByText("Açaí Puro · 500 ml"),
  ).toBeVisible();

  // Delete sale with confirmation
  await page.getByRole("button", { name: /Excluir Açaí Puro/ }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByText("Tudo começa com o primeiro registro")).toBeVisible();

  // Create & edit expense
  await navigate("Despesas");
  await page.getByRole("button", { name: "Nova despesa" }).click();
  await page.getByLabel("Descrição").fill("Energia");
  await page.getByLabel("Categoria").fill("Contas");
  await page.getByLabel("Valor (R$)").fill("150");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("Energia")).toBeVisible();

  await page.getByRole("button", { name: "Editar Energia" }).click();
  await page.getByLabel("Descrição").fill("Energia elétrica");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("Energia elétrica")).toBeVisible();

  // Pricing simulator
  await navigate("Precificação");
  await expect(page.getByText("Encontre o preço ideal para sua margem")).toBeVisible();

  // Reload and confirm local persistence
  await page.reload();
  await navigate("Despesas");
  await expect(page.getByText("Energia elétrica")).toBeVisible();

  // Verify no horizontal overflow
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("stock auto-deduction, product duplication, multi-item sale, recurring expenses and goals work end-to-end", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", (route) =>
    new URL(route.request().url()).pathname.startsWith("/api/")
      ? route.fulfill({ status: 404, body: "Not Found" })
      : route.continue(),
  );

  await page.goto("/");

  async function navigate(name: string) {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  }

  // Define monthly goals
  await page.getByRole("button", { name: "Definir metas" }).click();
  await page.getByLabel("Meta de faturamento (R$)").fill("500");
  await page.getByLabel("Meta de garrafas").fill("20");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("R$ 500,00")).toBeVisible();

  // Create ingredient & set stock
  await navigate("Insumos");
  await page.getByRole("button", { name: "Novo insumo" }).click();
  await page.getByLabel("Nome do insumo").fill("Polpa");
  await page.getByLabel("Unidade base").selectOption("g");
  await page.getByLabel("Quantidade comprada").fill("1000");
  await page.getByLabel("Valor total da compra").fill("20");
  await page.getByRole("button", { name: "Salvar registro" }).click();

  await page.getByRole("button", { name: "Controlar" }).click();
  await page.getByLabel("Estoque atual (g)").fill("1000");
  await page.getByLabel("Alerta mínimo (g)").fill("500");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("button", { name: "1.000 g" })).toBeVisible();

  // Create product and duplicate it
  await navigate("Produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();
  await page.getByLabel("Nome / sabor").fill("Tradicional");
  await page.getByLabel("Tamanho", { exact: true }).fill("300 ml");
  await page.getByLabel("Preço de venda").fill("15");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Insumo", exact: true })
    .selectOption({ index: 1 });
  await page.getByLabel("Quantidade do insumo 1").fill("300");
  await page.getByRole("button", { name: "Salvar registro" }).click();

  await page.getByRole("button", { name: "Duplicar Tradicional" }).click();
  await page.getByLabel("Nome / sabor").fill("Morango");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("Morango")).toBeVisible();

  // Register multi-item sale (consumes 600g total -> stock drops to 400g <= 500g)
  await navigate("Vendas");
  await page
    .getByRole("button", { name: "Registrar venda", exact: true })
    .click();
  await page.getByRole("button", { name: "Adicionar sabor" }).click();
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.locator("table").getByText(/Tradicional.*Morango|Morango.*Tradicional/),
  ).toBeVisible();

  // Verify low-stock alert and product ranking on Overview
  await navigate("Visão geral");
  await expect(page.getByText("Alerta de reposição de estoque:")).toBeVisible();
  await expect(page.getByText("Ranking de sabores")).toBeVisible();

  // Save recurring expense & launch with 1 click
  await navigate("Despesas");
  await page.getByRole("button", { name: "Nova despesa" }).click();
  await page.getByLabel("Descrição").fill("Internet");
  await page.getByLabel("Categoria").fill("Fixos");
  await page.getByLabel("Tipo").selectOption("fixed");
  await page.getByLabel("Valor (R$)").fill("100");
  await page.getByText(/Salvar como modelo recorrente/).click();
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByText("Despesas recorrentes")).toBeVisible();

  await page.getByRole("button", { name: "Lançar hoje" }).click();
  await expect(page.getByText("2 registros no período")).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});


