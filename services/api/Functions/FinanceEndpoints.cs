using System.Data;
using System.Net;
using System.Text.Json;
using System.Web;
using GestaoAcai.Api.Configuration;
using GestaoAcai.Api.Data;
using GestaoAcai.Api.Domain;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace GestaoAcai.Api.Functions;

public sealed class FinanceEndpoints(GestaoDbContext db, ILogger<FinanceEndpoints> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public sealed record IngredientInput(string Name, string Unit, decimal PurchaseQuantity, decimal PurchasePrice);
    public sealed record RecipeInput(Guid IngredientId, decimal Quantity);
    public sealed record ProductInput(string Name, string Size, decimal Price, decimal FeePercent, decimal FeePerUnit, List<RecipeInput> Recipe);
    public sealed record SaleInput(DateOnly Date, Guid ProductId, decimal Quantity, decimal Price, string Channel, string PaymentMethod, decimal FeePercent, decimal FeePerUnit);
    public sealed record ExpenseInput(string Description, string Category, DateOnly Date, decimal Amount, bool IsFixed);
    public sealed record FixedInput(decimal MonthlyAmount);

    private async Task<HttpResponseData> Run(HttpRequestData request, Func<Task<object>> work)
    {
        if (!AdminAuth.IsAuthorized(request)) return await AdminAuth.Unauthorized(request);
        object payload; var status = HttpStatusCode.OK;
        try { payload = await work(); }
        catch (DomainError error) { status = (HttpStatusCode)error.Status; payload = new { error = error.Message }; }
        catch (JsonException) { status = HttpStatusCode.BadRequest; payload = new { error = "Confira os campos e o formato dos valores." }; }
        catch (DbUpdateException error) { logger.LogWarning(error, "Falha ao salvar registro"); status = HttpStatusCode.Conflict; payload = new { error = "O registro está em uso ou foi alterado. Atualize a página e confira os vínculos." }; }
        catch (NpgsqlException error) { logger.LogError(error, "Banco indisponível"); status = HttpStatusCode.ServiceUnavailable; payload = new { error = "Não foi possível acessar o banco de dados. Tente novamente." }; }
        var response = request.CreateResponse(status);
        response.Headers.Add("Cache-Control", "no-store");
        await response.WriteAsJsonAsync(payload);
        response.StatusCode = status;
        return response;
    }
    private static async Task<T> Body<T>(HttpRequestData r) => await JsonSerializer.DeserializeAsync<T>(r.Body, Json) ?? throw new DomainError("Preencha os dados do registro.");
    private static string Text(string? value, int limit = 120)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > limit) throw new DomainError($"Preencha os textos com até {limit} caracteres.");
        return value.Trim();
    }
    private static decimal Number(decimal n, bool positive = false, decimal maximum = 1_000_000m)
    {
        if (n < 0 || (positive && n == 0) || n > maximum || decimal.Round(n, 6) != n) throw new DomainError("Informe valores válidos, com até 6 casas decimais.");
        return n;
    }
    private static DateOnly Date(DateOnly date)
    {
        if (date.Year < 2000 || date.Year > 2100) throw new DomainError("Informe uma data entre 2000 e 2100.");
        return date;
    }
    private static (DateOnly From, DateOnly To) Range(HttpRequestData request)
    {
        var query = HttpUtility.ParseQueryString(request.Url.Query);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = query["from"] is { } f ? DateOnly.TryParseExact(f, "yyyy-MM-dd", out var parsed) ? parsed : throw new DomainError("Data inicial inválida.") : new(today.Year, today.Month, 1);
        var to = query["to"] is { } t ? DateOnly.TryParseExact(t, "yyyy-MM-dd", out var parsedTo) ? parsedTo : throw new DomainError("Data final inválida.") : from.AddMonths(1).AddDays(-1);
        Date(from); Date(to);
        if (from > to) throw new DomainError("A data final deve ser igual ou posterior à inicial.");
        return (from, to);
    }

    [Function("Ingredients")]
    public Task<HttpResponseData> Ingredients([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "ingredients")] HttpRequestData request) => Run(request, async () =>
    {
        if (request.Method == "GET") return await db.Ingredients.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
        var row = new Ingredient { Id = Guid.NewGuid() }; Apply(row, await Body<IngredientInput>(request));
        db.Ingredients.Add(row); await db.SaveChangesAsync(); return row;
    });
    private static void Apply(Ingredient row, IngredientInput input)
    {
        row.Name = Text(input.Name); row.Unit = Text(input.Unit, 12);
        if (!new[] { "g", "ml", "un" }.Contains(row.Unit)) throw new DomainError("Use g, ml ou un e a mesma unidade na ficha técnica.");
        row.PurchaseQuantity = Number(input.PurchaseQuantity, true); row.PurchasePrice = Number(input.PurchasePrice);
    }
    [Function("IngredientById")]
    public Task<HttpResponseData> IngredientById([HttpTrigger(AuthorizationLevel.Anonymous, "put", "delete", Route = "ingredients/{id:guid}")] HttpRequestData request, Guid id) => Run(request, async () =>
    {
        var row = await db.Ingredients.FindAsync(id) ?? throw new DomainError("Insumo não encontrado.", 404);
        if (request.Method == "DELETE") db.Ingredients.Remove(row);
        else {
            var input = await Body<IngredientInput>(request);
            if (input.Unit != row.Unit && await db.RecipeItems.AnyAsync(x => x.IngredientId == id)) throw new DomainError("A unidade de um insumo usado em fichas técnicas não pode ser alterada.");
            Apply(row, input);
        }
        await db.SaveChangesAsync(); return new { id };
    });
    private async Task<object[]> ProductViews()
    {
        var ingredients = await db.Ingredients.AsNoTracking().ToDictionaryAsync(x => x.Id);
        return (await db.Products.AsNoTracking().Include(x => x.Recipe).OrderBy(x => x.Name).ToListAsync()).Select(p => ProductView(p, ingredients)).ToArray();
    }
    private static object ProductView(Product p, Dictionary<Guid, Ingredient> ingredients)
    {
        var unitCost = Finance.UnitCost(p, ingredients);
        var variableFee = Finance.Fee(p.SalePrice, p.FeePercent, p.FeePerUnit);
        return new { p.Id, p.Name, p.Size, price = p.SalePrice, p.FeePercent, p.FeePerUnit, unitCost, variableFee,
            contribution = p.SalePrice - unitCost - variableFee,
            recipe = p.Recipe.Select(x => new { x.IngredientId, x.Quantity }) };
    }
    private async Task Apply(Product row, ProductInput input)
    {
        row.Name = Text(input.Name); row.Size = Text(input.Size, 40); row.SalePrice = Number(input.Price, true);
        row.FeePercent = Number(input.FeePercent, maximum: 100); row.FeePerUnit = Number(input.FeePerUnit);
        if (input.Recipe is null || input.Recipe.Count == 0 || input.Recipe.Count > 100 || input.Recipe.Select(x => x.IngredientId).Distinct().Count() != input.Recipe.Count)
            throw new DomainError("Inclua de 1 a 100 insumos diferentes na ficha técnica.");
        var ids = input.Recipe.Select(x => x.IngredientId).ToArray();
        if (await db.Ingredients.CountAsync(x => ids.Contains(x.Id)) != ids.Length) throw new DomainError("Um dos insumos não existe mais.");
        foreach (var item in input.Recipe) Number(item.Quantity, true);
        // Reconcile tracked rows rather than replacing keys in a unique index.
        foreach (var old in row.Recipe.Where(x => !ids.Contains(x.IngredientId)).ToList()) { db.RecipeItems.Remove(old); row.Recipe.Remove(old); }
        foreach (var item in input.Recipe) {
            var existing = row.Recipe.SingleOrDefault(x => x.IngredientId == item.IngredientId);
            if (existing is not null) existing.Quantity = item.Quantity;
            else row.Recipe.Add(new RecipeItem { Id = Guid.NewGuid(), IngredientId = item.IngredientId, Quantity = item.Quantity });
        }
    }
    [Function("Products")]
    public Task<HttpResponseData> Products([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "products")] HttpRequestData request) => Run(request, async () =>
    {
        if (request.Method == "GET") return await ProductViews();
        var row = new Product { Id = Guid.NewGuid() }; await Apply(row, await Body<ProductInput>(request));
        db.Products.Add(row); await db.SaveChangesAsync(); return new { row.Id };
    });
    [Function("ProductById")]
    public Task<HttpResponseData> ProductById([HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", "delete", Route = "products/{id:guid}")] HttpRequestData request, Guid id) => Run(request, async () =>
    {
        var row = await db.Products.Include(x => x.Recipe).SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError("Produto não encontrado.", 404);
        if (request.Method == "GET") return ProductView(row, await db.Ingredients.AsNoTracking().ToDictionaryAsync(x => x.Id));
        if (request.Method == "DELETE") db.Products.Remove(row); else await Apply(row, await Body<ProductInput>(request));
        await db.SaveChangesAsync(); return new { id };
    });
    [Function("Pricing")]
    public Task<HttpResponseData> Pricing([HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", Route = "pricing/{productId:guid}")] HttpRequestData request, Guid productId) => Run(request, async () =>
    {
        var row = await db.Products.Include(x => x.Recipe).SingleOrDefaultAsync(x => x.Id == productId) ?? throw new DomainError("Produto não encontrado.", 404);
        if (request.Method == "PUT") {
            var input = await Body<ProductInput>(request);
            row.SalePrice = Number(input.Price, true); row.FeePercent = Number(input.FeePercent, maximum: 100); row.FeePerUnit = Number(input.FeePerUnit);
            await db.SaveChangesAsync();
        }
        return ProductView(row, await db.Ingredients.AsNoTracking().ToDictionaryAsync(x => x.Id));
    });
    private static object SaleView(Sale s) => new { s.Id, date = s.SoldOn, s.Channel, s.PaymentMethod,
        productName = string.Join(", ", s.Items.Select(x => x.ProductNameSnapshot)), quantity = s.Items.Sum(x => x.Quantity),
        total = s.Items.Sum(x => x.Quantity * x.SalePriceSnapshot),
        contribution = s.Items.Sum(x => x.Quantity * (x.SalePriceSnapshot - x.UnitCostSnapshot - x.VariableFeeSnapshot)) };
    [Function("Sales")]
    public Task<HttpResponseData> Sales([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "sales")] HttpRequestData request) => Run(request, async () =>
    {
        if (request.Method == "GET") {
            var (from, to) = Range(request);
            return (await db.Sales.AsNoTracking().Include(x => x.Items).Where(x => x.SoldOn >= from && x.SoldOn <= to).OrderByDescending(x => x.SoldOn).ThenBy(x => x.Id).ToListAsync()).Select(SaleView).ToArray();
        }
        var input = await Body<SaleInput>(request);
        Date(input.Date); Number(input.Quantity, true); Number(input.Price, true); Number(input.FeePercent, maximum: 100); Number(input.FeePerUnit);
        // One consistent price/cost snapshot, even when an ingredient is edited concurrently.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var product = await db.Products.Include(x => x.Recipe).SingleOrDefaultAsync(x => x.Id == input.ProductId) ?? throw new DomainError("Produto não encontrado.");
        if (product.Recipe.Count == 0) throw new DomainError("Complete a ficha técnica antes de vender.");
        var cost = Finance.UnitCost(product, await db.Ingredients.AsNoTracking().ToDictionaryAsync(x => x.Id));
        var sale = new Sale { Id = Guid.NewGuid(), SoldOn = input.Date, Channel = Text(input.Channel, 60), PaymentMethod = Text(input.PaymentMethod, 60), Items = [new SaleItem {
            Id = Guid.NewGuid(), ProductId = product.Id, ProductNameSnapshot = $"{product.Name} · {product.Size}", Quantity = input.Quantity,
            SalePriceSnapshot = input.Price, UnitCostSnapshot = decimal.Round(cost, 6), VariableFeeSnapshot = decimal.Round(Finance.Fee(input.Price, input.FeePercent, input.FeePerUnit), 6)
        }] };
        db.Sales.Add(sale); await db.SaveChangesAsync(); await transaction.CommitAsync(); return SaleView(sale);
    });
    [Function("SaleById")]
    public Task<HttpResponseData> SaleById([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "sales/{id:guid}")] HttpRequestData request, Guid id) => Run(request, async () => SaleView(await db.Sales.AsNoTracking().Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError("Venda não encontrada.", 404)));
    [Function("Expenses")]
    public Task<HttpResponseData> Expenses([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "expenses")] HttpRequestData request) => Run(request, async () =>
    {
        if (request.Method == "GET") {
            var (from, to) = Range(request);
            return await db.Expenses.AsNoTracking().Where(x => x.OccurredOn >= from && x.OccurredOn <= to).OrderByDescending(x => x.OccurredOn)
                .Select(x => new { x.Id, x.Description, x.Category, date = x.OccurredOn, x.Amount, x.IsFixed }).ToListAsync();
        }
        var input = await Body<ExpenseInput>(request);
        var row = new Expense { Id = Guid.NewGuid(), Description = Text(input.Description, 180), Category = Text(input.Category, 80), OccurredOn = Date(input.Date), Amount = Number(input.Amount, true), IsFixed = input.IsFixed };
        db.Expenses.Add(row); await db.SaveChangesAsync(); return new { row.Id };
    });
    [Function("ExpenseById")]
    public Task<HttpResponseData> ExpenseById([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "expenses/{id:guid}")] HttpRequestData request, Guid id) => Run(request, async () =>
    {
        var row = await db.Expenses.FindAsync(id) ?? throw new DomainError("Despesa não encontrada.", 404);
        db.Expenses.Remove(row); await db.SaveChangesAsync(); return new { id };
    });
    [Function("FixedCosts")]
    public Task<HttpResponseData> FixedCosts([HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", Route = "fixed-costs")] HttpRequestData request) => Run(request, async () =>
    {
        var row = await db.FixedCosts.FindAsync(1);
        if (request.Method == "PUT") {
            var input = await Body<FixedInput>(request);
            if (row is null) { row = new FixedCostSettings(); db.FixedCosts.Add(row); }
            row.MonthlyAmount = Number(input.MonthlyAmount); await db.SaveChangesAsync();
        }
        return new { monthlyAmount = row?.MonthlyAmount ?? 0m };
    });
    [Function("Dashboard")]
    public Task<HttpResponseData> Dashboard([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "dashboard")] HttpRequestData request) => Run(request, async () =>
    {
        var (from, to) = Range(request);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var sales = await db.Sales.AsNoTracking().Include(x => x.Items).Where(x => x.SoldOn >= from && x.SoldOn <= to).ToListAsync();
        var items = sales.SelectMany(x => x.Items).ToList();
        var revenue = items.Sum(x => x.Quantity * x.SalePriceSnapshot);
        var cost = items.Sum(x => x.Quantity * x.UnitCostSnapshot);
        var fees = items.Sum(x => x.Quantity * x.VariableFeeSnapshot);
        var expenses = await db.Expenses.Where(x => x.OccurredOn >= from && x.OccurredOn <= to).SumAsync(x => (decimal?)x.Amount) ?? 0m;
        var contribution = revenue - cost - fees;
        var quantity = items.Sum(x => x.Quantity);
        var monthly = (await db.FixedCosts.AsNoTracking().FirstOrDefaultAsync())?.MonthlyAmount ?? 0m;
        await transaction.CommitAsync();
        return new { revenue, cost, fees, expenses, contribution, netResult = contribution - expenses, salesCount = sales.Count, quantity,
            averageMargin = revenue > 0 ? contribution / revenue * 100m : 0m,
            monthlyFixedCosts = monthly, breakEvenUnits = quantity > 0 ? Finance.BreakEven(monthly, contribution / quantity) : null,
            daily = sales.GroupBy(x => x.SoldOn).OrderBy(x => x.Key).Select(g => new { date = g.Key, revenue = g.SelectMany(x => x.Items).Sum(x => x.Quantity * x.SalePriceSnapshot) }) };
    });
}
