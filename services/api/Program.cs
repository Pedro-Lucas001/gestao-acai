using Azure.Core.Serialization;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using GestaoAcai.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services => {
        services.Configure<WorkerOptions>(options => options.Serializer = new JsonObjectSerializer(new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        services.AddDbContext<GestaoDbContext>(options =>
        options.UseNpgsql(Environment.GetEnvironmentVariable("POSTGRESQL_CONNECTION_STRING")
            ?? throw new InvalidOperationException("Configure POSTGRESQL_CONNECTION_STRING.")));
    })
    .Build();

// Explicit opt-in migration command for a reviewed deployment; never migrates on startup.
if (args.Contains("--migrate"))
{
    using var scope = host.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<GestaoDbContext>().Database.MigrateAsync();
    return;
}
host.Run();
