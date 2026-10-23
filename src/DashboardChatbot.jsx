import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';

const money = (value = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
const monthName = (value) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`));

function expectedProfit(product) {
  const returns = Math.min(1, Math.max(0, Number(product.customerReturnRate || 0) / 100));
  const good = Math.max(0, Number(product.goodReturnRate ?? 100));
  const damaged = Math.max(0, Number(product.damagedReturnRate || 0));
  const goodShare = good + damaged > 0 ? good / (good + damaged) : 1;
  const commission = Math.min(1, Math.max(0, Number(product.commissionRate ?? 15) / 100));
  const gst = Math.max(0, Number(product.gstRate || 0) / 100);
  const factor = (1 - returns) * (1 - commission) / (1 + gst);
  const costs = Number(product.buyPrice || 0) * (1 - returns * goodShare)
    + Number(product.deliveryFee || 0) + Number(product.packagingCost || 0)
    + Number(product.additionalCost || 0) + Number(product.returnShippingCost || 0) * returns;
  return Number(product.sellingPrice || 0) * factor - costs;
}

function suggestedSellingPrice(product) {
  const returns = Math.min(1, Math.max(0, Number(product.customerReturnRate || 0) / 100));
  const good = Math.max(0, Number(product.goodReturnRate ?? 100));
  const damaged = Math.max(0, Number(product.damagedReturnRate || 0));
  const goodShare = good + damaged > 0 ? good / (good + damaged) : 1;
  const commission = Math.min(1, Math.max(0, Number(product.commissionRate ?? 15) / 100));
  const gst = Math.max(0, Number(product.gstRate || 0) / 100);
  const factor = (1 - returns) * (1 - commission) / (1 + gst);
  if (factor <= 0) return null;
  const costs = Number(product.buyPrice || 0) * (1 - returns * goodShare)
    + Number(product.deliveryFee || 0) + Number(product.packagingCost || 0)
    + Number(product.additionalCost || 0) + Number(product.returnShippingCost || 0) * returns;
  const target = Number(product.desiredProfit || 0) * (1 - returns);
  return Math.ceil(((target + costs) / factor - Number.EPSILON) * 100) / 100;
}

function answerQuestion(question, { products, sales, report, month }) {
  const q = question.toLowerCase().trim()
    .replace(/\bselleing\b/g, 'selling')
    .replace(/\bprodcut\b/g, 'product')
    .replace(/\bquanity\b/g, 'quantity')
    .replace(/\bproffit\b/g, 'profit')
    .replace(/\bcomision\b/g, 'commission')
    .replace(/\bretun\b/g, 'return');
  const totals = report?.totals || {};
  const period = monthName(month);
  const product = products.find((item) => q.includes(String(item.name || '').toLowerCase()) || q.includes(String(item.sku || '').toLowerCase()));

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {
    return `Hello! I can answer questions about ${period} sales and inventory, and explain how to use the product, sales, return, and report screens.`;
  }
  if (q.includes('help') || q.includes('what can you')) {
    return 'Ask about your data, or ask how to do something: “What is my profit this month?”, “Which products are low on stock?”, “How do I add a product?”, or “How do I record a return?”';
  }
  if (q.includes('product photo') || q.includes('product image') || q.includes('upload photo') || q.includes('upload image')) {
    return 'To add a product photo, open Inventory and choose Add product, or click an existing product to edit it. In the Product image section choose Upload photo, select a JPG, PNG, or WebP image, then save the product.';
  }
  if ((q.includes('add') || q.includes('create') || q.includes('new') || q.includes('enter')) && (q.includes('product') || q.includes('item')) || (q.includes('how') || q.includes('where')) && (q.includes('product') || q.includes('item'))) {
    return 'To add a product: 1. Open Inventory in the left sidebar. 2. Choose Add product. 3. Enter the product name, SKU, quantity, buy price, desired profit, and any image or fees. 4. Review the calculated selling price; choose Use suggested selling price if you want to apply it. 5. Choose Add product to save.';
  }
  if ((q.includes('record') || q.includes('add') || q.includes('make') || q.includes('create')) && q.includes('sale') || q.includes('how') && q.includes('sale')) {
    return 'To record a sale: open Sales & returns, choose Record a sale, select each product and quantity, optionally enter the customer name, then choose Record sale. The sale saves the current prices and costs and reduces stock automatically.';
  }
  if ((q.includes('return') || q.includes('refund')) && (q.includes('how') || q.includes('process') || q.includes('record') || q.includes('do'))) {
    return 'To process a return: open Sales & returns, find the original transaction, choose Return, enter the quantity, then choose Process return. The returned quantity is reflected in the original sale’s monthly report and is added back to stock.';
  }
  if ((q.includes('report') || q.includes('profit')) && (q.includes('how') || q.includes('where') || q.includes('view') || q.includes('download') || q.includes('export'))) {
    return 'Open Profit reports in the left sidebar. Use the month controls to choose a reporting period. Choose Export CSV to download the sales details for that month.';
  }
  if (q.includes('price') && (q.includes('how') || q.includes('calculat') || q.includes('suggest') || q.includes('sell'))) {
    return 'Open Inventory and add or edit a product. Enter the buy price, desired profit per kept sale, commission (15% by default), GST, delivery, packaging, additional spend, customer return rate, good/damaged return split, and return shipping. The calculator assumes the selling price includes GST, estimates refunded orders and return costs, then raises the price enough to reach your target profit on kept sales. The suggestion updates as you edit; choose Use suggested selling price to apply it.';
  }
  if (q.includes('desired profit')) {
    return 'Desired profit is the amount you want to keep on each sale that is not returned. The price calculator works backward from that target after GST, commission, delivery, packaging, additional spend, and expected returns.';
  }
  if (q.includes('expected profit') || q.includes('actual profit') || q.includes('why') && q.includes('profit')) {
    return 'Expected product profit uses the product pricing and return-rate assumptions. Monthly actual profit uses recorded sales and returns, saved costs, GST, commission, shipping, packaging, and additional spend. They can differ when actual return quantities differ from the product return estimate.';
  }
  if (q.includes('gst') && (q.includes('price') || q.includes('calculat') || q.includes('include'))) {
    return 'The price calculator assumes your entered selling price includes GST. It removes the GST portion before calculating profit, then applies commission to the amount after GST. Change the GST rate in the product form to update the suggested price.';
  }
  if (q.includes('sku') || q.includes('hsn')) {
    return 'SKU is your own unique product identifier; it must be unique for each product. HSN is the product classification code. Both can be entered in the product form and are included in monthly sales exports.';
  }
  if (q.includes('good return') || q.includes('damaged return')) {
    return 'Customer return rate is the share of shipped orders expected to come back. Good and damaged return percentages split those returns; the calculator normalizes the two values as a split. Good returns are treated as recoverable stock, while damaged returns are treated as a product cost.';
  }
  if ((q.includes('edit') || q.includes('update') || q.includes('change')) && q.includes('product')) {
    return 'Open Inventory and click the product row you want to change. Update its details, then choose Save changes. Past sales keep the costs and prices saved when each sale was recorded.';
  }
  if ((q.includes('how') || q.includes('where')) && (q.includes('stock') || q.includes('quantity'))) {
    return 'To adjust stock manually, open Inventory and click the product row, change Available quantity, then choose Save changes. Recording a sale lowers stock automatically, and processing a return adds the returned quantity back.';
  }
  if (!report && products.length === 0 && sales.length === 0) {
    return 'Your dashboard data has not loaded yet. Check that the app is connected, then try again.';
  }

  if (product) {
    if (q.includes('suggest') || q.includes('should i sell') || q.includes('selling price')) {
      const suggested = suggestedSellingPrice(product);
      return suggested === null ? `${product.name} has a 100% return rate or commission, so a suggested price cannot be calculated.` : `${product.name} has a suggested selling price of ${money(suggested)} based on its desired profit and saved costs.`;
    }
    if (q.includes('profit') || q.includes('margin')) {
      return `${product.name} is estimated to make ${money(expectedProfit(product))} per shipped order at its current selling price of ${money(product.sellingPrice)}. Its target profit is ${money(product.desiredProfit)} per kept sale.`;
    }
    if (q.includes('return')) {
      return `${product.name} has a ${Number(product.customerReturnRate || 0)}% customer return rate. The saved return mix is ${Number(product.goodReturnRate ?? 100)}% good and ${Number(product.damagedReturnRate || 0)}% damaged.`;
    }
    if (q.includes('price') || q.includes('buy cost') || q.includes('cost') || q.includes('commission') || q.includes('gst') || q.includes('packaging') || q.includes('spent') || q.includes('shipping')) {
      const suggested = suggestedSellingPrice(product);
      return `${product.name}: buy ${money(product.buyPrice)}, current selling price ${money(product.sellingPrice)}, suggested price ${suggested === null ? 'unavailable' : money(suggested)}, commission ${Number(product.commissionRate ?? 15)}%, GST ${Number(product.gstRate || 0)}%, packaging ${money(product.packagingCost)}, and additional spend ${money(product.additionalCost)} per unit.`;
    }
    return `${product.name} (${product.sku}): ${product.quantity} units in stock, buy price ${money(product.buyPrice)}, selling price ${money(product.sellingPrice)}, and expected profit ${money(expectedProfit(product))} per shipped order.`;
  }

  if (q.includes('sales report') || q.includes('sales summary') || q.includes('show sales') || q.includes('give me sales')) {
    return `Sales report for ${period}: ${totals.orders || 0} orders, ${money(totals.revenue)} gross revenue, ${money(totals.profit)} net profit, and ${totals.returnedUnits || 0} returned units. Open Profit reports for the detailed rows or to export the month as CSV.`;
  }
  if (q.includes('is it right') || q.includes('is this correct') || q.includes('is that correct') || q.includes('is it correct')) {
    return 'I can check a product price against its suggested price. Tell me the product name or SKU, and I’ll compare its current and suggested selling prices.';
  }

  if (q.includes('low stock') || q.includes('running low') || q.includes('almost out')) {
    const low = products.filter((item) => item.quantity > 0 && item.quantity <= 5);
    return low.length ? `There ${low.length === 1 ? 'is' : 'are'} ${low.length} product${low.length === 1 ? '' : 's'} running low (5 or fewer units): ${low.map((item) => `${item.name} (${item.quantity})`).join(', ')}.` : 'No products are currently at 5 units or below.';
  }
  if (q.includes('out of stock') || q.includes('zero stock')) {
    const empty = products.filter((item) => item.quantity === 0);
    return empty.length ? `Out of stock: ${empty.map((item) => item.name).join(', ')}.` : 'All listed products currently have stock available.';
  }
  if (q.includes('profit') || q.includes('earning') || q.includes('earned')) {
    return `Net profit for ${period} is ${money(totals.profit)}. Desired profit for the kept units is ${money(totals.desiredProfit)}. This report uses the prices and costs saved on each sale.`;
  }
  if (q.includes('revenue') || q.includes('sales amount') || q.includes('turnover')) {
    return `Gross sales revenue for ${period} is ${money(totals.revenue)} across ${totals.orders || 0} orders. GST is shown separately in the report.`;
  }
  if (q.includes('return')) {
    return `${totals.returnedUnits || 0} unit${totals.returnedUnits === 1 ? '' : 's'} were returned in ${period}. Product return-rate settings are estimates used for suggested pricing.`;
  }
  if (q.includes('most profitable') || q.includes('highest profit')) {
    const ranked = products.map((item) => ({ item, profit: expectedProfit(item) })).sort((a, b) => b.profit - a.profit).slice(0, 3);
    return ranked.length ? `Highest expected profit per shipped order: ${ranked.map(({ item, profit }) => `${item.name} (${money(profit)})`).join(', ')}.` : 'There are no products to compare yet.';
  }
  if (q.includes('best seller') || q.includes('top selling') || q.includes('sold the most')) {
    const quantities = new Map();
    sales.forEach((sale) => sale.items.forEach((item) => quantities.set(item.name, (quantities.get(item.name) || 0) + item.quantity)));
    const top = [...quantities.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} has the most recorded units sold overall: ${top[1]}.` : 'No sales have been recorded yet.';
  }
  if (q.includes('expense') || q.includes('spent') || q.includes('commission') || q.includes('gst') || q.includes('fee') || q.includes('cost')) {
    const fees = (totals.gst || 0) + (totals.delivery || 0) + (totals.commission || 0) + (totals.packaging || 0) + (totals.additionalCost || 0) + (totals.returnShipping || 0);
    return `Recorded fees and tax for ${period} total ${money(fees)}: GST ${money(totals.gst)}, commission ${money(totals.commission)}, delivery ${money(totals.delivery)}, packaging ${money(totals.packaging)}, additional spend ${money(totals.additionalCost)}, and return shipping ${money(totals.returnShipping)}.`;
  }
  if (q.includes('stock') || q.includes('inventory') || q.includes('quantity') || q.includes('how many product')) {
    const units = products.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return `You have ${products.length} products and ${units} units in stock. Inventory is currently valued at ${money(products.reduce((sum, item) => sum + Number(item.buyPrice || 0) * Number(item.quantity || 0), 0))} at buy cost.`;
  }
  if (q.includes('order') || q.includes('transaction')) {
    return `There are ${totals.orders || 0} orders in ${period} and ${sales.length} recorded orders overall.`;
  }
  return 'I can answer questions about products, stock, sales, returns, fees, suggested prices, and profit in the dashboard. Try asking about one of those.';
}

