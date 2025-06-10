import { MarginSimulator } from './src/MarginSimulator';

function toUSD(euros: number): number {
    const DOLLAR_EUR_MARGIN = 0.88; // 1 dollar = 0.88 euros
    return euros / DOLLAR_EUR_MARGIN;
}

(()=>{

    const marginSimulator = new MarginSimulator({
        client: {
            budget: 60_000, // dollars
        },

        purchaser: {
            pricePerItem: (numberOfItems:number) => {

                // 8000 items = 3.5eur/item
                // 10000 items = 3.25eur/item
                // 10000+ items = 3eur/item

                if (numberOfItems < 8000) {
                    return toUSD(3.5);
                } else if (numberOfItems < 10000) {
                    return toUSD(3.25);
                } else {
                    return toUSD(3.0);
                }
            },
            // toUSD(3.0),
            // desiredMargin:  (numberOfItems:number) => {
            //     // 8000 items = 0.3 margin
            //     // 10000 items = 0.25 margin
            //     // 10000+ items = 0.2 margin
            //
            //     return 0.25;
            // }
            // 0.25, // +30% margin
        },

        transport: {
            costFn: (numberOfItems:number) => {

                // 1 container contains 2750 items
                // 6000EUR for the container

                // 1 truck contains 5500 items
                // 850EUR for the truck

                const costPerTruck = 850;
                const costPerContainer = 6000;

                const numItemPerTruck = 7000;
                const numItemPerContainer = 7000;

                const costSea = costPerContainer * Math.ceil(numberOfItems / numItemPerContainer);
                const costTruck = costPerTruck * Math.ceil(numberOfItems / numItemPerTruck);

                return costSea + costTruck;
            },
            pays: "client",
        }
    });

    marginSimulator
        .logNumberOfSellableItemsToTheClient();

    marginSimulator
        .logMarginInUSDToTheClient();

    marginSimulator
        .logTotalShippingCostToTheClient();
        
    marginSimulator
        .logTotalCostPerItemToTheClient();

})();