# Server Entry Point (`server/index.js`) Documentation

This file serves as the main entry point for the AutoTester.dev backend application. It sets up the
Express server, configures middleware, connects to the MongoDB database, defines core API routes,
and integrates other route modules for user and administrative functionalities.

## Overview

`server/index.js` is responsible for:

1.  **Server Initialization:** Creating and configuring the Express application instance.
2.  **Middleware Setup:** Applying essential middleware for handling requests (CORS, JSON parsing,
    logging, compression, rate limiting, metrics).
3.  **Database Connection:** Establishing a connection to the MongoDB database using Mongoose.
4.  **Model Definition:** Defining the `Feedback` Mongoose schema locally.
5.  **Core API Routes:** Implementing specific API endpoints related to AI test generation
    (`/api/tests/generate`), test execution triggering (`/api/tests/:id/run`), and fetching test
    plans/reports (`/api/tests`, `/api/tests/:id`).
6.  **Route Integration:** Mounting separate route handlers for user (`./user.js`) and admin
    (`./admin.js`) functionalities.
7.  **Stripe Webhook:** Handling incoming events from Stripe for subscription management.
8.  **Documentation Route:** Serving content from local Markdown files.
9.  **Static File Serving:** Serving the client-side build files (`../dist`) and public assets
    (`../public`).
10. **Client-Side Routing Fallback:** Handling non-API GET requests by serving the main `index.html`
    for client-side routing.
11. **Error Handling:** Implementing middleware for catching and responding to errors.
12. **Process Management:** Listening for uncaught exceptions and unhandled rejections.

It utilizes various external libraries and internal modules from the `server` directory (e.g.,
`models`, `middleware`, `utils`, `gemini`, `search`, `user`, `admin`) to perform its tasks.

## Dependencies

### External Libraries

- `express`: Web application framework.
- `cors`: Middleware to enable Cross-Origin Resource Sharing.
- `express-prom-bundle`: Middleware to expose Prometheus metrics.
- `fs/promises`: Node.js built-in module for file system operations using Promises.
- `dotenv`: Loads environment variables from a `.env` file.
- `stripe`: Stripe Node.js library for payment processing and webhooks.
- `express-rate-limit`: Basic rate limiting middleware.
- `mongoose`: MongoDB object modeling tool.
- `morgan`: HTTP request logger middleware.
- `compression`: Middleware to compress response bodies.
- `path`: Node.js built-in module for working with file and directory paths.
- `url`: Node.js built-in module for URL resolution and parsing.

### Internal Modules

- `./gemini.js`: Provides utility functions for interacting with the Gemini AI model
  (`getTextGemini`).
- `./models/User.js`: Mongoose model for user data.
- `./models/TestCase.js`: Mongoose model for saved AI-generated test plans.
- `./models/TestReport.js`: Mongoose model for test execution reports.
- `./models/Project.js`: Mongoose model for project data (imported but not explicitly used in the
  documented routes within `index.js`).
- `./middleware/auth.js`: Provides authentication middleware (`authenticateToken`,
  `authenticateTokenOptional`).
- `./user.js`: Express router defining user-related API routes.
- `./admin.js`: Express router defining administrative API routes.
- `./search.js`: Provides utility functions for fetching web content (`fetchPageContent`).
- `./utils.js`: Provides general utility functions (`extractCodeSnippet`).

## Configuration

The server is configured using environment variables, typically loaded from a `.env` file via
`dotenv`. Key configuration points include:

- `PORT`: The port the server listens on (defaults to 3000).
- `MONGODB_URI`: The connection string for the MongoDB database.
- `STRIPE_KEY`: Your Stripe secret key.
- `STRIPE_WH_SECRET`: Your Stripe webhook secret for verifying webhook signatures.
- `NODE_ENV`: The current environment (`development`, `production`, etc.), affects logging, rate
  limiting, and error detail verbosity.
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to the Google Cloud service account key file for AI access
  (defaults to `./google.json` if not set, with a warning).
