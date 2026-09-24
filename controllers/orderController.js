const Order = require('../models/Order');
const Product = require('../models/Product');

// @desc    Create new order (Customer checkout)
// @route   POST /api/orders
// @access  Private/Customer
const addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, totalAmount } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items provided' });
    }

    // 1. Verify stock availability and collect formatted items
    const formattedOrderItems = await Promise.all(
      orderItems.map(async (item) => {
        const productId = item.product || item._id;
        const productDoc = await Product.findById(productId);

        if (!productDoc) {
          throw new Error(`Product not found: ${productId}`);
        }

        const productTitle = productDoc.title || productDoc.name || item.title || 'Product Item';
        
        // Check if sufficient stock is available
        if (productDoc.stock < item.quantity) {
          throw new Error(`Insufficient stock for "${productDoc.title}". Only ${productDoc.stock} left in stock.`);
        }

        return {
          product: productId,
          quantity: item.quantity,
          price: item.price,
          vendor: productDoc.vendor || item.vendor || item.user || req.user._id,
          title: productTitle // Attached for clean email rendering
        };
      })
    );

    // 2. Decrement stock for each purchased product
    for (let item of formattedOrderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    // Ensure shipping address matches schema requirements
    const formattedShippingAddress = {
      address: shippingAddress?.address || shippingAddress || 'Default Address',
      city: shippingAddress?.city || 'Chennai',
      postalCode: shippingAddress?.postalCode || '600001',
      country: shippingAddress?.country || 'India'
    };

    const calculatedTotal = totalAmount || formattedOrderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const order = new Order({
      customer: req.user._id,
      orderItems: formattedOrderItems,
      shippingAddress: formattedShippingAddress,
      totalAmount: calculatedTotal,
      paymentStatus: 'Paid',
      orderStatus: 'Pending'
    });

    const createdOrder = await order.save();

    // 3. Trigger Brevo Automated Order Confirmation Email via v6 BrevoClient SDK
    try {
      const { BrevoClient } = require('@getbrevo/brevo');
      const brevo = new BrevoClient({
        apiKey: process.env.BREVO_API_KEY
      });

      await brevo.transactionalEmails.sendTransacEmail({
        sender: { 
          name: process.env.SENDER_NAME || 'ShopSphere', 
          email: process.env.SENDER_EMAIL || 'gayathri.dkp@gmail.com'
        },
        to: [{ 
          email: req.user.email, 
          name: req.user.name || 'Customer' 
        }],
        subject: `Order Confirmation #${createdOrder._id.toString().slice(-8).toUpperCase()}`,
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
            
            <!-- Header -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
              <tr>
                <td style="font-size: 24px; font-weight: 700; letter-spacing: 0.5px; color: #111;">SHOPSPHERE</td>
                <td align="right" style="font-size: 14px; color: #6b7280; font-weight: 500;">ORDER #${createdOrder._id.toString().slice(-8).toUpperCase()}</td>
              </tr>
            </table>

            <!-- Thank You Section -->
            <h2 style="font-size: 22px; font-weight: 600; color: #111; margin-bottom: 8px;">Thank you for your order!</h2>
            <p style="font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 24px;">
              We're getting your order ready to be shipped. We will notify you when it has been sent.
            </p>

            <!-- Action Buttons -->
            <div style="margin-bottom: 35px;">
              <a href="${process.env.FRONTEND_URL || 'https://shopsphere.onrender.com'}/my-orders" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600; display: inline-block; margin-right: 15px;">View your order</a>
              <span style="font-size: 14px; color: #666;">or <a href="${process.env.FRONTEND_URL || 'https://shopsphere.onrender.com'}" style="color: #0284c7; text-decoration: none;">Visit our store</a></span>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />

            <!-- Order Summary Title -->
            <h3 style="font-size: 16px; font-weight: 600; color: #111; margin-bottom: 20px;">Order summary</h3>

            <!-- Items List -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
              ${createdOrder.orderItems.map(item => `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #333;">
                    <strong>${item.title || 'Product Item'}</strong> &times; ${item.quantity}
                  </td>
                  <td align="right" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #333; font-weight: 500;">
                    Rs. ${(item.price * item.quantity).toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </table>

            <!-- Totals Breakdown Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #555; margin-bottom: 30px;">
              <tr>
                <td style="padding: 6px 0;" align="right">Subtotal</td>
                <td style="padding: 6px 0; width: 120px;" align="right">Rs. ${createdOrder.totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0;" align="right">Shipping</td>
                <td style="padding: 6px 0;" align="right">Rs. 0.00</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;" align="right">Taxes</td>
                <td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;" align="right">Rs. 0.00</td>
              </tr>
              <tr>
                <td style="padding: 15px 0; font-size: 16px; font-weight: 600; color: #111;" align="right">Total</td>
                <td style="padding: 15px 0; font-size: 18px; font-weight: 700; color: #111;" align="right">Rs. ${createdOrder.totalAmount.toFixed(2)}</td>
              </tr>
            </table>

            <!-- Footer -->
            <div style="text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 40px;">
              &copy; ${new Date().getFullYear()} ShopSphere. All rights reserved.
            </div>

          </div>
        `
      });

      console.log('Brevo order confirmation email sent successfully via SDK v6.');
    } catch (emailErr) {
      console.error('Failed to send Brevo confirmation email:', emailErr.message || emailErr);
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get logged-in customer's orders
// @route   GET /api/orders/myorders
// @access  Private/Customer
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate({
        path: 'orderItems.product',
        select: 'title images price'
      })
      .sort({ createdAt: -1 });
      
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get orders belonging to the logged-in vendor's products
// @route   GET /api/orders/vendor/orders
// @access  Private/Vendor
const getVendorOrders = async (req, res) => {
  try {
    const vendorProducts = await Product.find({ vendor: req.user._id }).select('_id');
    const productIds = vendorProducts.map((p) => p._id);

    const orders = await Order.find({
      $or: [
        { 'orderItems.vendor': req.user._id },
        { 'orderItems.product': { $in: productIds } }
      ]
    })
      .populate('customer', 'name email')
      .populate('orderItems.product', 'title price images');

    const filteredOrders = orders.map(order => {
      const orderObj = order.toObject();

      orderObj.orderItems = orderObj.orderItems.filter(item => {
        const itemVendorId = item.vendor?._id ? item.vendor._id.toString() : item.vendor?.toString();
        const isMyProduct = productIds.some(id => id.toString() === item.product?._id?.toString() || id.toString() === item.product?.toString());
        
        return itemVendorId === req.user._id.toString() || isMyProduct;
      });

      return orderObj;
    }).filter(order => order.orderItems.length > 0);

    res.json(filteredOrders);
  } catch (error) {
    console.error('Vendor orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update order status (Vendor or Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Vendor
const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (orderStatus === 'Cancelled' && order.orderStatus !== 'Cancelled') {
      for (let item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    }

    order.orderStatus = orderStatus;
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateVendorItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { itemStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = order.orderItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Order item not found' });
    }
    const itemVendorId = item.vendor._id ? item.vendor._id.toString() : item.vendor.toString();
    const loggedInUserId = req.user._id.toString();

    if (itemVendorId !== loggedInUserId) {
      return res.status(403).json({ message: 'Unauthorized: You do not own this item' });
    }

    if (itemStatus === 'Cancelled' && item.itemStatus !== 'Cancelled') {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    item.itemStatus = itemStatus;
    await order.save();

    res.json({ message: 'Item status updated successfully', order });
  } catch (error) {
    console.error('Update item status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  addOrderItems,
  getMyOrders,
  getVendorOrders,
  updateOrderStatus,
  updateVendorItemStatus,
};