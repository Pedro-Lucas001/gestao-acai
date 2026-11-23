using GestaoAcai.Api.Data;
namespace GestaoAcai.Api.Domain;

public static class Finance
{
    public static decimal UnitCost(Product product, IReadOnlyDictionary<Guid, Ingredient> ingredients) =>
        product.Recipe.Sum(item => item.Quantity * ingredients[item.IngredientId].PurchasePrice / ingredients[item.IngredientId].PurchaseQuantity);
    public static decimal Fee(decimal price, decimal percent, decimal perUnit) => price * percent / 100m + perUnit;
    public static decimal? BreakEven(decimal fixedCosts, decimal contribution) => contribution > 0 ? decimal.Ceiling(fixedCosts / contribution) : null;
}
public sealed class DomainError(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}
