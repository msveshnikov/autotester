import { ChakraProvider, Box, Container, VStack, extendTheme } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './Landing';
import { Suspense, createContext, useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './Navbar';
import Terms from './Terms';
import Privacy from './Privacy';
import Login from './Login';
import SignUp from './SignUp';
import Feedback from './Feedback';
import Admin from './Admin';
import Docs from './Docs';
import Forgot from './Forgot';
import Reset from './Reset';
import Profile from './Profile';
import { BottomNavigationBar } from './BottomNavigationBar';

export const API_URL = import.meta.env.DEV ? 'http://localhost:3000' : 'https://autotester.dev';
export const UserContext = createContext(null);

const theme = extendTheme({
    colors: {
        primary: {
            500: '#3498DB' // Keep original theme colors for now, as no new branding specified
        },
        secondary: {
            500: '#2980B9',
            600: '#2471A3'
        },
        accent: {
            500: '#F1C40F',
            600: '#E67E22'
        }
    },
    fonts: {
        heading: 'Montserrat, sans-serif',
        body: 'Open Sans, sans-serif'
    }
});

function App() {
    const [user, setUser] = useState(undefined); // Use undefined initially to indicate loading

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetch(`${API_URL}/api/profile`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error('Profile fetch failed');
                    }
                    return res.json();
                })
                .then((data) => {
                    setUser(data);
                })
                .catch((error) => {
                    console.error('Failed to fetch profile:', error);
                    localStorage.removeItem('token'); // Remove invalid token
                    setUser(null); // Set user to null on failure
                });
        } else {
            setUser(null); // No token, set user to null immediately
        }
    }, []);

    // Show loading indicator while user status is being determined
    if (user === undefined) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                Loading user...
            </Box>
        );
    }

    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <ChakraProvider theme={theme}>
                <Suspense
                    fallback={
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            height="100vh"
                        >
                            Loading application...
                        </Box>
                    }
                >
                    <UserContext.Provider value={{ user, setUser }}>
                        <Router>
                            <Box pb="50px" minH="100vh" bg="gray.50">
                                <Navbar />
                                <Container maxW="container.xl" py={8}>
                                    <VStack spacing={8}>
                                        <Routes>
                                            {/* Landing page is the primary route */}
                                            <Route path="/" element={<Landing />} />

                                            {/* Static pages */}
                                            <Route path="/privacy" element={<Privacy />} />
                                            <Route path="/terms" element={<Terms />} />
                                            <Route path="/docs/*" element={<Docs />} />

                                            {/* Authentication pages */}
                                            <Route path="/login" element={<Login />} />
                                            <Route path="/signup" element={<SignUp />} />
                                            <Route path="/forgot" element={<Forgot />} />
                                            <Route
                                                path="/reset-password/:token"
                                                element={<Reset />}
                                            />

                                            {/* User specific pages */}
                                            {/* Protect profile route - redirect if not logged in */}
                                            <Route
                                                path="/profile"
                                                element={user ? <Profile /> : <Navigate to="/login" replace />}
                                            />
                                            {/* Feedback route can be accessed by anyone */}
                                            <Route path="/feedback" element={<Feedback />} />

                                            {/* Admin route - protect with admin check */}
                                            <Route
                                                path="/admin"
                                                element={user?.isAdmin ? <Admin /> : <Navigate to="/" replace />}
                                            />

                                            {/* Redirect unknown routes to home */}
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Routes>
                                    </VStack>
                                </Container>
                                {/* Bottom navigation might need updates for AutoTester.dev specific routes */}
                                {/* Consider conditionally rendering based on route if needed */}
                                <BottomNavigationBar />
                            </Box>
                        </Router>
                    </UserContext.Provider>
                </Suspense>
            </ChakraProvider>
        </GoogleOAuthProvider>
    );
}

export default App;