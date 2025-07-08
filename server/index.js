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
import { getTextGrok } from './grok.js';
import { getTextGpt } from './openai.js';
import { getTextDeepseek } from './deepseek.js';
import { getTextClaude } from './claude.js';
import User from './models/User.js'; // Assuming User model is needed for Auth/Admin
import Feedback from './models/Feedback.js'; // Assuming Feedback model is needed
// Note: Presentation model is removed as it's not relevant to AutoTester.dev README features
import userRoutes from './user.js';
import adminRoutes from './admin.js';
import { authenticateToken, authenticateTokenOptional } from './middleware/auth.js';

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
        labels.model = req?.body?.model ?? 'No';
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

// User and Admin routes (keeping these as they are general platform features)
userRoutes(app);
adminRoutes(app);

// AI Response Generation (utility function, not a direct route)
const generateAIResponse = async (prompt, model, temperature = 0.7) => {
    switch (model) {
        case 'o3-mini':
        case 'gpt-4o-mini':
        case 'gpt-4o': // Added gpt-4o based on common usage
        case 'gpt-3.5-turbo': // Added gpt-3.5-turbo
            return await getTextGpt(prompt, model, temperature);
        case 'gemini-2.0-pro-exp-02-05':
        case 'gemini-2.0-flash-001':
        case 'gemini-2.0-flash-thinking-exp-01-21':
        case 'gemini-pro': // Added gemini-pro
        case 'gemini-flash': // Added gemini-flash
            return await getTextGemini(prompt, model, temperature);
        case 'deepseek-reasoner':
        case 'deepseek-coder': // Added deepseek-coder
            return await getTextDeepseek(prompt, model, temperature);
        case 'claude-3-7-sonnet-20250219':
        case 'claude-3-opus-20240229': // Added claude-opus
        case 'claude-3-sonnet-20240229': // Added claude-sonnet
        case 'claude-3-haiku-20240307': // Added claude-haiku
            return await getTextClaude(prompt, model, temperature);
        case 'grok-2-latest':
        case 'grok-3-mini':
            return await getTextGrok(prompt, model, temperature);
        default:
            throw new Error('Invalid model specified');
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
        // This middleware is only relevant for routes that consume significant AI resources
        // Apply it selectively to test generation/execution routes
        const user = req.user ? await User.findById(req.user.id) : null;

        // If user is logged in and not subscribed/trialing
        if (
            user &&
            user.subscriptionStatus !== 'active' &&
            user.subscriptionStatus !== 'trialing'
        ) {
            const now = new Date();
            const lastRequest = user.lastAiRequestTime ? new Date(user.lastAiRequestTime) : null;

            // Check if the last request was today
            if (lastRequest && now.toDateString() === lastRequest.toDateString()) {
                if (user.aiRequestCount >= 3) {
                    // Limit to 3 requests per day for free users
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
        } else if (!user) {
            // Optional: Handle unauthenticated users if they are allowed limited AI access
            // For now, assume AI features require auth, or implement IP-based limiting here
            // console.log('AI request from unauthenticated user. Consider IP limiting.');
            // If unauthenticated users are not allowed AI features, add a check here.
            // return res.status(401).json({ error: 'Authentication required for this feature.' });
        }

        next();
    } catch (err) {
        console.error('Error in checkAiLimit middleware:', err);
        next(err);
    }
};

// Utility functions (keeping these, although they might not be directly used in index.js anymore)
const extractCodeSnippet = (text) => {
    const codeBlockRegex = /```(?:json|js|html)?\n([\s\S]*?)\n```/;
    const match = text.match(codeBlockRegex);
    return match ? match[1] : text;
};

// ==============================================
// AutoTester.dev Specific API Routes
// ==============================================

// Placeholder routes for AutoTester.dev features
// These would interact with database models for Tests/Reports and potentially an execution engine

// POST /api/tests/generate - Trigger AI test generation
app.post('/api/tests/generate', authenticateToken, checkAiLimit, async (req, res) => {
    try {
        // This is a placeholder. Actual implementation would:
        // 1. Parse user input (e.g., URL, description, user flow).
        // 2. Use AI models (via generateAIResponse) to create a test plan (e.g., a sequence of steps, assertions).
        // 3. Save the test plan to the database (needs a TestPlan model).
        // 4. Return the generated test plan ID or details.

        const { url, description, flow, model } = req.body;

        if (!url || !description || !model) {
            return res.status(400).json({ error: 'URL, description, and model are required.' });
        }

        // Example AI prompt construction (simplified)
        const prompt = `Generate a test plan (in JSON format) for the web application at ${url} based on the following description and user flow:\n\nDescription: ${description}\nUser Flow: ${flow || 'Default user flow'}\n\nThe test plan should include steps and expected outcomes.`;

        console.log(`Generating test plan for ${url} using model ${model}`);

        // Call the AI model
        const aiResponse = await generateAIResponse(prompt, model, 0.7);

        // Attempt to extract JSON code snippet
        let testPlanJson;
        try {
            testPlanJson = JSON.parse(extractCodeSnippet(aiResponse));
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError);
            console.log('AI Response:', aiResponse);
            // Fallback or error handling if AI doesn't return valid JSON
            return res
                .status(500)
                .json({ error: 'Failed to generate valid test plan from AI.', aiResponse });
        }

        // Placeholder: Save the generated test plan to DB
        // const newTestPlan = new TestPlan({
        //     userId: req.user.id,
        //     url,
        //     description,
        //     flow,
        //     modelUsed: model,
        //     plan: testPlanJson,
        //     createdAt: new Date()
        // });
        // await newTestPlan.save();

        // Return a success response with the generated plan (or ID)
        res.status(201).json({
            message: 'Test plan generated successfully (placeholder)',
            // testPlanId: newTestPlan._id,
            generatedPlan: testPlanJson, // Returning the generated plan for demonstration
            aiResponse: aiResponse // Include raw AI response for debugging
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
        // 1. Retrieve the test plan from the database using testId.
        // 2. Queue or trigger the test execution engine (e.g., a separate service, Puppeteer/Playwright script).
        // 3. The execution engine would run the test steps on the target URL.
        // 4. Results (pass/fail, logs, screenshots) would be stored, likely in a new TestReport document.
        // 5. Return a response indicating the test run has started (e.g., run ID).

        // Placeholder: Find test plan (assuming a TestPlan model exists)
        // const testPlan = await TestPlan.findById(testId);
        // if (!testPlan) {
        //     return res.status(404).json({ error: 'Test plan not found' });
        // }
        // if (testPlan.userId.toString() !== req.user.id && !req.user.isAdmin) {
        //      return res.status(403).json({ error: 'Unauthorized: You do not own this test plan' });
        // }

        console.log(`Triggering test run for test ID: ${testId}`);

        // Placeholder: Trigger execution engine
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
            message: 'Test run initiated successfully (placeholder)'
            // runId: newTestReport._id
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
        // 1. Retrieve a TestPlan or TestReport document by ID.
        // 2. Ensure the user has access (is the owner or an admin).
        // 3. Return the document.

        // Placeholder: Find TestPlan or TestReport
        // const testDocument = await TestPlan.findById(testId) || await TestReport.findById(testId); // Could be either
        // if (!testDocument) {
        //     return res.status(404).json({ error: 'Test or Report not found' });
        // }
        // if (testDocument.userId.toString() !== req.user.id && !req.user.isAdmin) {
        //      return res.status(403).json({ error: 'Unauthorized access' });
        // }

        // Placeholder response
        res.status(200).json({
            message: `Details for test/report ID ${testId} (placeholder)`
            // data: testDocument
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
        // 1. Retrieve TestPlan or TestReport documents for the logged-in user.
        // 2. Apply filtering/sorting from query parameters (e.g., status, date, search).
        // 3. Return a list of documents (potentially paginated or limited).

        // Placeholder: Find documents for user
        // const userTestsOrReports = await TestPlan.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100); // Example
        // Or find TestReports: await TestReport.find({ userId: req.user.id }).sort({ startTime: -1 }).limit(100);

        console.log(`Fetching tests/reports for user ${req.user.id}`);

        // Placeholder response
        res.status(200).json({
            message: `List of tests/reports for user ${req.user.id} (placeholder)`
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

                // Google Analytics event (assuming measurement_id is defined elsewhere or removed)
                // const measurement_id = process.env.GA_MEASUREMENT_ID; // Need this env var
                // const api_secret = process.env.GA_API_SECRET; // Need this env var

                // if (measurement_id && api_secret) {
                //      fetch(
                //         `https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`,
                //         {
                //             method: 'POST',
                //             body: JSON.stringify({
                //                 client_id: user._id.toString(), // Use user ID as client_id
                //                 user_id: user._id.toString(),
                //                 events: [
                //                     {
                //                         name: 'purchase', // Or 'subscription_status_update'
                //                         params: {
                //                             subscription_id: subscription.id,
                //                             subscription_status: subscription.status,
                //                             currency: subscription.currency, // Add currency if available
                //                             value: subscription.plan?.amount / 100, // Add value if available
                //                             // Add other relevant subscription details
                //                         }
                //                     }
                //                 ]
                //             })
                //         }
                //     ).catch(gaError => console.error('Failed to send GA event:', gaError));
                // } else {
                //     console.warn('Google Analytics Measurement ID or API Secret not configured.');
                // }
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
        const docsPath = join(__dirname, '../docs'); // Assuming docs are in a 'docs' folder parallel to 'server'
        const filenames = await fsPromises.readdir(docsPath);
        const docsData = await Promise.all(
            filenames.map(async (filename) => {
                const filePath = join(docsPath, filename);
                // Check if it's a markdown file
                if (!filename.endsWith('.md')) return null;

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
    if (req.path.includes('.') && !req.path.startsWith('/api/')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(join(__dirname, '../dist/index.html'));
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
app.use((err, req, res) => {
    console.error('Unhandled Error:', err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Process error handling
process.on('uncaughtException', (err, origin) => {
    console.error(`Caught exception: ${err}`, `Exception origin: ${origin}`);
    // Consider graceful shutdown here in production
    // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Consider graceful shutdown here in production
    // process.exit(1);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Set Google Application Credentials environment variable
process.env['GOOGLE_APPLICATION_CREDENTIALS'] = './google.json';
