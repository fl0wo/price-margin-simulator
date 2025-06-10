interface ClientConfig {
  budget: number; // in dollars
}

interface PurchaserConfig {
  pricePerItem: number | ((numberOfItems: number) => number); // in euros or function returning euros based on number of items
  desiredMargin: number | ((numberOfItems: number) => number); // percentage as decimal or function returning percentage based on number of items
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
   * Get price per item based on item count
   * @param itemCount Number of items
   * @returns Price per item in euros
   */
  private getPricePerItem(itemCount: number): number {
    const { purchaser } = this.config;
    
    if (typeof purchaser.pricePerItem === 'function') {
      return purchaser.pricePerItem(itemCount);
    }
    
    return purchaser.pricePerItem;
  }
  
  /**
   * Get desired margin based on item count
   * @param itemCount Number of items
   * @returns Margin as decimal
   */
  private getDesiredMargin(itemCount: number): number {
    const { purchaser } = this.config;
    
    if (typeof purchaser.desiredMargin === 'function') {
      return purchaser.desiredMargin(itemCount);
    }
    
    return purchaser.desiredMargin;
  }
  
  /**
   * Calculate sell price per item including margin
   * @param itemCount Number of items
   * @returns Sell price per item in euros
   */
  private getSellPricePerItem(itemCount: number): number {
    const pricePerItem = this.getPricePerItem(itemCount);
    const margin = this.getDesiredMargin(itemCount);
    
    return pricePerItem / (1 - margin);
  }

  /**
   * Calculate the maximum number of items that can be sold to the client
   * based on their budget, the purchaser's price and margin, and transport costs.
   */
  public calculateNumberOfSellableItems(): number {
    const { client, transport } = this.config;
    
    // Convert client budget from dollars to euros
    const clientBudgetInEuros = client.budget * this.DOLLAR_EUR_MARGIN;
    
    // Determine the maximum number of items based on budget and costs
    if (transport.pays === 'client') {
      // If client pays for transport, we need to solve for x:
      // sellPricePerItem(x) * x + transport.costFn(x) = clientBudgetInEuros
      
      // We'll use an iterative approach to find the maximum number of items
      // Start with a naive estimate (assuming no transport costs)
      // Use a fixed price for initial estimate
      const initialPricePerItem = this.getPricePerItem(1);
      const initialMargin = this.getDesiredMargin(1);
      const initialSellPrice = initialPricePerItem / (1 - initialMargin);
      
      let estimatedItems = Math.floor(clientBudgetInEuros / initialSellPrice);
      let previousEstimate = 0;
      
      // Refine our estimate iteratively
      while (estimatedItems !== previousEstimate && estimatedItems > 0) {
        previousEstimate = estimatedItems;
        
        const sellPricePerItem = this.getSellPricePerItem(estimatedItems);
        const totalCost = (sellPricePerItem * estimatedItems) + transport.costFn(estimatedItems);
        
        if (totalCost > clientBudgetInEuros) {
          // Too many items, reduce estimate
          estimatedItems = Math.floor(estimatedItems * (clientBudgetInEuros / totalCost));
        } else {
          // Check if we can add more items
          const sellPriceForNextItem = this.getSellPricePerItem(estimatedItems + 1);
          const costPerAdditionalItem = sellPriceForNextItem + 
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
      // This requires an iterative approach too since the price varies with quantity
      let estimatedItems = 1;
      let previousEstimate = 0;
      
      // Refine our estimate iteratively
      while (estimatedItems !== previousEstimate) {
        previousEstimate = estimatedItems;
        
        const sellPricePerItem = this.getSellPricePerItem(estimatedItems);
        const totalCost = sellPricePerItem * estimatedItems;
        
        if (totalCost > clientBudgetInEuros) {
          // Too many items, reduce estimate
          estimatedItems = Math.floor(estimatedItems * (clientBudgetInEuros / totalCost));
        } else {
          // Check if we can add more items
          const sellPriceForNextItem = this.getSellPricePerItem(estimatedItems + 1);
          
          if (totalCost + sellPriceForNextItem <= clientBudgetInEuros) {
            estimatedItems += 1;
          } else {
            // We've found the maximum number of items
            break;
          }
        }
      }
      
      return estimatedItems;
    }
  }

  /**
   * Log the number of sellable items to the console
   */
  public logNumberOfSellableItemsToTheClient(): void {
    const itemCount = this.calculateNumberOfSellableItems();
    console.log(`Number of items that can be shipped to the client: ${itemCount}`);
  }

  /**
   * Calculate the margin in USD currency
   */
  public calculateMarginInUSD(): number {
    const itemCount = this.calculateNumberOfSellableItems();
    
    // Calculate cost in euros
    const pricePerItem = this.getPricePerItem(itemCount);
    const costInEuros = pricePerItem * itemCount;
    
    // Calculate sell price in euros (cost + margin)
    const margin = this.getDesiredMargin(itemCount);
    const sellPriceInEuros = costInEuros / (1 - margin);
    
    // Calculate margin in euros
    const marginInEuros = sellPriceInEuros - costInEuros;
    
    // Convert margin to USD
    return marginInEuros / this.DOLLAR_EUR_MARGIN;
  }

  /**
   * Log the margin in USD to the console
   */
  public logMarginInUSDToTheClient(): void {
    const marginInUSD = this.calculateMarginInUSD();
    console.log(`Margin in USD: $${marginInUSD.toFixed(2)}`);
  }

  /**
   * Calculate the total shipping cost for sellable items
   * @returns Total shipping cost in USD
   */
  public calculateTotalShippingCost(): number {
    const { transport } = this.config;
    const itemCount = this.calculateNumberOfSellableItems();
    
    // Calculate shipping cost in euros
    const shippingCostInEuros = transport.costFn(itemCount);
    
    // Convert to USD
    return shippingCostInEuros / this.DOLLAR_EUR_MARGIN;
  }

  /**
   * Log the total shipping cost to the console
   */
  public logTotalShippingCostToTheClient(): void {
    const shippingCost = this.calculateTotalShippingCost();
    console.log(`Total shipping cost: $${shippingCost.toFixed(2)}`);
  }

  /**
   * Calculate the total cost per item (including shipping) in USD
   * @returns Cost per item in USD
   */
  public calculateTotalCostPerItem(): number {
    const { transport } = this.config;
    const itemCount = this.calculateNumberOfSellableItems();
    
    if (itemCount === 0) {
      return 0;
    }
    
    // Calculate sell price per item in euros (cost + margin)
    const sellPricePerItemInEuros = this.getSellPricePerItem(itemCount);
    
    // Calculate total shipping cost and cost per item in euros
    const shippingCostInEuros = transport.pays === 'client' ? transport.costFn(itemCount) : 0;
    const shippingCostPerItemInEuros = shippingCostInEuros / itemCount;
    
    // Total cost per item in euros
    const totalCostPerItemInEuros = sellPricePerItemInEuros + shippingCostPerItemInEuros;
    
    // Convert to USD
    return totalCostPerItemInEuros / this.DOLLAR_EUR_MARGIN;
  }

  /**
   * Log the total cost per item to the console
   */
  public logTotalCostPerItemToTheClient(): void {
    const totalCostPerItem = this.calculateTotalCostPerItem();
    console.log(`Total cost per item (all included): $${totalCostPerItem.toFixed(2)}`);
  }
}