using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace GestaoAcai.Api.Functions;

public sealed class AuthFunction
{
    private sealed record LoginRequest(string Username, string Password);

    [Function("AdminLogin")]
    public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/login")] HttpRequestData request)
    {
        LoginRequest? input;
        try { input = await JsonSerializer.DeserializeAsync<LoginRequest>(request.Body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
        catch (JsonException) { input = null; }

        var username = Environment.GetEnvironmentVariable("ADMIN_USERNAME");
        var password = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
        var token = Environment.GetEnvironmentVariable("ADMIN_API_TOKEN");
        if (input is null || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(token) || !FixedEquals(input.Username, username) || !FixedEquals(input.Password, password))
        {
            var denied = request.CreateResponse(System.Net.HttpStatusCode.Unauthorized);
            await denied.WriteAsJsonAsync(new { error = "Usuário ou senha inválidos." });
            return denied;
        }

        var response = request.CreateResponse(System.Net.HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { accessToken = token, tokenType = "Bearer" });
        return response;
    }

    private static bool FixedEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}
