import { useEffect, useState } from 'react';
import { ArrowRight, FileText, LoaderCircle, Pencil, Plus, Printer, Search, Settings2, Trash2, X } from 'lucide-react';
import logoUrl from './assets/logobr.png';
import { dateLabel, money } from './shared.js';
import './invoice.css';

export const INDIAN_STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
];
const stateLabel = (name) => { const match = INDIAN_STATES.find(([, label]) => label === name); return match ? `${match[1]} (${match[0]})` : name || '—'; };
const stateFromGstin = (gstin) => INDIAN_STATES.find(([code]) => code === String(gstin || '').slice(0, 2))?.[1] || '';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const belowHundred = (n) => n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
const belowThousand = (n) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${belowHundred(n % 100)}`;
// Indian numbering: crore, lakh, thousand.
export const amountInWords = (amount) => {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const parts = [];
  [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1000, 'Thousand']].forEach(([size, label]) => {
    if (n >= size) { parts.push(`${belowThousand(Math.floor(n / size))} ${label}`); n %= size; }
  });
  if (n) parts.push(belowThousand(n));
  return `Rupees ${parts.join(' ')} Only`;
};
const localDate = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };

function ModalShell({ eyebrow, title, description, error, close, children }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><div className="modal-card"><div className="modal-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button className="modal-close" onClick={close}><X size={18} /></button></div>{error && <div className="modal-error">{error}</div>}{children}</div></div>;
}
function Footer({ busy, close, submit }) {
  return <div className="modal-footer"><button type="button" className="button secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? <><LoaderCircle size={15} className="spinning" /> Saving…</> : <>{submit} <ArrowRight size={15} /></>}</button></div>;
}
function StateSelect({ value, onChange, required }) {
  return <select value={value} required={required} onChange={(e) => onChange(e.target.value)}><option value="">Choose state</option>{INDIAN_STATES.map(([code, name]) => <option key={code} value={name}>{name} ({code})</option>)}</select>;
}

export function SettingsForm({ settings, busy, error, onSave, close }) {
  const [form, setForm] = useState(() => ({ ...settings }));
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <ModalShell eyebrow="GST BILLING" title="Business settings" description="These details are printed on every new GST invoice." error={error} close={close}>
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, logo: undefined, gstin: (form.gstin || '').trim().toUpperCase() }); }}>
      <div className="form-grid">
        <label className="field"><span>Business name <b>*</b></span><input required value={form.businessName} onChange={(e) => set('businessName', e.target.value)} /></label>
        <label className="field"><span>GSTIN</span><input value={form.gstin} maxLength={15} placeholder="15-character GSTIN" onChange={(e) => { const gstin = e.target.value.toUpperCase(); setForm((current) => ({ ...current, gstin, state: current.state || stateFromGstin(gstin) })); }} /></label>
        <label className="field full-field"><span>Registered address <b>*</b></span><textarea required rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
        <label className="field"><span>State <b>*</b></span><StateSelect required value={form.state} onChange={(value) => set('state', value)} /></label>
        <label className="field"><span>Invoice prefix</span><input value={form.invoicePrefix} maxLength={10} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase())} /></label>
        <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="field full-field"><span>Bank / UPI details <small>optional</small></span><textarea rows={2} value={form.bankDetails} onChange={(e) => set('bankDetails', e.target.value)} /></label>
        <label className="field full-field"><span>Terms &amp; conditions</span><textarea rows={2} value={form.terms} onChange={(e) => set('terms', e.target.value)} /></label>
        <p className="form-note full-field">Invoice numbers look like {form.invoicePrefix || 'AE'}/2026-27/0001 and restart each financial year (April).</p>
      </div>
      <Footer busy={busy} close={close} submit="Save settings" />
    </form>
  </ModalShell>;
}

export function InvoiceForm({ sale, products = [], customers = [], settings, busy, error, onCreate, close }) {
  const saved = customers.find((c) => c._id === String(sale.customer));
  const [customer, setCustomer] = useState({ name: saved?.name || '', phone: saved?.phone || '', gstin: saved?.gstin || '', address: saved?.address || '', state: saved?.state || settings?.state || '' });
  const [invoiceDate, setInvoiceDate] = useState(localDate);
  const set = (key, value) => setCustomer((current) => ({ ...current, [key]: value }));
  const lines = sale.items.filter((item) => item.quantity > item.returnedQuantity);
  const total = lines.reduce((sum, item) => sum + item.sellingPrice * (item.quantity - item.returnedQuantity), 0);
  const interState = Boolean(settings?.state && customer.state && settings.state !== customer.state);
  return <ModalShell eyebrow="GST BILLING" title="Create GST invoice" description={`For sale ${sale.saleNumber} · ${lines.length} item(s) · ${money(total)} incl. GST`} error={error} close={close}>
    {!settings?.gstin && <div className="modal-error">Your GSTIN is not set yet. Add it in Business settings so it prints on the bill.</div>}
    <form onSubmit={(e) => { e.preventDefault(); onCreate({ saleId: sale._id, invoiceDate, customer: { ...customer, gstin: customer.gstin.trim().toUpperCase() } }); }}>
      <div className="form-grid">
        <label className="field"><span>Customer name <b>*</b></span><input required value={customer.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Phone</span><input value={customer.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="field"><span>Customer GSTIN <small>for business buyers</small></span><input value={customer.gstin} maxLength={15} onChange={(e) => { const gstin = e.target.value.toUpperCase(); const state = stateFromGstin(gstin); setCustomer((current) => ({ ...current, gstin, state: state || current.state })); }} /></label>
        <label className="field"><span>Invoice date <b>*</b></span><input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
        <label className="field full-field"><span>Billing address</span><textarea rows={2} value={customer.address} onChange={(e) => set('address', e.target.value)} /></label>
        <label className="field"><span>Place of supply <b>*</b></span><StateSelect required value={customer.state} onChange={(value) => set('state', value)} /></label>
        <p className="form-note">{interState ? 'Different state: IGST will be charged.' : 'Same state: GST is split into CGST + SGST.'} Prices are treated as GST-inclusive.</p>
        <div className="full-field invoice-lines"><table><thead><tr><th>Item</th><th>MRP</th><th>Price</th><th>Qty</th><th>GST</th><th>Total</th></tr></thead><tbody>{lines.map((item, index) => {
          const quantity = item.quantity - item.returnedQuantity;
          // Older sales have no MRP saved; the server falls back to the product's current MRP the same way.
          const mrp = Number(item.mrp || products.find((product) => product._id === item.product)?.mrp || item.sellingPrice);
          return <tr key={index}><td><strong>{item.name}</strong><small>SKU {item.sku}</small></td><td>{money(mrp)}</td><td>{money(item.sellingPrice)}</td><td>{quantity}</td><td>{item.gstRate || 0}%</td><td>{money(item.sellingPrice * quantity)}</td></tr>;
        })}</tbody></table></div>
      </div>
      <Footer busy={busy} close={close} submit="Create invoice" />
    </form>
  </ModalShell>;
}

export function CustomerForm({ customer, busy, error, onSave, close }) {
  const [form, setForm] = useState(() => ({ name: '', phone: '', gstin: '', address: '', state: '', ...customer }));
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <ModalShell eyebrow="GST BILLING" title={customer ? 'Edit customer' : 'Add customer'} description={customer ? 'Changes apply to new bills. Bills already made keep the old details.' : 'Pick this customer on a sale to make it ready for a GST bill.'} error={error} close={close}>
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, gstin: form.gstin.trim().toUpperCase() }); }}>
      <div className="form-grid">
        <label className="field"><span>Customer name <b>*</b></span><input required value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="field"><span>GSTIN</span><input value={form.gstin} maxLength={15} onChange={(e) => { const gstin = e.target.value.toUpperCase(); setForm((current) => ({ ...current, gstin, state: stateFromGstin(gstin) || current.state })); }} /></label>
        <label className="field"><span>State <b>*</b></span><StateSelect required value={form.state} onChange={(value) => set('state', value)} /></label>
        <label className="field full-field"><span>Billing address</span><textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
      </div>
      <Footer busy={busy} close={close} submit="Save customer" />
    </form>
  </ModalShell>;
}

export function BillForm({ products = [], customers = [], settings, busy, error, onCreate, close }) {
  const [customerId, setCustomerId] = useState(customers[0]?._id || '');
  const [invoiceDate, setInvoiceDate] = useState(localDate);
  const [lines, setLines] = useState([{ productId: '', quantity: 1, price: '' }]);
  const customer = customers.find((c) => c._id === customerId);
  const setLine = (index, patch) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  const total = lines.reduce((sum, line) => sum + (Number(line.price) || 0) * (Number(line.quantity) || 0), 0);
  const interState = Boolean(settings?.state && customer?.state && settings.state !== customer.state);
  return <ModalShell eyebrow="GST BILLING" title="New bill" description="Choose a customer and products. Prices are GST-inclusive." error={error} close={close}>
    {!customers.length && <div className="modal-error">Add a customer first with the "Add customer" button.</div>}
    <form onSubmit={(e) => { e.preventDefault(); onCreate({ invoiceDate, customer: { name: customer.name, phone: customer.phone, gstin: customer.gstin, address: customer.address, state: customer.state }, items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), price: Number(line.price) })) }); }}>
      <div className="form-grid">
        <label className="field"><span>Customer <b>*</b></span><select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Choose customer</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.gstin ? ` · ${c.gstin}` : ''}</option>)}</select></label>
        <label className="field"><span>Invoice date <b>*</b></span><input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
        {customer && <p className="form-note full-field"><b>{customer.name}</b>{customer.address ? ` · ${customer.address}` : ''}{customer.gstin ? ` · GSTIN ${customer.gstin}` : ''} · {stateLabel(customer.state)} · {interState ? 'IGST' : 'CGST + SGST'}</p>}
        <div className="full-field invoice-lines"><table><thead><tr><th>Product</th><th>HSN</th><th>MRP</th><th>Price</th><th>Qty</th><th>GST</th><th>Total</th><th /></tr></thead><tbody>{lines.map((line, index) => {
          const product = products.find((p) => p._id === line.productId);
          return <tr key={index}>
            <td><select required value={line.productId} onChange={(e) => { const next = products.find((p) => p._id === e.target.value); setLine(index, { productId: e.target.value, price: next ? next.sellingPrice : '' }); }}><option value="">Select product…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}</select></td>
            <td>{product?.hsn || '—'}</td>
            <td>{product ? money(product.mrp || product.sellingPrice) : '—'}</td>
            <td><input type="number" required min="0" step="0.01" value={line.price} onChange={(e) => setLine(index, { price: e.target.value })} /></td>
            <td><input type="number" required min="1" step="1" value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} /></td>
            <td>{product ? `${product.gstRate || 0}%` : '—'}</td>
            <td>{money((Number(line.price) || 0) * (Number(line.quantity) || 0))}</td>
            <td>{lines.length > 1 && <button type="button" className="modal-close" aria-label="Remove line" onClick={() => setLines(lines.filter((_, i) => i !== index))}><X size={14} /></button>}</td>
          </tr>;
        })}</tbody></table>
          <button type="button" className="button secondary" onClick={() => setLines([...lines, { productId: '', quantity: 1, price: '' }])}><Plus size={14} /> Add product</button>
          <p className="form-note"><b>Bill total: {money(total)}</b> · Stock is not changed by a bill made here.</p>
        </div>
      </div>
      <Footer busy={busy || !customers.length} close={close} submit="Create bill" />
    </form>
  </ModalShell>;
}

export function Invoices({ invoices, sales = [], customers = [], loading, onOpen, onDelete, onCreate, openSettings, openCustomer, openBill, onEditCustomer, onDeleteCustomer }) {
  const [query, setQuery] = useState('');
  const invoiced = new Set(invoices.map((invoice) => String(invoice.sale)));
  const customerName = (id) => customers.find((c) => c._id === String(id))?.name || '—';
  const pending = sales.filter((sale) => sale.customer && !invoiced.has(String(sale._id)) && sale.items.some((item) => item.quantity > item.returnedQuantity));
  const filtered = invoices.filter((invoice) => `${invoice.invoiceNumber} ${invoice.customer?.name} ${invoice.saleNumber}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="page-heading"><div><div className="eyebrow">GST BILLING</div><h1>Invoices</h1><p>Make a GST bill for a customer, then view and print it from the list below.</p></div><div className="heading-actions"><button className="button primary" onClick={openBill}><FileText size={16} /> New bill</button><button className="button secondary" onClick={openCustomer}><Plus size={16} /> Add customer</button><button className="button secondary" onClick={openSettings}><Settings2 size={16} /> Business settings</button></div></div>
    {pending.length > 0 && <section className="panel table-panel"><div className="table-toolbar"><div><h2>Ready to bill <span className="count-badge">{pending.length}</span></h2><p>Customer sales without a GST invoice yet. Marketplace orders are not listed.</p></div></div><div className="table-scroll"><table><thead><tr><th>SALE</th><th>DATE</th><th>CUSTOMER</th><th>ITEMS</th><th>MRP</th><th>NET SALE</th><th /></tr></thead><tbody>{pending.map((sale) => {
      const lines = sale.items.filter((item) => item.quantity > item.returnedQuantity);
      const qty = (item) => item.quantity - item.returnedQuantity;
      return <tr key={sale._id}><td><strong>{sale.saleNumber}</strong></td><td>{dateLabel(sale.saleDate || sale.createdAt)}</td><td>{customerName(sale.customer)}</td><td>{lines.map((item) => `${item.name} × ${qty(item)}`).join(', ')}</td><td>{money(lines.reduce((sum, item) => sum + Number(item.mrp || item.sellingPrice) * qty(item), 0))}</td><td className="strong-cell">{money(lines.reduce((sum, item) => sum + item.sellingPrice * qty(item), 0))}</td><td><button className="button primary" type="button" onClick={() => onCreate(sale)}><FileText size={14} /> Create bill</button></td></tr>;
    })}</tbody></table></div></section>}
    {customers.length > 0 && <section className="panel table-panel"><div className="table-toolbar"><div><h2>Customers <span className="count-badge">{customers.length}</span></h2><p>Pick one in "New bill" or on a sale.</p></div></div><div className="table-scroll"><table><thead><tr><th>NAME</th><th>GSTIN</th><th>PHONE</th><th>ADDRESS</th><th>STATE</th><th /></tr></thead><tbody>{customers.map((c) => <tr key={c._id}><td><strong>{c.name}</strong></td><td>{c.gstin || '—'}</td><td>{c.phone || '—'}</td><td>{c.address || '—'}</td><td>{stateLabel(c.state)}</td><td><div className="invoice-row-actions"><button className="button secondary" type="button" onClick={() => onEditCustomer(c)}><Pencil size={14} /> Edit</button><button className="report-delete-button" type="button" aria-label={`Delete customer ${c.name}`} onClick={() => onDeleteCustomer(c)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div></section>}
    <section className="panel table-panel"><div className="table-toolbar"><div><h2>All invoices <span className="count-badge">{invoices.length}</span></h2><p>Each invoice keeps the details from the day it was issued.</p></div><label className="search-box"><Search size={15} /><input placeholder="Search invoices..." value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
      {loading ? <div className="loading-state"><LoaderCircle size={19} className="spinning" /> Loading invoices…</div> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>INVOICE NO</th><th>DATE</th><th>CUSTOMER</th><th>SALE</th><th>TAXABLE</th><th>GST</th><th>TOTAL</th><th /></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice._id}><td><strong>{invoice.invoiceNumber}</strong></td><td>{dateLabel(invoice.invoiceDate)}</td><td>{invoice.customer?.name}{invoice.customer?.gstin && <small>{invoice.customer.gstin}</small>}</td><td>{invoice.saleNumber || 'Direct bill'}</td><td>{money(invoice.totals?.taxableValue)}</td><td>{money(invoice.totals?.tax)}</td><td className="strong-cell">{money(invoice.totals?.grandTotal)}</td><td><div className="invoice-row-actions"><button className="button secondary" type="button" onClick={() => onOpen(invoice)}><FileText size={14} /> View</button><button className="button primary" type="button" onClick={() => onOpen(invoice, true)}><Printer size={14} /> Print</button><button className="report-delete-button" type="button" aria-label={`Delete invoice ${invoice.invoiceNumber}`} onClick={() => onDelete(invoice)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
        : <div className="empty-state"><div className="empty-icon"><FileText size={21} /></div><strong>{query ? 'No matching invoices' : 'No invoices yet'}</strong><p>{query ? 'Try a different search.' : 'Click "New bill", pick a customer and products, and the bill shows here.'}</p></div>}
    </section>
  </>;
}

export function InvoiceView({ invoice, close }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    document.body.classList.add('printing-invoice');
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.classList.remove('printing-invoice'); };
  }, [close]);
  // "Print" in the list opens the bill and goes straight to the print dialog once it has drawn.
  useEffect(() => {
    if (!invoice.autoPrint) return undefined;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [invoice._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { seller = {}, customer = {}, totals = {}, interState } = invoice;
  const rateGroups = Object.values(invoice.items.reduce((groups, item) => {
    const group = groups[item.gstRate] ||= { gstRate: item.gstRate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
    ['taxableValue', 'cgst', 'sgst', 'igst'].forEach((key) => { group[key] += item[key]; });
    return groups;
  }, {}));
  return <div className="invoice-overlay">
    <div className="invoice-toolbar"><strong>{invoice.invoiceNumber}</strong><div><button className="button primary" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="button secondary" onClick={close}><X size={15} /> Close</button></div></div>
    <article className="invoice-sheet">
      <header className="inv-header">
        <div className="inv-seller"><img src={logoUrl} alt={`${seller.businessName} logo`} className="inv-logo" /><div><h1>{seller.businessName}</h1><p>{seller.address}</p><p>{[seller.phone, seller.email].filter(Boolean).join(' · ')}</p>{seller.gstin && <p><b>GSTIN:</b> {seller.gstin}</p>}<p><b>State:</b> {stateLabel(seller.state)}</p></div></div>
        <div className="inv-title"><h2>TAX INVOICE</h2><span>Original for recipient</span></div>
      </header>
      <section className="inv-meta">
        <div><h3>Bill to</h3><strong>{customer.name}</strong>{customer.address && <p>{customer.address}</p>}{customer.phone && <p>Phone: {customer.phone}</p>}{customer.gstin && <p><b>GSTIN:</b> {customer.gstin}</p>}<p><b>Place of supply:</b> {stateLabel(customer.state)}</p></div>
        <dl><dt>Invoice no.</dt><dd>{invoice.invoiceNumber}</dd><dt>Invoice date</dt><dd>{dateLabel(invoice.invoiceDate)}</dd><dt>Order ref.</dt><dd>{invoice.saleNumber || '—'}</dd><dt>Supply type</dt><dd>{interState ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}</dd></dl>
      </section>
      <table className="inv-table">
        <thead><tr><th>#</th><th>Item</th><th>HSN</th><th>MRP</th><th>Price</th><th>Qty</th><th>Taxable value</th><th>GST</th><th>Total</th></tr></thead>
        <tbody>{invoice.items.map((item, index) => <tr key={index}><td>{index + 1}</td><td><strong>{item.name}</strong><small>SKU {item.sku}{item.packSize > 1 ? ` · pack of ${item.packSize}` : ''}</small></td><td>{item.hsn || '—'}</td><td>{item.mrp ? money(item.mrp) : '—'}</td><td>{money(item.price || item.total / item.quantity)}</td><td>{item.quantity}</td><td>{money(item.taxableValue)}</td><td>{money(item.cgst + item.sgst + item.igst)}<small>@ {item.gstRate}%</small></td><td className="inv-strong">{money(item.total)}</td></tr>)}</tbody>
      </table>
      <section className="inv-summary">
        <div className="inv-left">
          <table className="inv-tax-table"><thead><tr><th>GST %</th><th>Taxable</th>{interState ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}</tr></thead><tbody>{rateGroups.map((group) => <tr key={group.gstRate}><td>{group.gstRate}%</td><td>{money(group.taxableValue)}</td>{interState ? <td>{money(group.igst)}</td> : <><td>{money(group.cgst)}</td><td>{money(group.sgst)}</td></>}</tr>)}</tbody></table>
          {invoice.items.some((item) => item.mrp > (item.price || 0)) && <p className="inv-savings">You saved {money(invoice.items.reduce((sum, item) => sum + Math.max(0, (item.mrp || 0) - (item.price || 0)) * item.quantity, 0))} on MRP</p>}
          <p className="inv-words"><b>Amount in words:</b> {amountInWords(totals.grandTotal)}</p>
          {seller.bankDetails && <div className="inv-note"><h3>Bank / UPI details</h3><p>{seller.bankDetails}</p></div>}
        </div>
        <dl className="inv-totals"><dt>Total quantity</dt><dd>{invoice.items.reduce((sum, item) => sum + item.quantity, 0)}</dd><dt>Taxable value</dt><dd>{money(totals.taxableValue)}</dd>{interState ? <><dt>IGST</dt><dd>{money(totals.igst)}</dd></> : <><dt>CGST</dt><dd>{money(totals.cgst)}</dd><dt>SGST</dt><dd>{money(totals.sgst)}</dd></>}<dt>Round off</dt><dd>{money(totals.roundOff)}</dd><dt className="inv-grand">Grand total</dt><dd className="inv-grand">{money(totals.grandTotal)}</dd></dl>
      </section>
      <footer className="inv-footer">
        <div className="inv-note">{seller.terms && <><h3>Terms &amp; conditions</h3><p>{seller.terms}</p></>}</div>
        <div className="inv-sign"><span>For {seller.businessName}</span><div /><span>Authorised signatory</span></div>
      </footer>
      <p className="inv-computer">This is a computer-generated invoice.</p>
    </article>
  </div>;
}
