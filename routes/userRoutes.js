const express = require('express');
const router = express.Router();
const { getUsers, approveVendor, updateUserProfile } = require('../controllers/authController'); 
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Route for users to update their profile and password
router.put('/profile', protect, updateUserProfile);

// Route to get all users (Admin only)
router.get('/admin/users', protect, adminOnly, getUsers);

// Route to approve a vendor (Admin only)
router.put('/admin/approve/:id', protect, adminOnly, approveVendor);

module.exports = router;