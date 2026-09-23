const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  getVendorProducts,
  deleteProduct,
  updateProduct,
  createProductReview, // <-- Import this controller function
} = require('../controllers/productController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Review route (Protected for logged-in users/customers)
router.post('/:id/reviews', protect, createProductReview);

// Vendor-protected routes
router.get('/vendor/mystore', protect, vendorOnly, getVendorProducts);
router.post('/', protect, vendorOnly, createProduct);
router.delete('/:id', protect, vendorOnly, deleteProduct);
router.put('/:id', protect, vendorOnly, updateProduct);

module.exports = router;