const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const dns = require("dns").promises;
const net = require("net");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   SCHOOLIO PROXY SERVER
========================================================= */

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


/* =========================================================
   CORS
========================================================= */

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});


/* =========================================================
   ALLOW ALL WEBSITES MODE
   Set ALLOW_ALL_WEBSITES=true in Render environment variables
   or change the default below to true
========================================================= */

const ALLOW_ALL_WEBSITES = process.env.ALLOW_ALL_WEBSITES !== "false";

const DEFAULT_ALLOWED_HOSTS = [
    "example.com",
    "petezahgames.com",
    "github.com",
    "api.github.com",
    "docs.github.com",
    "githubusercontent.com",
    "raw.githubusercontent.com",
    "githubassets.com",
    "stackoverflow.com",
    "stackexchange.com",
    "codepen.io",
    "jsfiddle.net",
    "replit.com",
    "npmjs.com",
    "nodejs.org",
    "python.org",
    "pypi.org",
    "java.com",
    "oracle.com",
    "developer.mozilla.org",
    "mozilla.org",
    "mozilla.net",
    "w3.org",
    "w3schools.com",
    "render.com",
    "vercel.com",
    "netlify.com",
    "railway.app",
    "cloudflare.com",
    "jsdelivr.net",
    "cdnjs.com",
    "unpkg.com",
    "wikipedia.org",
    "wikimedia.org",
    "wiktionary.org",
    "britannica.com",
    "merriam-webster.com",
    "dictionary.com",
    "thesaurus.com",
    "archive.org",
    "gutenberg.org",
    "microsoft.com",
    "learn.microsoft.com",
    "support.microsoft.com",
    "office.com",
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "googleusercontent.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "scholar.google.com",
    "books.google.com",
    "translate.google.com",
    "khanacademy.org",
    "kastatic.org",
    "kasandbox.org",
    "quizlet.com",
    "desmos.com",
    "geogebra.org",
    "wolframalpha.com",
    "nasa.gov",
    "noaa.gov",
    "usgs.gov",
    "nih.gov",
    "cdc.gov",
    "who.int",
    "weather.gov",
    "census.gov",
    "data.gov",
    "loc.gov",
    "sec.gov",
    "irs.gov",
    "federalreserve.gov",
    "stlouisfed.org",
    "bea.gov",
    "bls.gov",
    "finra.org",
    "investopedia.com",
    "nasdaq.com",
    "nyse.com",
    "finance.yahoo.com",
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "npr.org",
    "imdb.com",
    "rottentomatoes.com",
    "goodreads.com",
    "medium.com",
    "substack.com",
    "canva.com",
    "figma.com",
    "notion.so"
];

const EXTRA_ALLOWED_HOSTS =
    String(process.env.EXTRA_ALLOWED_HOSTS || "")
    .split(",")
    .map(domain => domain.trim().toLowerCase())
    .filter(Boolean);

const ALLOWED_HOSTS = Array.from(
    new Set([...DEFAULT_ALLOWED_HOSTS, ...EXTRA_ALLOWED_HOSTS])
);


/* =========================================================
   DOMAIN CHECK
========================================================= */

function cleanHostname(hostname) {
    return String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
}

function isAllowedHost(hostname) {
    if (ALLOW_ALL_WEBSITES) {
        return true;
    }
    
    const host = cleanHostname(hostname);
    return ALLOWED_HOSTS.some(domain => {
        const allowed = cleanHostname(domain);
        return host === allowed || host.endsWith("." + allowed);
    });
}


/* =========================================================
   PRIVATE NETWORK PROTECTION
========================================================= */

function isPrivateIPv4(ip) {
    const parts = ip.split(".").map(Number);
    
    if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
        return true;
    }
    
    const a = parts[0];
    const b = parts[1];
    
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
    );
}

function isPrivateIPv6(ip) {
    const value = String(ip).toLowerCase();
    return (
        value === "::" ||
        value === "::1" ||
        value.startsWith("fc") ||
        value.startsWith("fd") ||
        value.startsWith("fe80:")
    );
}

function isPrivateIP(ip) {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);
    return true;
}


/* =========================================================
   VALIDATE URL
========================================================= */

async function validateUrl(input) {
    let url;
    
    try {
        url = new URL(input);
    } catch {
        throw new Error("Invalid website address.");
    }
    
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Only HTTP and HTTPS websites are supported.");
    }
    
    if (url.username || url.password) {
        throw new Error("URLs containing usernames or passwords are not supported.");
    }
    
    if (!isAllowedHost(url.hostname)) {
        throw new Error(`${url.hostname} is not in the Schoolio allowlist.`);
    }
    
    let addresses;
    try {
        addresses = await dns.lookup(url.hostname, { all: true });
    } catch {
        throw new Error("That website could not be found.");
    }
    
    if (!addresses.length) {
        throw new Error("That website could not be found.");
    }
    
    for (const result of addresses) {
        if (isPrivateIP(result.address)) {
            throw new Error("Private and internal network addresses are blocked.");
        }
    }
    
    return url;
}


/* =========================================================
   FETCH WITH REDIRECT VALIDATION
========================================================= */

