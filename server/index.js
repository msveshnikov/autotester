import express from 'express';
import cors from 'cors';
import promBundle from 'express-prom-bundle';
import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import morgan from 'morgan';
import compression from 'compression';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import AI core utility
import { getTextGemini } from './gemini.js';

// Import Mongoose Models from server/models
import User from './models/User.js';
import TestCase from './models/TestCase.js'; // Represents a saved test plan
import TestReport from './models/TestReport.js'; // Represents a test execution run
import Project from './models/Project.js'; // Import Project model as per structure

// Import routes and middleware
import userRoutes from './user.js';
import adminRoutes from './admin.js'; // Note: admin.js might expect a 'Presentation' model which is not defined here or in models/
import { authenticateToken, authenticateTokenOptional } from './middleware/auth.js';

// Import utility functions
import { fetchPageContent } from './search.js'; // Utility to fetch web content
import { extractCodeSnippet } from './utils.js'; // Utility to extract code from text

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_KEY);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

// Stripe webhook needs raw body
app.use((req, res, next) => {
    if (req.originalUrl === '/api/stripe-webhook') {
        next();
    } else {
        express.json({ limit: '15mb' })(req, res, next);
    }
});

const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    customLabels: { model: 'No' },
    transformLabels: (labels, req) => {
        // Assuming AI model usage is primarily in /api/tests/generate or similar
        labels.model = req?.body?.model ?? 'No'; // Capture model used for generation
        return labels;
    }
});
app.use(metricsMiddleware);
app.use(cors());
// Serve static files from the 'dist' directory (client build)
app.use(express.static(join(__dirname, '../dist')));
// Serve static files from the 'public' directory
app.use(express.static(join(__dirname, '../public')));
app.use(morgan('dev'));
app.use(compression());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 130 // Limit each IP to 130 requests per windowMs
});

// Apply the rate limiting middleware to API routes in production
if (process.env.NODE_ENV === 'production') {
    app.use('/api/', limiter);
}

// MongoDB Connection
mongoose
    .connect(process.env.MONGODB_URI, {})
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

// ==============================================
// Mongoose Schemas Defined Locally (e.g., Feedback)
// Only define schemas here if they don't have dedicated files in server/models/
// ==============================================

const feedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    message: { type: String, required: true },
    type: { type: String, enum: ['bug', 'feature', 'general'], required: true },
    createdAt: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// ==============================================
// Internal Utility Functions
// ==============================================

// AI Response Generation (utility function, now only uses Gemini)
const generateAIResponse = async (prompt, model, temperature = 0.7) => {
    // As per README, only Gemini is used for core AI features
    try {
        // getTextGemini is expected to handle valid Gemini model names like 'gemini-pro'
        return await getTextGemini(prompt, model, temperature);
    } catch (error) {
        console.error(`Error calling Gemini model ${model}:`, error);
        throw new Error(`Failed to get response from AI model ${model}`);
    }
};

export const getIpFromRequest = (req) => {
    let ips = (
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        ''
    ).split(',');
    return ips[0].trim();
};

// Middleware to check AI usage limits for free users
const checkAiLimit = async (req, res, next) => {
    try {
        // req.user is set by authenticateToken middleware
        // authenticateToken is required for /api/tests/generate, so req.user will be present if authenticated
        const user = req.user ? await User.findById(req.user.id) : null;

        // If user is logged in and not subscribed/trialing, apply limit
        if (
            user &&
            user.subscriptionStatus !== 'active' &&
            user.subscriptionStatus !== 'trialing'
        ) {
            const now = new Date();
            const lastRequest = user.lastAiRequestTime ? new Date(user.lastAiRequestTime) : null;

            // Check if the last request was today (resets daily limit)
            const isToday = lastRequest && now.toDateString() === lastRequest.toDateString();

            const dailyLimit = 3; // Define the daily limit for free users

            if (isToday) {
                if (user.aiRequestCount >= dailyLimit) {
                    return res.status(429).json({
                        error: `Daily AI usage limit (${dailyLimit}) reached. Please upgrade for unlimited access.`
                    });
                }
                user.aiRequestCount++;
            } else {
                // New day or first request
                user.aiRequestCount = 1;
                user.lastAiRequestTime = now;
            }
            await user.save();
            console.log(`User ${user.email} AI usage count: ${user.aiRequestCount} today.`);
        }
        // Note: Unauthenticated users are blocked by authenticateToken middleware on the route itself.

        next();
    } catch (err) {
        console.error('Error in checkAiLimit middleware:', err);
        // Pass the error to the next error handling middleware
        next(err);
    }
};