- `GA_MEASUREMENT_ID`, `GA_API_SECRET`: Google Analytics credentials (commented out in the provided
  code).

## Initialization

The server initializes by:

1.  Loading environment variables.
2.  Creating an Express application instance.
3.  Setting `app.set('trust proxy', 1)` to correctly determine the client's IP address when behind
    proxies (like load balancers or Heroku).
4.  Connecting to MongoDB using `mongoose.connect()`.
5.  Defining the local `Feedback` Mongoose model.

## Middleware

The following middleware are used:

- **Stripe Raw Body Middleware:** A custom middleware applied _only_ to `/api/stripe-webhook` to get
  the raw request body needed for Stripe signature verification.
- **`express.json({ limit: '15mb' })`:** Parses incoming requests with JSON payloads. Applied to all
  routes _except_ the Stripe webhook. Sets a payload limit of 15MB.
- **`express-prom-bundle` (`metricsMiddleware`)**: Collects and exposes Prometheus metrics about
  HTTP requests (method, path, status code). Includes a custom label `model` to track AI model usage
  based on the request body.
- **`cors()`:** Enables CORS for all origins (default configuration), allowing the frontend served
  from a different origin to communicate with the backend.
- **`express.static()`:** Serves static files. One instance serves files from the `../dist`
  directory (typically the client-side build), and another serves files from `../public`.
- **`morgan('dev')`:** Logs incoming HTTP requests to the console in a developer-friendly format.
- **`compression()`:** Compresses response bodies for eligible requests, reducing data transfer
  size.
- **`express-rate-limit` (`limiter`)**: Limits the rate of requests to `/api/` routes. Configured to
  allow a maximum of 130 requests per 15-minute window per IP address. **This middleware is only
  applied when `NODE_ENV` is `production`.**
- **`authenticateToken`**: Custom middleware (from `./middleware/auth.js`) that verifies a JWT token
  in the `Authorization` header and attaches the authenticated user's details to `req.user`. Used on
  routes requiring authentication.
- **`authenticateTokenOptional`**: Custom middleware (from `./middleware/auth.js`) that attempts to
  verify a JWT token but allows the request to proceed even if no token is present or valid. If a
  token is valid, `req.user` is set. Used on routes where authentication is optional (e.g.,
  feedback).
- **`checkAiLimit`**: Custom middleware that checks and enforces the daily AI usage limit for free
  users (`subscriptionStatus` not 'active' or 'trialing'). It increments the user's `aiRequestCount`
  and updates `lastAiRequestTime`. Returns a 429 status code if the limit is reached. Used on
  AI-generating routes.

## Models

The following Mongoose models are used within this file:

- `User` (imported): Represents a user in the database. Used by `checkAiLimit` and the Stripe
  webhook handler.
- `TestCase` (imported): Represents a saved test plan, typically generated by AI. Used for saving
  and retrieving test plans.
- `TestReport` (imported): Represents a record of a test execution run. Used for creating and
  retrieving test reports.
- `Project` (imported): Represents a project (imported but not directly used in the core routes
  defined in `index.js`).
- `Feedback` (defined locally): Represents user feedback submissions.

## Internal Utility Functions

- ### `generateAIResponse(prompt, model, temperature = 0.7)`

    Asynchronously generates a text response from an AI model. Currently hardcoded to use the
    `getTextGemini` function from `./gemini.js`.

    - **Parameters:**
        - `prompt` (`string`): The text prompt to send to the AI model.
        - `model` (`string`): The name of the AI model to use (expected by `getTextGemini`, e.g.,
          'gemini-pro').
        - `temperature` (`number`, optional): Controls the randomness of the output. Defaults to
          `0.7`.
    - **Returns:**
        - `Promise<string>`: A promise that resolves with the generated text response from the AI.
    - **Throws:**
        - `Error`: If the AI model call fails.