export default function DashboardChatbot({ products, sales, report, month, chatMode = 'local' }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hi! Ask about your dashboard data or how to use it.' }]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  const ask = async (question = draft) => {
    const text = question.trim();
    if (!text || waiting) return;
    setMessages((current) => [...current, { role: 'user', text }]);
    setDraft('');
    if (chatMode !== 'ai') {
      setMessages((current) => [...current, { role: 'assistant', text: answerQuestion(text, { products, sales, report, month }) }]);
      return;
    }
    setWaiting(true);
    const context = {
      selectedMonth: month,
      monthlyReport: report ? {
        totals: report.totals,
        daily: report.daily,
        sales: report.rows.slice(0, 60),
        totalRows: report.rows.length,
      } : null,
      inventory: {
        productCount: products.length,
        totalUnits: products.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        products: products.slice(0, 120).map((item) => ({
          name: item.name, sku: item.sku, hsn: item.hsn, category: item.category,
          quantity: item.quantity, buyPrice: item.buyPrice, sellingPrice: item.sellingPrice,
          desiredProfit: item.desiredProfit, commissionRate: item.commissionRate, gstRate: item.gstRate,
          deliveryFee: item.deliveryFee, packagingCost: item.packagingCost, additionalCost: item.additionalCost,
          customerReturnRate: item.customerReturnRate, goodReturnRate: item.goodReturnRate,
          damagedReturnRate: item.damagedReturnRate, returnShippingCost: item.returnShippingCost,
          suggestedSellingPrice: suggestedSellingPrice(item), expectedProfitPerShipment: expectedProfit(item),
        })),
      },
      recentSales: sales.slice(0, 12).map((sale) => ({
        saleNumber: sale.saleNumber, date: sale.createdAt,
        items: sale.items.map((item) => ({ name: item.name, sku: item.sku, quantity: item.quantity, returnedQuantity: item.returnedQuantity, buyPrice: item.buyPrice, sellingPrice: item.sellingPrice })),
      })),
    };
    const history = messages.slice(-8).map(({ role, text: content }) => ({ role, text: content }));
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history, context }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'The AI assistant could not answer right now.');
      setMessages((current) => [...current, { role: 'assistant', text: result.answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', text: answerQuestion(text, { products, sales, report, month }) }]);
    } finally {
      setWaiting(false);
    }
  };

  return <div className="dashboard-chatbot">
    {open && <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <header className="chat-header"><div className="chat-bot-avatar"><Bot size={18} /></div><div className="chat-header-copy"><strong id="chat-title">{chatMode === 'ai' ? 'AI dashboard assistant' : 'Dashboard assistant'}</strong><span><i />{chatMode === 'ai' ? 'AI uses the selected dashboard context' : 'Uses local dashboard answers'}</span></div><button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={17} /></button></header>
      <div className="chat-messages" aria-live="polite">
        {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}><div className="chat-message-icon">{message.role === 'assistant' ? <Sparkles size={13} /> : 'You'}</div><p>{message.text}</p></div>)}
        {waiting && <div className="chat-message assistant"><div className="chat-message-icon"><Sparkles size={13} /></div><p className="chat-thinking">Looking at your dashboard…</p></div>}
        {messages.length === 1 && <div className="chat-suggestions"><button onClick={() => ask('What is my profit this month?')}>Monthly profit</button><button onClick={() => ask('Which products are low on stock?')}>Low stock</button><button onClick={() => ask('How do I add a product?')}>Add a product</button></div>}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); ask(); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your dashboard…" aria-label="Ask a dashboard question" disabled={waiting} /><button disabled={!draft.trim() || waiting} aria-label="Send message"><Send size={16} /></button></form>
      <div className="chat-footnote">{chatMode === 'ai' ? <>Selected dashboard context is sent to the AI service. AI can make mistakes. We’re learning and improving; please verify important figures.</> : 'Answers use the dashboard information currently loaded in the app.'}</div>
    </section>}
    <button className={`chat-launcher ${open ? 'open' : ''}`} onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close dashboard assistant' : 'Open dashboard assistant'}>{open ? <X size={21} /> : <MessageCircle size={21} />}<span>{open ? 'Close' : 'Ask assistant'}</span></button>
  </div>;
}
