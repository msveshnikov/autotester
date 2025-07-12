# Documentation for `server\admin.js`

## File Path

`server\admin.js`

## Overview

This file defines the API routes specifically designed for administrative operations within the
application. It provides endpoints for managing users (listing, deleting, updating subscription
status), managing test plans (listing, viewing, deleting), managing test reports (listing, viewing,
deleting), and retrieving dashboard statistics. All routes defined in this file are protected by
authentication and require the user to have administrative privileges.

## Role in Project Structure

As seen in the provided project structure, `server/admin.js` resides in the `server` directory
alongside other backend modules like `index.js`, `user.js`, `gemini.js`, etc. It acts as a dedicated
module for handling backend logic related to the admin panel. The main server file
(`server/index.js`) is expected to import the `adminRoutes` function from this file and register
these routes with the Express application instance. It interacts with the database models
(`server/models/User.js`, `server/models/TestPlan.js`, `server/models/TestReport.js`) and relies on
authentication and authorization middleware (`server/middleware/auth.js`).

## Dependencies

- `./middleware/auth.js`: Provides `authenticateToken` (verifies JWT token) and `isAdmin` (checks if
  the authenticated user has admin role) middleware functions used to protect all admin routes.
- `./models/User.js`: Mongoose model for interacting with the `users` collection.
- `./models/TestPlan.js`: Mongoose model for interacting with the `testplans` collection.
- `./models/TestReport.js`: Mongoose model for interacting with the `testreports` collection.

## Function Description

### `adminRoutes`

This function is responsible for registering all admin-specific API routes with an Express
application instance.
