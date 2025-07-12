import mongoose from 'mongoose';

const testReportSchema = new mongoose.Schema({
    testPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TestPlan', // References the TestPlan this report is for
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // References the User who initiated the test run
        required: true
    },
    status: {
        type: String,
        enum: ['queued', 'running', 'completed', 'failed'],
        default: 'queued'
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    results: {
        type: mongoose.Schema.Types.Mixed // Store execution results, logs, screenshots etc.
    },
    createdAt: {
        type: Date,
        default: Date.now // Time report was created/queued
    }
});

// Add indexes for efficient querying
testReportSchema.index({ testPlanId: 1, createdAt: -1 });
testReportSchema.index({ userId: 1, createdAt: -1 });
testReportSchema.index({ status: 1, createdAt: -1 });

const TestReport = mongoose.model('TestReport', testReportSchema);

export default TestReport;
