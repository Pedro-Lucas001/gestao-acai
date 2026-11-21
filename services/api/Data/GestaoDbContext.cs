using Microsoft.EntityFrameworkCore;

namespace GestaoAcai.Api.Data;

public sealed class GestaoDbContext(DbContextOptions<GestaoDbContext> options) : DbContext(options)
{
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<RecipeItem> RecipeItems => Set<RecipeItem>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<Expense> Expenses => Set<Expense>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Ingredient>().Property(x => x.PurchaseQuantity).HasPrecision(18, 6);
        modelBuilder.Entity<Ingredient>().Property(x => x.PurchasePrice).HasPrecision(18, 4);
        modelBuilder.Entity<Product>().Property(x => x.SalePrice).HasPrecision(18, 4);
        modelBuilder.Entity<RecipeItem>().Property(x => x.Quantity).HasPrecision(18, 6);
        modelBuilder.Entity<SaleItem>().Property(x => x.Quantity).HasPrecision(18, 6);
        modelBuilder.Entity<SaleItem>().Property(x => x.SalePriceSnapshot).HasPrecision(18, 4);
        modelBuilder.Entity<SaleItem>().Property(x => x.UnitCostSnapshot).HasPrecision(18, 4);
        modelBuilder.Entity<SaleItem>().Property(x => x.VariableFeeSnapshot).HasPrecision(18, 4);
        modelBuilder.Entity<Expense>().Property(x => x.Amount).HasPrecision(18, 4);
    }
}
