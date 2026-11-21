namespace GestaoAcai.Api.Data;

public sealed class Ingredient
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Unit { get; set; } = "";
    public decimal PurchaseQuantity { get; set; }
    public decimal PurchasePrice { get; set; }
}

public sealed class Product
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Size { get; set; } = "";
    public decimal SalePrice { get; set; }
    public List<RecipeItem> Recipe { get; set; } = [];
}

public sealed class RecipeItem
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid IngredientId { get; set; }
    public decimal Quantity { get; set; }
}

public sealed class Sale
{
    public Guid Id { get; set; }
    public DateOnly SoldOn { get; set; }
    public string Channel { get; set; } = "";
    public string PaymentMethod { get; set; } = "";
    public List<SaleItem> Items { get; set; } = [];
}

public sealed class SaleItem
{
    public Guid Id { get; set; }
    public Guid SaleId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal SalePriceSnapshot { get; set; }
    public decimal UnitCostSnapshot { get; set; }
    public decimal VariableFeeSnapshot { get; set; }
}

public sealed class Expense
{
    public Guid Id { get; set; }
    public string Description { get; set; } = "";
    public string Category { get; set; } = "";
    public DateOnly OccurredOn { get; set; }
    public decimal Amount { get; set; }
    public bool IsFixed { get; set; }
}
