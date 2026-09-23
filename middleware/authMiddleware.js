const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes (Checks if user is logged in)
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (Format: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Check if user is a Vendor
const vendorOnly = (req, res, next) => {
  if (req.user && req.user.role === 'vendor') {
    if (!req.user.isApproved) {
      return res.status(403).json({ message: 'Your vendor account is pending admin approval.' });
    }
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Not a vendor.' });
  }
};

// Check if user is an Admin
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Not an admin.' });
  }
};

module.exports = { protect, vendorOnly, adminOnly };