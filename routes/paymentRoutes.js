const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    verifyPayment, 
    createCODOrder,
    handleWebhook 
} = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

// Apply protection to all routes except webhook
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/cod', protect, createCODOrder);
router.post('/webhook', handleWebhook); // No auth for webhook

module.exports = router;