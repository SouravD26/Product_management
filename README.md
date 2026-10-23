# Amita Essentials · Product management

A React and Node product management app for tracking products, stock, sales, returns, and monthly profit. Product and sales data is stored in MongoDB.

## Run locally

1. Install Node.js and start a local MongoDB instance, or prepare a MongoDB connection string.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` if you are not using the default local database.
3. Install dependencies with `npm install`.
4. Start the frontend and API together with `npm run dev`.
5. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

For a production build, run `npm run build`, then `npm start`. The Node server serves the built app and the API on port `5000` by default.

## AI dashboard assistant

The chatbot has local answers by default. To enable open-ended AI answers, set `OPENAI_API_KEY` in the server `.env` file; `OPENAI_MODEL` can select another model available to your account. The API key stays on the server. When AI mode is enabled, each question sends the conversation context plus a limited summary of product prices, stock, recent sales, and the selected monthly report to OpenAI. Product images and customer names are not sent. OpenAI API usage may incur charges on your account.

## What it does

- **Inventory:** add and update a product photo, name, SKU, HSN, category, quantity, buy price, selling price, desired profit, delivery fee, commission, GST rate, packaging cost, additional spend per unit, customer return rate, good and damaged return rates, and return shipping cost. Commission defaults to 15%. Product photos are resized in the browser and stored with the product in MongoDB. Stock on hand is reduced as sales are recorded and restored as returns are processed.
- **Sales & returns:** record an order with one or more products and optional customer name. Each sale saves a snapshot of each product's price, cost, commission, GST, packaging, additional spend, and return shipping cost. A return cannot exceed the quantity originally sold.
- **Monthly reports:** select a month to see net units, gross revenue, GST, product cost, delivery, commission, packaging, additional spend, return shipping, desired profit, and actual profit. Returns reduce net units and revenue in the original sale's reporting month. Product edits do not rewrite historical sales. Export the detail table to CSV.
- **Dashboard:** see the selected month's sales and profit alongside current stock value and stock health.
- **Dashboard assistant:** open the floating chat button to ask about current inventory, product prices, sales, profit, returns, and costs. Answers are generated from the dashboard data loaded in the app.

The price suggestion solves for desired profit per sale kept by a customer. It treats SP as GST-inclusive, deducts commission from revenue after GST and expected refunds, and includes delivery, packaging, additional spend, return shipping, and recovery of good returns. Good and damaged return percentages describe the split of returned orders; the calculator normalizes the two values as that split. Desired profit is the target for a sale kept by the customer. Monthly actual profit uses the recorded sale and return quantities. Currency is shown in INR.

## API

- `GET /api/health`
- `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
- `GET /api/sales`, `POST /api/sales`, `POST /api/sales/:saleId/returns`
- `GET /api/reports/monthly?month=YYYY-MM`
