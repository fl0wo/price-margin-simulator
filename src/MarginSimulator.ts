interface ClientConfig {
  budget: number; // in dollars
  buysAtPricePerItem?: number | ((numberOfItems: number) => number); // optional fixed price client is willing to pay per item in dollars
}

interface PurchaserConfig {
  pricePerItem: number | ((numberOfItems: number) => number); // in euros or function returning euros based on number of items
  desiredMargin?: number | ((numberOfItems: number) => number); // optional percentage as decimal or function returning percentage based on number of items
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
   * Get the purchase price per item based on item count
   * @param itemCount Number of items
   * @returns Price per item in euros
   */
  private getPurchasePrice(itemCount: number): number {
    const { purchaser } = this.config;
    
    if (typeof purchaser.pricePerItem === 'function') {
      return purchaser.pricePerItem(itemCount);
    }
    
    return purchaser.pricePerItem;
  }
  
  /**
   * Get client's buying price per item in dollars
   * @param itemCount Number of items
   * @returns Price per item in dollars or undefined if not specified
   */
  private getClientBuyPrice(itemCount: number): number | undefined {
    const { client } = this.config;
    
    if (!client.buysAtPricePerItem) {
      return undefined;
    }
    
    if (typeof client.buysAtPricePerItem === 'function') {
      return client.buysAtPricePerItem(itemCount);
    }
    
    return client.buysAtPricePerItem;
  }
  
  /**
   * Get desired margin based on item count
   * @param itemCount Number of items
   * @returns Margin as decimal or calculated margin if not specified
   */
  private getDesiredMargin(itemCount: number): number {
    const { purchaser } = this.config;
    
    // If desired margin is specified, return it
    if (purchaser.desiredMargin !== undefined) {
      if (typeof purchaser.desiredMargin === 'function') {
        return purchaser.desiredMargin(itemCount);
      }
      return purchaser.desiredMargin;
    }
    
    // If client buy price is specified, calculate the margin
    const clientBuyPrice = this.getClientBuyPrice(itemCount);
    if (clientBuyPrice !== undefined) {
      const purchasePrice = this.getPurchasePrice(itemCount);
      // Convert client price from USD to EUR
      const clientBuyPriceInEuros = clientBuyPrice * this.DOLLAR_EUR_MARGIN;
      
      // Calculate margin correctly
      // If sell price = cost / (1 - margin), then:
      // margin = 1 - (cost / sell price)
      const margin = 1 - (purchasePrice / clientBuyPriceInEuros);
      return margin;
    }
    
    // Default to 0.2 (20%) if neither desired margin nor client buy price is specified
    return 0.2;
  }
  
  /**
   * Calculate the actual margin percentage for this trade
   * @param itemCount Number of items
   * @returns Margin percentage (0-1)
   */
  public calculateMarginPercentage(itemCount: number): number {
    return this.getDesiredMargin(itemCount);
  }
  
  /**
   * Get price per item based on item count (legacy method for compatibility)
   * @param itemCount Number of items
   * @returns Price per item in euros
   */
  private getPricePerItem(itemCount: number): number {
    return this.getPurchasePrice(itemCount);
  }
  
  /**
   * Calculate sell price per item including margin
   * @param itemCount Number of items
   * @returns Sell price per item in euros
   */
  private getSellPricePerItem(itemCount: number): number {
    const { purchaser } = this.config;
    const clientBuyPrice = this.getClientBuyPrice(itemCount);
    
    // If client buy price is specified, convert from USD to EUR
    if (clientBuyPrice !== undefined) {
      return clientBuyPrice * this.DOLLAR_EUR_MARGIN;
    }
    
    // Otherwise calculate based on purchase price and margin
    const purchasePrice = this.getPurchasePrice(itemCount);
    const margin = this.getDesiredMargin(itemCount);
    
    return purchasePrice / (1 - margin);
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
      const initialSellPrice = this.getSellPricePerItem(1);
      
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
  
  /**
   * Log the margin percentage to the console
   * Especially useful when desiredMargin is not defined and buysAtPricePerItem is defined
   */
  public logMarginPercentageToTheClient(): void {
    const itemCount = this.calculateNumberOfSellableItems();
    const marginPercentage = this.calculateMarginPercentage(itemCount);
    console.log(`Margin percentage: ${(marginPercentage * 100).toFixed(2)}%`);
    
    // Additional info when margin is calculated rather than specified
    const { purchaser } = this.config;
    if (purchaser.desiredMargin === undefined && this.getClientBuyPrice(itemCount) !== undefined) {
      const purchasePrice = this.getPurchasePrice(itemCount);
      const clientBuyPrice = this.getClientBuyPrice(itemCount)!;
      console.log(`Purchase price: €${purchasePrice.toFixed(2)} ($${(purchasePrice / this.DOLLAR_EUR_MARGIN).toFixed(2)} USD)`);
      console.log(`Client price: $${clientBuyPrice.toFixed(2)}`);
    }
  }
}

// Helper function to convert euros to USD
function toUSD(euros: number): number {
  const DOLLAR_EUR_MARGIN = 0.88; // 1 dollar = 0.88 euros
  return euros / DOLLAR_EUR_MARGIN;
}