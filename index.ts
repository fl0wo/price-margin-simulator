import { MarginSimulator } from './src/MarginSimulator';

function toUSD(euros: number): number {
    const DOLLAR_EUR_MARGIN = 0.88; // 1 dollar = 0.88 euros
    return euros / DOLLAR_EUR_MARGIN;
}

(()=>{
    const DOLLAR_EUR_MARGIN = 0.88; // 1 dollar = 0.88 euros

    const marginSimulator = new MarginSimulator({
        client: {
            budget: 50_000, // dollars
        },

        purchaser: {
            pricePerItem: toUSD(3.5),
            desiredMargin: 0.2, // +40% margin
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
                const numItemPerContainer = 2750;

                const costSea = costPerContainer * Math.ceil(numberOfItems / numItemPerContainer);
                const costTruck = costPerTruck * Math.ceil(numberOfItems / numItemPerTruck);

                return costSea + costTruck;
            },
            pays: "client",
        }
    });

    marginSimulator
        .logNumberOfSellableItemsToTheClient()

})();