async function safeFetch(input, redirectCount = 0) {
    if (redirectCount > 6) {
        throw new Error("Too many redirects.");
    }
    
    const url = await validateUrl(input);
    
    const response = await fetch(url.href, {
        method: "GET",
        redirect: "manual",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,text/css,application/javascript,application/json,image/avif,image/webp,image/png,image/jpeg,image/svg+xml,*/*",
            "Accept-Language": "en-US,en;q=0.9"
        }
    });
    
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        
        if (!location) {
            throw new Error("Redirect destination was missing.");
        }
        
        const next = new URL(location, url);
        return safeFetch(next.href, redirectCount + 1);
    }
    
    return { response, finalUrl: url.href };
}


/* =========================================================
   CREATE PROXY URL
========================================================= */

function createProxyUrl(url) {
    return "/proxy?url=" + encodeURIComponent(url);
}


/* =========================================================
   URL SKIP CHECK
========================================================= */

function shouldSkipUrl(value) {
    if (!value) return true;
    
    const lower = String(value).trim().toLowerCase();
    
    return (
        lower.startsWith("#") ||
        lower.startsWith("data:") ||
        lower.startsWith("javascript:") ||
        lower.startsWith("mailto:") ||
        lower.startsWith("tel:") ||
        lower.startsWith("blob:") ||
        lower.startsWith("about:")
    );
}


/* =========================================================
   REWRITE ONE HTML ATTRIBUTE
========================================================= */

function rewriteAttribute($, selector, attribute, pageUrl) {
    $(selector).each((index, element) => {
        const original = $(element).attr(attribute);
        
        if (shouldSkipUrl(original)) return;
        
        try {
            const absolute = new URL(original, pageUrl);
            
            if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
                return;
            }
            
            $(element).attr(attribute, createProxyUrl(absolute.href));
        } catch {
            // Ignore malformed URLs
        }
    });
}


/* =========================================================
   REWRITE SRCSET
========================================================= */

function rewriteSrcset($, pageUrl) {
    $("[srcset]").each((index, element) => {
        const srcset = $(element).attr("srcset");
        
        if (!srcset) return;
        
        const rewritten = srcset
            .split(",")
            .map(item => {
                const parts = item.trim().split(/\s+/);
                const value = parts.shift();
                const descriptor = parts.join(" ");
                
                if (shouldSkipUrl(value)) return item;
                
                try {
                    const absolute = new URL(value, pageUrl);
                    const proxied = createProxyUrl(absolute.href);
                    return proxied + (descriptor ? " " + descriptor : "");
                } catch {
                    return item;
                }
            })
            .join(", ");
        
        $(element).attr("srcset", rewritten);
    });
}


/* =========================================================
   REWRITE INLINE CSS URL(...)
========================================================= */

function rewriteCSS(css, pageUrl) {
    return String(css).replace(
        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
        (whole, quote, value) => {
            if (shouldSkipUrl(value)) return whole;
            
            try {
                const absolute = new URL(value, pageUrl);
                
                if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
                    return whole;
                }
                
                return 'url("' + createProxyUrl(absolute.href) + '")';
            } catch {
                return whole;
            }
        }
    );
}


/* =========================================================
   REWRITE HTML
========================================================= */

function rewriteHTML(html, pageUrl) {
    const $ = cheerio.load(html, { decodeEntities: false });
    
    rewriteAttribute($, "a[href]", "href", pageUrl);
    rewriteAttribute($, "img[src]", "src", pageUrl);
    rewriteAttribute($, "script[src]", "src", pageUrl);
    rewriteAttribute($, "link[href]", "href", pageUrl);
    rewriteAttribute($, "iframe[src]", "src", pageUrl);
    rewriteAttribute($, "source[src]", "src", pageUrl);
    rewriteAttribute($, "video[src]", "src", pageUrl);
    rewriteAttribute($, "audio[src]", "src", pageUrl);
    rewriteAttribute($, "input[src]", "src", pageUrl);
    rewriteAttribute($, "track[src]", "src", pageUrl);
    
    rewriteSrcset($, pageUrl);
    
    // Rewrite inline style URLs
    $("[style]").each((index, element) => {
        const style = $(element).attr("style");
        if (!style) return;
        
        $(element).attr("style", rewriteCSS(style, pageUrl));
    });
    
    // Rewrite <style> blocks
    $("style").each((index, element) => {
        const css = $(element).html();
        if (!css) return;
        
        $(element).html(rewriteCSS(css, pageUrl));
    });
    
    // Prevent automatic redirects
    $('meta[http-equiv="refresh"]').remove();
    
    // Remove <base> because it can interfere with Schoolio's rewritten URLs
    $("base").remove();
    
    $("head").prepend('<meta name="schoolio-proxy" content="enabled">');
    
    return $.html();
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   ERROR PAGE
========================================================= */

function proxyErrorPage(title, message) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; }
body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 25px;
    font-family: Arial, sans-serif;
    color: #eeeeee;
    background: radial-gradient(circle at 50% 0%, rgba(255,38,61,.09), transparent 40%), #070707;
}
.card {
    width: min(520px, 100%);
    padding: 27px;
    border-radius: 15px;
    background: #0d0d0d;
    border: 1px solid rgba(255,255,255,.07);
    box-shadow: 0 25px 60px rgba(0,0,0,.5);
}
.icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    color: #ff263d;
    background: rgba(255,38,61,.07);
    border: 1px solid rgba(255,38,61,.16);
    font-weight: bold;
}
h2 { margin: 15px 0 8px; color: #ff4055; }
p { margin: 0; color: #77777e; line-height: 1.6; font-size: 13px; }
</style>
</head>
<body>
<div class="card">
<div class="icon">!</div>
<h2>${escapeHtml(title)}</h2>
<p>${escapeHtml(message)}</p>
</div>
</body>
</html>
    `;
}


/* =========================================================
   SERVE FRONTEND
========================================================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


/* =========================================================
   API TEST
========================================================= */

app.get("/api/test", (req, res) => {
    res.json({
        working: true,
        version: "Schoolio Proxy 3.0",
        message: "Schoolio connected successfully!",
        mode: ALLOW_ALL_WEBSITES ? "unrestricted" : "restricted",
        allowedDomains: ALLOWED_HOSTS.length
    });
});


/* =========================================================
   API CHECK
========================================================= */

app.get("/api/check", async (req, res) => {
    const target = req.query.url;
    
    if (!target) {
        return res.status(400).json({
            allowed: false,
            error: "Missing url parameter."
        });
    }
    
    try {
        const url = await validateUrl(target);
        
        return res.json({
            allowed: true,
            hostname: url.hostname,
            url: url.href
        });
        
    } catch(error) {
        return res.status(403).json({
            allowed: false,
            error: error.message
        });
    }
});


/* =========================================================
   API ALLOWED
========================================================= */

app.get("/api/allowed", (req, res) => {
    res.json({
        mode: ALLOW_ALL_WEBSITES ? "unrestricted" : "restricted",
        count: ALLOWED_HOSTS.length,
        websites: ALLOWED_HOSTS.slice().sort()
    });
});


/* =========================================================
   WEBSITE PROXY
========================================================= */

app.get("/proxy", async (req, res) => {
    const target = req.query.url;
    
    if (!target) {
        return res.status(400).type("html").send(
            proxyErrorPage("Missing Website", "No website URL was supplied.")
        );
    }
    
    try {
        const { response, finalUrl } = await safeFetch(target);
        
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const contentLength = Number(response.headers.get("content-length") || 0);
        
        const MAX_SIZE = 15 * 1024 * 1024;
        
        if (contentLength > MAX_SIZE) {
            return res.status(413).type("html").send(
                proxyErrorPage("File Too Large", "This resource is too large for the Schoolio proxy.")
            );
        }
        
        // HTML
        if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
            let html = await response.text();
            
            if (Buffer.byteLength(html, "utf8") > MAX_SIZE) {
                return res.status(413).type("html").send(
                    proxyErrorPage("Page Too Large", "This page is too large for the Schoolio proxy.")
                );
            }
            
            html = rewriteHTML(html, finalUrl);
            
            res.status(response.status);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("X-Schoolio-Final-URL", finalUrl);
            res.setHeader("Cache-Control", "no-cache");
            
            return res.send(html);
        }
        
        // CSS
        if (contentType.includes("text/css")) {
            let css = await response.text();
            css = rewriteCSS(css, finalUrl);
            
            res.status(response.status);
            res.setHeader("Content-Type", "text/css; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=300");
            
            return res.send(css);
        }
        
        // Other resources
        const buffer = await response.buffer();
        
        if (buffer.length > MAX_SIZE) {
            return res.status(413).type("html").send(
                proxyErrorPage("File Too Large", "This resource is too large for the Schoolio proxy.")
            );
        }
        
        res.status(response.status);
        res.setHeader("Content-Type", contentType);
        
        if (contentType.startsWith("image/") || contentType.includes("font")) {
            res.setHeader("Cache-Control", "public, max-age=600");
        } else {
            res.setHeader("Cache-Control", "public, max-age=120");
        }
        
        res.setHeader("X-Schoolio-Final-URL", finalUrl);
        
        return res.send(buffer);
        
    } catch(error) {
        const message = error.message || "The website could not be loaded.";
        const notAllowed = message.includes("allowlist");
        
        return res.status(notAllowed ? 403 : 502).type("html").send(
            proxyErrorPage(
                notAllowed ? "SITE NOT ALLOWED" : "PROXY ERROR",
                message
            )
        );
    }
});


/* =========================================================
   404
========================================================= */

app.use((req, res) => {
    res.status(404).json({ error: "Schoolio route not found." });
});


/* =========================================================
   START
========================================================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log("==================================");
    console.log("SCHOOLIO PROXY 3.0");
    console.log("Port: " + PORT);
    console.log("Mode: " + (ALLOW_ALL_WEBSITES ? "UNRESTRICTED" : "RESTRICTED"));
    console.log("Allowed domains: " + ALLOWED_HOSTS.length);
    console.log("==================================");
});
