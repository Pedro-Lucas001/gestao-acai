using System.Net;
using GestaoAcai.Api.Configuration;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace GestaoAcai.Api.Functions;

// Rotas de domínio são explicitamente enumeradas. A camada de persistência/API será
// conectada no próximo passo do fluxo, sem inventar registros ou simular dados reais.
public sealed class ScaffoldEndpoints
{
    [Function("Ingredients")]
    public Task<HttpResponseData> Ingredients([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "ingredients")] HttpRequestData request) => Pending(request);
    [Function("IngredientById")]
    public Task<HttpResponseData> IngredientById([HttpTrigger(AuthorizationLevel.Anonymous, "put", "delete", Route = "ingredients/{id:guid}")] HttpRequestData request) => Pending(request);
    [Function("Products")]
    public Task<HttpResponseData> Products([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "products")] HttpRequestData request) => Pending(request);
    [Function("ProductById")]
    public Task<HttpResponseData> ProductById([HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", "delete", Route = "products/{id:guid}")] HttpRequestData request) => Pending(request);
    [Function("Pricing")]
    public Task<HttpResponseData> Pricing([HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", Route = "pricing/{productId:guid}")] HttpRequestData request) => Pending(request);
    [Function("Sales")]
    public Task<HttpResponseData> Sales([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "sales")] HttpRequestData request) => Pending(request);
    [Function("SaleById")]
    public Task<HttpResponseData> SaleById([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "sales/{id:guid}")] HttpRequestData request) => Pending(request);
    [Function("Expenses")]
    public Task<HttpResponseData> Expenses([HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "expenses")] HttpRequestData request) => Pending(request);
    [Function("ExpenseById")]
    public Task<HttpResponseData> ExpenseById([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "expenses/{id:guid}")] HttpRequestData request) => Pending(request);
    [Function("FixedCosts")]
    public Task<HttpResponseData> FixedCosts([HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", Route = "fixed-costs")] HttpRequestData request) => Pending(request);
    [Function("Dashboard")]
    public Task<HttpResponseData> Dashboard([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "dashboard")] HttpRequestData request) => Pending(request);

    private static async Task<HttpResponseData> Pending(HttpRequestData request)
    {
        if (!AdminAuth.IsAuthorized(request)) return await AdminAuth.Unauthorized(request);
        var response = request.CreateResponse(HttpStatusCode.NotImplemented);
        await response.WriteAsJsonAsync(new { error = "Endpoint scaffoldado; persistência será habilitada na etapa de integração." });
        return response;
    }
}
