import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from './assets/logobr.png';
import DashboardChatbot from './DashboardChatbot.jsx';
import { BillForm, CustomerForm, InvoiceForm, InvoiceView, Invoices, SettingsForm } from './Invoices.jsx';
import { api, dateLabel, money, optimizeProductImage } from './shared.js';
import './calendar.css';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Boxes, CalendarDays,
  Check, ChevronDown, FileText, ChevronLeft, ChevronRight, CircleHelp, Download, Ellipsis,
  LayoutDashboard, LoaderCircle, Package, Pencil, Plus, Search, Settings2, ShoppingBag,
  ShoppingCart, Sparkles, TrendingUp, Trash2, Truck, Undo2, X,
} from 'lucide-react';

const stockGroupKey = (product) => String(product.stockGroupId || product._id);
const uniqueStockProducts = (products) => {
  const groups = new Map();
  products.forEach((product) => {
    const key = stockGroupKey(product);
    if (!groups.has(key) || String(product._id) === key) groups.set(key, product);
  });
  return [...groups.values()];
};
const pricingFactors = (product) => {
  const returns = Math.min(1, Math.max(0, Number(product.customerReturnRate || 0) / 100));
  const good = Math.max(0, Number(product.goodReturnRate ?? 100));
  const damaged = Math.max(0, Number(product.damagedReturnRate || 0));
  const goodShare = good + damaged > 0 ? good / (good + damaged) : 1;
  const commission = Math.min(1, Math.max(0, Number(product.commissionRate ?? 15) / 100));
  const gst = Math.max(0, Number(product.gstRate || 0) / 100);
  const revenueFactor = (1 - returns) * (1 - commission) / (1 + gst);
  const fixedExpectedCosts = Number(product.buyPrice || 0) * (1 - returns * goodShare)
    + Number(product.deliveryFee || 0) + Number(product.packagingCost || 0) + Number(product.additionalCost || 0)
    + Number(product.returnShippingCost || 0) * returns;
  return { revenueFactor, fixedExpectedCosts, keptRate: 1 - returns };
};
const productUnitProfit = (product) => {
  const { revenueFactor, fixedExpectedCosts } = pricingFactors(product);
  return Number(product.sellingPrice || 0) * revenueFactor - fixedExpectedCosts;
};
const suggestedSellingPrice = (product) => {
  const { revenueFactor, fixedExpectedCosts, keptRate } = pricingFactors(product);
  if (revenueFactor <= 0) return null;
  const price = (Number(product.desiredProfit || 0) * keptRate + fixedExpectedCosts) / revenueFactor;
  return Math.ceil((price - Number.EPSILON) * 100) / 100;
};
const returnQualitySplit = (product) => {
  const good = Math.max(0, Number(product.goodReturnRate || 0));
  const damaged = Math.max(0, Number(product.damagedReturnRate || 0));
  const total = good + damaged;
  return total > 0 ? { good: good / total * 100, damaged: damaged / total * 100 } : { good: 100, damaged: 0 };
};
const monthNow = () => new Date().toISOString().slice(0, 7);
const localDateInput = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
const dateInputValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : localDateInput();
const monthLabel = (value) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`));
const CACHE_KEY = 'meridian-workspace-cache';
let cacheMemo;
const readCache = () => {
  if (cacheMemo) return cacheMemo;
  try { cacheMemo = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { cacheMemo = {}; }
  return cacheMemo;
};
// Keeps the last loaded data so a reload can show it instantly while fresh data loads.
const writeCache = (patch) => {
  cacheMemo = { ...readCache(), ...patch };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cacheMemo)); }
  catch {
    // Product photos can exceed the storage quota; fall back to caching without them.
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cacheMemo, products: (cacheMemo.products || []).map(({ image, ...rest }) => rest) })); } catch { /* storage unavailable */ }
  }
};

function App() {
  const [page, setPage] = useState('Overview');
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [products, setProducts] = useState(() => readCache().products || []);
  const [sales, setSales] = useState(() => readCache().sales || []);
  const [report, setReport] = useState(() => { const r = readCache().report; return r && r.month === monthNow() ? r : null; });
  const [month, setMonth] = useState(monthNow());
  const [invoices, setInvoices] = useState(() => readCache().invoices || []);
  const [customers, setCustomers] = useState(() => readCache().customers || []);
  const [settings, setSettings] = useState(() => readCache().settings || null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [modal, setModal] = useState(null);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loading, setLoading] = useState(() => !readCache().products);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [chatMode, setChatMode] = useState('local');
  const [query, setQuery] = useState('');

  const refresh = useCallback(async (nextMonth = month) => {
    setError('');
    const fail = (err) => { setError(`${err.message} Start MongoDB and the API server to connect your workspace.`); };
    // Each request updates the screen as soon as it arrives instead of waiting for all of them.
    const loads = [
      api('/products').then((p) => { setProducts(p); setLoading(false); writeCache({ products: p }); }),
      api('/sales').then((s) => { setSales(s); writeCache({ sales: s }); }),
      api(`/reports/monthly?month=${nextMonth}`).then((r) => { setReport(r); writeCache({ report: r }); }),
      api('/invoices').then((list) => { setInvoices(list); writeCache({ invoices: list }); }),
      api('/customers').then((list) => { setCustomers(list); writeCache({ customers: list }); }),
      api('/settings').then((data) => { setSettings(data); writeCache({ settings: data }); }),
      api('/health').then((health) => setChatMode(health.assistant || 'local')).catch(() => {}),
    ];
    const results = await Promise.allSettled(loads);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) fail(failed.reason);
    setLoading(false);
  }, [month]);

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (report && report.month !== month) api(`/reports/monthly?month=${month}`).then(setReport).catch((err) => setError(err.message)); }, [month]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 3200); return () => clearTimeout(timer); }, [notice]);

  const run = async (action, success) => {
    setBusy(true); setError('');
    try { await action(); setModal(null); setNotice(success); await refresh(month); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const totals = report?.totals || {};
  const stockItems = uniqueStockProducts(products);
  const stockValue = stockItems.reduce((sum, product) => sum + product.buyPrice * product.quantity / Number(product.packSize || 1), 0);
  const totalUnits = stockItems.reduce((sum, product) => sum + product.quantity, 0);
  const lowStock = stockItems.filter((product) => product.quantity > 0 && product.quantity <= 5).length;
  const zeroStock = stockItems.filter((product) => product.quantity === 0).length;
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase()));

  const chooseMonth = (delta) => {
    const next = new Date(`${month}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(next.toISOString().slice(0, 7));
  };
  const exportReport = (rows = report?.rows || [], range = {}) => {
    if (!rows.length) return;
    const columns = ['SL No', 'Date', 'Marketplace', 'Product Name', 'QTY (packs)', 'Units per pack', 'Net units', 'BP per pack', 'Total Price', 'Overall Cost', 'Delivery fee', 'Commission', 'Packaging cost', 'Additional spend', 'Return shipping', 'SP per pack', 'GST amount', 'Desired Profit', 'Actual Profit', 'SKU', 'HSN'];
    const csvRows = rows.map((r, i) => [i + 1, dateLabel(r.date), r.platform || 'Marketplace not recorded', r.name, r.netQuantity, r.packSize, r.netUnits, r.buyPrice, r.totalPrice, r.overallCost, r.deliveryFee, r.commission, r.packagingCost, r.additionalCost, r.returnShippingCost, r.netQuantity ? r.totalPrice / r.netQuantity : 0, r.gstAmount, r.desiredProfit, r.profit, r.sku, r.hsn]);
    const csv = [columns, ...csvRows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a');
    const dateSuffix = range.fromDate || range.toDate ? `-${range.fromDate || 'month-start'}-to-${range.toDate || 'month-end'}` : '';
    link.href = URL.createObjectURL(blob); link.download = `amita-essentials-${month}${dateSuffix}-report.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const deleteReportItem = (row) => {
    const restore = Math.max(0, row.quantity - row.returnedQuantity) * Number(row.packSize || 1);
    const stockMessage = restore ? ` ${restore} unsold ${restore === 1 ? 'unit will' : 'units will'} be restored to inventory.` : '';
    setConfirmDialog({
      title: 'Delete this sale item?',
      message: `Remove ${row.name} from sale ${row.saleNumber}? This also removes it from the sales report.${stockMessage} This cannot be undone.`,
      confirmLabel: 'Delete item',
      action: () => run(() => api(`/sales/${row.saleId}/items/${row.itemIndex}`, { method: 'DELETE' }), 'Sale item deleted and reports updated.'),
    });
  };
  const deleteSale = (sale) => {
    const restore = sale.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity) * Number(item.packSize || 1), 0);
    const stockMessage = restore ? ` ${restore} unreturned ${restore === 1 ? 'unit will' : 'units will'} be restored to inventory.` : '';
    setConfirmDialog({
      title: 'Delete this sale?',
      message: `Sale ${sale.saleNumber} will be removed from the sales list and reports.${stockMessage} This cannot be undone.`,
      confirmLabel: 'Delete sale',
      action: () => run(() => api(`/sales/${sale._id}`, { method: 'DELETE' }), 'Sale deleted and reports updated.'),
    });
  };
  const confirmPendingAction = () => {
    const action = confirmDialog?.action;
    setConfirmDialog(null);
    if (action) action();
  };
  const saveSaleDetails = (saleId, data) => run(() => api(`/sales/${saleId}`, { method: 'PATCH', body: JSON.stringify(data) }), 'Sale details updated.');
  const openVariant = (product) => {
    const stockGroupId = stockGroupKey(product);
    const stockOwner = products.find((item) => String(item._id) === stockGroupId) || product;
    let variantNumber = 2;
    let variantSku = `${stockOwner.sku}-V${variantNumber}`;
    while (products.some((item) => item.sku === variantSku)) variantSku = `${stockOwner.sku}-V${++variantNumber}`;
    setModal({ type: 'variant', product: stockOwner, variantSku });
  };
  const createInvoice = (data) => run(async () => {
    const invoice = await api('/invoices', { method: 'POST', body: JSON.stringify(data) });
    setViewInvoice(invoice);
  }, 'GST invoice ready.');
  const saveSettings = (data) => run(async () => setSettings(await api('/settings', { method: 'PUT', body: JSON.stringify(data) })), 'Business settings saved.');
  // The list already holds everything the bill prints, so it opens at once; the full copy is fetched behind it.
  const openInvoice = async (invoice, autoPrint = false) => {
    if (invoice.items) setViewInvoice({ ...invoice, autoPrint });
    try { const full = await api(`/invoices/${invoice._id}`); setViewInvoice((current) => current && current._id === full._id ? { ...full, autoPrint } : current); }
    catch (err) { if (!invoice.items) setError(err.message); }
  };
  const openSettings = async () => {
    try { const data = settings || await api('/settings'); setSettings(data); setModal({ type: 'settings' }); } catch (err) { setError(err.message); }
  };
  const openSaleInvoice = (sale) => {
    const existing = invoices.find((invoice) => String(invoice.sale) === String(sale._id));
    if (existing) openInvoice(existing); else setModal({ type: 'invoice', sale });
  };
  const deleteCustomer = (customer) => setConfirmDialog({
    title: 'Delete this customer?',
    message: `${customer.name} will be removed. Bills already made keep their details. This cannot be undone.`,
    confirmLabel: 'Delete customer',
    action: () => run(() => api(`/customers/${customer._id}`, { method: 'DELETE' }), 'Customer deleted.'),
  });
  const deleteInvoice = (invoice) => setConfirmDialog({
    title: 'Delete this invoice?',
    message: `Invoice ${invoice.invoiceNumber} will be removed. Its number will not be reused. This cannot be undone.`,
    confirmLabel: 'Delete invoice',
    action: () => run(() => api(`/invoices/${invoice._id}`, { method: 'DELETE' }), 'Invoice deleted.'),
  });
  const deleteProduct = (product) => setConfirmDialog({
    title: 'Delete this product variant?',
    message: `Delete ${product.name} (${product.sku}) from inventory? Its other variants and their shared stock will remain. Products with sales history cannot be deleted.`,
    confirmLabel: 'Delete product',
    action: () => run(async () => {
      await api(`/products/${product._id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item._id !== product._id));
    }, 'Product deleted from inventory.'),
  });

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Inventory', icon: Package, badge: uniqueStockProducts(products).length || null },
    { label: 'Sales & returns', icon: ShoppingCart },
    { label: 'Sales calendar', icon: CalendarDays },
    { label: 'Profit reports', icon: TrendingUp },
    { label: 'Invoices', icon: FileText },
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src={logoUrl} alt="Amita Essentials logo" /><span>Amita Essentials</span><button className="workspace-switch" aria-label="Choose workspace"><ChevronDown size={14} /></button></div>
      <div className="workspace-card"><img className="workspace-avatar" src={logoUrl} alt="" /><div className="workspace-copy"><strong>Amita Essentials</strong><span>Business workspace</span></div><Ellipsis size={17} className="muted-icon" /></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="nav-list">{navItems.map(({ label, icon: Icon, badge }) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setQuery(''); }}><Icon size={17} strokeWidth={1.9} /><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}</button>)}</nav>
      <div className="side-label tools-label">TOOLS</div>
      <button className="nav-item" onClick={() => setModal({ type: 'product' })}><Plus size={17} /><span>Add a product</span><span className="shortcut">⌘ N</span></button>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><Sparkles size={16} /></div><strong>Your business, at a glance.</strong><p>Track your stock and keep every rupee accounted for.</p><button onClick={() => setPage('Profit reports')}>Explore reports <ArrowRight size={14} /></button></div><div className="profile-row"><img className="profile-avatar" src={logoUrl} alt="" /><div className="profile-copy"><strong>Store admin</strong><span>Workspace owner</span></div><Settings2 size={17} className="muted-icon" /></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Amita Essentials</span><ChevronRight size={14} /><strong>{page}</strong></div><div className="topbar-actions"><div className="sync-pill"><span className={`sync-dot ${error ? 'offline' : ''}`} />{error ? 'Offline' : 'All changes saved'}</div><button className="icon-button" title="Help"><CircleHelp size={17} /></button><img className="top-avatar" src={logoUrl} alt="Amita Essentials" /></div></header>
      {error && <div className="alert error-alert"><span><strong>Couldn’t connect to your workspace</strong><small>{error}</small></span><button onClick={() => refresh()}><Activity size={14} /> Try again</button></div>}
      {notice && <div className="toast"><Check size={16} />{notice}</div>}
      <div className="page-content">
        {page === 'Overview' && <Overview greeting={currentHour < 5 ? 'Good night' : currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : currentHour < 21 ? 'Good evening' : 'Good night'} report={report} totals={totals} products={products} sales={sales} stockValue={stockValue} totalUnits={totalUnits} lowStock={lowStock} zeroStock={zeroStock} month={month} changeMonth={chooseMonth} setPage={setPage} openSale={() => setModal({ type: 'sale' })} openProduct={() => setModal({ type: 'product' })} loading={loading} />}
        {page === 'Inventory' && <Inventory products={products} query={query} setQuery={setQuery} openProduct={(product) => setModal({ type: 'product', product })} openVariant={openVariant} onDelete={deleteProduct} onPreview={setPreviewProduct} openNew={() => setModal({ type: 'product' })} loading={loading} />}
        {page === 'Sales & returns' && <Sales sales={sales} products={products} openSale={() => setModal({ type: 'sale' })} openEdit={(sale) => setModal({ type: 'editSale', sale })} deleteSale={deleteSale} openReturn={(sale, item) => setModal({ type: 'return', sale, item })} openInvoice={openSaleInvoice} invoicedSales={new Set(invoices.map((invoice) => String(invoice.sale)))} loading={loading} />}
        {page === 'Sales calendar' && <SalesCalendar sales={sales} month={month} changeMonth={chooseMonth} loading={loading} />}
        {page === 'Profit reports' && <Reports report={report} month={month} changeMonth={chooseMonth} onExport={exportReport} onDeleteItem={deleteReportItem} loading={loading} />}
        {page === 'Invoices' && <Invoices invoices={invoices} sales={sales} customers={customers} openCustomer={() => setModal({ type: 'customer' })} openBill={() => setModal({ type: 'bill' })} onDeleteCustomer={deleteCustomer} loading={loading} onCreate={openSaleInvoice} onOpen={openInvoice} onDelete={deleteInvoice} openSettings={openSettings} />}
      </div>
    </main>
    {modal?.type === 'bill' && <BillForm products={products} customers={customers} settings={settings} busy={busy} error={error} onCreate={createInvoice} close={() => { if (!busy) { setModal(null); setError(''); } }} />}
    {modal?.type === 'customer' && <CustomerForm busy={busy} error={error} onSave={(data) => run(() => api('/customers', { method: 'POST', body: JSON.stringify(data) }), 'Customer added.')} close={() => { if (!busy) { setModal(null); setError(''); } }} />}
    {modal?.type === 'settings' && <SettingsForm settings={settings || {}} busy={busy} error={error} onSave={saveSettings} close={() => { if (!busy) { setModal(null); setError(''); } }} />}
    {modal?.type === 'invoice' && <InvoiceForm sale={modal.sale} products={products} customers={customers} settings={settings} busy={busy} error={error} onCreate={createInvoice} close={() => { if (!busy) { setModal(null); setError(''); } }} />}
    {viewInvoice && <InvoiceView invoice={viewInvoice} close={() => setViewInvoice(null)} />}
    {modal && !['settings', 'invoice', 'customer', 'bill'].includes(modal.type) && <Modal modal={modal} products={products} customers={customers} busy={busy} error={error} close={() => { if (!busy) { setModal(null); setError(''); } }} onProduct={(data) => run(() => api(data._id ? `/products/${data._id}` : '/products', { method: data._id ? 'PUT' : 'POST', body: JSON.stringify(data) }), data._id ? 'Product updated.' : modal.type === 'variant' ? 'Variant added with shared stock.' : 'Product added to inventory.')} onSale={(data) => run(() => api('/sales', { method: 'POST', body: JSON.stringify(data) }), 'Sale recorded and stock updated.')} onEditSale={(data) => saveSaleDetails(data.saleId, data)} onReturn={(data) => run(() => api(`/sales/${data.saleId}/returns`, { method: 'POST', body: JSON.stringify(data) }), 'Return processed and stock restored.')} />}
    {previewProduct && <ProductImagePreview product={previewProduct} onClose={() => setPreviewProduct(null)} />}
    {confirmDialog && <ConfirmationDialog dialog={confirmDialog} busy={busy} onCancel={() => { if (!busy) setConfirmDialog(null); }} onConfirm={confirmPendingAction} />}
    <DashboardChatbot products={products} sales={sales} report={report} month={month} chatMode={chatMode} />
  </div>;
}

