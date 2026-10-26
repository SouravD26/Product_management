import { useEffect, useState } from 'react';
import { ArrowRight, FileText, LoaderCircle, Printer, Search, Settings2, Trash2, X } from 'lucide-react';
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

export function InvoiceForm({ sale, settings, busy, error, onCreate, close }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', gstin: '', address: '', state: settings?.state || '' });
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
      </div>
      <Footer busy={busy} close={close} submit="Create invoice" />
    </form>
  </ModalShell>;
}

export function Invoices({ invoices, loading, onOpen, onDelete, openSettings }) {
  const [query, setQuery] = useState('');
  const filtered = invoices.filter((invoice) => `${invoice.invoiceNumber} ${invoice.customer?.name} ${invoice.saleNumber}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="page-heading"><div><div className="eyebrow">GST BILLING</div><h1>Invoices</h1><p>Create a GST invoice from any sale in Sales &amp; returns, then print it.</p></div><div className="heading-actions"><button className="button secondary" onClick={openSettings}><Settings2 size={16} /> Business settings</button></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h2>All invoices <span className="count-badge">{invoices.length}</span></h2><p>Each invoice keeps the details from the day it was issued.</p></div><label className="search-box"><Search size={15} /><input placeholder="Search invoices..." value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
      {loading ? <div className="loading-state"><LoaderCircle size={19} className="spinning" /> Loading invoices…</div> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>INVOICE NO</th><th>DATE</th><th>CUSTOMER</th><th>SALE</th><th>TAXABLE</th><th>GST</th><th>TOTAL</th><th /></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice._id}><td><strong>{invoice.invoiceNumber}</strong></td><td>{dateLabel(invoice.invoiceDate)}</td><td>{invoice.customer?.name}{invoice.customer?.gstin && <small>{invoice.customer.gstin}</small>}</td><td>{invoice.saleNumber}</td><td>{money(invoice.totals?.taxableValue)}</td><td>{money(invoice.totals?.tax)}</td><td className="strong-cell">{money(invoice.totals?.grandTotal)}</td><td><div className="invoice-row-actions"><button className="button secondary" type="button" onClick={() => onOpen(invoice)}><Printer size={14} /> View / print</button><button className="report-delete-button" type="button" aria-label={`Delete invoice ${invoice.invoiceNumber}`} onClick={() => onDelete(invoice)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
        : <div className="empty-state"><div className="empty-icon"><FileText size={21} /></div><strong>{query ? 'No matching invoices' : 'No invoices yet'}</strong><p>{query ? 'Try a different search.' : 'Open Sales & returns and choose "GST bill" on a sale.'}</p></div>}
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
