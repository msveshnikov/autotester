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
import { getTextGemini } from './gemini.js';
// Removed imports for other models as per README TODO
import User from './models/User.js'; // Assuming User model is needed for Auth/Admin
import userRoutes from './user.js';
import adminRoutes from './admin.js';
import { authenticateToken, authenticateTokenOptional } from './middleware/auth.js';
import { fetchPageContent } from './search.js'; // Import utility to fetch web content
import { extractCodeSnippet } from './utils.js'; // Import utility to extract code

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

mongoose.connect(process.env.MONGODB_URI, {});

// User and Admin routes
userRoutes(app);
adminRoutes(app);

// AI Response Generation (utility function, now only uses Gemini)
const generateAIResponse = async (prompt, model, temperature = 0.7) => {
    // As per README, only Gemini is used for core AI features
    // Validate that the requested model is a Gemini model if necessary, or rely on getTextGemini
    // which is expected to handle valid Gemini model names.
    // For now, we assume the model parameter passed is a valid Gemini model name expected by getTextGemini.
    try {
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
export const checkAiLimit = async (req, res, next) => {
    try {
        const user = req.user ? await User.findById(req.user.id) : null;

        // If user is logged in and not subscribed/trialing
        if (
            user &&
            user.subscriptionStatus !== 'active' &&
            user.subscriptionStatus !== 'trialing'
        ) {
            const now = new Date();
            const lastRequest = user.lastAiRequestTime ? new Date(user.lastAiRequestTime) : null;

            // Check if the last request was today (resets daily limit)
            if (lastRequest && now.toDateString() === lastRequest.toDateString()) {
                if (user.aiRequestCount >= 3) {
                    // Limit to 3 requests per day for free users for AI-intensive tasks
                    return res.status(429).json({
                        error: 'Daily AI usage limit reached. Please upgrade for unlimited access.'
                    });
                }
                user.aiRequestCount++;
            } else {
                // New day or first request
                user.aiRequestCount = 1;
                user.lastAiRequestTime = now;
            }
            await user.save();
        }
        // Note: Unauthenticated users are implicitly handled by authenticateToken on /api/tests/generate

        next();
    } catch (err) {
        console.error('Error in checkAiLimit middleware:', err);
        next(err);
    }
};

// ==============================================
// AutoTester.dev Specific API Routes
// ==============================================

// POST /api/tests/generate - Trigger AI test generation
app.post('/api/tests/generate', authenticateToken, checkAiLimit, async (req, res) => {
    try {
        // Inputs from the client UI based on README TODO
        const { docLink, appUrl, model = 'gemini-pro' } = req.body; // Default to a Gemini model

        if (!docLink || !appUrl) {
            return res.status(400).json({ error: 'Documentation link and App URL are required.' });
        }

        // 1. Fetch content from the documentation link
        console.log(`Fetching content from documentation link: ${docLink}`);
        const docContent = await fetchPageContent(docLink);

        if (!docContent) {
            // Optionally allow proceeding without documentation, or return an error
            console.warn(`Could not fetch content from documentation link: ${docLink}`);
            // return res.status(400).json({ error: `Could not fetch content from documentation link: ${docLink}` });
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
        - 'action' (string, e.g., "navigate", "click", "type", "assert")
        - 'selector' (string, CSS selector or similar, for elements to interact with, if applicable)
        - 'value' (string, value to type or text to assert, if applicable)
        - 'expected' (string, expected outcome or state after the step, for assertions)

        Focus on generating realistic user flows and edge cases based on the documentation.
        Consider common web application interactions like navigation, form submission, button clicks, link clicks, text verification, etc.

        Target Web Application URL: ${appUrl}

        Documentation Content:
        ${docContent ? docContent : 'No documentation content fetched.'}

        Generate the JSON test plan:`;

        console.log(`Sending prompt to AI model ${model} for test generation.`);
        // console.log("Prompt:", prompt); // Log prompt for debugging if needed

        // 3. Call the AI model (Gemini)
        const aiResponse = await generateAIResponse(prompt, model, 0.7);

        // 4. Attempt to extract and parse the JSON test plan from the AI response
        let testPlanJson;
        try {
            testPlanJson = JSON.parse(extractCodeSnippet(aiResponse));
            // Basic validation of the expected JSON structure
            if (!Array.isArray(testPlanJson) || !testPlanJson.every(tc => tc.name && Array.isArray(tc.steps))) {
                 throw new Error('AI response did not return the expected JSON structure for test cases.');
            }
        } catch (parseError) {
            console.error('Failed to parse or validate AI response as JSON:', parseError);
            console.log('Raw AI Response:', aiResponse); // Log raw response for debugging
            return res
                .status(500)
                .json({ error: 'Failed to generate valid test plan from AI.', rawAiResponse: aiResponse });
        }

        // 5. Placeholder: Save the generated test plan to DB (Needs TestPlan model)
        // const newTestPlan = new TestPlan({
        //     userId: req.user.id,
        //     docLink,
        //     appUrl,
        //     modelUsed: model,
        //     plan: testPlanJson,
        //     createdAt: new Date()
        // });
        // await newTestPlan.save();

        // 6. Return a success response with the generated plan
        res.status(201).json({
            message: 'Test plan generated successfully (placeholder)',
            // testPlanId: newTestPlan._id, // Return ID if saving to DB
            generatedPlan: testPlanJson, // Return the generated plan
            rawAiResponse: aiResponse // Include raw AI response for debugging
        });
    } catch (error) {
        console.error('Error generating test plan:', error);
        res.status(500).json({ error: 'Failed to generate test plan', details: error.message });
    }
});

// POST /api/tests/:id/run - Trigger test execution
app.post('/api/tests/:id/run', authenticateToken, checkAiLimit, async (req, res) => {
    try {
        const testId = req.params.id;
        // This is a placeholder. Actual implementation would:
        // 1. Retrieve the test plan from the database using testId. (Needs TestPlan model)
        // 2. Queue or trigger the test execution engine (e.g., a separate service using Puppeteer/Playwright).
        // 3. The execution engine would run the test steps on the target URL.
        // 4. Results (pass/fail, logs, screenshots) would be stored, likely in a new TestReport document. (Needs TestReport model)
        // 5. Return a response indicating the test run has started (e.g., run ID).

        // Placeholder: Find test plan (assuming a TestPlan model exists)
        // const testPlan = await TestPlan.findById(testId);
        // if (!testPlan) {
        //     return res.status(404).json({ error: 'Test plan not found' });
        // }
        // // Check ownership or admin status
        // if (testPlan.userId.toString() !== req.user.id && !req.user.isAdmin) {
        //      return res.status(403).json({ error: 'Unauthorized: You do not own this test plan' });
        // }

        console.log(`Triggering test run for test ID: ${testId}. Execution engine needed here.`);

        // Placeholder: Trigger execution engine (This function needs to be implemented elsewhere)
        // await triggerTestExecution(testPlan); // Function to interact with execution service

        // Placeholder: Create a new TestReport entry (assuming a TestReport model exists)
        // const newTestReport = new TestReport({
        //     testPlanId: testId,
        //     userId: req.user.id,
        //     status: 'queued', // or 'running'
        //     startTime: new Date()
        // });
        // await newTestReport.save();

        res.status(202).json({
            message: 'Test run initiated successfully (placeholder - execution engine required)'
            // runId: newTestReport._id // Return run ID if saving to DB
        });
    } catch (error) {
        console.error('Error initiating test run:', error);
        res.status(500).json({ error: 'Failed to initiate test run', details: error.message });
    }
});

// GET /api/tests/:id - Get a specific test plan or report
app.get('/api/tests/:id', authenticateToken, async (req, res) => {
    try {
        const testId = req.params.id;
        // This is a placeholder. Actual implementation would:
        // 1. Retrieve a TestPlan or TestReport document by ID. (Needs TestPlan/TestReport models)
        // 2. Ensure the user has access (is the owner or an admin).
        // 3. Return the document.

        // Placeholder: Find TestPlan or TestReport
        // const testDocument = await TestPlan.findById(testId) || await TestReport.findById(testId); // Could be either
        // if (!testDocument) {
        //     return res.status(404).json({ error: 'Test or Report not found' });
        // }
        // // Check ownership or admin status
        // if (testDocument.userId.toString() !== req.user.id && !req.user.isAdmin) {
        //      return res.status(403).json({ error: 'Unauthorized access' });
        // }

        console.log(`Fetching details for test/report ID ${testId} (placeholder)`);

        // Placeholder response
        res.status(200).json({
            message: `Details for test/report ID ${testId} (placeholder - requires DB models)`
            // data: testDocument // Return actual data if found
        });
    } catch (error) {
        console.error('Error fetching test/report:', error);
        res.status(500).json({ error: 'Failed to fetch test/report', details: error.message });
    }
});

// GET /api/tests - List test plans or reports for the user
app.get('/api/tests', authenticateToken, async (req, res) => {
    try {
        // This is a placeholder. Actual implementation would:
        // 1. Retrieve TestPlan or TestReport documents for the logged-in user. (Needs DB models)
        // 2. Apply filtering/sorting from query parameters (e.g., status, date, search).
        // 3. Return a list of documents (potentially paginated or limited).

        // Placeholder: Find documents for user
        // const userTestsOrReports = await TestPlan.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100); // Example
        // Or find TestReports: await TestReport.find({ userId: req.user.id }).sort({ startTime: -1 }).limit(100);

        console.log(`Fetching tests/reports for user ${req.user.id} (placeholder)`);

        // Placeholder response
        res.status(200).json({
            message: `List of tests/reports for user ${req.user.id} (placeholder - requires DB models)`
            // data: userTestsOrReports.map(doc => ({ id: doc._id, ... })) // Return summary data
        });
    } catch (error) {
        console.error('Error fetching user tests/reports:', error);
        res.status(500).json({ error: 'Failed to fetch tests/reports', details: error.message });
    }
});

// ==============================================
// Existing General API Routes (kept)
// ==============================================

// Feedback route (kept)
app.post('/api/feedback', authenticateTokenOptional, async (req, res) => {
    try {
        const { message, type } = req.body;
        const feedback = new Feedback({
            userId: req?.user?.id,
            message,
            type,
            createdAt: new Date()
        });
        await feedback.save();
        res.status(201).json(feedback);
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: error.message });
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
                const customer = await stripe.customers.retrieve(subscription.customer);
                if (!customer || !customer.email) {
                    console.error(
                        `Customer not found or missing email for subscription ${subscription.id}`
                    );
                    return res.status(400).send('Customer not found');
                }
                const user = await User.findOneAndUpdate(
                    { email: customer.email },
                    {
                        subscriptionStatus: subscription.status,
                        subscriptionId: subscription.id
                    },
                    { new: true } // Return the updated document
                );
                if (!user) {
                    console.error(`User not found for email ${customer.email}`);
                    // Depending on flow, might create user here or just log
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
            // Add other Stripe event types if needed (e.g., invoice.payment_succeeded)
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
app.get('/api/docs', async (req, res) => {
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
             filenames = await fsPromises.readdir(docsPath);
        } catch (readDirError) {
            console.warn(`Docs directory not found or readable at ${docsPath}:`, readDirError.message);
            return res.json([]); // Return empty array if docs directory doesn't exist
        }

        const docsData = await Promise.all(
            filenames.map(async (filename) => {
                const filePath = join(docsPath, filename);
                // Check if it's a markdown file and not a directory
                const stat = await fsPromises.stat(filePath);
                if (!filename.endsWith('.md') || stat.isDirectory()) return null;

                const content = await fsPromises.readFile(filePath, 'utf8');
                const title = filename.replace(/\.md$/, '').replace(/[_-]+/g, ' '); // Remove .md and replace separators
                // Basic category extraction - could be enhanced
                const category = 'general'; // Placeholder, could parse from file path or content

                return { title, category, content, filename };
            })
        );

        // Filter out non-markdown files and null results
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
        res.status(500).json({ error: e.message });
    }
});

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
    fsPromises.access(indexPath)
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
app.use((err, req, res, next) => { // Added 'next' parameter
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
    console.warn('GOOGLE_APPLICATION_CREDENTIALS set to ./google.json. Ensure this is correct for your environment.');
}