# Price Margin Simulator

A TypeScript calculator to simulate shipping costs and determine the maximum number of items that can be shipped from Verona to Pakistan based on client budget, item costs, margins, and transportation expenses.

## Features

- Calculate the maximum number of items that can be shipped within a client's budget
- Account for different pricing models (who pays for transport)
- Handle currency conversion (USD to EUR)
- Apply desired profit margins to pricing

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies
   ```
   npm install
   ```

### Usage

Run the simulator:

```
npm run dev
```

## Configuration

The simulator accepts a configuration object with the following properties:

- **client**: Client information including budget in USD
- **purchaser**: Item costs and desired profit margin
- **transport**: Transportation cost function and payment responsibility

## Example

```typescript
const marginSimulator = new MarginSimulator({
    client: {
        budget: 50_000, // dollars
    },
    purchaser: {
        pricePerItem: 4 * 0.88, // euros (converted from USD)
        desiredMargin: 0.4, // +40% margin
    },
    transport: {
        costFn: (numberOfItems) => {
            // Calculate transport costs
            return 0.88 * (0.23 * numberOfItems + 2.5 * numberOfItems); // euros
        },
        pays: "client", // client pays for transport
    }
});

// Calculate and log the number of items
marginSimulator.logNumberOfSellableItemsToTheClient();
```