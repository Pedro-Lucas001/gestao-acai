using GestaoAcai.Api.Data;
using GestaoAcai.Api.Domain;
using Xunit;
namespace GestaoAcai.Api.Tests;
public class FinanceTests
{
    [Fact]
    public void RecipeCostUsesDecimalAndBaseUnits()
    {
        var id = Guid.NewGuid();
        var product = new Product { Recipe = [new() { IngredientId = id, Quantity = 250m }] };
        var ingredients = new Dictionary<Guid, Ingredient> { [id] = new() { PurchasePrice = 35.50m, PurchaseQuantity = 1000m } };
        Assert.Equal(8.875m, Finance.UnitCost(product, ingredients));
        ingredients[id].PurchasePrice = 40m;
        Assert.Equal(10m, Finance.UnitCost(product, ingredients));
    }
    [Fact]
    public void FeeAndBreakEvenHandleNegativeAndZeroContribution()
    {
        Assert.Equal(1.10m, Finance.Fee(10m, 6m, .50m));
        Assert.Equal(113m, Finance.BreakEven(1000m, 8.90m));
        Assert.Null(Finance.BreakEven(1000m, 0m));
        Assert.Null(Finance.BreakEven(1000m, -1m));
        Assert.Equal(0m, Finance.BreakEven(0m, 5m));
    }
}
