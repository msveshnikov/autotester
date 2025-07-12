import { load } from 'cheerio';

// Maximum length of extracted content per page
export const MAX_PAGE_CONTENT_LENGTH = 7000;

// Common user agents to rotate to avoid blocking
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0'
];

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const TIMEOUT = 15000; // 15 seconds

/**
 * Fetches the content of a given URL, extracts text, and performs basic cleaning.
 * Skips large files, non-HTML content, and handles timeouts.
 * This function is intended for fetching text content from documentation links or similar.
 * It might not be suitable for detailed DOM analysis of the target application URL.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string|null>} - The extracted text content or null if fetching/processing fails.
 */
export async function fetchPageContent(url) {
    try {
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        let response;
        try {
            response = await fetch(url, {
                headers: { 'User-Agent': randomUserAgent },
                signal: controller.signal
            });
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                console.log('fetchPageContent timed out', url);
            } else {
                console.error(`fetchPageContent failed to fetch ${url}:`, fetchError);
            }
            clearTimeout(timeoutId);
            return null;
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.log(`fetchPageContent skipped (bad status ${response.status})`, url);
            return null;
        }

        const contentType = response.headers.get('Content-Type');
        if (
            contentType &&
            (contentType.includes('application/pdf') ||
                contentType.includes('audio') ||
                contentType.includes('video') ||
                contentType.includes('image') ||
                contentType.includes('binary')) // Add binary check
        ) {
            console.log(`fetchPageContent skipped (${contentType})`, url);
            return null;
        }

        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
            console.log('fetchPageContent skipped (file too large)', url);
            return null;
        }

        const html = await response.text();
        const $ = load(html);

        // Remove unwanted elements that clutter text extraction, especially for documentation
        $('script, style, noscript, iframe, head, header, footer, nav').remove();

        // Extract text content, attempting to preserve some structure with line breaks
        // This is a simple approach; a more advanced one might use DOM traversal
        // to add spaces/newlines appropriately between block elements.
        let content = $('body').text();

        // Basic cleaning: replace multiple newlines/spaces with single ones, trim
        content = content.replace(/\s\s+/g, ' ').trim();

        return content?.slice(0, MAX_PAGE_CONTENT_LENGTH);
    } catch (error) {
        if (error.name === 'AbortError') {
            // Timeout already logged
        } else {
            console.error('fetchPageContent error', error, url);
        }
        return null;
    }
}