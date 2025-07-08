import { Box, Icon, Text } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FiHome, FiUser, FiMessageSquare, FiBookOpen } from 'react-icons/fi';

export const BottomNavigationBar = () => (
    <Box
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        height="50px"
        bg="white"
        borderTopWidth="1px"
        display={{ base: 'flex', md: 'none' }} // Show only on mobile/small screens
        justifyContent="space-around"
        alignItems="center"
        zIndex={1000}
        fontSize="sm"
        sx={{
            '@supports (backdrop-filter: blur(10px))': {
                backdropFilter: 'blur(10px)',
                bg: 'rgba(255, 255, 255, 0.9)'
            }
        }}
    >
        <Box as={Link} to="/" p={2} display="flex" flexDirection="column" alignItems="center">
            <Icon as={FiHome} boxSize={5} />
            <Text fontSize="xs">Home</Text>
        </Box>
        <Box
            as={Link}
            to="/profile"
            p={2}
            display="flex"
            flexDirection="column"
            alignItems="center"
        >
            <Icon as={FiUser} boxSize={5} />
            <Text fontSize="xs">Profile</Text>
        </Box>
        <Box
            as={Link}
            to="/feedback"
            p={2}
            display="flex"
            flexDirection="column"
            alignItems="center"
        >
            <Icon as={FiMessageSquare} boxSize={5} />
            <Text fontSize="xs">Feedback</Text>
        </Box>
        <Box as={Link} to="/docs" p={2} display="flex" flexDirection="column" alignItems="center">
            <Icon as={FiBookOpen} boxSize={5} />
            <Text fontSize="xs">Docs</Text>
        </Box>
    </Box>
);
