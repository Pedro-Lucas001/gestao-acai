using System.Security.Cryptography;
using System.Text;
using Microsoft.Azure.Functions.Worker.Http;

namespace GestaoAcai.Api.Configuration;

public static class AdminAuth
{
    public static bool IsAuthorized(HttpRequestData request)
    {
        var configuredToken = Environment.GetEnvironmentVariable("ADMIN_API_TOKEN");
        var authorization = request.Headers.TryGetValues("Authorization", out var values) ? values.FirstOrDefault() : null;
        if (string.IsNullOrWhiteSpace(configuredToken) || string.IsNullOrWhiteSpace(authorization) ||
            !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return false;

        var supplied = Encoding.UTF8.GetBytes(authorization["Bearer ".Length..].Trim());
        var expected = Encoding.UTF8.GetBytes(configuredToken);
        return supplied.Length == expected.Length && CryptographicOperations.FixedTimeEquals(supplied, expected);
    }

    public static async Task<HttpResponseData> Unauthorized(HttpRequestData request)
    {
        var response = request.CreateResponse(System.Net.HttpStatusCode.Unauthorized);
        await response.WriteAsJsonAsync(new { error = "Autenticação necessária." });
        return response;
    }
}