// ==============================================
// AutoTester.dev Specific API Routes (New/Updated)
// ==============================================

// POST /api/tests/generate - Trigger AI test generation
app.post('/api/tests/generate', authenticateToken, checkAiLimit, async (req, res, next) => {
    try {
        // Inputs from the client UI based on README TODO
        const { docLink, appUrl, model = 'gemini-pro' } = req.body; // Default to a Gemini model

        if (!docLink || !appUrl) {
            return res.status(400).json({ error: 'Documentation link and App URL are required.' });
        }

        // 1. Fetch content from the documentation link
        console.log(`Fetching content from documentation link: ${docLink}`);
        let docContent = null;
        try {
            docContent = await fetchPageContent(docLink);
            if (!docContent) {
                console.warn(
                    `Could not fetch content from documentation link: ${docLink}. Proceeding without doc content.`
                );
                // It's acceptable to proceed without documentation if the AI can work from URL alone
            }
        } catch (fetchError) {
            console.error(
                `Failed to fetch content from documentation link ${docLink}:`,
                fetchError.message
            );
            // Log error but still try to generate based on URL if docContent is null
            console.warn(`Proceeding with null documentation content due to fetch error.`);
        }

        // 2. Construct a detailed prompt for Gemini
        // The prompt instructs Gemini to act as a QA expert and generate test cases
        // based on the documentation and the target web application URL.
        // It should request the output in a structured format (e.g., JSON).
        const prompt = `As an AI QA expert, analyze the following documentation content and the target web application URL to generate a comprehensive test plan.
        The test plan should be provided as a JSON object containing an array of test cases.
        Each test case should include:
        - a 'name' (string, e.g., "Verify user login")
        - a 'description' (string, explaining the goal of the test)
        - a 'steps' array (array of objects, each object representing a test step)
        Each step object should include:
        - 'action' (string, e.g., "navigate", "click", "type", "assert", "wait")
        - 'selector' (string, CSS selector or similar, for elements to interact with, if applicable)
        - 'value' (string, value to type or text to assert, if applicable)
        - 'expected' (string, expected outcome or state after the step, for assertions)
        - 'optional' (boolean, true if step failure should not stop the test, default: false)

        Ensure the first step of each test case is always to navigate to the appUrl.
        Focus on generating realistic user flows and edge cases based on the documentation.
        Consider common web application interactions like navigation, form submission, button clicks, link clicks, text verification, etc.
        If documentation content is unavailable or minimal, generate basic smoke tests based on the URL structure and common web elements.

        Target Web Application URL: ${appUrl}

        Documentation Content:
        ${docContent ? docContent : 'No documentation content available.'}

        Generate the JSON test plan:`;

        console.log(`Sending prompt to AI model ${model} for test generation.`);
        // console.log("Prompt:", prompt); // Log prompt for debugging if needed

        // 3. Call the AI model (Gemini)
        const aiResponse = await generateAIResponse(prompt, model, 0.7);

        if (!aiResponse) {
            throw new Error('AI model returned no response.');
        }

        // 4. Attempt to extract and parse the JSON test plan from the AI response
        let testPlanJson;
        try {
            const jsonString = extractCodeSnippet(aiResponse);
            testPlanJson = JSON.parse(jsonString);
            // Basic validation of the expected JSON structure
            if (
                !Array.isArray(testPlanJson) ||
                testPlanJson.length === 0 ||
                !testPlanJson.every(
                    (tc) =>
                        typeof tc.name === 'string' &&
                        Array.isArray(tc.steps) &&
                        tc.steps.length > 0 &&
                        tc.steps.every(
                            (step) => typeof step.action === 'string' // Basic step validation
                        )
                )
            ) {
                console.warn(
                    'AI response did not return the exact expected JSON structure for test cases:',
                    JSON.stringify(testPlanJson, null, 2)
                );
                // Decide how strict validation should be. For now, allow it if it's an array of objects with 'name' and 'steps' array.
                if (!Array.isArray(testPlanJson)) {
                    throw new Error('AI response is not a JSON array.');
                }
                if (testPlanJson.length === 0) {
                    // Allow empty array? Or require at least one test case? Let's require at least one.
                    throw new Error('AI response JSON array is empty.');
                }
                if (
                    !testPlanJson.every(
                        (tc) => typeof tc.name === 'string' && Array.isArray(tc.steps)
                    )
                ) {
                    throw new Error(
                        'Some items in the AI response array are not valid test case objects (missing name or steps array).'
                    );
                }
                // If we reach here, it's an array of objects with name and steps, but maybe steps aren't fully validated.
                // Log a warning but proceed with the parsed data.
            }
            console.log('Successfully parsed AI response into JSON test plan.');
        } catch (parseError) {
            console.error('Failed to parse or validate AI response as JSON:', parseError);
            console.log('Raw AI Response:', aiResponse); // Log raw response for debugging
            return res.status(500).json({
                error: 'Failed to generate valid test plan from AI. AI response was not parseable JSON or did not match expected structure.',
                rawAiResponse: aiResponse
            });
        }

        // 5. Save the generated test plan to DB (Using the imported TestCase model)
        const newTestPlan = new TestCase({
            userId: req.user.id,
            docLink,
            appUrl,
            modelUsed: model,
            plan: testPlanJson, // Store the generated JSON structure
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await newTestPlan.save();
        console.log(`Test plan saved with ID: ${newTestPlan._id}`);

        // 6. Return a success response with the generated plan and ID
        res.status(201).json({
            message: 'Test plan generated and saved successfully.',
            testPlanId: newTestPlan._id,
            generatedPlan: testPlanJson,
            rawAiResponse: process.env.NODE_ENV === 'development' ? aiResponse : undefined // Include raw AI response in dev for debugging
        });
    } catch (error) {
        console.error('Error generating test plan:', error);
        // Pass the error to the next error handling middleware
        next(error);
    }
});

// POST /api/tests/:id/run - Trigger test execution
app.post('/api/tests/:id/run', authenticateToken, async (req, res, next) => {
    try {
        const testPlanId = req.params.id;

        // 1. Retrieve the test plan from the database using testPlanId.
        // Use the imported TestCase model
        const testPlan = await TestCase.findById(testPlanId);
        if (!testPlan) {
            return res.status(404).json({ error: 'Test plan not found' });
        }
        // 2. Check ownership or admin status
        if (testPlan.userId.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: You do not own this test plan' });
        }

        console.log(`Triggering test run for test plan ID: ${testPlanId}`);

        // 3. Create a new TestReport entry (Using the imported TestReport model)
        const newTestReport = new TestReport({
            testPlanId: testPlan._id,
            userId: req.user.id, // Store user ID on report for easy lookup
            status: 'queued', // Initial status
            startTime: new Date(), // Start time of the *request*, execution engine sets actual start time
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await newTestReport.save();
        console.log(`Test report created with ID: ${newTestReport._id}, status: queued`);

        // 4. Queue or trigger the test execution engine.
        // THIS IS A PLACEHOLDER. Actual implementation requires a separate service
        // (e.g., a worker process using Puppeteer/Playwright) that picks up 'queued' reports,
        // executes the steps from the associated TestPlan, updates the report status and results.
        console.warn(
            `TODO: Implement actual test execution logic for report ${newTestReport._id}. Requires a separate execution engine.`
        );
        // Example: Send a message to a queue or call an internal execution service API
        // await triggerTestExecutionService(newTestReport._id);

        // 5. Return a response indicating the test run has started (e.g., run ID).
        res.status(202).json({
            message: 'Test run initiated and queued successfully.',
            runId: newTestReport._id,
            testPlanId: testPlan._id,
            status: newTestReport.status
        });
    } catch (error) {
        console.error('Error initiating test run:', error);
        // Pass the error to the next error handling middleware
        next(error);
    }
});

// GET /api/tests/:id - Get a specific test plan or report
app.get('/api/tests/:id', authenticateToken, async (req, res, next) => {
    try {
        const documentId = req.params.id;

        // Attempt to find it as a TestReport first
        // Use the imported TestReport model and populate the associated TestCase
        let document = await TestReport.findById(documentId).populate('testPlanId');
        let docType = 'report';

        if (!document) {
            // If not found as a Report, try finding it as a TestPlan (TestCase model)
            // Use the imported TestCase model
            document = await TestCase.findById(documentId);
            docType = 'plan';
        }

        if (!document) {
            return res.status(404).json({ error: 'Test Plan or Report not found' });
        }

        // Check ownership or admin status
        // For a report, check the userId on the report
        // For a plan (TestCase), check the userId on the plan
        const documentUserId = document.userId
            ? document.userId.toString() // For TestCase or TestReport found directly
            : document.testPlanId?.userId // For TestReport where testPlanId was populated
              ? document.testPlanId.userId.toString()
              : null; // Should not happen if models are linked correctly

        if (!documentUserId || (documentUserId !== req.user.id && !req.user.isAdmin)) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        console.log(`Fetching details for ${docType} ID ${documentId} for user ${req.user.id}`);

        res.status(200).json({
            message: `Successfully retrieved ${docType} details.`,
            type: docType,
            data: document
        });
    } catch (error) {
        console.error('Error fetching test plan/report:', error);
        // Pass the error to the next error handling middleware
        next(error);
    }
});

// GET /api/tests - List test plans and reports for the user
app.get('/api/tests', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { type, status, search, limit = 100, skip = 0 } = req.query; // Add basic filtering/pagination

        const reportQuery = { userId: userId };
        if (status) reportQuery.status = status; // Filter reports by status

        // Fetch Test Plans (using TestCase model)
        let plans = [];
        if (!type || type === 'plan') {
            const planFilter = { userId: userId };
            // Add search to plan filter if applicable (e.g., on docLink, appUrl)
            if (search) {
                const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
                planFilter.$or = [
                    { docLink: searchRegex },
                    { appUrl: searchRegex }
                    // Searching within the 'plan' array structure is complex/inefficient in MongoDB without text index.
                    // Maybe only search on metadata for now, or add text index to the 'plan' field if needed and performance allows.
                    // For now, let's keep it simple and only search docLink/appUrl.
                ];
            }

            plans = await TestCase.find(planFilter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(parseInt(skip))
                .lean(); // Use lean() for performance if not modifying docs
        }

        // Fetch Test Reports (using TestReport model)
        let reports = [];
        if (!type || type === 'report') {
            const reportFilter = { userId: userId };
            if (status) reportFilter.status = status;

            // Add search to report filter if applicable
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                // Search on linked test plan's docLink or appUrl
                // This requires populating and then filtering in memory or using $lookup in aggregation
                // In-memory filtering after population is simpler for basic cases
                reports = await TestReport.find(reportFilter)
                    .populate('testPlanId', 'docLink appUrl') // Populate linked plan info
                    .sort({ createdAt: -1 })
                    .limit(parseInt(limit))
                    .skip(parseInt(skip))
                    .lean();

                reports = reports.filter(
                    (r) =>
                        r.testPlanId &&
                        (r.testPlanId.docLink.match(searchRegex) ||
                            r.testPlanId.appUrl.match(searchRegex) ||
                            (r.results && JSON.stringify(r.results).match(searchRegex))) // Optional: search within results
                );
            } else {
                // No search, just fetch and populate
                reports = await TestReport.find(reportFilter)
                    .populate('testPlanId', 'docLink appUrl') // Populate linked plan info
                    .sort({ createdAt: -1 })
                    .limit(parseInt(limit))
                    .skip(parseInt(skip))
                    .lean();
            }
        }

        // Combine and sort if necessary, or return separately
        // Combining and sorting can be done after fetching
        const combinedList = plans
            .map((p) => ({ ...p, type: 'plan' }))
            .concat(reports.map((r) => ({ ...r, type: 'report' })));

        // Sort combined list by creation date (most recent first)
        combinedList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(
            `Fetching tests/reports for user ${userId}. Found ${combinedList.length} documents.`
        );

        res.status(200).json({
            message: `Successfully retrieved tests and reports for user ${userId}.`,
            data: combinedList
        });
    } catch (error) {
        console.error('Error fetching user tests/reports:', error);
        // Pass the error to the next error handling middleware
        next(error);
    }
});

// ==============================================
// Existing General API Routes (kept)
// ==============================================

// Feedback route (kept, uses local Feedback schema)
app.post('/api/feedback', authenticateTokenOptional, async (req, res, next) => {
    try {
        const { message, type } = req.body;
        // Validate type
        if (!['bug', 'feature', 'general'].includes(type)) {
            return res.status(400).json({ error: 'Invalid feedback type' });
        }
        const feedback = new Feedback({
            userId: req?.user?.id, // Will be null for unauthenticated users
            message,
            type,
            createdAt: new Date()
        });
        await feedback.save();
        res.status(201).json(feedback);
    } catch (error) {
        console.error('Error saving feedback:', error);
        next(error);
    }
});

// Stripe webhook (kept)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const event = await stripe.webhooks.constructEventAsync(
            req.body,
            req.headers['stripe-signature'],
            process.env.STRIPE_WH_SECRET
        );

        console.log('✅ Success:', event.id, 'Type:', event.type);

        switch (event.type) {
            case 'customer.subscription.updated':
            case 'customer.subscription.created':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                console.log('Subscription Event:', subscription.id, 'Status:', subscription.status);
                // Retrieve customer details using the customer ID from the subscription object
                const customer = await stripe.customers.retrieve(subscription.customer);
                if (!customer || !customer.email) {
                    console.error(
                        `Customer not found or missing email for subscription ${subscription.id}`
                    );
                    // Depending on flow, might create user here or just log
                    break;
                }
                // Find the user by email and update their subscription status
                const user = await User.findOneAndUpdate(
                    { email: customer.email },
                    {
                        subscriptionStatus: subscription.status,
                        subscriptionId: subscription.id, // Store the subscription ID
                        customerId: customer.id // Store the customer ID
                    },
                    { new: true, upsert: true } // Create user if not found, return the updated/created document
                );
                if (!user) {
                    // This case should ideally not be hit with upsert: true, but good for logging
                    console.error(`User update/creation failed for email ${customer.email}`);
                    break;
                }
                console.log(
                    `User ${user.email} subscription updated to ${user.subscriptionStatus}`
                );

                // Google Analytics event - commented out as per original code structure
                // const measurement_id = process.env.GA_MEASUREMENT_ID;
                // const api_secret = process.env.GA_API_SECRET;
                // if (measurement_id && api_secret) { ... }

                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                console.log(
                    'Invoice Payment Succeeded:',
                    invoice.id,
                    'Customer:',
                    invoice.customer
                );
                // Logic to handle successful payments, e.g., update user status, send confirmation
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                console.log('Invoice Payment Failed:', invoice.id, 'Customer:', invoice.customer);
                // Logic to handle failed payments, e.g., notify user, update status
                break;
            }
            default:
                console.log(`Unhandled Stripe event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Stripe Webhook Error:', error.message);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Docs route (kept)
app.get('/api/docs', async (req, res, next) => {
    try {
        const search = req.query.search ? req.query.search.toLowerCase() : '';
        const categoryQuery =
            req.query.category && req.query.category !== 'all'
                ? req.query.category.toLowerCase()
                : null;
        // Assuming docs are in a 'docs' folder parallel to 'server'
        const docsPath = join(__dirname, '../docs');
        let filenames = [];
        try {
            // Check if directory exists before reading
            await fsPromises.access(docsPath);
            filenames = await fsPromises.readdir(docsPath);
        } catch (readDirError) {
            // If directory doesn't exist or isn't readable, return empty array
            if (readDirError.code === 'ENOENT') {
                console.warn(`Docs directory not found at ${docsPath}.`);
                return res.json([]); // Return empty array if docs directory doesn't exist
            }
            console.error(`Error reading docs directory at ${docsPath}:`, readDirError.message);
            throw readDirError; // Re-throw other errors
        }

        const docsData = await Promise.all(
            filenames.map(async (filename) => {
                const filePath = join(docsPath, filename);
                // Check if it's a markdown file and not a directory
                try {
                    const stat = await fsPromises.stat(filePath);
                    if (!filename.endsWith('.md') || stat.isDirectory()) return null;
                } catch (statError) {
                    console.warn(`Could not stat file ${filePath}:`, statError.message);
                    return null; // Skip files that cannot be stat'd
                }

                try {
                    const content = await fsPromises.readFile(filePath, 'utf8');
                    const title = filename.replace(/\.md$/, '').replace(/[_-]+/g, ' '); // Remove .md and replace separators
                    // Basic category extraction - could be enhanced (e.g., from frontmatter)
                    // For now, use a default or try to infer from filename/path if structure allows
                    const category = 'general'; // Placeholder, could parse from file path or content

                    return { title, category, content, filename };
                } catch (readFileError) {
                    console.warn(`Could not read file ${filePath}:`, readFileError.message);
                    return null; // Skip files that cannot be read
                }
            })
        );

        // Filter out non-markdown files and null results from failed reads/stats
        let filteredDocs = docsData.filter((doc) => doc !== null);

        if (categoryQuery) {
            filteredDocs = filteredDocs.filter(
                (doc) =>
                    doc.category.toLowerCase().includes(categoryQuery) ||
                    doc.filename.toLowerCase().includes(categoryQuery) // Allow searching filenames too
            );
        }
        if (search) {
            filteredDocs = filteredDocs.filter(
                (doc) =>
                    doc.title.toLowerCase().includes(search) ||
                    doc.content.toLowerCase().includes(search) // Search in content
            );
        }

        res.json(filteredDocs);
    } catch (e) {
        console.error('Error fetching docs:', e);
        next(e);
    }
});

// User and Admin routes
userRoutes(app);
adminRoutes(app); // Note: admin.js might fail without a 'Presentation' model

// ==============================================
// Static File Serving and Client-Side Routing Fallback
// ==============================================

// Catch-all for any GET requests not handled by API routes or static middleware
// This serves the main index.html for client-side routing
app.get('*', (req, res) => {
    // Check if the request is for a file that wasn't found by static middleware
    // This helps prevent sending index.html for missing static assets like CSS/JS/images
    // Also checks if it's an API route that wasn't caught
    if (req.path.includes('.') && !req.path.startsWith('/api/')) {
        return res.status(404).send('Not Found');
    }
    // Ensure the file exists before sending to prevent errors
    const indexPath = join(__dirname, '../dist/index.html');
    fsPromises
        .access(indexPath)
        .then(() => res.sendFile(indexPath))
        .catch(() => {
            console.error(`index.html not found at ${indexPath}`);
            res.status(404).send('Client application not built.');
        });
});

// ==============================================
// Error Handling and Process Listeners
// ==============================================

// 404 handler for API routes not caught by specific handlers or static files
// Note: The catch-all '*' above handles non-API GET requests.
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// General error handler middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    // Check if headers have already been sent
    if (res.headersSent) {
        return next(err); // Delegate to default error handler if headers are sent
    }
    res.status(err.status || 500).json({
        error: err.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Process error handling
process.on('uncaughtException', (err, origin) => {
    console.error(`Caught exception: ${err}`, `Exception origin: ${origin}`);
    // Consider graceful shutdown here in production
    // process.exit(1); // Exit with failure code
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Consider graceful shutdown here in production
    // process.exit(1); // Exit with failure code
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Set Google Application Credentials environment variable (should be done before VertexAI initialization)
// Ensure this is set correctly based on your deployment environment
// In production, consider setting this via environment variables or secrets management
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] = './google.json';
    console.warn(
        'GOOGLE_APPLICATION_CREDENTIALS set to ./google.json. Ensure this is correct for your environment.'
    );
}
