// frontend/src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// Define the shape of the user object (adjust based on what your backend login returns)
interface User {
    id: number;
    email: string;
    created_at: string;
    // Add other fields if returned and needed (e.g., firstName)
}

// Define the shape of the context value
interface AuthContextType {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean; // To handle initial check from localStorage
    login: (token: string, userData: User) => void;
    logout: () => void;
}

// Create the context with a default value (usually null or an object indicating loading state)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the Provider component
interface AuthProviderProps {
    children: ReactNode; // Type for children prop
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading

    // Check localStorage for token on initial load
    useEffect(() => {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('authUser');
        console.log("AuthProvider Mount: Stored Token:", storedToken); // Log on load
        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error("Failed to parse user data from localStorage", error);
                localStorage.removeItem('authToken'); // Clear bad data
                localStorage.removeItem('authUser');
            }
        }
        setIsLoading(false); // Finished loading state from storage
    }, []);

    const login = (newToken: string, userData: User) => {
        console.log("AuthProvider Login: Setting Token:", newToken); // Log during login
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authUser', JSON.stringify(userData)); // Store user info too
    };

    const logout = () => {
        console.log("AuthProvider Logout: Clearing Token"); // Log on logout
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        // Optionally redirect to login page or home page here using useNavigate if needed outside component logic
    };

    const value = {
        token,
        user,
        isAuthenticated: !!token, // True if token is not null/empty
        isLoading,
        login,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Create a custom hook to easily use the context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};