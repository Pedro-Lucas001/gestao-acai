using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace GestaoAcai.Api.Functions;

public sealed class BreakEvenFunction
{
    private sealed record BreakEvenRequest(decimal MonthlyFixedCosts, decimal AverageContribution);

    [Function("BreakEven")]
    public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "calculations/break-even")] HttpRequestData request)
    {
        BreakEvenRequest? input;
        try { input = await JsonSerializer.DeserializeAsync<BreakEvenRequest>(request.Body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
        catch (JsonException) { input = null; }

        if (input is null || input.MonthlyFixedCosts < 0)
        {
            var invalid = request.CreateResponse(System.Net.HttpStatusCode.BadRequest);
            await invalid.WriteAsJsonAsync(new { error = "Informe custos fixos mensais válidos." });
            invalid.StatusCode = System.Net.HttpStatusCode.BadRequest;
        return invalid;
        }

        var response = request.CreateResponse(System.Net.HttpStatusCode.OK);
        if (input.AverageContribution <= 0)
            await response.WriteAsJsonAsync(new { viable = false, units = (decimal?)null, message = "Não há ponto de equilíbrio viável com contribuição nula ou negativa." });
        else
            await response.WriteAsJsonAsync(new { viable = true, units = decimal.Ceiling(input.MonthlyFixedCosts / input.AverageContribution), message = "Unidades estimadas para cobrir os custos fixos mensais." });
        return response;
    }
}
