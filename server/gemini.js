import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config({ override: true });

// Ensure GOOGLE_KEY is set for Vertex AI project ID
if (!process.env.GOOGLE_KEY) {
    console.error('GOOGLE_KEY environment variable is not set.');
    // In a production environment, you might want to throw an error or exit
    // process.exit(1);
}

// Ensure GOOGLE_APPLICATION_CREDENTIALS is set for authentication
// This should ideally be handled by the environment where the app is run,
// but setting it here as a fallback if using a local google.json file.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Check if google.json exists relative to this file or project root
    // This is a simplified check; a robust app would handle credential loading securely
    console.warn(
        'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. Vertex AI might not authenticate correctly.'
    );
    console.warn(
        'Ensure your environment is configured for Google Cloud authentication (e.g., GOOGLE_APPLICATION_CREDENTIALS, gcloud auth application-default login, or running on GCE/GKE).'
    );
    // Example fallback if using a local key file (not recommended for production)
    // const path = require('path'); // Need to import path if using Node.js built-in modules
    // process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '..', 'google.json');
    // console.warn(`Attempting to use default credential path: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
}

const vertex_ai = new VertexAI({ project: process.env.GOOGLE_KEY, location: 'us-central1' });

/**
 * Sends a text prompt to a specified Gemini model and returns the response.
 * @param {string} prompt - The text prompt for the model.
 * @param {string} model - The name of the Gemini model to use (e.g., 'gemini-pro', 'gemini-1.5-flash-001').
 * @param {number} [temperature=0.7] - The temperature for generation (0.0 to 1.0).
 * @returns {Promise<string|null>} The text response from the model, or null if an error occurs or no text part is found.
 */
export const getTextGemini = async (prompt, model, temperature = 0.7) => {
    try {
        // Validate model name if necessary, or rely on Vertex AI API to reject invalid ones
        // For now, assume valid Gemini model names are passed from index.js
        if (!model || !model.startsWith('gemini')) {
            console.warn(
                `Attempted to call getTextGemini with non-Gemini model name: ${model}. Defaulting to gemini-pro.`
            );
            model = 'gemini-pro'; // Fallback or stricter validation needed?
        }

        const generativeModel = vertex_ai.preview.getGenerativeModel({
            model: model,
            generation_config: {
                temperature: temperature
                // Add other generation configurations as needed (e.g., max_output_tokens)
                // max_output_tokens: 8192, // Example
            }
            // safety_settings: [ // Example safety settings - adjust as per requirements
            //     {
            //         category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            //         threshold: 'BLOCK_NONE',
            //     },
            //     {
            //         category: 'HARM_CATEGORY_HARASSMENT',
            //         threshold: 'BLOCK_NONE',
            //     },
            //     {
            //         category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            //         threshold: 'BLOCK_NONE',
            //     },
            //     {
            //         category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            //         threshold: 'BLOCK_NONE',
            //     },
            // ],
            // tool_config: { // Example of potentially configuring tool use (e.g., Google Search)
            //     tool_code: 'AUTO', // Let model decide when to use tools
            //     tools: [
            //         {
            //             googleSearchRetrieval: {
            //                 disableAttribution: true // Disable attribution if not required
            //             }
            //         }
            //     ]
            // }
        });

        // Start a chat session (useful for multi-turn conversations, but works for single turns too)
        // For single, stateless requests like generating a test plan, a non-chat approach might also work,
        // but startChat is flexible.
        const chat = generativeModel.startChat({});

        // Send the message
        const result = await chat.sendMessage([{ text: prompt }]);

        // Extract the text part from the response candidate
        // Responses might have multiple parts or candidates; we take the first text part from the first candidate.
        const textResponse = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            console.warn(`Gemini model ${model} returned no text response parts.`);
            // Log the full response structure for debugging if no text is found
            console.warn('Full Gemini response:', JSON.stringify(result?.response, null, 2));
        }

        return textResponse || null;
    } catch (error) {
        console.error(`Error calling Gemini model ${model}:`, error);
        // Log more details from the error object
        if (error.response) {
            console.error('Gemini API error response data:', error.response.data);
            console.error('Gemini API error response status:', error.response.status);
            console.error('Gemini API error response headers:', error.response.headers);
        } else if (error.request) {
            console.error('Gemini API error request:', error.request);
        } else {
            console.error('Gemini API error message:', error.message);
        }
        // Rethrow or return null depending on desired error handling in calling code (index.js)
        // Returning null allows index.js to handle the missing response.
        return null;
    }
};

// This file is dedicated to Gemini interactions.
// Other AI models or utility functions for processing AI responses should reside elsewhere
// (e.g., index.js for orchestration, utils.js for parsing).
