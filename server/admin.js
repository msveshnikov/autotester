import { authenticateToken, isAdmin } from './middleware/auth.js';
import User from './models/User.js';
// Assuming these models exist in the models directory based on the project structure
// and the need for these routes, although they are defined in index.js currently.
import TestPlan from './models/TestPlan.js';
import TestReport from './models/TestReport.js';

const adminRoutes = (app) => {
    // ==============================================
    // User Management
    // ==============================================

    // Get all users
    app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
        try {
            // Fetch users, excluding password field, sorted by creation date
            const users = await User.find().select('-password').sort({ createdAt: -1 });
            res.json(users);
        } catch (error) {
            console.error('Admin users fetch error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Delete a user by ID
    app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const userIdToDelete = req.params.id;
            // Find and delete the user
            const user = await User.findByIdAndDelete(userIdToDelete);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            // Also delete related data for the user (Feedbacks, TestPlans, TestReports)
            await Promise.all([
                TestPlan.deleteMany({ userId: userIdToDelete }),
                TestReport.deleteMany({ userId: userIdToDelete })
            ]);
            res.json({ message: 'User and associated data deleted successfully' });
        } catch (error) {
            console.error('Admin user delete error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Update a user's subscription status
    app.put('/api/admin/users/:id/subscription', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { subscriptionStatus } = req.body;
            // Validate the provided subscription status
            if (
                ![
                    'active',
                    'free',
                    'trialing',
                    'past_due',
                    'canceled',
                    'incomplete_expired'
                ].includes(subscriptionStatus)
            ) {
                return res.status(400).json({ error: 'Invalid subscription status' });
            }
            // Find the user and update their subscription status
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            user.subscriptionStatus = subscriptionStatus;
            await user.save(); // Save the updated user
            res.json({ message: 'User subscription updated successfully' });
        } catch (error) {
            console.error('Admin subscription update error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ==============================================
    // Test Plan Management (New)
    // ==============================================

    // Get all test plans
    app.get('/api/admin/testplans', authenticateToken, isAdmin, async (req, res) => {
        try {
            // Optional: Implement pagination/sorting if needed
            const testPlans = await TestPlan.find()
                .populate('userId', 'email')
                .sort({ createdAt: -1 });
            res.json(testPlans);
        } catch (error) {
            console.error('Admin test plans fetch error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get a specific test plan by ID
    app.get('/api/admin/testplans/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const testPlan = await TestPlan.findById(req.params.id).populate('userId', 'email');
            if (!testPlan) {
                return res.status(404).json({ error: 'Test Plan not found' });
            }
            res.json(testPlan);
        } catch (error) {
            console.error('Admin test plan fetch error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Delete a test plan by ID
    app.delete('/api/admin/testplans/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const testPlanIdToDelete = req.params.id;
            // Find and delete the test plan
            const testPlan = await TestPlan.findByIdAndDelete(testPlanIdToDelete);
            if (!testPlan) {
                return res.status(404).json({ error: 'Test Plan not found' });
            }
            // Also delete associated test reports
            await TestReport.deleteMany({ testPlanId: testPlanIdToDelete });
            res.json({ message: 'Test Plan and associated reports deleted successfully' });
        } catch (error) {
            console.error('Admin test plan delete error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ==============================================
    // Test Report Management (New)
    // ==============================================

    // Get all test reports
    app.get('/api/admin/testreports', authenticateToken, isAdmin, async (req, res) => {
        try {
            // Optional: Implement pagination/sorting if needed
            // Populate user and the associated test plan for context
            const testReports = await TestReport.find()
                .populate('userId', 'email')
                .populate('testPlanId', 'docLink appUrl') // Populate linked plan info
                .sort({ createdAt: -1 });
            res.json(testReports);
        } catch (error) {
            console.error('Admin test reports fetch error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get a specific test report by ID
    app.get('/api/admin/testreports/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const testReport = await TestReport.findById(req.params.id)
                .populate('userId', 'email')
                .populate('testPlanId', 'docLink appUrl'); // Populate linked plan info
            if (!testReport) {
                return res.status(404).json({ error: 'Test Report not found' });
            }
            res.json(testReport);
        } catch (error) {
            console.error('Admin test report fetch error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Delete a test report by ID
    app.delete('/api/admin/testreports/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            // Find and delete the test report
            const testReport = await TestReport.findByIdAndDelete(req.params.id);
            if (!testReport) {
                return res.status(404).json({ error: 'Test Report not found' });
            }
            res.json({ message: 'Test Report deleted successfully' });
        } catch (error) {
            console.error('Admin test report delete error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ==============================================
    // Dashboard Statistics (Updated)
    // ==============================================

    // Get dashboard statistics (Users, Feedback, Test Plans, Test Reports)
    app.get('/api/admin/dashboard', authenticateToken, isAdmin, async (req, res) => {
        try {
            // Fetch various counts and growth data
            const [
                totalUsers,
                premiumUsers,
                trialingUsers,
                totalFeedbacks,
                totalTestPlans, // New: Total Test Plans
                totalTestReports, // New: Total Test Reports
                userGrowth // User growth data
            ] = await Promise.all([
                User.countDocuments(), // Total users
                User.countDocuments({ subscriptionStatus: 'active' }), // Active subscriptions
                User.countDocuments({ subscriptionStatus: 'trialing' }), // Trialing subscriptions
                TestPlan.countDocuments(), // New: Total Test Plans
                TestReport.countDocuments(), // New: Total Test Reports
                User.aggregate([
                    // Aggregate user creation counts by day for the last 30 days
                    {
                        $group: {
                            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }, // Sort by date
                    { $limit: 30 } // Limit to last 30 days
                ])
            ]);

            // Calculate conversion rate
            const conversionRate =
                totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(2) : '0.00';

            // Respond with dashboard stats
            res.json({
                stats: {
                    totalUsers,
                    premiumUsers,
                    trialingUsers,
                    conversionRate,
                    totalFeedbacks,
                    totalTestPlans, // Include Test Plan count
                    totalTestReports // Include Test Report count
                },
                userGrowth // User growth data
            });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};

export default adminRoutes;
