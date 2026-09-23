const express = require('express');
const router = express.Router();
const {
  addOrderItems,
  getMyOrders,
  getVendorOrders,
  updateOrderStatus,
  updateVendorItemStatus,
} = require('../controllers/orderController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

router.post('/', protect, addOrderItems);
router.get('/myorders', protect, getMyOrders);
router.get('/vendor/orders', protect, vendorOnly, getVendorOrders);
router.put('/:id/status', protect, vendorOnly, updateOrderStatus);
router.put('/:orderId/item/:itemId/status', protect, vendorOnly, updateVendorItemStatus);

module.exports = router;