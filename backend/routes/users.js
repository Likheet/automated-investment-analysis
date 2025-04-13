// backend/routes/users.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/users/me - Fetch details for the logged-in user
router.get('/me', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    console.log(`Fetching user details for User ID: ${userId}`);
    let client;
    try {
        client = await pool.connect();
        // Select all EXCEPT the password hash
        const query = 'SELECT id, email, provider, provider_id, display_name, created_at FROM users WHERE id = $1';
        const result = await client.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(result.rows[0]); // Send user object back

    } catch (error) {
        console.error(`Error fetching user details for ID ${userId}:`, error);
        res.status(500).json({ message: 'Server error fetching user details.' });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;