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
    public DbSet<FixedCostSettings> FixedCosts => Set<FixedCostSettings>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        foreach (var entity in b.Model.GetEntityTypes())
            foreach (var p in entity.GetProperties().Where(p => p.ClrType == typeof(decimal)))
            { p.SetPrecision(18); p.SetScale(6); }
        b.Entity<Product>().HasMany(p => p.Recipe).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<RecipeItem>().HasOne<Ingredient>().WithMany().HasForeignKey(x => x.IngredientId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<RecipeItem>().HasIndex(x => new { x.ProductId, x.IngredientId }).IsUnique();
        b.Entity<Sale>().HasMany(x => x.Items).WithOne().HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SaleItem>().HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Sale>().HasIndex(x => x.SoldOn);
        b.Entity<Expense>().HasIndex(x => x.OccurredOn);
        b.Entity<Ingredient>().Property(x => x.Name).HasMaxLength(120);
        b.Entity<Ingredient>().Property(x => x.Unit).HasMaxLength(12);
        b.Entity<Product>().Property(x => x.Name).HasMaxLength(120);
        b.Entity<Product>().Property(x => x.Size).HasMaxLength(40);
        b.Entity<Sale>().Property(x => x.Channel).HasMaxLength(60);
        b.Entity<Sale>().Property(x => x.PaymentMethod).HasMaxLength(60);
        b.Entity<SaleItem>().Property(x => x.ProductNameSnapshot).HasMaxLength(180);
        b.Entity<Expense>().Property(x => x.Description).HasMaxLength(180);
        b.Entity<Expense>().Property(x => x.Category).HasMaxLength(80);
    }
}
