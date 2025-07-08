import { load } from 'cheerio';

export const MAX_SEARCH_RESULT_LENGTH = 7000; // Maximum length of extracted content per page

export async function searchWebContent(results) {
    try {
        // Fetch content for the first few relevant search results
        const pageContents = await Promise.all(
            results.slice(0, 3).map(async (result) => {
                if (result.link) {
                    return await fetchPageContent(result.link);
                }
                return null;
            })
        );
        // Filter out null results and join the content, limiting the total size
        const combinedContent = pageContents
            ?.filter((content) => content !== null)
            .join('\n')
            .slice(0, MAX_SEARCH_RESULT_LENGTH * 2); // Combine content up to twice the max page length

        return combinedContent;
    } catch (e) {
        console.error('Error in searchWebContent:', e);
        return null;
    }
}

// Common user agents to rotate to avoid blocking
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0'
];

export async function fetchSearchResults(query) {
    try {
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        // Using Bing as a search provider
        const searchUrl = `https://bing.com/search?lang=en&q=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, { headers: { 'User-Agent': randomUserAgent } });
        if (!response.ok) {
            console.error(`Bing search failed with status: ${response.status}`);
            return null;
        }
        const html = await response.text();
        const $ = load(html);

        const results = $('.b_algo')
            .map((_, result) => {
                const title = $(result).find('h2').text().trim();
                const link = $(result).find('a').attr('href');
                const snippet = $(result).find('.b_lineclamp2').text().trim();
                // Basic validation for link and title
                if (link && title) {
                    return { title, link, snippet };
                }
                return null; // Skip invalid results
            })
            .get()
            .filter((result) => result !== null); // Filter out null entries

        return results;
    } catch (error) {
        console.error('Error fetching search results:', error);
        return null;
    }
}

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const TIMEOUT = 10000; // 10 seconds

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

        // Remove unwanted elements that clutter text extraction
        $('script, style, noscript, iframe, head, header, footer, nav').remove();

        // Extract text content, attempting to preserve some structure with line breaks
        // This is a simple approach; a more advanced one might use DOM traversal
        // to add spaces/newlines appropriately between block elements.
        let content = $('body').text();

        // Basic cleaning: replace multiple newlines/spaces with single ones, trim
        content = content.replace(/\s\s+/g, ' ').trim();

        return content?.slice(0, MAX_SEARCH_RESULT_LENGTH);
    } catch (error) {
        if (error.name === 'AbortError') {
            // Timeout already logged
        } else {
            console.error('fetchPageContent error', error, url);
        }
        return null;
    }
}