function PageHeading({ eyebrow, title, description, actions }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{actions}</div></div>; }
function MetricCard({ label, value, change, icon: Icon, tone = 'violet', note }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-foot">{change && <span className="positive"><ArrowUpRight size={14} />{change}</span>}<span>{note}</span></div></div>; }

function Overview({ greeting, report, totals, products, sales, stockValue, totalUnits, lowStock, zeroStock, month, changeMonth, setPage, openSale, openProduct, loading }) {
  const stockItems = uniqueStockProducts(products);
  const chart = report?.daily || [];
  const max = Math.max(...chart.map((d) => d.revenue), 1);
  const [year, monthNumber] = month.split('-').map(Number);
  const monthDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const bucketDays = Math.ceil(monthDays / 14);
  const bars = Array.from({ length: 14 }, (_, i) => chart.filter((d) => d.day > i * bucketDays && d.day <= (i + 1) * bucketDays).reduce((acc, d) => ({ revenue: acc.revenue + d.revenue, profit: acc.profit + d.profit }), { revenue: 0, profit: 0 }));
  const recent = [...sales].slice(0, 5);
  const monthUnits = totals.units || 0;
  return <>
    <PageHeading eyebrow={new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()} title={greeting} description="Here’s what’s happening with your business today." actions={<><button className="button secondary" onClick={() => setPage('Inventory')}><Package size={16} /> View inventory</button><button className="button primary" onClick={openSale}><Plus size={16} /> Record a sale</button></>} />
    <div className="month-strip"><div className="period-tag"><CalendarDays size={15} /> THIS MONTH</div><div className="month-switch"><button onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button><span>{monthLabel(month)}</span><button onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button></div><button className="text-link" onClick={() => setPage('Profit reports')}>Full report <ArrowRight size={14} /></button></div>
    <div className="metrics-grid">
      <MetricCard label="Desired profit" value={money(totals.desiredProfit)} note="target profit on kept packs" icon={TrendingUp} tone="green" />
      <MetricCard label="Sales revenue" value={money(totals.revenue)} note={`${monthUnits} individual units sold this month`} icon={ShoppingBag} tone="blue" />
      <MetricCard label="Inventory value" value={money(stockValue)} note={`${totalUnits} individual units currently in stock`} icon={Boxes} tone="violet" />
      <MetricCard label="Orders this month" value={totals.orders || 0} note={`${totals.returnedUnits || 0} individual units returned`} icon={Activity} tone="orange" />
    </div>
    <div className="overview-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Your daily sales performance</p></div><button className="select-button" onClick={() => setPage('Profit reports')}>Revenue <ChevronDown size={14} /></button></div><div className="chart-total"><strong>{money(totals.revenue)}</strong><span className="chart-period">in {monthLabel(month)}</span></div><div className="chart-area"><div className="chart-y"><span>₹{Math.round(max / 1000)}k</span><span>₹{Math.round(max * .66 / 1000)}k</span><span>₹{Math.round(max * .33 / 1000)}k</span><span>₹0</span></div><div className="chart-lines"><div className="grid-line" /><div className="grid-line" /><div className="grid-line" /><div className="grid-line" /><div className="bar-chart">{bars.map((value, i) => <div className="bar-slot" key={i}><div className="bar-group"><div className={`bar ${value.revenue ? 'has-value' : ''}`} style={{ height: `${Math.max(value.revenue ? 2 : 0, value.revenue / max * 100)}%` }} title={`Revenue ${money(value.revenue)}`} /><div className="bar profit-bar" style={{ height: `${Math.max(value.profit ? 2 : 0, value.profit / max * 100)}%` }} title={`Profit ${money(value.profit)}`} /></div></div>)}</div></div></div><div className="chart-x"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>31</span></div><div className="chart-legend"><i /> Revenue <i className="legend-profit" /> Profit</div></section>
      <section className="panel stock-panel"><div className="panel-heading"><div><h2>Stock health</h2><p>Quick look at your inventory</p></div><button className="more-button" onClick={() => setPage('Inventory')}><Ellipsis size={18} /></button></div><div className="stock-donut-wrap"><div className="stock-donut" style={{ '--stock-fill': `${stockItems.length ? Math.max(3, (stockItems.filter((p) => p.quantity > 5).length / stockItems.length) * 100) : 0}%` }}><div><strong>{stockItems.length}</strong><span>products</span></div></div><div className="stock-legend"><div><i className="dot-in" /><span>In stock</span><strong>{stockItems.filter((p) => p.quantity > 5).length}</strong></div><div><i className="dot-low" /><span>Running low</span><strong>{lowStock}</strong></div><div><i className="dot-out" /><span>Out of stock</span><strong>{zeroStock}</strong></div></div></div><div className="stock-alert"><div className="alert-icon"><Package size={15} /></div><span><strong>{lowStock + zeroStock ? `${lowStock + zeroStock} items need attention` : 'Stock is looking healthy'}</strong><small>{lowStock + zeroStock ? 'Review products running low or out of stock.' : 'You’re well stocked across your catalogue.'}</small></span><button onClick={() => setPage('Inventory')}><ArrowRight size={15} /></button></div></section>
    </div>
    <div className="lower-grid"><section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent sales</h2><p>Your latest recorded orders</p></div><button className="text-link" onClick={() => setPage('Sales & returns')}>View all <ArrowRight size={14} /></button></div>{loading ? <Loading /> : recent.length ? <div className="recent-list">{recent.map((sale) => <SaleListRow key={sale._id} sale={sale} />)}</div> : <Empty title="No sales recorded yet" copy="Your recorded sales will show up here." action="Record a sale" onClick={openSale} />}</section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Get things done faster</p></div></div><button className="quick-action" onClick={openProduct}><div className="quick-icon quick-violet"><Plus size={17} /></div><span><strong>Add a product</strong><small>Add something new to your catalogue</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={openSale}><div className="quick-icon quick-blue"><ShoppingCart size={17} /></div><span><strong>Record a sale</strong><small>Log a sale and update stock</small></span><ArrowRight size={16} /></button><button className="quick-action" onClick={() => setPage('Profit reports')}><div className="quick-icon quick-green"><TrendingUp size={17} /></div><span><strong>View profit report</strong><small>See how your month is going</small></span><ArrowRight size={16} /></button></section></div>
  </>;
}

function Inventory({ products, query, setQuery, openProduct, openVariant, onDelete, onPreview, openNew, loading }) {
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState('all');
  const [packFilter, setPackFilter] = useState('all');
  const searchInputRef = useRef(null);
  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (product) => {
    const packSize = Number(product.packSize || 1);
    const searchable = `${product.name} ${product.sku} ${product.hsn || ''} ${product.category || ''} pack ${packSize}`.toLowerCase();
    const searchMatch = !normalizedQuery || searchable.includes(normalizedQuery);
    const stockMatch = stockFilter === 'all' || (stockFilter === 'in' && product.quantity > 5) || (stockFilter === 'low' && product.quantity > 0 && product.quantity <= 5) || (stockFilter === 'out' && product.quantity === 0);
    const packMatch = packFilter === 'all' || packSize === Number(packFilter);
    return searchMatch && stockMatch && packMatch;
  };
  const visibleListings = products.filter(matches);
  const groupIds = [...new Set(visibleListings.map(stockGroupKey))];
  const groups = groupIds.map((groupId) => products.find((product) => String(product._id) === groupId) || visibleListings.find((product) => stockGroupKey(product) === groupId));
  const stockItems = uniqueStockProducts(products);
  const inStock = stockItems.filter((p) => p.quantity > 5).length;
  const low = stockItems.filter((p) => p.quantity > 0 && p.quantity <= 5).length;
  const out = stockItems.filter((p) => p.quantity === 0).length;
  const variantsFor = (product) => products.filter((item) => stockGroupKey(item) === stockGroupKey(product) && String(item._id) !== String(product._id) && matches(item));
  const toggleGroup = (groupId) => setExpandedGroups((current) => {
    const next = new Set(current);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    return next;
  });
  const clearFilters = () => { setStockFilter('all'); setPackFilter('all'); };
  const filterActive = stockFilter !== 'all' || packFilter !== 'all';
  const renderProductRow = (product, index, isVariant = false, variantCount = 0) => <tr key={product._id} className={isVariant ? 'variant-row' : ''}>
    <td><div className="product-cell" style={isVariant ? { paddingLeft: 25 } : undefined}><ProductVisual product={product} index={index} onPreview={onPreview} /><div><strong>{product.name}</strong><span>{product.sku} · Added {dateLabel(product.createdAt)}</span>{!isVariant && variantCount > 0 && (normalizedQuery || filterActive ? <small className="variant-match-label">Matching variants shown</small> : <button type="button" className="variant-toggle" onClick={() => toggleGroup(stockGroupKey(product))}>{expandedGroups.has(stockGroupKey(product)) ? 'Hide' : 'Show'} {variantCount} variant{variantCount === 1 ? '' : 's'}</button>)}</div></div></td>
    <td><div className="sku-cell">{product.sku}<span>HSN {product.hsn || '—'}</span></div></td><td><span className="category-tag">{product.category || 'General'}</span></td><td>Pack {Number(product.packSize || 1)}</td><td>{money(product.buyPrice)}</td><td className="strong-cell">{money(product.sellingPrice)}</td><td><StockBadge quantity={product.quantity} packSize={product.packSize || 1} /></td><td>{money(product.desiredProfit)}</td><td>{suggestedSellingPrice(product) === null ? '—' : money(suggestedSellingPrice(product))}</td><td>{Number(product.commissionRate ?? 15)}%</td><td>{Number(product.gstRate || 0)}%</td><td>{money(product.packagingCost)}</td><td>{money(product.additionalCost)}</td><td>{Number(product.customerReturnRate || 0)}%</td><td>{returnQualitySplit(product).good.toFixed(1)}%</td><td>{returnQualitySplit(product).damaged.toFixed(1)}%</td><td>{money(product.returnShippingCost)}</td><td><div className="row-actions"><button className="row-menu add-variant-button" title="Add variant" aria-label={`Add variant of ${product.name}`} onClick={() => openVariant(product)}><Plus size={14} />Add variant</button><button className="row-menu" title="Edit product" aria-label={`Edit ${product.name}`} onClick={() => openProduct(product)}><Ellipsis size={17} /></button><button className="row-menu delete-product-button" title="Delete product" aria-label={`Delete ${product.name} SKU ${product.sku}`} onClick={() => onDelete(product)}><Trash2 size={15} /></button></div></td>
  </tr>;
  return <><PageHeading eyebrow="CATALOGUE" title="Inventory" description="Manage products and pack variants using shared stock." actions={<button className="button primary" onClick={openNew}><Plus size={16} /> Add product</button>} /><div className="inventory-summary"><div><span>Products</span><strong>{groups.length}</strong></div><div><span>In stock</span><strong className="sum-green">{inStock}</strong></div><div><span>Running low</span><strong className="sum-amber">{low}</strong></div><div><span>Out of stock</span><strong className="sum-red">{out}</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>Products <span className="count-badge">{groups.length}</span></h2><p>Expand a product to see its pack variants. Each variant has its own price; stock is shared in individual units.</p></div><div className="table-tools"><div className="search-box"><Search size={15} /><input ref={searchInputRef} placeholder="Search products or SKU..." value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>Ctrl K</kbd>{query && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}</div><div className="filter-wrap"><button className={`filter-button ${filterActive ? 'filter-active' : ''}`} type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}><Settings2 size={15} /> Filter {filterActive && <i />}<ChevronDown size={14} /></button>{filterOpen && <div className="filter-menu"><label>Stock status<select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}><option value="all">All stock</option><option value="in">In stock</option><option value="low">Running low</option><option value="out">Out of stock</option></select></label><label>Pack size<select value={packFilter} onChange={(e) => setPackFilter(e.target.value)}><option value="all">All pack sizes</option><option value="1">Pack 1</option><option value="2">Pack 2</option><option value="3">Pack 3</option><option value="4">Pack 4</option></select></label><button type="button" className="filter-reset" onClick={clearFilters}>Clear filters</button></div>}</div></div></div>{loading ? <Loading /> : groups.length ? <><div className="table-scroll inventory-desktop-table"><table><thead><tr><th>PRODUCT / VARIANT</th><th>SKU / HSN</th><th>CATEGORY</th><th>PACK SIZE</th><th>BUY PRICE / PACK</th><th>SELL PRICE / PACK</th><th>STOCK ON HAND</th><th>DESIRED PROFIT / PACK</th><th>SUGGESTED SELL PRICE / PACK</th><th>COMMISSION</th><th>GST RATE</th><th>PACKAGING</th><th>OTHER SPEND / PACK</th><th>RETURN RATE</th><th>GOOD RETURNS</th><th>DAMAGED RETURNS</th><th>RETURN SHIPPING</th><th /></tr></thead><tbody>{groups.flatMap((product, index) => { const variants = variantsFor(product); const expanded = expandedGroups.has(stockGroupKey(product)) || Boolean((normalizedQuery || filterActive) && variants.length); return [renderProductRow(product, index, false, variants.length), ...(expanded ? variants.map((variant, variantIndex) => renderProductRow(variant, index + variantIndex + 1, true)) : [])]; })}</tbody></table></div><InventoryMobileCards groups={groups} variantsFor={variantsFor} expandedGroups={expandedGroups} toggleGroup={toggleGroup} autoExpand={Boolean(normalizedQuery || filterActive)} openProduct={openProduct} openVariant={openVariant} onDelete={onDelete} onPreview={onPreview} /></> : <Empty title={query || filterActive ? 'No matching products' : 'Your catalogue is ready'} copy={query || filterActive ? 'Try a different search or clear the filters.' : 'Add your first product to start tracking stock and profit.'} action={query || filterActive ? 'Clear filters' : 'Add your first product'} onClick={() => { setQuery(''); clearFilters(); }} />}</section><div className="table-foot"><span>Showing <strong>{groups.length}</strong> products</span><span>Variant sales deduct units from their shared product stock.</span></div></>;
}
function InventoryMobileCards({ groups, variantsFor, expandedGroups, toggleGroup, autoExpand, openProduct, openVariant, onDelete, onPreview }) {
  return <div className="inventory-mobile-list">{groups.map((product) => {
    const variants = variantsFor(product);
    const expanded = expandedGroups.has(stockGroupKey(product)) || (autoExpand && variants.length > 0);
    return <div className="inventory-mobile-group" key={product._id}>
      <MobileProductCard product={product} variantCount={variants.length} expanded={expanded} autoExpanded={autoExpand && variants.length > 0} onToggle={() => toggleGroup(stockGroupKey(product))} openProduct={openProduct} openVariant={openVariant} onDelete={onDelete} onPreview={onPreview} />
      {expanded && variants.map((variant) => <MobileProductCard key={variant._id} product={variant} isVariant openProduct={openProduct} onDelete={onDelete} onPreview={onPreview} />)}
    </div>;
  })}</div>;
}

