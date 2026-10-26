import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, default: '' },
  hsn: { type: String, default: '' },
  packSize: { type: Number, default: 1 },
  quantity: { type: Number, required: true, min: 1 },
  mrp: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  rate: { type: Number, required: true },
  gstRate: { type: Number, default: 0 },
  taxableValue: { type: Number, required: true },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  total: { type: Number, required: true },
}, { _id: false });

// Invoices keep a snapshot of the seller, buyer, and prices so later edits never change an issued bill.
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  saleNumber: { type: String, default: '' },
  invoiceDate: { type: Date, required: true },
  interState: { type: Boolean, default: false },
  seller: {
    businessName: String, logo: String, gstin: String, address: String, state: String,
    phone: String, email: String, bankDetails: String, terms: String,
  },
  customer: {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    state: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  items: { type: [invoiceItemSchema], required: true },
  totals: {
    taxableValue: Number, cgst: Number, sgst: Number, igst: Number, tax: Number, roundOff: Number, grandTotal: Number,
  },
}, { timestamps: true });

invoiceSchema.index({ invoiceDate: -1, createdAt: -1 });
invoiceSchema.index({ sale: 1 });

export default mongoose.model('Invoice', invoiceSchema);
