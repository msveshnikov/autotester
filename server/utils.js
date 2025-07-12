// Function to get IP address from request headers
export const getIpFromRequest = (req) => {
    let ips = (
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        ''
    ).split(',');
    return ips[0].trim();
};

// Function to extract content from fenced code blocks
export const extractCodeSnippet = (text) => {
    // Regex updated to be more general for code blocks
    const codeBlockRegex = /```(?:[a-zA-Z0-9]*)\n([\s\S]*?)\n```/;
    const match = text.match(codeBlockRegex);
    return match ? match[1] : text;
};

// Function to create a URL-friendly slug
export const slugify = (text) => {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
        .replace(/--+/g, '-'); // Replace multiple - with single -
};

// Basic logging utility functions
// In a production environment, these might integrate with a dedicated logging library (e.g., Winston, Pino)
// or a cloud logging service.
export const logInfo = (message, context = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, context);
};

export const logWarning = (message, context = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, context);
};

export const logError = (message, error, context = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, context, error);
};

// The previous enrichMetadata function from the autotester.pro project is removed
// as it is not relevant to the AutoTester.dev project context.

// Add any other general utility functions here as needed by the server components.
// For example, functions for data formatting, validation helpers, etc.
