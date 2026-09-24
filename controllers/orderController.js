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

        // Check if sufficient stock is available
        if (productDoc.stock < item.quantity) {
          throw new Error(`Insufficient stock for "${productDoc.title}". Only ${productDoc.stock} left in stock.`);
        }

        return {
          product: productId,
          quantity: item.quantity,
          price: item.price,
          vendor: productDoc.vendor || item.vendor || item.user || req.user._id,
          title: productDoc.title // Attached for clean email rendering
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

    // // 3. Trigger Brevo Automated Order Confirmation Email via Native Fetch
    // try {
    //   const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    //     method: 'POST',
    //     headers: {
    //       'accept': 'application/json',
    //       'api-key': process.env.BREVO_API_KEY,
    //       'content-type': 'application/json'
    //     },
    //     body: JSON.stringify({
    //       sender: { 
    //         name: process.env.SENDER_NAME || 'ShopSphere', 
    //         email: process.env.SENDER_EMAIL 
    //       },
    //       to: [{ 
    //         email: req.user.email, 
    //         name: req.user.name || 'Customer' 
    //       }],
    //       subject: `Order Confirmation #${createdOrder._id.toString().slice(-8).toUpperCase()}`,
    //       htmlContent: `
    //         <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
    //           <!-- Header / Brand & Order ID -->
    //           <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 25px;">
    //             <tr>
    //               <td style="font-size: 22px; font-weight: 700; letter-spacing: 1px; color: #111;">
    //                 SHOPSPHERE
    //               </td>
    //               <td align="right" style="font-size: 14px; color: #6b7280; font-weight: 500;">
    //                 ORDER #${createdOrder._id.toString().slice(-8).toUpperCase()}
    //               </td>
    //             </tr>
    //           </table>

    //           <!-- Greeting & Status -->
    //           <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 8px;">Thank you for your purchase!</h2>
    //           <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
    //             Hi <strong>${req.user.name || 'Valued Customer'}</strong>, we're getting your order ready to be shipped. We will notify you when it has been sent.
    //           </p>

    //           <!-- Action Button -->
    //           <div style="margin-bottom: 30px;">
    //             <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-orders" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
    //               View your order
    //             </a>
    //           </div>

    //           <!-- Order Summary Heading -->
    //           <h3 style="font-size: 16px; font-weight: 600; color: #111; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px;">
    //             Order summary
    //           </h3>

    //           <!-- Order Items List -->
    //           <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
    //             ${formattedOrderItems.map(item => `
    //               <tr>
    //                 <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151;">
    //                   <strong>${item.title || 'Product Item'}</strong> &times; ${item.quantity}                     </td>                     <td align="right" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151; font-weight: 500;">                       $${(item.price * item.quantity).toFixed(2)}
    //                 </td>
    //               </tr>
    //             `).join('')}
    //           </table>

    //           <!-- Cost Breakdown -->
    //           <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">
    //             <tr>
    //               <td style="padding: 6px 0;">Subtotal</td>
    //               <td align="right" style="padding: 6px 0; color: #111; font-weight: 500;">$${calculatedTotal.toFixed(2)}</td>
    //             </tr>
    //             <tr>
    //               <td style="padding: 6px 0;">Shipping</td>
    //               <td align="right" style="padding: 6px 0; color: #111; font-weight: 500;">$0.00</td>
    //             </tr>
    //             <tr>
    //               <td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">Taxes</td>
    //               <td align="right" style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; color: #111; font-weight: 500;">$0.00</td>
    //             </tr>
    //             <tr>
    //               <td style="padding-top: 14px; font-size: 16px; font-weight: 600; color: #111;">Total</td>
    //               <td align="right" style="padding-top: 14px; font-size: 18px; font-weight: 700; color: #111;">$${calculatedTotal.toFixed(2)}</td>
    //             </tr>
    //           </table>

    //           <!-- Shipping Address Box -->
    //           <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; font-size: 13px; color: #4b5563; margin-top: 25px;">
    //             <p style="margin: 0 0 5px 0; font-weight: 600; color: #111;">Shipping Address:</p>
    //             <p style="margin: 0;">${formattedShippingAddress.address}, ${formattedShippingAddress.city} - ${formattedShippingAddress.postalCode}, ${formattedShippingAddress.country}</p>
    //           </div>

    //           <!-- Footer -->
    //           <div style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 35px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
    //             &copy; ${new Date().getFullYear()} ShopSphere. All rights reserved.
    //           </div>
    //         </div>
    //       `
    //     })
    //   });

    //   if (!response.ok) {
    //     const errorData = await response.json();
    //     throw new Error(errorData.message || 'Failed to send email via Brevo API');
    //   }

    //   console.log('Brevo order confirmation email sent successfully.');
    // } catch (emailErr) {
    //   console.error('Failed to send Brevo confirmation email:', emailErr.message);
    // }

    // 3. Trigger Brevo Automated Order Confirmation Email via Native Fetch
    try {
      const apiKey = process.env.BREVO_API_KEY || process.env.BREVOKEY;
      
      if (!apiKey) {
        console.error('Brevo Error: BREVO_API_KEY is undefined in process.env');
        throw new Error('BREVO_API_KEY is missing from environment variables');
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { 
            name: process.env.SENDER_NAME || 'ShopSphere', 
            email: process.env.SENDER_EMAIL 
          },
          to: [{ 
            email: req.user.email, 
            name: req.user.name || 'Customer' 
          }],
          subject: `Order Confirmation #${createdOrder._id.toString().slice(-8).toUpperCase()}`,
          htmlContent: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
              <!-- Header / Brand & Order ID -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 25px;">
                <tr>
                  <td style="font-size: 22px; font-weight: 700; letter-spacing: 1px; color: #111;">
                    SHOPSPHERE
                  </td>
                  <td align="right" style="font-size: 14px; color: #6b7280; font-weight: 500;">
                    ORDER #${createdOrder._id.toString().slice(-8).toUpperCase()}
                  </td>
                </tr>
              </table>

              <!-- Greeting & Status -->
              <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 8px;">Thank you for your purchase!</h2>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
                Hi <strong>${req.user.name || 'Valued Customer'}</strong>, we're getting your order ready to be shipped. We will notify you when it has been sent.
              </p>

              <!-- Action Button -->
              <div style="margin-bottom: 30px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-orders" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View your order
                </a>
              </div>

              <!-- Order Summary Heading -->
              <h3 style="font-size: 16px; font-weight: 600; color: #111; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px;">
                Order summary
              </h3>

              <!-- Order Items List -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                ${formattedOrderItems.map(item => `
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151;">
                      <strong>${item.title || 'Product Item'}</strong> &times; ${item.quantity}                    </td>                    <td align="right" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151; font-weight: 500;">                      $${(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                `).join('')}
              </table>

              <!-- Cost Breakdown -->
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 6px 0;">Subtotal</td>
                  <td align="right" style="padding: 6px 0; color: #111; font-weight: 500;">$${calculatedTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">Shipping</td>
                  <td align="right" style="padding: 6px 0; color: #111; font-weight: 500;">$0.00</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">Taxes</td>
                  <td align="right" style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; color: #111; font-weight: 500;">$0.00</td>
                </tr>
                <tr>
                  <td style="padding-top: 14px; font-size: 16px; font-weight: 600; color: #111;">Total</td>
                  <td align="right" style="padding-top: 14px; font-size: 18px; font-weight: 700; color: #111;">$${calculatedTotal.toFixed(2)}</td>
                </tr>
              </table>

              <!-- Shipping Address Box -->
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; font-size: 13px; color: #4b5563; margin-top: 25px;">
                <p style="margin: 0 0 5px 0; font-weight: 600; color: #111;">Shipping Address:</p>
                <p style="margin: 0;">${formattedShippingAddress.address}, ${formattedShippingAddress.city} - ${formattedShippingAddress.postalCode}, ${formattedShippingAddress.country}</p>
              </div>

              <!-- Footer -->
              <div style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 35px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                &copy; ${new Date().getFullYear()} ShopSphere. All rights reserved.
              </div>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email via Brevo API');
      }

      console.log('Brevo order confirmation email sent successfully.');
    } catch (emailErr) {
      console.error('Failed to send Brevo confirmation email:', emailErr.message);
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