const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('[AUTHORIZE] Checking authorization:', { 
      userRole: req.user?.role, 
      allowedRoles: roles,
      path: req.path,
      method: req.method
    });
    
    if (!req.user || !req.user.role) {
      console.log('[AUTHORIZE] No user or role found');
      return res.status(401).json({ 
        message: 'User not authenticated' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      console.log('[AUTHORIZE] Access denied:', { 
        userRole: req.user.role, 
        allowedRoles: roles,
        path: req.path 
      });
      return res.status(403).json({ 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    
    console.log('[AUTHORIZE] Access granted for role:', req.user.role);
    next();
  };
};

module.exports = { protect, authorize };

