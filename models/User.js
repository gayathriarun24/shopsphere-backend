const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['customer', 'vendor', 'admin'], 
    default: 'customer' 
  },
  // Fields specific to vendors
  storeName: { type: String },
  storeDescription: { type: String },
  isApproved: { type: Boolean, default: false } // Admin approval for vendors
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);