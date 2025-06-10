interface ClientConfig {
  budget: number; // in dollars
}

interface PurchaserConfig {
  pricePerItem: number; // in euros
  desiredMargin: number; // percentage as decimal (e.g., 0.4 for 40%)
}

interface TransportConfig {
  costFn: (numberOfItems: number) => number; // function to calculate transport cost in euros
  pays: 'client' | 'purchaser'; // who pays the transport cost
}

interface MarginSimulatorConfig {
  client: ClientConfig;
  purchaser: PurchaserConfig;
  transport: TransportConfig;
}

export class MarginSimulator {
  private readonly config: MarginSimulatorConfig;
  private readonly DOLLAR_EUR_MARGIN = 0.88; // 1 dollar = 0.88 euros

  constructor(config: MarginSimulatorConfig) {
    this.config = config;
  }

  /**
   * Calculate the maximum number of items that can be sold to the client
   * based on their budget, the purchaser's price and margin, and transport costs.
   */
  public calculateNumberOfSellableItems(): number {
    const { client, purchaser, transport } = this.config;
    
    // Convert client budget from dollars to euros
    const clientBudgetInEuros = client.budget * this.DOLLAR_EUR_MARGIN;
    
    // Calculate the sell price per item (including margin)
    const sellPricePerItem = purchaser.pricePerItem / (1 - purchaser.desiredMargin);
    
    // Determine the maximum number of items based on budget and costs
    if (transport.pays === 'client') {
      // If client pays for transport, we need to solve for x:
      // sellPricePerItem * x + transport.costFn(x) = clientBudgetInEuros
      
      // We'll use an iterative approach to find the maximum number of items
      // Start with a naive estimate (assuming no transport costs)
      let estimatedItems = Math.floor(clientBudgetInEuros / sellPricePerItem);
      let previousEstimate = 0;
      
      // Refine our estimate iteratively
      while (estimatedItems !== previousEstimate) {
        previousEstimate = estimatedItems;
        
        const totalCost = (sellPricePerItem * estimatedItems) + transport.costFn(estimatedItems);
        
        if (totalCost > clientBudgetInEuros) {
          // Too many items, reduce estimate
          estimatedItems = Math.floor(estimatedItems * (clientBudgetInEuros / totalCost));
        } else {
          // Check if we can add more items
          const costPerAdditionalItem = sellPricePerItem + 
            (transport.costFn(estimatedItems + 1) - transport.costFn(estimatedItems));
          
          if (totalCost + costPerAdditionalItem <= clientBudgetInEuros) {
            estimatedItems += 1;
          } else {
            // We've found the maximum number of items
            break;
          }
        }
      }
      
      return estimatedItems;
    } else {
      // If purchaser pays for transport, client only pays the sell price
      return Math.floor(clientBudgetInEuros / sellPricePerItem);
    }
  }

  /**
   * Log the number of sellable items to the console
   */
  public logNumberOfSellableItemsToTheClient(): void {
    const itemCount = this.calculateNumberOfSellableItems();
    console.log(`Number of items that can be shipped to the client: ${itemCount}`);
  }
}