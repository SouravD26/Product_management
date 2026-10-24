import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  hsn: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  packSize: { type: Number, enum: [1, 2, 3, 4], default: 1 },
  returnedQuantity: { type: Number, min: 0, default: 0 },
  buyPrice: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  desiredProfit: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 15 },
  gstRate: { type: Number, default: 0 },
  packagingCost: { type: Number, default: 0 },
  additionalCost: { type: Number, default: 0 },
  returnShippingCost: { type: Number, default: 0 },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  saleNumber: { type: String, unique: true },
  platform: { type: String, enum: ['Flipkart', 'Amazon', 'Meesho', 'Other'], default: 'Other' },
  saleDate: { type: Date },
  items: { type: [saleItemSchema], required: true },
}, { timestamps: true });

export default mongoose.model('Sale', saleSchema);