- ### `getIpFromRequest(req)`

    Extracts the client's IP address from an Express request object, considering common headers like
    `x-real-ip` and `x-forwarded-for`.

    - **Parameters:**
        - `req` (`object`): The Express request object.
    - **Returns:**
        - `string`: The extracted IP address, or an empty string if none could be determined.

- ### `checkAiLimit(req, res, next)`

    _See Middleware section._ This function is a middleware defined locally to handle AI usage
    limits for free users.

## API Routes Defined in `index.js`

- ### `POST /api/tests/generate`

    Triggers the AI-powered generation of a test plan based on provided documentation and
    application URLs. Requires user authentication and checks against daily AI usage limits for free
    users.

    - **Middleware:** `authenticateToken`, `checkAiLimit`
    - **Request Body:**
        - `docLink` (`string`, required): URL of the documentation.
        - `appUrl` (`string`, required): URL of the application under test.
        - `model` (`string`, optional): The AI model name to use (defaults to 'gemini-pro').
    - **Steps:**
        1.  Validate required inputs (`docLink`, `appUrl`).
        2.  Fetch content from `docLink` using `fetchPageContent`. Logs a warning if fetching fails
            but proceeds.
        3.  Construct a detailed prompt for the AI, including `appUrl` and documentation content.
        4.  Call `generateAIResponse` with the prompt and specified model.
        5.  Attempt to extract and parse a JSON object from the AI's response using
            `extractCodeSnippet` and `JSON.parse`. Includes basic validation of the parsed
            structure.
        6.  Save the parsed test plan to the database using the `TestCase` model, associating it
            with the authenticated user.
        7.  Return the saved test plan ID and the generated plan JSON.
    - **Response (201 Created):**
        ```json
        {
          "message": "Test plan generated and saved successfully.",
          "testPlanId": "...", // ID of the saved TestCase document
          "generatedPlan": [ ... ] // The JSON array of test cases
          // rawAiResponse included in development mode
        }
        ```
    - **Response (400 Bad Request):** If `docLink` or `appUrl` is missing.
    - **Response (429 Too Many Requests):** If the free user AI usage limit is reached.
    - **Response (401 Unauthorized):** If not authenticated.
    - **Response (500 Internal Server Error):** If fetching content, calling AI, parsing AI
      response, or saving to DB fails.

- ### `POST /api/tests/:id/run`

    Initiates a test execution run for a previously generated test plan. Creates a new `TestReport`
    entry with a 'queued' status. **Note: The actual test execution engine is a placeholder and
    needs separate implementation.**

    - **Middleware:** `authenticateToken`
    - **URL Parameters:**
        - `id` (`string`, required): The ID of the `TestCase` (test plan) to run.
    - **Steps:**
        1.  Retrieve the `TestCase` document by ID.
        2.  Check if the authenticated user owns the test plan or is an admin.
        3.  Create a new `TestReport` document in the database with status 'queued', linked to the
            `TestCase` and the user.
        4.  **Placeholder:** Log a warning indicating that the actual execution needs to be
            triggered by a separate service.
        5.  Return the ID and initial status of the created `TestReport`.
    - **Response (202 Accepted):**
        ```json
        {
            "message": "Test run initiated and queued successfully.",
            "runId": "...", // ID of the created TestReport document
            "testPlanId": "...", // ID of the linked TestCase document
            "status": "queued"
        }
        ```
    - **Response (401 Unauthorized):** If not authenticated.
    - **Response (403 Forbidden):** If the user does not own the test plan and is not an admin.
    - **Response (404 Not Found):** If the test plan ID does not exist.
    - **Response (500 Internal Server Error):** If database operations fail.

