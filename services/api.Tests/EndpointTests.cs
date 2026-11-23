using System.Net;
using System.Text;
using System.Text.Json;
using Azure.Core.Serialization;
using GestaoAcai.Api.Data;
using GestaoAcai.Api.Functions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using Npgsql;
namespace GestaoAcai.Api.Tests;

// Every run uses a new temporary database. The connection must have CREATE DATABASE rights.
public sealed class EndpointTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static HttpRequestData Request(string method, string path, object? body = null, bool auth = true)
    {
        var services = new ServiceCollection().Configure<WorkerOptions>(o => o.Serializer = new JsonObjectSerializer(Json)).BuildServiceProvider();
        var context = new Mock<FunctionContext>(); context.SetupProperty(x => x.InstanceServices, services);
        var headers = new HttpHeadersCollection(); if (auth) headers.Add("Authorization", "Bearer integration-token");
        var response = new Mock<HttpResponseData>(context.Object);
        response.SetupProperty(x => x.StatusCode, HttpStatusCode.OK);
        response.SetupProperty(x => x.Body, new MemoryStream());
        response.SetupProperty(x => x.Headers, new HttpHeadersCollection());
        var request = new Mock<HttpRequestData>(context.Object);
        request.SetupGet(x => x.Method).Returns(method); request.SetupGet(x => x.Url).Returns(new Uri("http://localhost/api/" + path));
        request.SetupGet(x => x.Headers).Returns(headers);
        request.SetupGet(x => x.Body).Returns(new MemoryStream(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(body, Json))));
        request.Setup(x => x.CreateResponse()).Returns(response.Object);
        return request.Object;
    }
    private static async Task<JsonElement> Read(HttpResponseData response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        response.Body.Position = 0;
        var text = await new StreamReader(response.Body).ReadToEndAsync();
        Assert.True(response.StatusCode == expected, $"{response.StatusCode}: {text}");
        return JsonSerializer.Deserialize<JsonElement>(text);
    }
    [Fact]
    public async Task ProtectedEndpointsDenyAccessBeforeDatabaseUse()
    {
        Environment.SetEnvironmentVariable("ADMIN_API_TOKEN", "integration-token");
        await using var db = new GestaoDbContext(new DbContextOptionsBuilder<GestaoDbContext>().UseNpgsql("Host=127.0.0.1;Database=unused").Options);
        var api = new FinanceEndpoints(db, NullLogger<FinanceEndpoints>.Instance);
        await Read(await api.Ingredients(Request("GET", "ingredients", auth: false)), HttpStatusCode.Unauthorized);
        var login = new AuthFunction();
        Environment.SetEnvironmentVariable("ADMIN_USERNAME", "test-admin"); Environment.SetEnvironmentVariable("ADMIN_PASSWORD", "test-password");
        await Read(await login.Run(Request("POST", "auth/login", new { username = (string?)null, password = "test-password" })), HttpStatusCode.Unauthorized);
    }
    [Fact]
    public async Task PostgreSqlPersistsFlowAndPreservesSaleSnapshots()
    {
        var connection = Environment.GetEnvironmentVariable("TEST_POSTGRESQL_CONNECTION_STRING");
        Assert.False(string.IsNullOrWhiteSpace(connection), "Set TEST_POSTGRESQL_CONNECTION_STRING to run the PostgreSQL integration test.");
        Environment.SetEnvironmentVariable("ADMIN_API_TOKEN", "integration-token");
        var temporary = new NpgsqlConnectionStringBuilder(connection) { Database = "acai_test_" + Guid.NewGuid().ToString("N") };
        var options = new DbContextOptionsBuilder<GestaoDbContext>().UseNpgsql(temporary.ConnectionString).Options;
        await using var database = new GestaoDbContext(options);
        await database.Database.MigrateAsync();
        try
        {
            async Task<JsonElement> Call(string method, string path, object? body, Func<FinanceEndpoints, HttpRequestData, Task<HttpResponseData>> execute, HttpStatusCode expected = HttpStatusCode.OK)
            {
                await using var db = new GestaoDbContext(options);
                return await Read(await execute(new FinanceEndpoints(db, NullLogger<FinanceEndpoints>.Instance), Request(method, path, body)), expected);
            }
            await Call("POST", "ingredients", new { name = "Polpa", unit = "g", purchaseQuantity = 0, purchasePrice = 20 }, (a, r) => a.Ingredients(r), HttpStatusCode.BadRequest);
            var ingredient = await Call("POST", "ingredients", new { name = "Polpa", unit = "g", purchaseQuantity = 1000, purchasePrice = 20 }, (a, r) => a.Ingredients(r));
            var ingredientId = ingredient.GetProperty("id").GetGuid();
            var recipe = new[] { new { ingredientId, quantity = 250m } };
            var product = await Call("POST", "products", new { name = "Tradicional", size = "300 ml", price = 10m, feePercent = 6m, feePerUnit = .5m, recipe }, (a, r) => a.Products(r));
            var productId = product.GetProperty("id").GetGuid();
            var sale = await Call("POST", "sales", new { date = "2026-11-23", productId, quantity = 2, price = 10, channel = "Direta", paymentMethod = "Crédito", feePercent = 6, feePerUnit = .5 }, (a, r) => a.Sales(r));
            Assert.Equal(7.8m, sale.GetProperty("contribution").GetDecimal());
            await Call("PUT", "ingredients/" + ingredientId, new { name = "Polpa", unit = "g", purchaseQuantity = 1000, purchasePrice = 40 }, (a, r) => a.IngredientById(r, ingredientId));
            var products = await Call("GET", "products", null, (a, r) => a.Products(r));
            Assert.Equal(10m, products[0].GetProperty("unitCost").GetDecimal());
            // Reconcile the same recipe without violating the ingredient/product unique index.
            await Call("PUT", "products/" + productId, new { name = "Novo nome", size = "300 ml", price = 12m, feePercent = 6m, feePerUnit = .5m, recipe }, (a, r) => a.ProductById(r, productId));
            await Call("POST", "expenses", new { description = "Energia", category = "Contas", date = "2026-11-23", amount = 3, isFixed = true }, (a, r) => a.Expenses(r));
            await Call("PUT", "fixed-costs", new { monthlyAmount = 100 }, (a, r) => a.FixedCosts(r));
            var dashboard = await Call("GET", "dashboard?from=2026-11-01&to=2026-11-30", null, (a, r) => a.Dashboard(r));
            Assert.Equal(20m, dashboard.GetProperty("revenue").GetDecimal());
            Assert.Equal(10m, dashboard.GetProperty("cost").GetDecimal());
            Assert.Equal(2.2m, dashboard.GetProperty("fees").GetDecimal());
            Assert.Equal(4.8m, dashboard.GetProperty("netResult").GetDecimal());
            Assert.Equal(26m, dashboard.GetProperty("breakEvenUnits").GetDecimal());
            var history = await Call("GET", "sales?from=2026-11-01&to=2026-11-30", null, (a, r) => a.Sales(r));
            Assert.Contains("Tradicional", history[0].GetProperty("productName").GetString());
            var empty = await Call("GET", "dashboard?from=2026-10-01&to=2026-10-31", null, (a, r) => a.Dashboard(r));
            Assert.Equal(0, empty.GetProperty("salesCount").GetInt32());
            await Call("GET", "sales?from=invalid", null, (a, r) => a.Sales(r), HttpStatusCode.BadRequest);
            await Call("DELETE", "ingredients/" + ingredientId, null, (a, r) => a.IngredientById(r, ingredientId), HttpStatusCode.Conflict);
            await Call("DELETE", "products/" + productId, null, (a, r) => a.ProductById(r, productId), HttpStatusCode.Conflict);
        }
        finally { await database.Database.EnsureDeletedAsync(); }
    }
}
