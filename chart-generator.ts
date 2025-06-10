import { MarginSimulator } from './src/MarginSimulator';
import * as fs from 'fs';
import * as path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// Function to generate data for different budgets
function generateData() {
  const budgets = [];
  const pricesPerItem = [];
  
  // Budgets from 50k to 250k in steps of 10k
  for (let budget = 30_000; budget <= 250_000; budget += 10_000) {
    budgets.push(budget);
    
    // Create a MarginSimulator instance for this budget
    const simulator = new MarginSimulator({
      client: {
        budget: budget,
      },
      purchaser: {
        pricePerItem: (numberOfItems: number) => {
          if (numberOfItems < 8000) {
            return 3.98; // $3.98 USD
          } else if (numberOfItems < 10000) {
            return 3.69; // $3.69 USD
          } else {
            return 3.41; // $3.41 USD
          }
        },
        desiredMargin: 0.25, // 25% margin
      },
      transport: {
        costFn: (numberOfItems: number) => {
          const costPerTruck = 850;
          const costPerContainer = 6000;

          const numItemPerTruck = 7000;
          const numItemPerContainer = 7000;
          
          const costSea = costPerContainer * Math.ceil(numberOfItems / numItemPerContainer);
          const costTruck = costPerTruck * Math.ceil(numberOfItems / numItemPerTruck);
          
          return costSea + costTruck;
        },
        pays: 'client',
      }
    });
    
    // Calculate items and cost per item
    const itemCount = simulator.calculateNumberOfSellableItems();
    const totalCost = simulator.calculateTotalCostPerItem();
    
    // Store the data
    pricesPerItem.push(totalCost);
    
    // Log the data
    console.log(`Budget: $${budget}, Items: ${itemCount}, Price per item: $${totalCost.toFixed(2)}, Margin: ${(simulator.calculateMarginPercentage(itemCount) * 100).toFixed(2)}%`);
  }
  
  return { budgets, pricesPerItem };
}

// Generate the chart
async function generateChart() {
  const { budgets, pricesPerItem } = generateData();
  
  // Create a new chart
  const width = 800;
  const height = 600;
  const chartCallback = (ChartJS: typeof Chart) => {
    ChartJS.defaults.font.family = 'Arial';
    ChartJS.defaults.font.size = 14;
    ChartJS.defaults.color = '#666';
  };
  
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height, 
    chartCallback,
    backgroundColour: 'white' // Adding white background
  });
  
  // Configuration for the chart
  const configuration: ChartConfiguration = {
    type: 'line' as const,
    data: {
      labels: budgets.map(b => `$${b/1000}k`),
      datasets: [
        {
          label: 'Price per Item (USD)',
          data: pricesPerItem,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Client Budget',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Price per Item (USD)',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Price per Item vs Client Budget',
          font: {
            size: 18,
            weight: 'bold'
          }
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  };
  
  // Generate the chart
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  
  // Save the image
  fs.writeFileSync(path.join(__dirname, 'budget-vs-price-chart.png'), image);
  console.log('Chart saved as budget-vs-price-chart.png');
}

// Run the chart generation
generateChart().catch(console.error);