- ### `GET /api/tests/:id`

    Retrieves details for a specific test plan (`TestCase`) or test report (`TestReport`) by its ID.
    It first attempts to find a report and, if not found, attempts to find a plan. Requires user
    authentication and checks ownership.

    - **Middleware:** `authenticateToken`
    - **URL Parameters:**
        - `id` (`string`, required): The ID of the `TestCase` or `TestReport` document.
    - **Steps:**
        1.  Attempt to find a `TestReport` by ID, populating the linked `testPlanId`.
        2.  If not found, attempt to find a `TestCase` by ID.
        3.  If still not found, return 404.
        4.  Check if the authenticated user is the owner of the found document (either the report or
            the plan) or is an admin.
        5.  Return the document data and its type ('plan' or 'report').
    - **Response (200 OK):**
        ```json
        {
          "message": "Successfully retrieved report details." OR "Successfully retrieved plan details.",
          "type": "report" OR "plan",
          "data": { ... } // The TestCase or TestReport document
        }
        ```
    - **Response (401 Unauthorized):** If not authenticated.
    - **Response (403 Forbidden):** If the user does not own the document and is not an admin.
    - **Response (404 Not Found):** If no document with the given ID is found.
    - **Response (500 Internal Server Error):** If database operations fail.

- ### `GET /api/tests`

    Lists all test plans and reports associated with the authenticated user. Supports basic
    filtering and pagination via query parameters.

    - **Middleware:** `authenticateToken`
    - **Query Parameters:**
        - `type` (`string`, optional): Filter by document type ('plan' or 'report'). If omitted,
          returns both.
        - `status` (`string`, optional): Filter reports by status (e.g., 'queued', 'running',
          'completed', 'failed'). Only applies when fetching reports.
        - `search` (`string`, optional): Case-insensitive search string. For plans, searches
          `docLink` and `appUrl`. For reports, searches the linked plan's `docLink` and `appUrl`.
        - `limit` (`number`, optional): Maximum number of results to return (defaults to 100).
        - `skip` (`number`, optional): Number of results to skip for pagination (defaults to 0).
    - **Steps:**
        1.  Get the authenticated user's ID.
        2.  Construct MongoDB queries based on user ID and query parameters (`type`, `status`,
            `search`).
        3.  Fetch `TestCase` documents if `type` is 'plan' or omitted.
        4.  Fetch `TestReport` documents if `type` is 'report' or omitted. Populate `testPlanId` for
            reports to enable search on plan details.
        5.  Apply in-memory filtering for search on reports after population (for simplicity).
        6.  Combine the lists of plans and reports.
        7.  Sort the combined list by `createdAt` date descending.
        8.  Return the list of documents.
    - **Response (200 OK):**
        ```json
        {
          "message": "Successfully retrieved tests and reports for user ...",
          "data": [
            { ... , "type": "plan" }, // TestCase document with added type field
            { ... , "type": "report" } // TestReport document (possibly with populated testPlanId) with added type field
            // ...
          ]
        }
        ```
    - **Response (401 Unauthorized):** If not authenticated.
    - **Response (500 Internal Server Error):** If database operations fail.

- ### `POST /api/feedback`

    Allows users (authenticated or optional) to submit feedback (bug report, feature request, or
    general).

    - **Middleware:** `authenticateTokenOptional`
    - **Request Body:**
        - `message` (`string`, required): The feedback message.
        - `type` (`string`, required): The type of feedback ('bug', 'feature', or 'general').
    - **Steps:**
        1.  Validate the `type` parameter.
        2.  Create a new `Feedback` document using the locally defined schema.
        3.  Associate the feedback with the authenticated user's ID if available (`req.user.id`).
        4.  Save the feedback to the database.
        5.  Return the created feedback document.
    - **Response (201 Created):** The saved `Feedback` document.
    - **Response (400 Bad Request):** If `message` is missing or `type` is invalid.
    - **Response (500 Internal Server Error):** If saving to the database fails.

