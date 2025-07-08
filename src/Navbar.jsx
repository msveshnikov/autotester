import { useContext } from 'react';
import {
    Box,
    Flex,
    Text,
    IconButton,
    Button,
    Stack,
    Collapse,
    Icon,
    Link,
    Popover,
    PopoverTrigger,
    PopoverContent,
    useDisclosure,
    useColorModeValue
} from '@chakra-ui/react';
import { HamburgerIcon, CloseIcon, ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { UserContext } from './App';

export default function Navbar() {
    const { isOpen, onToggle } = useDisclosure();
    const { user, setUser } = useContext(UserContext);
    const navigate = useNavigate();
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    const handleNavClick = () => {
        if (isOpen) onToggle();
    };

    const NAV_ITEMS = [
        { label: 'Docs', href: '/docs', requiresAuth: false }, // Added Docs link
        { label: 'Feedback', href: '/feedback', requiresAuth: false },
        ...(user?.isAdmin ? [{ label: 'Admin', href: '/admin', requiresAuth: true }] : [])
    ];

    const filteredNavItems = NAV_ITEMS.filter((item) => !item.requiresAuth || user?.email);

    return (
        <Box position="sticky" top="0" zIndex="1000">
            <Flex
                bg={bgColor}
                color={useColorModeValue('gray.600', 'white')}
                minH="60px"
                py={{ base: 2 }}
                px={{ base: 4 }}
                borderBottom={1}
                borderStyle="solid"
                borderColor={borderColor}
                align="center"
                boxShadow="sm"
            >
                <Flex
                    flex={{ base: 1, md: 'auto' }}
                    ml={{ base: -2 }}
                    display={{ base: 'flex', md: 'none' }}
                >
                    {filteredNavItems.length > 0 && ( // Only show hamburger if there are items
                        <IconButton
                            onClick={onToggle}
                            icon={
                                isOpen ? <CloseIcon w={3} h={3} /> : <HamburgerIcon w={5} h={5} />
                            }
                            variant="ghost"
                            aria-label="Toggle Navigation"
                        />
                    )}
                </Flex>
                <Flex flex={{ base: 1 }} justify={{ base: 'center', md: 'start' }} align="center">
                    {/* Site Title/Logo */}
                    <Link
                        as={RouterLink}
                        to="/"
                        onClick={handleNavClick}
                        _hover={{ textDecoration: 'none' }}
                    >
                        <Text
                            fontFamily="heading"
                            fontWeight="bold"
                            fontSize={{ base: 'md', md: 'lg' }}
                            color={useColorModeValue('gray.800', 'white')}
                        >
                            AutoTester.dev
                        </Text>
                    </Link>

                    {/* Desktop Navigation */}
                    <Flex display={{ base: 'none', md: 'flex' }} ml={10}>
                        <DesktopNav navItems={filteredNavItems} />
                    </Flex>
                </Flex>

                {/* Auth/Profile Buttons */}
                <Stack flex={{ base: 1, md: 0 }} justify="flex-end" direction="row" spacing={6}>
                    {user?.email ? (
                        <>
                            <Button
                                as={RouterLink}
                                to="/profile"
                                variant="ghost"
                                fontSize="sm"
                                fontWeight={400}
                                onClick={handleNavClick}
                            >
                                Profile
                            </Button>
                            <Button
                                onClick={() => {
                                    handleNavClick();
                                    handleLogout();
                                }}
                                colorScheme="red"
                                variant="outline"
                                fontSize="sm"
                                fontWeight={600}
                            >
                                Sign Out
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                as={RouterLink}
                                to="/login"
                                variant="ghost"
                                onClick={handleNavClick}
                            >
                                Login
                            </Button>
                            <Button
                                as={RouterLink}
                                to="/signup"
                                display={{ base: 'none', md: 'inline-flex' }}
                                fontSize="sm"
                                fontWeight={600}
                                color="white"
                                bg="primary.500" // Using primary color from theme
                                onClick={handleNavClick}
                                _hover={{
                                    bg: 'secondary.500' // Using secondary color from theme
                                }}
                            >
                                Sign Up
                            </Button>
                        </>
                    )}
                </Stack>
            </Flex>

            {/* Mobile Navigation */}
            {filteredNavItems.length > 0 && ( // Only show collapse if there are items
                <Collapse in={isOpen} animateOpacity>
                    <MobileNav navItems={filteredNavItems} onNavClick={handleNavClick} />
                </Collapse>
            )}
        </Box>
    );
}

const DesktopNav = ({ navItems }) => {
    const linkColor = useColorModeValue('gray.600', 'gray.200');
    const linkHoverColor = useColorModeValue('gray.800', 'white');
    const popoverContentBgColor = useColorModeValue('white', 'gray.800');

    return (
        <Stack direction="row" spacing={4}>
            {navItems.map((navItem) => (
                <Box key={navItem.label}>
                    <Popover trigger="hover" placement="bottom-start">
                        <PopoverTrigger>
                            <Link
                                p={2}
                                as={RouterLink}
                                to={navItem.href ?? '#'}
                                fontSize="sm"
                                fontWeight={500}
                                color={linkColor}
                                _hover={{
                                    textDecoration: 'none',
                                    color: linkHoverColor
                                }}
                            >
                                {navItem.label}
                            </Link>
                        </PopoverTrigger>
                        {navItem.children && (
                            <PopoverContent
                                border={0}
                                boxShadow="xl"
                                bg={popoverContentBgColor}
                                p={4}
                                rounded="xl"
                                minW="sm"
                            >
                                <Stack>
                                    {navItem.children.map((child) => (
                                        <DesktopSubNav key={child.label} {...child} />
                                    ))}
                                </Stack>
                            </PopoverContent>
                        )}
                    </Popover>
                </Box>
            ))}
        </Stack>
    );
};

const DesktopSubNav = ({ label, href, subLabel }) => {
    return (
        <Link
            as={RouterLink}
            to={href}
            role="group"
            display="block"
            p={2}
            rounded="md"
            _hover={{ bg: useColorModeValue('blue.50', 'gray.900') }}
        >
            <Stack direction="row" align="center">
                <Box>
                    <Text
                        transition="all .3s ease"
                        _groupHover={{ color: 'primary.500' }} // Using primary color
                        fontWeight={500}
                    >
                        {label}
                    </Text>
                    <Text fontSize="sm">{subLabel}</Text>
                </Box>
                <Flex
                    transition="all .3s ease"
                    transform="translateX(-10px)"
                    opacity={0}
                    _groupHover={{ opacity: 1, transform: 'translateX(0)' }}
                    justify="flex-end"
                    align="center"
                    flex={1}
                >
                    <Icon color="primary.500" w={5} h={5} as={ChevronRightIcon} />{' '}
                    {/* Using primary color */}
                </Flex>
            </Stack>
        </Link>
    );
};

const MobileNav = ({ navItems, onNavClick }) => {
    return (
        <Stack bg={useColorModeValue('white', 'gray.800')} p={4} display={{ md: 'none' }}>
            {navItems.map((navItem) => (
                <MobileNavItem key={navItem.label} {...navItem} onNavClick={onNavClick} />
            ))}
            {/* Add Profile/Auth links in Mobile Nav if not already there */}
            <Stack
                spacing={4}
                mt={4}
                borderTop="1px"
                borderColor={useColorModeValue('gray.200', 'gray.700')}
                pt={4}
            >
                {/* Profile/Sign Out or Login/Sign Up */}
                {useContext(UserContext).user?.email ? (
                    <>
                        <Link
                            py={2}
                            as={RouterLink}
                            to="/profile"
                            onClick={onNavClick}
                            fontWeight={600}
                            color={useColorModeValue('gray.600', 'gray.200')}
                        >
                            Profile
                        </Link>
                        <Link
                            py={2}
                            onClick={() => {
                                onNavClick();
                                useContext(UserContext).setUser(null); // Directly update context
                                localStorage.removeItem('token');
                                useNavigate()('/'); // Use navigate from hook or pass it down
                            }}
                            fontWeight={600}
                            color="red.500"
                        >
                            Sign Out
                        </Link>
                    </>
                ) : (
                    <>
                        <Link
                            py={2}
                            as={RouterLink}
                            to="/login"
                            onClick={onNavClick}
                            fontWeight={600}
                            color={useColorModeValue('gray.600', 'gray.200')}
                        >
                            Login
                        </Link>
                        <Link
                            py={2}
                            as={RouterLink}
                            to="/signup"
                            onClick={onNavClick}
                            fontWeight={600}
                            color={useColorModeValue('gray.600', 'gray.200')}
                        >
                            Sign Up
                        </Link>
                    </>
                )}
            </Stack>
        </Stack>
    );
};

const MobileNavItem = ({ label, children, href, onNavClick }) => {
    const { isOpen, onToggle } = useDisclosure();
    const navigate = useNavigate(); // Use navigate hook here

    const handleClick = () => {
        if (children) {
            onToggle();
        } else {
            onNavClick();
            if (href) {
                navigate(href); // Use navigate to handle navigation
            }
        }
    };

    return (
        <Stack spacing={4} onClick={handleClick}>
            <Flex
                py={2}
                // as={RouterLink} // Removed as={RouterLink} from Flex
                // to={href ?? '#'} // Removed to from Flex
                justify="space-between"
                align="center"
                _hover={{
                    textDecoration: 'none'
                }}
                cursor="pointer" // Add cursor pointer to indicate interactivity
            >
                <Text fontWeight={600} color={useColorModeValue('gray.600', 'gray.200')}>
                    {label}
                </Text>
                {children && (
                    <Icon
                        as={ChevronDownIcon}
                        transition="all .25s ease-in-out"
                        transform={isOpen ? 'rotate(180deg)' : ''}
                        w={6}
                        h={6}
                    />
                )}
            </Flex>
            <Collapse in={isOpen} animateOpacity style={{ marginTop: '0!important' }}>
                <Stack
                    mt={2}
                    pl={4}
                    borderLeft={1}
                    borderStyle="solid"
                    borderColor={useColorModeValue('gray.200', 'gray.700')}
                    align="start"
                >
                    {children &&
                        children.map((child) => (
                            <Link
                                key={child.label}
                                py={2}
                                as={RouterLink}
                                to={child.href}
                                onClick={onNavClick}
                            >
                                {child.label}
                            </Link>
                        ))}
                </Stack>
            </Collapse>
        </Stack>
    );
};
