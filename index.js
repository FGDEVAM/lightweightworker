// ============================================
// TERABOX URL CHECKER - NODE.JS (FOR RENDER)
// ============================================

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_HOST = "dm.nephobox.com";

const TERABOX_DOMAINS = [
    "terafileshare.com", "www.terafileshare.com",
    "terabox.com", "www.terabox.com",
    "terabox.club", "www.terabox.club",
    "teraboxlink.com", "4funbox.com", "www.4funbox.com",
    "terasharelink.com", "1024terabox.com", "www.1024terabox.com",
    "terabox.app", "www.terabox.app", "terabox.fun",
    "1024tera.com", "1024tera.co", "1024box.com",
    "teraboxshare.com", "teraboxapp.com", "momerybox.com",
    "4funbox.co", "mirrobox.com", "nephobox.com",
    "freeterabox.com", "tibibox.com"
];

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Convert to default host
function convertToDefaultHost(url, defaultHost = DEFAULT_HOST) {
    try {
        const urlObj = new URL(url);
        if (TERABOX_DOMAINS.includes(urlObj.hostname)) {
            urlObj.hostname = defaultHost;
            return urlObj.toString();
        }
        return url;
    } catch (error) {
        return url;
    }
}

// Fetch short URL info - Primary API
async function fetchShortUrlInfo(shortUrl, cookie, host = DEFAULT_HOST) {
    try {
        const url = `https://${host}/api/shorturlinfo?clienttype=1&root=1&shorturl=${shortUrl}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-IN,en;q=0.9',
                'Connection': 'keep-alive',
                'Cookie': cookie,
                'User-Agent': 'dubox;4.7.1;iPhone16ProMax;ios-iphone;26.0.1;en_IN'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.errno === 0) {
                return { success: true, data };
            }
            return { success: false, errno: data.errno, error: data.errmsg || 'API error' };
        }
        return { success: false, error: 'Request failed' };
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}

// Fallback API
async function fetchShareListFallback(shortUrl) {
    const url = `https://www.nephobox.com/share/list?clienttype=5&shorturl=${shortUrl}&root=1`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.errno === 0) {
                return { success: true, data };
            }
            return { success: false, errno: data.errno, error: data.errmsg || 'Fallback error' };
        }
        return { success: false, error: 'Fallback failed' };
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}

// Main check URL function
async function checkUrl(url, cookie, host = DEFAULT_HOST) {
    try {
        const normalizedUrl = convertToDefaultHost(url, host);
        let shortUrl = null;
        
        // Extract short URL
        const surlMatch = normalizedUrl.match(/surl=([^&]+)/);
        if (surlMatch) {
            shortUrl = surlMatch[1];
        } else {
            const sMatch = normalizedUrl.match(/\/s\/([^\/\?&]+)/);
            if (sMatch) {
                const rawUrl = sMatch[1];
                shortUrl = rawUrl.startsWith('1') && rawUrl.length > 1 ? rawUrl.substring(1) : rawUrl;
            }
        }
        
        if (!shortUrl) {
            return { exists: false, error: 'Invalid URL' };
        }
        
        // Try primary API
        const primaryResult = await fetchShortUrlInfo(shortUrl, cookie, host);
        
        if (primaryResult.success) {
            const fileList = primaryResult.data.list || [];
            return {
                exists: fileList.length > 0,
                total_files: fileList.length,
                files: fileList.map(f => ({
                    name: f.server_filename,
                    size: f.size,
                    isdir: f.isdir
                }))
            };
        }
        
        // Try fallback API
        const fallbackResult = await fetchShareListFallback(shortUrl);
        
        if (fallbackResult.success) {
            const fileList = fallbackResult.data.list || [];
            return {
                exists: fileList.length > 0,
                total_files: fileList.length,
                files: fileList.map(f => ({
                    name: f.server_filename,
                    size: f.size,
                    isdir: f.isdir
                }))
            };
        }
        
        return {
            exists: false,
            error: 'File not found or deleted'
        };
        
    } catch (error) {
        return { exists: false, error: 'Check failed' };
    }
}

// ============================================
// ROUTES
// ============================================

// Home route - API check
app.get('/', async (req, res) => {
    const teraUrl = req.query.url;
    let cookie = req.query.cookie;
    const host = req.query.host || DEFAULT_HOST;
    
    // If no URL, show API info
    if (!teraUrl) {
        return res.json({
            name: 'TeraBox URL Checker',
            version: '1.0.0',
            description: 'Lightweight API to check if TeraBox files exist',
            usage: 'GET /?url=TERABOX_URL&cookie=YOUR_COOKIE',
            example: '/?url=https://1024terabox.com/s/1xxxxx&cookie=ndus=YOUR_NDUS_VALUE',
            response: {
                exists: 'true/false',
                total_files: 'number',
                files: 'array of {name, size, isdir}'
            }
        });
    }
    
    // Check cookie
    if (!cookie) {
        return res.status(401).json({ error: "Missing 'cookie' parameter" });
    }
    
    // Auto-add ndus= prefix if missing
    if (!cookie.startsWith('ndus=')) {
        cookie = `ndus=${cookie}`;
    }
    
    // Validate TeraBox URL
    if (!/(?:terabox|tera|1024tera|4funbox|nephobox|mirrobox|freeterabox)/.test(teraUrl)) {
        return res.status(400).json({ error: 'Invalid TeraBox URL' });
    }
    
    // Check the URL
    const result = await checkUrl(teraUrl, cookie, host);
    res.json(result);
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 TeraBox Checker running on port ${PORT}`);
    console.log(`📍 Health check: /health`);
    console.log(`📍 API: /?url=TERABOX_URL&cookie=YOUR_COOKIE`);
});
