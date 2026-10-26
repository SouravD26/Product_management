import mongoose from 'mongoose';

// Single document holding the business details printed on GST invoices.
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'business', unique: true },
  businessName: { type: String, trim: true, default: 'Amita Essentials' },
  logo: { type: String, default: '', maxlength: 2000000 },
  gstin: { type: String, trim: true, uppercase: true, default: '' },
  address: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  invoicePrefix: { type: String, trim: true, default: 'AE' },
  bankDetails: { type: String, trim: true, default: '' },
  terms: { type: String, trim: true, default: 'Goods once sold will not be taken back.\nSubject to local jurisdiction.' },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
