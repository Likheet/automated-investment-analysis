// backend/config/passport-setup.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db');
require('dotenv').config({ path: '../.env' }); // Ensure access to env vars

passport.serializeUser((user, done) => {
    // Serialize user ID into the session
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    // Deserialize user ID from session to find user object
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        const user = result.rows[0];
        // Don't include password hash in the user object attached to req.user by passport
        if (user) {
            delete user.password_hash;
        }
        done(null, user); // Attach user object (without hash) to req.user
    } catch (err) {
        console.error("Deserialize user error:", err);
        done(err, null);
    } finally {
        if (client) client.release();
    }
});

passport.use(
    new GoogleStrategy({
        // Options for google strategy
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.CALLBACK_URL_BASE}/api/auth/google/callback` // Needs full path
    }, async (accessToken, refreshToken, profile, done) => {
        // Passport callback function
        // Check if user already exists in our db based on google ID
        const googleId = profile.id;
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null; // primary email
        const displayName = profile.displayName; // Or maybe profile.name.givenName etc.

        if (!email) {
             console.error("Google OAuth: No email found in profile.");
            return done(new Error('Email not provided by Google profile.'), null);
        }

        let client;
        try {
            client = await pool.connect();
            // Try find user by Google ID first
            let result = await client.query('SELECT * FROM users WHERE provider = $1 AND provider_id = $2', ['google', googleId]);
            let currentUser = result.rows[0];

            if (currentUser) {
                // Already have this user
                console.log('Google OAuth: Existing user found by provider_id:', currentUser.id);
                // Potential: Update email or name if changed? Skip for now.
                return done(null, currentUser); // Pass user to serializeUser
            } else {
                 // If not, check if user exists with that email already (maybe registered via email?)
                result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
                currentUser = result.rows[0];

                if (currentUser) {
                    // User exists with this email, but not linked to Google yet.
                    // Optional: Link account here by updating provider and provider_id. For simplicity, just log and let them log in via Google.
                     console.log(`Google OAuth: Found existing user by email ${email}, logging in. Consider adding provider fields.`);
                     // Update provider info if desired:
                     // await client.query("UPDATE users SET provider='google', provider_id=$1 WHERE id=$2", [googleId, currentUser.id]);
                     return done(null, currentUser); // Let them login as this existing user
                } else {
                    // If user doesn't exist, create new user
                    // We don't have a password, so hash field might need adjustment or leave null if provider is set
                     console.log('Google OAuth: Creating new user for email:', email);
                     const newUserResult = await client.query(
                        `INSERT INTO users (email, password_hash, provider, provider_id, display_name)
                         VALUES ($1, $2, $3, $4, $5)
                         RETURNING *`,
                         [email, null, 'google', googleId, displayName] // Store provider info, leave password null
                     );
                     currentUser = newUserResult.rows[0];
                     console.log('Google OAuth: New user created:', currentUser.id);
                    return done(null, currentUser); // Pass the new user to serializeUser
                 }
            }
        } catch (error) {
             console.error("Google OAuth callback DB error:", error);
             return done(error, null);
        } finally {
             if (client) client.release();
        }
    })
);