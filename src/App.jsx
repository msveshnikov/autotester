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
    const [user, setUser] = useState();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetch(`${API_URL}/api/profile`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
                .then((res) => res.json())
                .then((data) => {
                    setUser(data);
                })
                .catch((error) => {
                    console.error('Failed to fetch profile:', error);
                    localStorage.removeItem('token'); // Remove invalid token
                    setUser(null);
                });
        }
    }, []);

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
                            Loading...
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
                                            <Route path="/" element={<Landing />} />

                                            <Route path="/privacy" element={<Privacy />} />
                                            <Route path="/terms" element={<Terms />} />
                                            <Route path="/login" element={<Login />} />
                                            <Route path="/signup" element={<SignUp />} />
                                            <Route path="/forgot" element={<Forgot />} />
                                            {/* Profile route requires authentication - implement protection if needed */}
                                            <Route path="/profile" element={<Profile />} />
                                            {/* Feedback route can be accessed by anyone */}
                                            <Route path="/feedback" element={<Feedback />} />
                                            <Route
                                                path="/reset-password/:token"
                                                element={<Reset />}
                                            />
                                            {/* Admin route requires admin privileges - implement protection */}
                                            <Route path="/admin" element={<Admin />} />
                                            {/* Docs route */}
                                            <Route path="/docs/*" element={<Docs />} />

                                            {/* Redirect unknown routes to home */}
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Routes>
                                    </VStack>
                                </Container>
                                {/* Bottom navigation might need updates for AutoTester.dev specific routes */}
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
