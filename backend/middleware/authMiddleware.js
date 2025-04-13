// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' }); // Load .env vars from root directory

const authMiddleware = (req, res, next) => {
    // 1. Get token from header
    const authHeader = req.header('Authorization'); // Standard header for tokens

    // 2. Check if token exists
    if (!authHeader) {
        console.log("Auth middleware: No Authorization header found.");
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // 3. Check if token is in the correct format ('Bearer <token>')
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        console.log("Auth middleware: Invalid Authorization header format.");
        return res.status(401).json({ message: 'Access denied. Token format is "Bearer <token>".' });
    }

    const token = parts[1]; // Extract the token itself

    try {
        // 4. Verify token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Attach decoded user information to the request object
        // The payload used during login (`{ userId: user.id, email: user.email }`) is now available in `decoded`
        req.user = decoded; // Common practice to attach user payload to req.user

        console.log(`Auth middleware: Token verified for user ID ${req.user.userId}`);
        // 6. Call the next middleware or route handler in the chain
        next();

    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            console.log("Auth middleware: Token expired.");
            return res.status(401).json({ message: 'Access denied. Token has expired.' });
        }
        if (error.name === 'JsonWebTokenError') {
             console.log("Auth middleware: Invalid token signature/format.", error.message);
            return res.status(401).json({ message: 'Access denied. Invalid token.' });
        }

        // Handle other unexpected errors
        console.error("Auth middleware: Unexpected error during token verification:", error);
        res.status(500).json({ message: 'Internal server error during authentication.' });
    }
};

module.exports = authMiddleware;