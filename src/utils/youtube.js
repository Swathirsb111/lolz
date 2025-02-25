const cheerio = require('cheerio');

async function normalizeYouTubeUrl(url) {
    // Handle various YouTube URL formats
    const urlPatterns = {
        channel: /youtube\.com\/channel\/([^\/\?]+)/,
        user: /youtube\.com\/user\/([^\/\?]+)/,
        custom: /youtube\.com\/@([^\/\?]+)/,
        handle: /youtube\.com\/(@[^\/\?]+)/
    };

    for (const [type, pattern] of Object.entries(urlPatterns)) {
        const match = url.match(pattern);
        if (match) {
            const baseUrl = url.split('?')[0]; // Remove query parameters
            console.log(`Detected ${type} URL format: ${match[1]}`);
            return {
                main: baseUrl,
                live: `${baseUrl}/live`,
                stream: `${baseUrl}/live`
            };
        }
    }

    // If no pattern matches, ensure URL has https:// prefix and clean format
    const cleanUrl = url.startsWith('http') ? url : `https://youtube.com/${url.startsWith('@') ? '' : '@'}${url}`;
    const baseUrl = cleanUrl.split('?')[0]; // Remove query parameters
    console.log('Normalized URL:', baseUrl);
    return {
        main: baseUrl,
        live: `${baseUrl}/live`,
        stream: `${baseUrl}/live`
    };
}

async function fetchPage(url, headers, retries = 3) {
    console.log(`Fetching page: ${url}`);
    const fetch = (await import('node-fetch')).default;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, { headers });
            if (response.ok) return response;
            console.log(`Attempt ${i + 1} failed with status ${response.status}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } catch (error) {
            console.error(`Fetch attempt ${i + 1} failed:`, error);
            if (i === retries - 1) throw error;
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function getYouTubeChannelInfo(channelUrl) {
    try {
        const urls = await normalizeYouTubeUrl(channelUrl);
        console.log('URLs to check:', urls);

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        // Try live page first
        let response = await fetchPage(urls.live, headers);
        let html = await response.text();
        let $ = cheerio.load(html);
        let isLive = false;
        let detectionDetails = [];

        // Enhanced live detection with detailed logging
        const liveIndicators = [
            {
                name: 'Live Thumbnail',
                check: () => {
                    const hasLiveThumbnail = html.includes('hqdefault_live.jpg');
                    console.log('Live thumbnail check:', { found: hasLiveThumbnail });
                    if (hasLiveThumbnail) {
                        console.log('Found live thumbnail in HTML');
                        return true;
                    }
                    return false;
                }
            },
            {
                name: 'Live Badge',
                check: () => {
                    const liveBadges = $('[class*="live" i], [class*="badge" i]').filter((_, el) => {
                        const text = $(el).text().toLowerCase();
                        return text.includes('live');
                    });
                    console.log('Live badge elements found:', liveBadges.length);
                    liveBadges.each((_, el) => console.log('Live badge element:', $(el).prop('outerHTML')));
                    return liveBadges.length > 0;
                }
            },
            {
                name: 'Live Text',
                check: () => {
                    const liveTexts = ['LIVE NOW', 'LIVE', '🔴 LIVE', 'Live stream', 'Streaming now'];
                    const foundTexts = liveTexts.filter(text => {
                        const found = html.includes(text);
                        console.log(`Checking for "${text}":`, found);
                        return found;
                    });
                    return foundTexts.length > 0;
                }
            },
            {
                name: 'Script Data',
                check: () => {
                    const scriptTags = $('script').map((_, el) => $(el).html()).get();
                    const liveIndicators = {
                        isLiveNow: scriptTags.some(script => script?.includes('"isLiveNow":true')),
                        isLive: scriptTags.some(script => script?.includes('"isLive":true')),
                        statusLive: scriptTags.some(script => script?.includes('"status":"LIVE"')),
                        broadcastLive: scriptTags.some(script => script?.includes('"broadcastIsLive":true'))
                    };
                    console.log('Script data live indicators:', liveIndicators);
                    return Object.values(liveIndicators).some(val => val);
                }
            },
            {
                name: 'Metadata',
                check: () => {
                    const metaResults = {
                        ogVideoTag: $('meta[property="og:video:tag"][content*="live"]').length,
                        canonicalLink: $('link[rel="canonical"][href*="live"]').length,
                        ogType: $('meta[property="og:type"][content="video.other"]').length,
                        ogVideo: $('meta[property="og:video:url"]').length
                    };
                    console.log('Metadata check results:', metaResults);
                    return Object.values(metaResults).some(val => val > 0);
                }
            }
        ];

        // Check all indicators and collect results
        for (const indicator of liveIndicators) {
            try {
                console.log(`\nChecking ${indicator.name}...`);
                if (indicator.check()) {
                    isLive = true;
                    detectionDetails.push(indicator.name);
                }
            } catch (error) {
                console.error(`Error in ${indicator.name} check:`, error);
            }
        }

        // If not live on /live page, try main page
        if (!isLive && response.url === urls.live) {
            console.log('Not live on /live page, checking main page...');
            response = await fetchPage(urls.main, headers);
            html = await response.text();
            $ = cheerio.load(html);

            // Recheck indicators on main page
            for (const indicator of liveIndicators) {
                try {
                    if (indicator.check()) {
                        isLive = true;
                        detectionDetails.push(`${indicator.name} (main)`);
                    }
                } catch (error) {
                    console.error(`Error in ${indicator.name} check on main page:`, error);
                }
            }
        }

        console.log('Live detection results:', {
            isLive,
            detectedBy: detectionDetails.join(', ') || 'none'
        });

        // Get latest video ID
        let latestVideoId = null;
        const videoIdPatterns = [
            /"videoId":"([^"]+)"/,
            /watch\?v=([^"&]+)/,
            /"url":"\/watch\?v=([^"]+)"/,
            /embed\/([^"/?]+)/
        ];

        for (const pattern of videoIdPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                latestVideoId = match[1];
                console.log('Found video ID:', latestVideoId);
                break;
            }
        }

        const result = {
            isLive,
            latestVideoId,
            detectedBy: detectionDetails,
            checkedUrl: response.url,
            timestamp: new Date().toISOString()
        };

        console.log('Final result:', result);
        return result;

    } catch (error) {
        console.error('Error in getYouTubeChannelInfo:', error);
        console.error('Stack trace:', error.stack);
        return {
            isLive: false,
            latestVideoId: null,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = { getYouTubeChannelInfo, normalizeYouTubeUrl };