- ### `POST /api/stripe-webhook`

    Handles incoming webhook events from Stripe. Used to update user subscription status based on
    Stripe events like subscription creation, updates, and deletion, and payment success/failure.

    - **Middleware:** Custom raw body parser, `express.raw({ type: 'application/json' })`.
    - **Steps:**
        1.  Verify the authenticity of the webhook event using `stripe.webhooks.constructEventAsync`
            and the `STRIPE_WH_SECRET`.
        2.  Process different event types using a `switch` statement.
        3.  For `customer.subscription.*` events, retrieve the customer details from Stripe, find
            the corresponding user in the database by email, and update their `subscriptionStatus`,
            `subscriptionId`, and `customerId`. Uses `findOneAndUpdate` with `upsert: true`.
        4.  Logs other relevant events like `invoice.payment_succeeded` and
            `invoice.payment_failed`.
        5.  Responds with `{ received: true }`.
    - **Response (200 OK):** `{ received: true }` on successful processing.
    - **Response (400 Bad Request):** If webhook signature verification fails.
    - **Response (500 Internal Server Error):** If processing fails after verification (e.g.,
      database error).

- ### `GET /api/docs`

    Retrieves and filters documentation content from local Markdown files.

    - **Query Parameters:**
        - `search` (`string`, optional): Filters documents by case-insensitive search in title,
          content, or filename.
        - `category` (`string`, optional): Filters documents by category (currently a placeholder,
          defaults to 'general') or filename.
    - **Steps:**
        1.  Reads filenames from the `../docs` directory. Handles cases where the directory doesn't
            exist.
        2.  For each `.md` file, reads its content. Extracts a title from the filename and assigns a
            placeholder category ('general').
        3.  Filters the list based on the `search` and `category` query parameters.
        4.  Returns an array of document objects, each containing `title`, `category`, `content`,
            and `filename`.
    - **Response (200 OK):** An array of document objects. Returns an empty array if the docs
      directory doesn't exist or no documents match the criteria.
    - **Response (500 Internal Server Error):** If there's an error reading the docs directory or
      files (other than directory not found).

## Integrated Routes

- **`userRoutes(app)`:** Integrates routes defined in `server/user.js`. These typically handle user
  registration, login, profile management, etc.
- **`adminRoutes(app)`:** Integrates routes defined in `server/admin.js`. These typically handle
  administrative tasks. **Note:** The code comment indicates `admin.js` might expect a
  `Presentation` model which is not explicitly defined or imported in `index.js` or the listed
  models. This could be a potential point of failure if `admin.js` relies on this model.

## Static File Serving and Client-Side Routing Fallback

- `app.use(express.static(join(__dirname, '../dist')))`: Serves static assets (JS, CSS, images,
  etc.) from the client build output directory.
- `app.use(express.static(join(__dirname, '../public')))`: Serves static assets from the `public`
  directory.
- `app.get('*', ...)`: A catch-all GET route. If a GET request path doesn't match any API route or
  static file, this handler serves the `../dist/index.html` file. This is essential for single-page
  applications using client-side routing. It includes a check to return 404 for requests with file
  extensions (`.`) that weren't found by the static middleware.

## Error Handling

- **API 404 Handler:** An `app.use('/api', ...)` middleware is registered _after_ specific `/api`
  routes. If a request path starts with `/api` but doesn't match any defined API route, this
  middleware sends a 404 JSON response.
- **General Error Handler:** An `app.use((err, req, res, next) => { ... })` middleware catches
  errors propagated via `next(err)` or uncaught errors in the stack. It logs the error (including
  stack trace), prevents sending headers if they've already been sent, and sends a JSON response
  with an appropriate status code (defaults to 500) and an error message. In `development` mode, it
  includes the error stack in the response.

## Process Listeners

- `process.on('uncaughtException', ...)`: Catches exceptions that were not caught by a try/catch
  block anywhere in the application. Logs the error and its origin.
- `process.on('unhandledRejection', ...)`: Catches Promises that were rejected but did not have a
  `.catch()` handler. Logs the reason and the promise.
    - **Note:** Both listeners include comments suggesting graceful shutdown in production
      environments, although the current implementation only logs the errors.

## Usage

To start the server, ensure environment variables (especially `MONGODB_URI`, `STRIPE_KEY`,
`STRIPE_WH_SECRET`) are set correctly, and then execute this file using Node.js:
