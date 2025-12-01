const express = require('express');
const router = express.Router();
const {
    createOrder,
    getMyOrders,
    getOrders,
    getOrderById,
    updateOrderToDelivered,
} = require('../controllers/orderController');
const { protect, admin } = require('../middlewares/auth');

router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/', protect, admin, getOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/deliver', protect, admin, updateOrderToDelivered);

module.exports = router;