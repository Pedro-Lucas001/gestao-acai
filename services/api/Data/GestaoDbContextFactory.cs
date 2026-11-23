using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace GestaoAcai.Api.Data;
public sealed class GestaoDbContextFactory : IDesignTimeDbContextFactory<GestaoDbContext>
{
    public GestaoDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<GestaoDbContext>()
        .UseNpgsql(Environment.GetEnvironmentVariable("POSTGRESQL_CONNECTION_STRING") ?? "Host=localhost;Database=gestao_acai;Username=postgres")
        .Options);
}
