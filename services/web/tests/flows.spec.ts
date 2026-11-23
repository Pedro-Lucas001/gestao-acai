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
