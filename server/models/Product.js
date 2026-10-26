import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true, unique: true },
  hsn: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: 'General' },
  image: { type: String, default: '', maxlength: 2000000 },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  packSize: { type: Number, required: true, enum: [1, 2, 3, 4], default: 1 },
  stockGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
  buyPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  desiredProfit: { type: Number, min: 0, default: 0 },
  deliveryFee: { type: Number, min: 0, default: 0 },
  commissionRate: { type: Number, min: 0, max: 100, default: 15 },
  gstRate: { type: Number, min: 0, max: 100, default: 0 },
  packagingCost: { type: Number, min: 0, default: 0 },
  additionalCost: { type: Number, min: 0, default: 0 },
  customerReturnRate: { type: Number, min: 0, max: 100, default: 0 },
  goodReturnRate: { type: Number, min: 0, max: 100, default: 100 },
  damagedReturnRate: { type: Number, min: 0, max: 100, default: 0 },
  returnShippingCost: { type: Number, min: 0, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

productSchema.index({ updatedAt: -1 });

export default mongoose.model('Product', productSchema);
