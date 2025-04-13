// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const passport = require('passport'); // Import passport
const pool = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;

// --- Email/Password Register and Login routes ---
router.post('/register', [
    // Input validation
    body('email').isEmail().withMessage('Must provide a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('fullName').notEmpty().withMessage('Full name is required')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, fullName } = req.body;

        // Check if user already exists
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert new user into database
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, full_name, auth_type) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name',
            [email, hashedPassword, fullName, 'email']
        );

        const newUser = result.rows[0];

        // Create JWT token
        const payload = {
            userId: newUser.id,
            email: newUser.email
        };
        
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.full_name
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

router.post('/login', [
    // Input validation
    body('email').isEmail().withMessage('Must provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user in database
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = userResult.rows[0];

        // Check if user registered with OAuth
        if (user.auth_type !== 'email' && !user.password_hash) {
            return res.status(401).json({ 
                message: 'This account uses social login. Please sign in with Google.'
            });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Create JWT token
        const payload = {
            userId: user.id,
            email: user.email
        };
        
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// --- Google OAuth Routes ---

// 1. Redirect user to Google for authentication
// Frontend will have a button linking to GET /api/auth/google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'] // Request access to profile and email
}));

// 2. Callback route Google redirects back to after authentication
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login-failure' }), // Redirects if Google auth fails
    (req, res) => {
        // Authentication successful! req.user contains the logged-in user from passport strategy/deserializeUser.
        console.log(`Google OAuth successful callback for user ID: ${req.user?.id}`);

        // We need to generate a JWT token, similar to regular login,
        // so the frontend can use Bearer token auth consistently.
         if (!req.user || !req.user.id || !req.user.email) {
            console.error("OAuth Callback: User info missing after passport auth.");
            return res.redirect('/login-failure?error=user_info_missing');
        }

         const payload = {
            userId: req.user.id,
            email: req.user.email
            // Add other relevant non-sensitive info if needed
         };
         const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
         );

        // Redirect user back to frontend, sending token along (e.g., via query parameter)
        // Frontend needs code to grab this token from URL and save it.
        // Security Note: Putting token in URL can be risky (logs). Other methods: postMessage, server-rendered context. Query param is simplest demo.
         // !!! REPLACE 'http://localhost:5173' with your actual frontend URL/path !!!
         const frontendRedirectUrl = `http://localhost:5173/auth/callback?token=${token}`;
        console.log(`Redirecting frontend to: ${frontendRedirectUrl}`);
         res.redirect(frontendRedirectUrl);

         // Alternative for SPA: Instead of redirect, send JSON with token and have client handle it
         // res.status(200).json({ message: "Google login successful.", token: token, user: req.user });
    }
);

// Simple failure route (client side should ideally handle failure messages better)
router.get('/login-failure', (req, res) => {
    res.status(401).json({ message: 'Google authentication failed. Please try again or use another method.' });
});

module.exports = router;