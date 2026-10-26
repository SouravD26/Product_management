import mongoose from 'mongoose';

// Direct (non-marketplace) buyers who get a GST invoice.
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  gstin: { type: String, trim: true, uppercase: true, default: '' },
  address: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
}, { timestamps: true });

export default mongoose.model('Customer', customerSchema);
