// frontend/src/components/AuthCallbackPage.tsx
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth(); // Use the login function from context

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      console.log("AuthCallbackPage: Token received:", token);
      // --- PROBLEM: Need user data ---
      // Our 'login' function in AuthContext expects (token, userObject).
      // We only have the token here.
      // Solution 1: Modify backend callback to redirect with user data too (less secure).
      // Solution 2: Modify 'login' in AuthContext to fetch user data if needed.
      // Solution 3 (Best): Make a request to a protected backend endpoint like '/api/users/me' using the new token to get user details.

      // --- Implementing Solution 3 (Requires backend /api/users/me endpoint) ---
      const fetchUserDetails = async (receivedToken: string) => {
          try {
            // Assume you have a backend endpoint '/api/users/me' protected by authMiddleware
            const config = { headers: { 'Authorization': `Bearer ${receivedToken}` } };
            const response = await axios.get('http://localhost:5001/api/users/me', config); // << NEED TO CREATE THIS ENDPOINT

             if (response.data) { // Backend should return user object (without password hash)
                 login(receivedToken, response.data); // Call context login with token AND user data
                 navigate('/dashboard'); // Redirect to dashboard on success
             } else {
                throw new Error("No user data received from /api/users/me");
             }

          } catch (error) {
              console.error("AuthCallbackPage: Failed to fetch user details after getting token:", error);
              // Clear potentially invalid token? Or let login handle it.
              localStorage.removeItem('authToken'); // Clear token if fetch fails
              localStorage.removeItem('authUser');
              navigate('/login?error=fetch_user_failed'); // Redirect to login with specific error
          }
      };

      fetchUserDetails(token);

    } else {
      console.error("AuthCallbackPage: No token found in URL parameters.");
      navigate('/login?error=google_token_missing'); // Redirect to login with error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, login, navigate]); // Dependencies for useEffect

  // Render a loading state while processing
  return <div>Processing login... Please wait.</div>;
};

// Need to import axios at the top
import axios from 'axios';

export default AuthCallbackPage;