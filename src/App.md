# File: src\App.jsx

This file serves as the main entry point and root component for the frontend React application. It
sets up the core providers required for the application, defines global constants and theme, handles
initial user authentication state management, and configures the application's routing using
`react-router-dom`.

## Overview

`App.jsx` is the top-level component that orchestrates the entire user interface. It wraps the
application in necessary contexts and providers (`ChakraProvider`, `GoogleOAuthProvider`,
`UserContext`), manages the initial loading and authentication state of the user, defines the main
application layout (including navigation), and renders different components based on the current URL
path using React Router.

## Role in Project

As per the project structure, `src/App.jsx` is located at the root of the `src` directory. It is
imported by `src/main.jsx`, which is typically the actual entry point for rendering the React
application into the DOM. `App.jsx` acts as the central hub, importing and composing most of the
other components found in the `src` directory (like `Landing`, `Navbar`, `Login`, `Profile`, etc.)
and determining which component to render based on the route. It interacts with the backend server
(defined in the `server/` directory) by fetching user profile data on application load via an API
call using the `API_URL` constant.

## Imports

The file imports various modules and components:

- **External Libraries:**
    - `@chakra-ui/react`: For UI components and styling (`ChakraProvider`, `Box`, `Container`,
      `VStack`, `extendTheme`).
    - `react-router-dom`: For client-side routing (`BrowserRouter as Router`, `Routes`, `Route`,
      `Navigate`).
    - `react`: Core React library (`Suspense`, `createContext`, `useEffect`, `useState`).
    - `@react-oauth/google`: For Google OAuth integration (`GoogleOAuthProvider`).
- **Internal Components (from `src/`):**
    - `Landing`: The main landing page component.
    - `Navbar`: The top navigation bar.
    - `Terms`: Component for displaying terms and conditions.
    - `Privacy`: Component for displaying the privacy policy.
    - `Login`: Component for user login.
    - `SignUp`: Component for user registration.
    - `Feedback`: Component for submitting feedback.
    - `Admin`: Component for the admin panel (protected route).
    - `Docs`: Component for documentation pages.
    - `Forgot`: Component for initiating password reset.
    - `Reset`: Component for resetting password using a token.
    - `Profile`: Component for displaying/editing user profile (protected route).
    - `BottomNavigationBar`: The bottom navigation bar.

## Constants

- `API_URL`:
    - **Description:** Defines the base URL for backend API calls.
    - **Value:** Conditionally set based on the Vite environment variable `import.meta.env.DEV`.
        - If in development (`import.meta.env.DEV` is true), it's `http://localhost:3000`.
        - If in production, it's `https://autotester.dev`.
    - **Purpose:** Provides a single source of truth for the backend endpoint, adapting
      automatically between development and production environments.
- `UserContext`:
    - **Description:** A React Context created using `createContext(null)`.
    - **Purpose:** Used to share the current user's authentication status (`user` object) and a
      function to update it (`setUser`) across the component tree without needing to pass them down
      explicitly as props.

## Theme Configuration

- `theme`:
    - **Description:** A custom theme object created by extending the default Chakra UI theme using
      `extendTheme()`.
    - **Configuration:**
        - `colors`: Defines custom color palettes (`primary`, `secondary`, `accent`) with different
          shades (e.g., `500`, `600`).
        - `fonts`: Specifies custom font families for headings (`Montserrat, sans-serif`) and body
          text (`Open Sans, sans-serif`).
    - **Purpose:** Provides consistent styling throughout the application based on the defined
      design system.

## `App` Component

The main functional component of the application.

- **Description:** Renders the entire application UI, including global provideautotestervigation,
  and the main content area which changes based on the current route.
- **State:**
    - `user`: Manages the authentication state of the current user.
        - Initially `undefined`: Indicates that the user's authentication status is being determined
          (e.g., fetching profile).
        - `null`: Indicates that no user is logged in.
        - `{ ...userObject }`: Contains the user's data if logged in.
- **Effects:**
    - A `useEffect` hook runs once on component mount (`[]` dependency array).
    - It checks `localStorage` for an authentication `token`.
    - If a `token` exists, it attempts to fetch the user's profile data from the backend
      (`${API_URL}/api/profile`) using the token in the `Authorization` header.
    - On successful profile fetch, the `user` state is updated with the fetched data.
    - If the fetch fails (e.g., invalid or expired token), an error is logged, the invalid token is
      removed from `localStorage`, and the `user` state is set to `null`.
    - If no `token` is found in `localStorage`, the `user` state is immediately set to `null`.
    - **Purpose:** To automatically log in the user if a valid token exists from a previous session
      and determine the initial authentication state.
- **Rendering Logic:**
    - If `user` is `undefined` (initial loading state), it renders a simple "Loading user..."
      message centered on the screen.
    - Once `user` is `null` or an object, the main application structure is rendered.
- **JSX Structure:**
    - Wrapped in `GoogleOAuthProvider` to enable Google Sign-In features.
    - Wrapped in `ChakraProvider` to apply the custom `theme` and enable Chakra UI components.
    - Wrapped in `Suspense` with a loading fallback, ready for potential lazy-loaded components.
    - Wrapped in `UserContext.Provider` to make the `user` state and `setUser` function available to
      all descendant components.
    - Wrapped in `Router` (`BrowserRouter`) to enable client-side routing.
    - A main `Box` container sets a minimum height and background color, and adds padding at the
      bottom (`pb="50px"`) likely to accommodate the bottom navigation bar.
    - `Navbar` is rendered at the top.
    - A `Container` with `VStack` provides a structured content area with spacing.
    - `Routes` component defines the mapping between URL paths and components.
    - `BottomNavigationBar` is rendered at the bottom.

## Routes

The `Routes` component defines the application's navigation paths:

- `<Route path="/" element={<Landing />} />`: The home page.
- `<Route path="/privacy" element={<Privacy />} />`: Privacy policy page.
- `<Route path="/terms" element={<Terms />} />`: Terms and conditions page.
- `<Route path="/docs/*" element={<Docs />} />`: Documentation section, the `/*` allows for nested
  routes within `Docs`.
- `<Route path="/login" element={<Login />} />`: User login page.
- `<Route path="/signup" element={<SignUp />} />`: User registration page.
- `<Route path="/forgot" element={<Forgot />} />`: Forgot password page.
- `<Route path="/reset-password/:token" element={<Reset />} />`: Password reset page, requiring a
  dynamic `:token` parameter from the URL.
- `<Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" replace />} />`: User
  profile page. This route is protected; it renders the `Profile` component only if `user` is truthy
  (logged in), otherwise, it redirects to the `/login` page.
- `<Route path="/feedback" element={<Feedback />} />`: Feedback submission page (accessible to all).
- `<Route path="/admin" element={user?.isAdmin ? <Admin /> : <Navigate to="/" replace />} />`: Admin
  panel page. This route is protected; it renders the `Admin` component only if `user` exists AND
  `user.isAdmin` is truthy, otherwise, it redirects to the home page (`/`).
- `<Route path="*" element={<Navigate to="/" replace />} />`: A catch-all route that redirects any
  unknown or mistyped paths back to the home page (`/`).

## Usage

The `App` component is exported as the default export from this file. It is intended to be imported
and rendered by the application's main entry file, typically `src/main.jsx`, like this:
