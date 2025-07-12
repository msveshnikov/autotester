import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config({ override: true });

// Ensure GOOGLE_KEY is set
if (!process.env.GOOGLE_KEY) {
    console.error('GOOGLE_KEY environment variable is not set.');
    // Depending on your deployment strategy, you might want to exit here
    // process.exit(1);
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
        const generativeModel = vertex_ai.preview.getGenerativeModel({
            model: model,
            generation_config: {
                temperature: temperature,
                // tool_config: { // Example of potentially configuring tool use
                //     tool_code: 'AUTO', // Let model decide when to use tools
                //     tools: [
                //         {
                //             googleSearchRetrieval: {
                //                 disableAttribution: true // Disable attribution if not required
                //             }
                //         }
                //     ]
                // }
            },
            // safety_settings: [ // Example safety settings
            //     {
            //         category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            //         threshold: 'BLOCK_NONE',
            //     },
            //     // Add other categories as needed
            // ],
        });

        // Start a chat session (useful for multi-turn conversations, but works for single turns too)
        const chat = generativeModel.startChat({});

        // Send the message
        const result = await chat.sendMessage([{ text: prompt }]);

        // Extract the text part from the response candidate
        const textResponse = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            console.warn(`Gemini model ${model} returned no text response parts.`);
            console.warn('Full Gemini response:', JSON.stringify(result?.response, null, 2));
        }

        return textResponse || null;

    } catch (error) {
        console.error(`Error calling Gemini model ${model}:`, error);
        // Log more details if available
        if (error.response) {
            console.error('Gemini API error response data:', error.response.data);
            console.error('Gemini API error response status:', error.response.status);
            console.error('Gemini API error response headers:', error.response.headers);
        } else if (error.request) {
            console.error('Gemini API error request:', error.request);
        } else {
            console.error('Gemini API error message:', error.message);
        }
        return null;
    }
};

// You might add other Gemini interaction functions here later if needed,
// e.g., for multimodal inputs or specific tool configurations.