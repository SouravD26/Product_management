import mongoose from 'mongoose';

// Single document holding the business details printed on GST invoices.
// Defaults are Amita Essentials' own details, so bills work without saving settings first.
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'business', unique: true },
  businessName: { type: String, trim: true, default: 'Amita Essentials' },
  logo: { type: String, default: '', maxlength: 2000000 },
  gstin: { type: String, trim: true, uppercase: true, default: '' },
  address: { type: String, trim: true, default: 'Maslandapur, Sarkaripukur, With in 1 Km form UTRUN CAFE.' },
  state: { type: String, trim: true, default: 'West Bengal' },
  phone: { type: String, trim: true, default: '08158931079' },
  email: { type: String, trim: true, default: 'souravdutta655@gmail.com' },
  invoicePrefix: { type: String, trim: true, default: 'AE' },
  bankDetails: { type: String, trim: true, default: '588' },
  terms: { type: String, trim: true, default: 'Goods once sold will not be taken back.\nSubject to local jurisdiction.' },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
