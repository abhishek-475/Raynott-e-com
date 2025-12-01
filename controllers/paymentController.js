const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
const createOrder = async (req, res) => {
    try {
        console.log('Creating Razorpay order with data:', req.body);
        
        const { amount, currency = 'INR', receipt } = req.body;

        // IMPORTANT: Amount is already in paise from frontend
        // Don't multiply by 100 again!
        
        // Validate amount in paise (₹1 = 100 paise)
        if (!amount || amount < 100) { // Minimum ₹1 = 100 paise
            console.error('Invalid amount in paise:', amount);
            const amountInRupees = (amount || 0) / 100;
            return res.status(400).json({ 
                message: `Invalid amount: ₹${amountInRupees}. Minimum amount is ₹1.` 
            });
        }

        // Check for maximum amount (₹10,00,000 = 100000000 paise)
        if (amount > 100000000) {
            const amountInRupees = amount / 100;
            return res.status(400).json({ 
                message: `Amount ₹${amountInRupees} exceeds maximum limit of ₹10,00,000` 
            });
        }

        console.log('Amount details:', {
            received: amount,
            inPaise: amount,
            inRupees: amount / 100
        });

        const options = {
            amount: amount, // Already in paise, don't multiply!
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            payment_capture: 1 // Auto-capture payment
        };

        console.log('Creating Razorpay order with options:', options);
        
        const razorpayOrder = await razorpay.orders.create(options);
        
        console.log('Razorpay order created successfully:', {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            amountInRupees: razorpayOrder.amount / 100
        });
        
        res.json({
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            receipt: razorpayOrder.receipt,
            status: razorpayOrder.status
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(500).json({ 
            message: 'Failed to create payment order',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};


// Verify Razorpay payment and save order
const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            orderDetails,
            shippingAddress 
        } = req.body;

        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ 
                message: 'Payment verification failed: Invalid signature' 
            });
        }

        // Fetch order from Razorpay to verify amount
        const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
        
        // Verify amount matches
        const expectedAmount = Math.round(orderDetails.grandTotal * 100);
        if (razorpayOrder.amount !== expectedAmount) {
            return res.status(400).json({ 
                message: 'Payment verification failed: Amount mismatch' 
            });
        }

        // Create order in database
        const order = new Order({
            user: req.user._id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            products: orderDetails.items.map(item => ({
                product: item.productId || item.id,
                quantity: item.quantity,
                price: item.price
            })),
            totalAmount: orderDetails.subtotal || orderDetails.totalAmount,
            shippingFee: orderDetails.shipping || 0,
            taxAmount: orderDetails.tax || 0,
            grandTotal: orderDetails.grandTotal,
            status: 'processing',
            paymentStatus: 'paid',
            paymentMethod: 'razorpay',
            paymentId: razorpay_payment_id,
            shippingAddress: shippingAddress,
            receipt: razorpayOrder.receipt
        });

        await order.save();

        res.json({ 
            success: true,
            message: 'Payment verified and order created successfully',
            orderId: order._id,
            orderNumber: order.receipt
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ 
            message: 'Payment verification failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Create COD order - ALLOWS ALL ORDERS
const createCODOrder = async (req, res) => {
    try {
        const { orderDetails, shippingAddress } = req.body;

        // COD is available for ALL orders - no amount restriction
        
        // Calculate grand total including COD charges
        const subtotal = orderDetails.subtotal || orderDetails.totalAmount;
        const shipping = orderDetails.shipping || 0;
        const tax = orderDetails.tax || 0;
        const codCharges = 50; // Fixed COD charges for all orders
        const grandTotal = subtotal + shipping + tax + codCharges;

        // Create COD order in database
        const order = new Order({
            user: req.user._id,
            products: orderDetails.items.map(item => ({
                product: item.productId || item.id,
                quantity: item.quantity,
                price: item.price
            })),
            totalAmount: subtotal,
            shippingFee: shipping,
            taxAmount: tax,
            codCharges: codCharges,
            grandTotal: grandTotal,
            status: 'pending',
            paymentStatus: 'cod',
            paymentMethod: 'cod',
            shippingAddress: shippingAddress,
            receipt: `COD_${Date.now()}`
        });

        await order.save();

        res.json({ 
            success: true,
            message: 'COD order created successfully',
            orderId: order._id,
            orderNumber: order.receipt
        });
    } catch (error) {
        console.error('Error creating COD order:', error);
        res.status(500).json({ 
            message: 'Failed to create COD order',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Webhook handler for Razorpay
const handleWebhook = async (req, res) => {
    try {
        const crypto = require('crypto');
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest === req.headers['x-razorpay-signature']) {
            const event = req.body.event;
            const payment = req.body.payload.payment?.entity;

            switch (event) {
                case 'payment.captured':
                    await Order.findOneAndUpdate(
                        { razorpayPaymentId: payment.id },
                        { 
                            paymentStatus: 'paid',
                            status: 'processing'
                        }
                    );
                    break;
                    
                case 'payment.failed':
                    await Order.findOneAndUpdate(
                        { razorpayPaymentId: payment.id },
                        { 
                            paymentStatus: 'failed',
                            status: 'cancelled'
                        }
                    );
                    break;
                    
                case 'order.paid':
                    // Handle subscription payments if needed
                    break;
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    createCODOrder,
    handleWebhook
};