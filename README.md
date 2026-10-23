# Product_management

## Amita Essentials Ecommerce Product Manager

A React, Node.js, Express, and MongoDB application for managing ecommerce inventory, marketplace sales, returns, and monthly profit.

## Run locally

1. Install Node.js and start MongoDB, or prepare a MongoDB connection string.
2. Copy `.env.example` to `.env`; update `MONGODB_URI` if you are not using the default local MongoDB instance.
3. Install dependencies with `npm install`.
4. Start the frontend and API with `npm run dev` (on Windows PowerShell, use `npm.cmd run dev`).
5. Open the Vite URL printed in the terminal, normally `http://localhost:5173`.

For a production build, run `npm run build`, then `npm start`. The Node server serves the built app and API on port `5000` by default.

Keep secrets in `.env`. It is excluded from Git; `.env.example` contains placeholders only.

## Features

- **Inventory:** manage product images, names, SKUs, HSN codes, categories, stock, buy and selling prices, desired profit, commission, GST, delivery, packaging, other spend, and return assumptions. Product images are resized in the browser and stored in MongoDB.
- **Pricing:** calculate a suggested selling price from desired profit, GST-inclusive selling price assumptions, commission, delivery, packaging, additional spend, and expected returns.
- **Sales and returns:** record each sale with its marketplace (Flipkart, Amazon, Meesho, or Other) and sale date. Stock is reduced automatically. Processing a return updates the original sale and restores stock.
- **Sales calendar:** view products sold by date and marketplace; select a day to see its orders and quantities.
- **Sales editing and deletion:** update a sale's date, marketplace, products, or quantities. Delete a sale or a report line; unreturned units are restored to inventory.
- **Monthly reports:** review revenue, product costs, fees, desired profit, and actual net profit for the selected month. Returns are reported in the original sale month. Product edits do not rewrite historical sales. Export the detail table to CSV.
- **Dashboard assistant:** ask about dashboard usage and loaded business data. It uses local answers when AI is unavailable. To enable open-ended AI answers, set `OPENAI_API_KEY` in the server `.env` file; `OPENAI_MODEL` can select a model available to your API project. The key stays on the server. When AI is enabled, the app sends a limited summary of product pricing, stock, recent sales, the selected monthly report, and recent conversation context. Product images and customer names are not sent. API usage may incur charges.

## Profit calculations

The price suggestion works backward from desired profit per kept sale. It treats the entered selling price as GST-inclusive, applies commission after GST, and accounts for delivery, packaging, additional spend, expected returns, and return shipping. Good and damaged return rates split expected returns. Monthly actual profit is calculated from recorded sale and return quantities, saved product costs, GST, commission, and fees. Currency is INR.

## API

- `GET /api/health`
- `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
- `GET /api/sales`, `POST /api/sales`, `PATCH /api/sales/:saleId`, `DELETE /api/sales/:saleId`
- `POST /api/sales/:saleId/returns`
- `DELETE /api/sales/:saleId/items/:itemIndex`
- `GET /api/reports/monthly?month=YYYY-MM`
- `POST /api/chat`