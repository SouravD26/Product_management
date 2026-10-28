import mongoose from 'mongoose';

const refillSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  stockGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  refillDate: { type: Date, required: true, index: true },
  pricePerPack: { type: Number, required: true, min: 0 },
  packSize: { type: Number, enum: [1, 2, 3, 4], default: 1 },
}, { timestamps: true });

refillSchema.index({ refillDate: -1 });

export default mongoose.model('Refill', refillSchema);
