import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        appUrl: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        }
        // Future fields might include:
        // - configuration settings specific to this project (e.g., browser types, environments)
        // - references to associated TestPlan or TestReport documents (if not using subdocuments)
        // - references to TestPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TestPlan' }]
    },
    {
        timestamps: true // Adds createdAt and updatedAt fields automatically
    }
);

// Optional: Add index for faster lookup by user
ProjectSchema.index({ userId: 1, createdAt: -1 });

const Project = mongoose.model('Project', ProjectSchema);

export default Project;
