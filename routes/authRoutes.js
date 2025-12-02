const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUserProfile,
    getAllUsers,
    updateUserRole,
    deleteUser,
    getUserById,
    createUser
} = require('../controllers/authController');
const { protect, admin } = require('../middlewares/auth');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/profile', protect, getUserProfile);

// Admin routes (protected + admin only)
router.get('/users', protect, admin, getAllUsers);
router.get('/users/:userId', protect, admin, getUserById);
router.post('/users', protect, admin, createUser);
router.put('/users/:userId/role', protect, admin, updateUserRole);
router.delete('/users/:userId', protect, admin, deleteUser);

module.exports = router;