function MobileProductCard({ product, isVariant = false, variantCount = 0, expanded, autoExpanded = false, onToggle, openProduct, openVariant, onDelete, onPreview }) {
  return <article className={`inventory-mobile-card ${isVariant ? 'is-variant' : ''}`}>
    <div className="mobile-product-top tw:flex-wrap tw:sm:flex-nowrap"><ProductVisual product={product} onPreview={onPreview} /><div className="mobile-product-title"><strong>{product.name}</strong><span>{product.sku} · Pack {Number(product.packSize || 1)}</span></div></div>
    <StockBadge quantity={product.quantity} packSize={product.packSize || 1} />
    <div className="mobile-product-prices row g-2"><div className="col-6 col-sm-3"><div className="mobile-price-cell tw:h-full"><span>Buy / pack</span><strong className="tw:min-w-0 tw:break-words">{money(product.buyPrice)}</strong></div></div><div className="col-6 col-sm-3"><div className="mobile-price-cell tw:h-full"><span>Sell / pack</span><strong className="tw:min-w-0 tw:break-words">{money(product.sellingPrice)}</strong></div></div><div className="col-6 col-sm-3"><div className="mobile-price-cell tw:h-full"><span>Desired profit</span><strong className="tw:min-w-0 tw:break-words">{money(product.desiredProfit)}</strong></div></div><div className="col-6 col-sm-3"><div className="mobile-price-cell tw:h-full"><span>Suggested price</span><strong className="tw:min-w-0 tw:break-words">{suggestedSellingPrice(product) === null ? '—' : money(suggestedSellingPrice(product))}</strong></div></div></div>
    <div className="mobile-product-actions">{!isVariant && <button type="button" onClick={() => openVariant(product)}><Plus size={14} /> Add variant</button>}<button type="button" onClick={() => openProduct(product)}><Pencil size={13} /> Edit</button><button type="button" className="delete-product-button" onClick={() => onDelete(product)}><Trash2 size={13} /> Delete</button>{!isVariant && variantCount > 0 && (autoExpanded ? <span className="mobile-variant-match">Matching variants shown</span> : <button type="button" className="mobile-variant-toggle" onClick={onToggle}>{expanded ? 'Hide' : 'Show'} {variantCount} variant{variantCount === 1 ? '' : 's'} <ChevronDown size={13} /></button>)}</div>
  </article>;
}
function Sales({ sales, products, openSale, openEdit, deleteSale, openReturn, openInvoice, invoicedSales, loading }) {
  const [query, setQuery] = useState('');
  const filtered = sales.filter((sale) => `${sale.saleNumber} ${sale.platform || ""} ${sale.items.map((x) => x.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="ORDERS" title="Sales & returns" description="Record orders, keep stock current, and process returns." actions={<button className="button primary" onClick={openSale}><Plus size={16} /> Record a sale</button>} /><div className="sales-metrics"><div><div className="metric-mini-icon blue"><ShoppingBag size={17} /></div><span>Total orders</span><strong>{sales.length}</strong></div><div><div className="metric-mini-icon green"><TrendingUp size={17} /></div><span>Individual units sold this month</span><strong>{sales.filter((s) => (s.saleDate || s.createdAt)?.slice(0, 7) === monthNow()).reduce((sum, s) => sum + s.items.reduce((a, i) => a + (i.quantity - i.returnedQuantity) * Number(i.packSize || 1), 0), 0)}</strong></div><div><div className="metric-mini-icon orange"><Undo2 size={17} /></div><span>Individual units returned</span><strong>{sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.returnedQuantity * Number(i.packSize || 1), 0), 0)}</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>All transactions <span className="count-badge">{sales.length}</span></h2><p>Sales are saved with the prices from the day of purchase.</p></div><label className="search-box"><Search size={15} /><input placeholder="Search transactions..." value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>{loading ? <Loading /> : filtered.length ? <div className="transaction-list">{filtered.map((sale) => <article className="transaction-card" key={sale._id}><div className="transaction-icon"><ShoppingBag size={17} /></div><div className="transaction-main"><div><strong>{sale.saleNumber}</strong><span className="transaction-date">{dateLabel(sale.saleDate || sale.createdAt)}</span></div><span className="transaction-customer">{sale.platform || 'Marketplace not recorded'} · {sale.items.length} {sale.items.length === 1 ? 'product' : 'products'}</span><div className="transaction-items">{sale.items.map((item) => <span key={item.product} className="transaction-chip">{item.name} <b>× {item.quantity - item.returnedQuantity} pack(s) · {(item.quantity - item.returnedQuantity) * Number(item.packSize || 1)} units</b>{item.returnedQuantity > 0 && <i>({item.returnedQuantity} pack(s) returned)</i>}</span>)}</div></div><div className="transaction-total"><span>NET SALE</span><strong>{money(sale.items.reduce((sum, item) => sum + item.sellingPrice * (item.quantity - item.returnedQuantity), 0))}</strong></div><div className="transaction-controls"><button className="sale-edit-button" type="button" onClick={() => openEdit(sale)}><Pencil size={13} /> Edit</button><button className="sale-edit-button sale-invoice-button" type="button" onClick={() => openInvoice(sale)}><FileText size={13} /> {invoicedSales.has(String(sale._id)) ? 'View bill' : 'GST bill'}</button><button className="sale-delete-button" type="button" onClick={() => deleteSale(sale)}><Trash2 size={13} /> Delete</button>{sale.items.some((item) => item.quantity > item.returnedQuantity && products.some((p) => p._id === item.product)) ? <button className="return-button" onClick={() => { const item = sale.items.find((line) => line.quantity > line.returnedQuantity && products.some((p) => p._id === line.product)); if (item) openReturn(sale, item); }}><Undo2 size={14} /> Return</button> : <span className="returned-tag">Fully returned</span>}</div></article>)}</div> : <Empty title={query ? 'No matching transactions' : 'No sales just yet'} copy={query ? 'Try a different search term.' : 'Once you record an order, you can process returns from here.'} action={query ? null : 'Record your first sale'} onClick={openSale} />}</section></>;
}

function SalesCalendar({ sales, month, changeMonth, loading }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leadingDays = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const saleDays = useMemo(() => {
    const days = new Map();
    sales.forEach((sale) => {
      const saleDateValue = sale.saleDate || sale.createdAt;
      if (!saleDateValue || new Date(saleDateValue).toISOString().slice(0, 7) !== month) return;
      const day = new Date(saleDateValue).getUTCDate();
      days.set(day, [...(days.get(day) || []), sale]);
    });
    return days;
  }, [sales, month]);
  useEffect(() => setSelectedDay(null), [month]);
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const activeDay = selectedDay ?? (saleDays.size ? Math.min(...saleDays.keys()) : month === monthNow() ? new Date().getUTCDate() : null);
  const daySales = activeDay ? saleDays.get(activeDay) || [] : [];
  const dayUnits = daySales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity - item.returnedQuantity) * Number(item.packSize || 1), 0), 0);
  const dayRevenue = daySales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.sellingPrice * (item.quantity - item.returnedQuantity), 0), 0);

  return <>
    <PageHeading eyebrow="SALES ACTIVITY" title="Sales calendar" description="See which products sold on each day. Select a date to view order details." actions={<div className="calendar-month-switch"><button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><strong>{monthLabel(month)}</strong><button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></div>} />
    <div className="sales-calendar-layout">
      <section className="panel sales-calendar-panel">
        {loading ? <Loading /> : <>
          <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name) => <span key={name}>{name}</span>)}</div>
          <div className="calendar-grid">{calendarCells.map((day, index) => {
            const daySalesList = day ? saleDays.get(day) || [] : [];
            const productsOnDay = daySalesList.flatMap((sale) => sale.items.filter((item) => item.quantity > item.returnedQuantity).map((item) => item.name));
            const units = daySalesList.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity - item.returnedQuantity) * Number(item.packSize || 1), 0), 0);
            return <button key={`${day || 'blank'}-${index}`} className={`calendar-day ${day ? '' : 'empty'} ${day === activeDay ? 'selected' : ''} ${daySalesList.length ? 'has-sales' : ''}`} disabled={!day} onClick={() => setSelectedDay(day)} aria-label={day ? `${monthLabel(month)} ${day}: ${daySalesList.length} sales, ${units} units` : undefined}>
              {day && <><span className="calendar-day-number">{day}</span>{daySalesList.length > 0 && <><span className="calendar-day-count">{daySalesList.length} {daySalesList.length === 1 ? 'sale' : 'sales'} · {units} units</span><span className="calendar-day-products">{productsOnDay.slice(0, 2).join(', ')}{productsOnDay.length > 2 ? ` +${productsOnDay.length - 2}` : ''}</span></>}</>}
            </button>;
          })}</div>
          {!saleDays.size && <div className="calendar-empty-note">No sales recorded in {monthLabel(month)}.</div>}
        </>}
      </section>
      <aside className="panel calendar-detail-panel">
        <div className="calendar-detail-heading"><div><span className="eyebrow">DAY DETAILS</span><h2>{activeDay ? new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, activeDay))) : 'Select a day'}</h2></div></div>
        {activeDay ? <><div className="calendar-day-summary"><div><span>Orders</span><strong>{daySales.length}</strong></div><div><span>Net units</span><strong>{dayUnits}</strong></div><div><span>Sales total</span><strong>{money(dayRevenue)}</strong></div></div>{daySales.length ? <div className="calendar-order-list">{daySales.map((sale) => <article className="calendar-order" key={sale._id}><div className="calendar-order-title"><strong>{sale.platform || 'Marketplace not recorded'} · {sale.saleNumber}</strong><span>{dateLabel(sale.saleDate || sale.createdAt)}</span></div>{sale.items.map((item) => <div className="calendar-product-line" key={`${sale._id}-${item.product}`}><span>{item.name}</span><strong>{item.quantity - item.returnedQuantity} pack(s) · {(item.quantity - item.returnedQuantity) * Number(item.packSize || 1)} units{item.returnedQuantity ? ` · ${item.returnedQuantity} pack(s) returned` : ''}</strong></div>)}</article>)}</div> : <p className="calendar-no-sales">No products sold on this day.</p>}</> : <p className="calendar-no-sales">Choose a date on the calendar to see its sales.</p>}
      </aside>
    </div>
  </>;
}

function Reports({ report, month, changeMonth, onExport, onDeleteItem, loading }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  useEffect(() => { setFromDate(''); setToDate(''); }, [month]);
  const [year, monthNumber] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const allRows = report?.rows || [];
  const dateRangeValid = !(fromDate && toDate && fromDate > toDate);
  const rows = allRows.filter((row) => {
    const day = new Date(row.date).toISOString().slice(0, 10);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  const t = rows.reduce((sum, row) => ({
    units: sum.units + Number(row.netQuantity || 0),
    returnedUnits: sum.returnedUnits + Number(row.returnedQuantity || 0),
    revenue: sum.revenue + Number(row.totalPrice || 0),
    cost: sum.cost + Number(row.overallCost || 0),
    delivery: sum.delivery + Number(row.deliveryFee || 0),
    commission: sum.commission + Number(row.commission || 0),
    packaging: sum.packaging + Number(row.packagingCost || 0),
    additionalCost: sum.additionalCost + Number(row.additionalCost || 0),
    returnShipping: sum.returnShipping + Number(row.returnShippingCost || 0),
    gst: sum.gst + Number(row.gstAmount || 0),
    desiredProfit: sum.desiredProfit + Number(row.desiredProfit || 0),
    profit: sum.profit + Number(row.profit || 0),
  }), { units: 0, returnedUnits: 0, revenue: 0, cost: 0, delivery: 0, commission: 0, packaging: 0, additionalCost: 0, returnShipping: 0, gst: 0, desiredProfit: 0, profit: 0 });
  const dailyMap = new Map();
  rows.forEach((row) => {
    const day = new Date(row.date).getUTCDate();
    const value = dailyMap.get(day) || { day, revenue: 0, profit: 0 };
    value.revenue += Number(row.totalPrice || 0);
    value.profit += Number(row.profit || 0);
    dailyMap.set(day, value);
  });
  const daily = [...dailyMap.values()].sort((a, b) => a.day - b.day);
  const rangeLabel = fromDate || toDate ? `${fromDate || `${monthStart}`} – ${toDate || `${monthEnd}`}` : monthLabel(month);
  const downloadLabel = fromDate || toDate ? 'Export date range' : 'Export month';

  return <>
    <PageHeading eyebrow="ANALYTICS" title="Profit reports" description="Review monthly profit or download sales for specific dates." />
    <div className="report-month panel"><div className="report-month-icon"><CalendarDays size={18} /></div><div className="report-month-copy"><span>REPORTING PERIOD</span><strong>{monthLabel(month)}</strong></div><div className="report-month-switch"><button onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={17} /></button><button className="current-month" onClick={() => changeMonth(-1)}><ArrowLeft size={14} /> Previous</button><button className="current-month selected-month">Current period</button><button onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={17} /></button></div></div>
    <div className="report-download-panel panel"><div className="report-download-copy"><strong>Download sales CSV</strong><span>Choose dates to export a day or date range; leave them blank for the full month.</span></div><label><span>From date</span><input type="date" min={monthStart} max={monthEnd} value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label><span>To date</span><input type="date" min={monthStart} max={monthEnd} value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>{(fromDate || toDate) && <button className="button secondary report-clear-dates" onClick={() => { setFromDate(''); setToDate(''); }}>Clear dates</button>}<button className="button primary report-export-button" onClick={() => onExport(rows, { fromDate, toDate })} disabled={!rows.length || !dateRangeValid}><Download size={15} /> {downloadLabel}</button>{!dateRangeValid && <small className="report-date-error">From date must be before To date.</small>}</div>
    <div className="report-metrics"><MetricCard label="Sales revenue" value={money(t.revenue)} note={`${t.units} net units sold`} icon={ShoppingBag} tone="blue" /><MetricCard label="Product cost" value={money(t.cost)} note="cost of goods sold" icon={Package} tone="violet" /><MetricCard label="Fees & tax" value={money(t.delivery + t.commission + t.packaging + t.additionalCost + t.returnShipping + t.gst)} note="GST, fees, other spend & returns" icon={Truck} tone="orange" /><MetricCard label="Net profit" value={money(t.profit)} note="after all costs and taxes" icon={TrendingUp} tone="green" /></div>
    <div className="report-chart-panel panel"><div className="panel-heading"><div><h2>Daily performance</h2><p>Revenue and net profit by day · {rangeLabel}</p></div><div className="chart-legend report-legend"><i /> Revenue <i className="legend-profit" /> Profit</div></div><ReportChart daily={daily} /></div>
    <section className="panel table-panel report-table"><div className="table-toolbar"><div><h2>Sales detail <span className="count-badge">{rows.length}</span></h2><p>Rows and totals reflect the selected month and date filters.</p></div><div className="report-total"><span>{fromDate || toDate ? 'RANGE PROFIT' : 'MONTH PROFIT'}</span><strong>{money(t.profit)}</strong></div></div>{loading ? <Loading /> : rows.length ? <div className="table-scroll"><table><thead><tr><th>SL NO / DATE</th><th>PRODUCT NAME</th><th>QTY (PACKS)</th><th>BP / PACK</th><th>TOTAL PRICE</th><th>OVERALL COST</th><th>DELIVERY FEE</th><th>COMMISSION</th><th>PACKAGING</th><th>OTHER SPEND</th><th>RETURN SHIPPING</th><th>SP / PACK</th><th>GST AMOUNT</th><th>DESIRED PROFIT</th><th>ACTUAL PROFIT</th><th>SKU</th><th>HSN</th><th>ACTION</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.id}><td><span className="report-sl">{String(i + 1).padStart(2, '0')}</span><span className="report-date">{dateLabel(row.date)}</span>{row.returnedQuantity > 0 && <small className="return-note">{row.returnedQuantity} pack(s) returned</small>}</td><td><div className="report-product"><strong>{row.name}</strong><span>{row.saleNumber} · {row.platform || 'Marketplace not recorded'}</span></div></td><td>{row.netQuantity}<small>{row.packSize} unit(s) per pack</small></td><td>{money(row.buyPrice)}</td><td className="strong-cell">{money(row.totalPrice)}</td><td>{money(row.overallCost)}</td><td>{money(row.deliveryFee)}</td><td>{money(row.commission)}</td><td>{money(row.packagingCost)}</td><td>{money(row.additionalCost)}</td><td>{money(row.returnShippingCost)}</td><td>{row.netQuantity ? money(row.totalPrice / row.netQuantity) : '—'}</td><td>{money(row.gstAmount)}</td><td>{money(row.desiredProfit)}</td><td className={row.profit >= 0 ? 'profit-text' : 'negative-text'}>{money(row.profit)}</td><td>{row.sku}</td><td>{row.hsn || '—'}</td><td><button className="report-delete-button" type="button" aria-label={`Delete ${row.name} from sales report`} title="Delete from sales report" onClick={() => onDeleteItem(row)}><Trash2 size={14} /></button></td></tr>)}</tbody><tfoot><tr><td colSpan="2">TOTAL · {t.units} NET UNITS</td><td>{rows.reduce((sum, row) => sum + row.netQuantity, 0)}</td><td>—</td><td>{money(t.revenue)}</td><td>{money(t.cost)}</td><td>{money(t.delivery)}</td><td>{money(t.commission)}</td><td>{money(t.packaging)}</td><td>{money(t.additionalCost)}</td><td>{money(t.returnShipping)}</td><td>—</td><td>{money(t.gst)}</td><td>{money(t.desiredProfit)}</td><td className="profit-text">{money(t.profit)}</td><td colSpan="3">{t.returnedUnits} returned</td></tr></tfoot></table></div> : <Empty title={fromDate || toDate ? 'No sales on those dates' : 'No sales in this period'} copy={fromDate || toDate ? 'Choose a different date or clear the date filters.' : 'Try another month, or record a sale to start your report.'} action={fromDate || toDate ? 'Clear dates' : 'Record a sale in Sales'} onClick={() => { setFromDate(''); setToDate(''); }} />}</section>
    <div className="report-footnote"><Check size={14} /> Historical reports use the buy price and selling price per pack captured when each sale was recorded. Product edits will not change past reports.</div>
  </>;
}
function ReportChart({ daily }) {
  const max = Math.max(...daily.map((d) => d.revenue), 1); const byDay = new Map(daily.map((d) => [d.day, d]));
  return <div className="report-chart"><div className="report-yaxis"><span>{money(max)}</span><span>{money(max * .66)}</span><span>{money(max * .33)}</span><span>₹0</span></div><div className="report-chart-main"><div className="report-grid-lines"><i /><i /><i /><i /></div><div className="report-bars">{Array.from({ length: 31 }, (_, i) => { const d = byDay.get(i + 1); return <div className="report-bar-slot" key={i}><div className="report-bar-group"><div className="report-bar revenue-bar" style={{ height: `${Math.max(d?.revenue ? 2 : 0, (d?.revenue || 0) / max * 100)}%` }} /><div className="report-bar profit-bar" style={{ height: `${Math.max(d?.profit ? 2 : 0, (d?.profit || 0) / max * 100)}%` }} /></div></div>; })}</div><div className="report-xaxis"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>31</span></div></div></div>;
}

function SaleListRow({ sale }) { const total = sale.items.reduce((sum, item) => sum + item.sellingPrice * (item.quantity - item.returnedQuantity), 0); return <div className="recent-row"><div className="recent-product-icon"><ShoppingBag size={16} /></div><div className="recent-copy"><strong>{sale.platform || 'Marketplace not recorded'}</strong><span>{sale.saleNumber} · {sale.items.reduce((n, i) => n + (i.quantity - i.returnedQuantity) * Number(i.packSize || 1), 0)} individual units</span></div><div className="recent-trailing"><strong>{money(total)}</strong><span>{dateLabel(sale.saleDate || sale.createdAt)}</span></div></div>; }
function ProductVisual({ product, index = 0, onPreview }) {
  const className = `product-thumb thumb-${index % 5} product-visual`;
  return product.image
    ? <button type="button" className={className} aria-label={`Preview photo of ${product.name}`} title="View product photo" onClick={() => onPreview?.(product)}><img src={product.image} alt={`${product.name} product`} loading="lazy" /></button>
    : <div className={className}><Package size={17} /></div>;
}
function ProductImagePreview({ product, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="product-image-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="product-image-dialog" role="dialog" aria-modal="true" aria-label={`${product.name} product photo`}><button type="button" className="product-image-close" aria-label="Close image preview" onClick={onClose}><X size={20} /></button><img src={product.image} alt={`${product.name} product`} /><div className="product-image-caption"><strong>{product.name}</strong><span>{product.sku} · Pack {Number(product.packSize || 1)}</span></div></div></div>;
}
function StockBadge({ quantity, packSize = 1 }) { const type = quantity === 0 ? 'out' : quantity <= 5 ? 'low' : 'in'; const packs = Math.floor(quantity / Number(packSize || 1)); const text = quantity === 0 ? 'Out of stock' : `${quantity} units · ${packs} packs`; return <span className={`stock-badge ${type}`}><i />{text}</span>; }
function Loading() { return <div className="loading-state"><LoaderCircle size={19} className="spinning" /> Loading your workspace…</div>; }
function Empty({ title, copy, action, onClick }) { return <div className="empty-state"><div className="empty-icon"><Package size={21} /></div><strong>{title}</strong><p>{copy}</p>{action && <button className="button secondary" onClick={onClick}>{action}</button>}</div>; }

function Modal({ modal, products, customers = [], busy, error, close, onProduct, onSale, onEditSale, onReturn }) {
  const isVariant = modal.type === 'variant'; const isProduct = modal.type === 'product' || isVariant; const isSale = modal.type === 'sale'; const isEditSale = modal.type === 'editSale';
  const [form, setForm] = useState(modal.product ? {
    ...modal.product,
    ...(isVariant ? {
      _id: undefined, stockGroupId: stockGroupKey(modal.product), sku: modal.variantSku,
      quantity: modal.product.quantity, packSize: 1, buyPrice: '', sellingPrice: '', desiredProfit: '', mrp: '',
    } : {
      stockGroupId: modal.product.stockGroupId && String(modal.product.stockGroupId) !== String(modal.product._id) ? String(modal.product.stockGroupId) : '',
    }),
    packSize: isVariant ? 1 : modal.product.packSize ?? 1,
    desiredProfit: isVariant ? '' : modal.product.desiredProfit ?? 0,
    commissionRate: modal.product.commissionRate ?? 15,
    gstRate: modal.product.gstRate ?? 0,
    packagingCost: modal.product.packagingCost ?? 0,
    additionalCost: modal.product.additionalCost ?? 0,
    customerReturnRate: modal.product.customerReturnRate ?? 0,
    goodReturnRate: Number(modal.product.goodReturnRate || 0) + Number(modal.product.damagedReturnRate || 0) === 0 ? 100 : modal.product.goodReturnRate,
    damagedReturnRate: modal.product.damagedReturnRate ?? 0,
    returnShippingCost: modal.product.returnShippingCost ?? 0,
  } : { name: '', sku: '', hsn: '', category: '', quantity: '', packSize: 1, buyPrice: '', sellingPrice: '', desiredProfit: '', deliveryFee: '', commissionRate: 15, gstRate: '', packagingCost: '', additionalCost: '', customerReturnRate: '', goodReturnRate: 100, damagedReturnRate: '', returnShippingCost: '', image: '' });
  const [cart, setCart] = useState(() => modal.type === 'editSale' ? modal.sale.items.map((item, index) => ({ productId: item.product, quantity: item.quantity, returnedQuantity: item.returnedQuantity, sourceIndex: index })) : [{ productId: '', quantity: 1 }]); const [returnQty, setReturnQty] = useState(1); const [saleDate, setSaleDate] = useState(() => dateInputValue(modal.sale?.saleDate || modal.sale?.createdAt)); const [salePlatform, setSalePlatform] = useState(modal.sale?.platform || ''); const [saleCustomer, setSaleCustomer] = useState(modal.sale?.customer ? String(modal.sale.customer) : '');
  const [imageError, setImageError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    try { set('image', await optimizeProductImage(file)); }
    catch (err) { setImageError(err.message); }
  };
  const product = modal.product;
  const stockGroupId = String(form.stockGroupId || '');
  const selectedStockOwner = stockGroupId ? products.find((item) => String(item._id) === stockGroupId) || products.find((item) => stockGroupKey(item) === stockGroupId) : null;
  const isSharedVariant = isVariant || Boolean(product && stockGroupId && stockGroupId !== String(product._id));
  const returnAvailable = modal.type === 'return' && modal.item
    ? modal.item.quantity - modal.item.returnedQuantity
    : 0;
  const suggestedPrice = suggestedSellingPrice(form);
  const selectedLines = cart.map((line) => ({ ...line, product: products.find((p) => p._id === line.productId) }));
  
  const saleTotal = selectedLines.reduce((sum, line) => sum + (line.product?.sellingPrice || 0) * (Number(line.quantity) || 0), 0);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><div className="modal-card"><div className="modal-heading"><div><span className="eyebrow">{isProduct ? 'PRODUCT CATALOGUE' : isSale || isEditSale ? 'ORDER MANAGEMENT' : 'PROCESS RETURN'}</span><h2>{isVariant ? 'Add a variant' : isProduct ? product ? 'Edit product' : 'Add a product' : isEditSale ? 'Edit sale' : isSale ? 'Record a sale' : 'Return items'}</h2><p>{isVariant ? 'Add another pack size. Stock is shared automatically with the main product.' : isProduct ? 'Keep your costs, prices, and stock up to date.' : isEditSale ? 'Update the marketplace or date for this order.' : isSale ? 'Stock is reduced automatically when you record an order.' : 'Returned units are added back to available stock.'}</p></div><button className="modal-close" onClick={close}><X size={18} /></button></div>{error && <div className="modal-error">{error}</div>}
    {isProduct && <form onSubmit={(e) => { e.preventDefault(); onProduct({ ...form, buyPrice: Number(form.buyPrice), sellingPrice: Number(form.sellingPrice), mrp: Number(form.mrp || 0), stockGroupId: form.stockGroupId || null, quantity: Number(selectedStockOwner?.quantity ?? form.quantity), packSize: Number(form.packSize || 1), deliveryFee: Number(form.deliveryFee || 0), desiredProfit: Number(form.desiredProfit || 0), commissionRate: Number(form.commissionRate ?? 15), gstRate: Number(form.gstRate || 0), packagingCost: Number(form.packagingCost || 0), additionalCost: Number(form.additionalCost || 0), customerReturnRate: Number(form.customerReturnRate || 0), goodReturnRate: Number(form.goodReturnRate || 0), damagedReturnRate: Number(form.damagedReturnRate || 0), returnShippingCost: Number(form.returnShippingCost || 0) }); }}><div className="form-grid"><label className="field full-field"><span>Product name <b>*</b></span><input autoFocus required placeholder="e.g. Everyday cotton tote" value={form.name} onChange={(e) => set('name', e.target.value)} /></label><label className="field"><span>SKU <b>*</b></span><input required placeholder="e.g. TOTE-001" value={form.sku} onChange={(e) => set('sku', e.target.value)} /></label><label className="field"><span>HSN code</span><input placeholder="e.g. 4202" value={form.hsn || ''} onChange={(e) => set('hsn', e.target.value)} /></label><label className="field"><span>Category</span><input placeholder="e.g. Accessories" value={form.category || ''} onChange={(e) => set('category', e.target.value)} /></label>{isSharedVariant && <div className="field full-field"><strong>Variant stock</strong><small>Shared with {selectedStockOwner?.name || product?.name}. Changes to stock apply to all variants.</small></div>}<label className="field"><span>Available quantity (individual units) <b>*</b></span><input type="number" min="0" step="1" required disabled={Boolean(selectedStockOwner)} value={selectedStockOwner ? selectedStockOwner.quantity : form.quantity} onChange={(e) => set('quantity', e.target.value)} />{selectedStockOwner && <small>Shared stock from {selectedStockOwner.name}.</small>}</label><label className="field"><span>Pack size</span><select value={form.packSize || 1} onChange={(e) => set('packSize', Number(e.target.value))}><option value="1">Pack 1</option><option value="2">Pack 2</option><option value="3">Pack 3</option><option value="4">Pack 4</option></select><small>Selling one pack deducts {Number(form.packSize || 1)} individual unit(s) from stock.</small></label><div className="field full-field image-field"><span>Product image <small>optional · JPG, PNG or WebP up to 5 MB</small></span><div className="image-uploader"><div className="image-preview">{form.image ? <img src={form.image} alt="Product preview" /> : <Package size={23} />}</div><div className="image-uploader-copy"><strong>Add a product photo</strong><small>Images are resized before saving.</small><label className="button secondary image-upload-button"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /><Plus size={14} />{form.image ? 'Change photo' : 'Upload photo'}</label></div>{form.image && <button type="button" className="remove-image-button" onClick={() => set('image', '')}>Remove</button>}</div>{imageError && <small className="image-error">{imageError}</small>}</div><div className="form-divider full-field">PRICING & FULFILMENT · PACK {Number(form.packSize || 1)} LISTING</div><label className="field"><span>Buy price (BP) <small>for Pack {Number(form.packSize || 1)}</small> <b>*</b></span><div className="input-prefix"><i>₹</i><input type="number" min="0" step="0.01" required placeholder="0.00" value={form.buyPrice} onChange={(e) => set('buyPrice', e.target.value)} /></div></label><label className="field"><span>MRP <small>for Pack {Number(form.packSize || 1)} · printed on bill</small></span><div className="input-prefix"><i>₹</i><input type="number" min="0" step="0.01" placeholder="0.00" value={form.mrp ?? ''} onChange={(e) => set('mrp', e.target.value)} /></div></label><label className="field"><span>Selling price (SP) <small>for Pack {Number(form.packSize || 1)}</small> <b>*</b></span><div className="input-prefix"><i>₹</i><input type="number" min="0" step="0.01" required placeholder="0.00" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} /></div></label><label className="field"><span>Desired profit <small>₹ per kept pack</small></span><input type="number" min="0" step="0.01" value={form.desiredProfit} onChange={(e) => set('desiredProfit', e.target.value)} /></label><label className="field"><span>Delivery fee <small>per shipped pack</small></span><div className="input-prefix"><i>₹</i><input type="number" min="0" step="0.01" placeholder="0.00" value={form.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} /></div></label><div className="form-divider full-field">MARKETPLACE & RETURNS</div><label className="field"><span>Commission <small>%</small></span><input type="number" min="0" max="100" step="0.01" value={form.commissionRate ?? 15} onChange={(e) => set('commissionRate', e.target.value)} /></label><label className="field"><span>GST rate <small>%</small></span><input type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)} /></label><label className="field"><span>Packaging cost <small>₹ / pack</small></span><input type="number" min="0" step="0.01" value={form.packagingCost} onChange={(e) => set('packagingCost', e.target.value)} /></label><label className="field"><span>Additional spend <small>₹ / pack</small></span><input type="number" min="0" step="0.01" value={form.additionalCost} onChange={(e) => set('additionalCost', e.target.value)} /></label><label className="field"><span>Customer return rate <small>% of shipped orders</small></span><input type="number" min="0" max="100" step="0.01" value={form.customerReturnRate} onChange={(e) => set('customerReturnRate', e.target.value)} /></label><label className="field"><span>Good returns <small>% of returns</small></span><input type="number" min="0" max="100" step="0.01" value={form.goodReturnRate} onChange={(e) => set('goodReturnRate', e.target.value)} /></label><label className="field"><span>Damaged returns <small>% of returns</small></span><input type="number" min="0" max="100" step="0.01" value={form.damagedReturnRate} onChange={(e) => set('damagedReturnRate', e.target.value)} /></label><label className="field"><span>Return shipping cost <small>₹ / returned pack</small></span><input type="number" min="0" step="0.01" value={form.returnShippingCost} onChange={(e) => set('returnShippingCost', e.target.value)} /></label><p className="form-note full-field">Customer return rate is a share of shipped orders; good and damaged rates split returned orders. Selling price is treated as GST-inclusive.</p></div><div className="profit-preview"><div><TrendingUp size={16} /><span>Expected profit per shipped pack</span></div><strong>{money(productUnitProfit(form))}</strong></div><div className="suggested-price-card"><div className="suggested-price-head"><div><span>CALCULATED SELLING PRICE</span><small>Includes commission, GST, delivery, packaging, additional spend and expected returns</small></div><strong>{suggestedPrice === null ? 'Not calculable' : money(suggestedPrice)}</strong></div><p>Desired profit is per sale kept by the customer. Return rates estimate refunds; good and damaged percentages split those returns.</p><button type="button" className="button secondary" disabled={suggestedPrice === null} onClick={() => set('sellingPrice', suggestedPrice.toFixed(2))}>Use suggested selling price <ArrowRight size={14} /></button></div><ModalFooter busy={busy} close={close} submit={isVariant ? 'Add variant' : product ? 'Save changes' : 'Add product'} /></form>}
    {isEditSale && <form onSubmit={(e) => { e.preventDefault(); onEditSale({ saleId: modal.sale._id, platform: salePlatform, customer: saleCustomer || null, saleDate, items: cart.map(({ productId, quantity, sourceIndex }) => ({ productId, quantity: Number(quantity), sourceIndex })) }); }}><div className="sale-meta-grid"><label className="field"><span>Sale date <b>*</b></span><input type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></label><label className="field"><span>Marketplace <b>*</b></span><select required value={salePlatform} onChange={(e) => setSalePlatform(e.target.value)}><option value="">Select marketplace</option><option value="Flipkart">Flipkart</option><option value="Amazon">Amazon</option><option value="Meesho">Meesho</option><option value="Other">Other</option></select></label><label className="field"><span>Customer <small>for GST bill</small></span><select value={saleCustomer} onChange={(e) => setSaleCustomer(e.target.value)}><option value="">None (marketplace order)</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.gstin ? ` · ${c.gstin}` : ''}</option>)}</select></label></div><div className="cart-heading"><span>PRODUCTS IN THIS SALE</span><button type="button" className="small-add" onClick={() => setCart([...cart, { productId: '', quantity: 1, sourceIndex: null }])}><Plus size={14} /> Add item</button></div><div className="cart-lines">{cart.map((line, index) => { const item = products.find((p) => p._id === line.productId); const original = Number.isInteger(line.sourceIndex) ? modal.sale.items[line.sourceIndex] : null; const minQuantity = Math.max(1, Number(line.returnedQuantity) || 0); const sameOriginalProduct = original && String(original.product) === String(line.productId); const editPackSize = Number(sameOriginalProduct ? original.packSize || 1 : item?.packSize || 1); const maxQuantity = item ? Math.floor((item.quantity + (sameOriginalProduct ? (original.quantity - original.returnedQuantity) * Number(original.packSize || 1) : 0)) / editPackSize) : undefined; return <div className="cart-line" key={index}><select required disabled={Boolean(line.returnedQuantity)} value={line.productId} onChange={(e) => setCart(cart.map((x, i) => i === index ? { ...x, productId: e.target.value } : x))}><option value="">Select a product…</option>{original && !item && <option value={line.productId}>{original.name} (not in inventory)</option>}{products.map((p) => <option key={p._id} value={p._id} disabled={Math.floor(p.quantity / Number(p.packSize || 1)) <= 0 && p._id !== line.productId}>{p.name} · {Math.floor(p.quantity / Number(p.packSize || 1))} packs · {p.quantity} units · Pack {Number(p.packSize || 1)} · {money(p.sellingPrice)} / pack{Math.floor(p.quantity / Number(p.packSize || 1)) <= 0 ? ' · Out of stock' : ''}</option>)}</select><div className="quantity-input"><button type="button" disabled={Number(line.quantity) <= minQuantity} onClick={() => setCart(cart.map((x, i) => i === index ? { ...x, quantity: Math.max(minQuantity, Number(x.quantity) - 1) } : x))}>−</button><input aria-label="Quantity" type="number" min={minQuantity} max={maxQuantity} value={line.quantity} onChange={(e) => setCart(cart.map((x, i) => i === index ? { ...x, quantity: e.target.value } : x))} /><button type="button" onClick={() => setCart(cart.map((x, i) => i === index ? { ...x, quantity: Number(x.quantity) + 1 } : x))}>+</button></div><strong>{money((item?.sellingPrice || 0) * (Number(line.quantity) || 0))}</strong>{cart.length > 1 && !line.returnedQuantity && <button type="button" className="remove-line" aria-label="Remove item" onClick={() => setCart(cart.filter((_, i) => i !== index))}><X size={15} /></button>}</div>; })}</div><div className="sale-edit-items"><span>Returned quantities are locked to keep return records accurate.</span></div><ModalFooter busy={busy} close={close} submit="Save changes" /></form>}
    {isSale && <form onSubmit={(e) => { e.preventDefault(); onSale({ platform: salePlatform, customer: saleCustomer || null, saleDate, items: cart.map(({ productId, quantity }) => ({ productId, quantity: Number(quantity) })) }); }}><div className="sale-meta-grid"><label className="field"><span>Sale date <b>*</b></span><input type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></label><label className="field"><span>Marketplace <b>*</b></span><select required value={salePlatform} onChange={(e) => setSalePlatform(e.target.value)}><option value="">Select marketplace</option><option value="Flipkart">Flipkart</option><option value="Amazon">Amazon</option><option value="Meesho">Meesho</option><option value="Other">Other</option></select></label><label className="field"><span>Customer <small>for GST bill</small></span><select value={saleCustomer} onChange={(e) => setSaleCustomer(e.target.value)}><option value="">None (marketplace order)</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.gstin ? ` · ${c.gstin}` : ''}</option>)}</select></label></div><div className="cart-heading"><span>PRODUCTS IN THIS SALE</span><button type="button" className="small-add" onClick={() => setCart([...cart, { productId: '', quantity: 1 }])}><Plus size={14} /> Add item</button></div><div className="cart-lines">{cart.map((line, index) => { const item = products.find((p) => p._id === line.productId); return <div className="cart-line" key={index}><select required value={line.productId} onChange={(e) => setCart(cart.map((x, i) => i === index ? { ...x, productId: e.target.value } : x))}><option value="">Select a product…</option>{products.map((p) => <option key={p._id} value={p._id} disabled={Math.floor(p.quantity / Number(p.packSize || 1)) <= 0}>{p.name} · {Math.floor(p.quantity / Number(p.packSize || 1))} packs · {p.quantity} units · Pack {Number(p.packSize || 1)} · {money(p.sellingPrice)} / pack{Math.floor(p.quantity / Number(p.packSize || 1)) <= 0 ? ' · Out of stock' : ''}</option>)}</select><div className="quantity-input"><button type="button" onClick={() => setCart(cart.map((x, i) => i === index ? { ...x, quantity: Math.max(1, Number(x.quantity) - 1) } : x))}>−</button><input aria-label="Quantity" type="number" min="1" max={item ? Math.floor(item.quantity / Number(item.packSize || 1)) : undefined} value={line.quantity} onChange={(e) => setCart(cart.map((x, i) => i === index ? { ...x, quantity: e.target.value } : x))} /><button type="button" onClick={() => setCart(cart.map((x, i) => i === index ? { ...x, quantity: Number(x.quantity) + 1 } : x))}>+</button></div><strong>{money((item?.sellingPrice || 0) * (Number(line.quantity) || 0))}</strong>{cart.length > 1 && <button type="button" className="remove-line" onClick={() => setCart(cart.filter((_, i) => i !== index))}><X size={15} /></button>}</div>; })}{!products.some((p) => Math.floor(p.quantity / Number(p.packSize || 1)) > 0) && <p className="no-stock-note">Add products with available stock before recording a sale.</p>}</div><div className="sale-summary"><span>Order total</span><strong>{money(saleTotal)}</strong></div><p className="modal-hint">The sale saves today’s product cost and selling price for your monthly report.</p><ModalFooter busy={busy} close={close} submit="Record sale" /></form>}
    {!isProduct && !isSale && !isEditSale && <form onSubmit={(e) => { e.preventDefault(); onReturn({ saleId: modal.sale._id, productId: modal.item.product, quantity: Number(returnQty) }); }}><div className="return-product"><div className="product-thumb thumb-2"><Package size={18} /></div><div><strong>{modal.item.name}</strong><span>{modal.sale.saleNumber} · {returnAvailable} pack(s) available to return</span></div></div><div className="return-math"><div><span>Original sale price</span><strong>{money(modal.item.sellingPrice)}</strong></div><div><span>Product cost restored</span><strong>{money(modal.item.buyPrice)}</strong></div></div><label className="field full-field"><span>Number of packs to return <b>*</b></span><div className="quantity-stepper"><button type="button" onClick={() => setReturnQty(Math.max(1, Number(returnQty) - 1))}>−</button><input type="number" min="1" max={returnAvailable} value={returnQty} onChange={(e) => setReturnQty(e.target.value)} required /><button type="button" onClick={() => setReturnQty(Math.min(returnAvailable, Number(returnQty) + 1))}>+</button></div></label><div className="return-note-box"><Undo2 size={16} /><span><strong>{Number(returnQty) || 0} pack(s) ({(Number(returnQty) || 0) * Number(modal.item.packSize || 1)} units) will be returned to stock.</strong><small>Monthly profit is recalculated using net units sold.</small></span></div><ModalFooter busy={busy} close={close} submit="Process return" /></form>}
  </div></div>;
}

function ModalFooter({ busy, close, submit }) { return <div className="modal-footer"><button type="button" className="button secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? <><LoaderCircle size={15} className="spinning" /> Saving…</> : <>{submit} <ArrowRight size={15} /></>}</button></div>; }

function ConfirmationDialog({ dialog, busy, onCancel, onConfirm }) {
  return <div className="modal-backdrop confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="modal-card confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
      <div className="confirmation-icon"><Trash2 size={18} /></div>
      <div className="confirmation-copy"><span className="eyebrow">CONFIRM ACTION</span><h2 id="confirmation-title">{dialog.title}</h2><p id="confirmation-message">{dialog.message}</p></div>
      <div className="confirmation-actions"><button className="button secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="confirmation-delete-button" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : dialog.confirmLabel}</button></div>
    </section>
  </div>;
}

export default App;
