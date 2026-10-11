const express = require("express");
const dns = require("dns").promises;
const net = require("net");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_RESPONSE_BYTES = 15 * 1024 * 1024;
const VERSION = "Schoolio Proxy 5.1";

// Raw request bodies are preserved for proxied POST/PUT/PATCH requests.
app.use("/proxy", express.raw({
    type: () => true,
    limit: MAX_RESPONSE_BYTES
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Range, If-None-Match, If-Modified-Since"
    );
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

const DEFAULT_ALLOWED_HOSTS = [
    "petezahgames.com",
    "petezahgames.github.io",
    "roblox.com",
    "rbxcdn.com",
    "github.com",
    "api.github.com",
    "docs.github.com",
    "githubusercontent.com",
    "raw.githubusercontent.com",
    "stackoverflow.com",
    "stackexchange.com",
    "codepen.io",
    "jsfiddle.net",
    "replit.com",
    "npmjs.com",
    "nodejs.org",
    "python.org",
    "pypi.org",
    "developer.mozilla.org",
    "mozilla.org",
    "w3.org",
    "w3schools.com",
    "cloudflare.com",
    "cdnjs.cloudflare.com",
    "jsdelivr.net",
    "unpkg.com",
    "bootstrapcdn.com",
    "fontawesome.com",
    "wikipedia.org",
    "wikimedia.org",
    "wiktionary.org",
    "britannica.com",
    "merriam-webster.com",
    "dictionary.com",
    "thesaurus.com",
    "archive.org",
    "gutenberg.org",
    "khanacademy.org",
    "quizlet.com",
    "desmos.com",
    "geogebra.org",
    "wolframalpha.com",
    "quizizz.com",
    "wayground.com",
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
    "render.com",
    "vercel.com",
    "netlify.com",
    "railway.app",
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
    "yahoo.com",
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
    "notion.so",
    "1001games.com",
    "1games.io",
    "addictinggames.com",
    "agame.com",
    "armor.com",
    "azgames.io",
    "battle.net",
    "bbogd.net",
    "blizzard.com",
    "boardgamearena.com",
    "browsergames.gg",
    "camadia.com",
    "connectionsgame.org",
    "construct.net",
    "coolmathgames.com",
    "crazygames.com",
    "discord.com",
    "ea.com",
    "epicgames.com",
    "freecivweb.org",
    "galatium.net",
    "gamemonetize.com",
    "geometry-lite.io",
    "gog.com",
    "immoralattack.com",
    "immortalday.com",
    "itch.io",
    "kongregate.com",
    "landofnevard.net",
    "mademanmafia.com",
    "mafiareturns.com",
    "miniclip.com",
    "mobsters-united.com",
    "mpogr.com",
    "newgrounds.com",
    "newyork-mafia.com",
    "nintendo.com",
    "piratequest.org",
    "playstation.com",
    "playsuikagame.com",
    "pokerogue.io",
    "poki.com",
    "puzzlist.com",
    "riotgames.com",
    "simdynasty.com",
    "slithergame.io",
    "slopeonline.online",
    "speedrun.com",
    "steampowered.com",
    "suikagame.com",
    "suikagame.io",
    "top100webgames.com",
    "topwebgames.com",
    "twitch.tv",
    "twoplayergames.org",
    "ubisoft.com",
    "unity.com",
    "wafflegame.net",
    "wordle2.io",
    "xbox.com",
    "y8.com"
];

const EXTRA_ALLOWED_HOSTS = String(process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

const ALLOWED_HOSTS = Array.from(
    new Set(
        [...DEFAULT_ALLOWED_HOSTS, ...EXTRA_ALLOWED_HOSTS]
            .map(host => normalizeHost(host))
            .filter(Boolean)
    )
).sort();

let SITE_CATALOG = [];

try {
    const candidates = [
        path.join(__dirname, "SCHOOLIO_URL_CATALOG_UPDATED.json"),
        path.join(__dirname, "SCHOOLIO_URL_CATALOG.json")
    ];

    const catalogPath = candidates.find(file => fs.existsSync(file));

    if (catalogPath) {
        const parsed = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
        if (Array.isArray(parsed)) {
            SITE_CATALOG = Array.from(
                new Set(
                    parsed
                        .map(value => String(value || "").trim())
                        .filter(Boolean)
                )
            );
        }
    }
} catch (error) {
    console.warn("Could not load Schoolio URL catalog:", error.message);
}

function normalizeHost(hostname) {
    return String(hostname || "")
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");
}

function isAllowedHost(hostname) {
    const host = normalizeHost(hostname);

    return ALLOWED_HOSTS.some(domain => (
        host === domain ||
        host.endsWith("." + domain)
    ));
}

function parseHttpUrl(input, base) {
    try {
        const url = base
            ? new URL(String(input), base)
            : new URL(String(input));

        if (!["http:", "https:"].includes(url.protocol)) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

function isPrivateIPv4(ip) {
    const parts = ip.split(".").map(Number);

    if (
        parts.length !== 4 ||
        parts.some(value => Number.isNaN(value))
    ) {
        return true;
    }

    const [a, b] = parts;

    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
    );
}

function isPrivateIPv6(ip) {
    const value = String(ip || "").toLowerCase();

    if (value.startsWith("::ffff:")) {
        const mapped = value.slice(7);
        return net.isIPv4(mapped)
            ? isPrivateIPv4(mapped)
            : true;
    }

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

async function validateUrl(input) {
    const url = parseHttpUrl(input);

    if (!url) {
        throw new Error("Invalid HTTP/HTTPS URL");
    }

    if (url.username || url.password) {
        throw new Error("URLs with embedded credentials are not supported");
    }

    if (!isAllowedHost(url.hostname)) {
        throw new Error("Website is not in the Schoolio allowlist");
    }

    const addresses = await dns.lookup(url.hostname, { all: true });

    if (!addresses.length) {
        throw new Error("Could not resolve hostname");
    }

    for (const item of addresses) {
        if (isPrivateIP(item.address)) {
            throw new Error("Private/internal network addresses are blocked");
        }
    }

    return url;
}

function proxyUrl(target) {
    return "/proxy?url=" + encodeURIComponent(String(target));
}

function shouldSkipUrl(value) {
    const raw = String(value || "").trim();

    return (
        !raw ||
        raw.startsWith("#") ||
        /^(data|blob|javascript|mailto|tel|about):/i.test(raw)
    );
}

function rewriteUrl(value, baseUrl) {
    if (shouldSkipUrl(value)) {
        return value;
    }

    const absolute = parseHttpUrl(value, baseUrl);

    if (!absolute) {
        return value;
    }

    if (!isAllowedHost(absolute.hostname)) {
        return "/blocked?url=" + encodeURIComponent(absolute.href);
    }

    return proxyUrl(absolute.href);
}

function rewriteSrcset(srcset, baseUrl) {
    return String(srcset || "")
        .split(",")
        .map(part => {
            const bits = part.trim().split(/\s+/);

            if (!bits[0]) {
                return part;
            }

            bits[0] = rewriteUrl(bits[0], baseUrl);
            return bits.join(" ");
        })
        .join(", ");
}

function rewriteCss(css, baseUrl) {
    let output = String(css || "");

    output = output.replace(
        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
        (match, quote, raw) => {
            if (shouldSkipUrl(raw)) {
                return match;
            }

            const rewritten = rewriteUrl(raw, baseUrl);
            return `url(${quote}${rewritten}${quote})`;
        }
    );

    output = output.replace(
        /@import\s+(?:url\()?\s*(['"])(.*?)\1\s*\)?/gi,
        (match, quote, raw) => {
            const rewritten = rewriteUrl(raw, baseUrl);
            return `@import ${quote}${rewritten}${quote}`;
        }
    );

    return output;
}

function rewriteJavaScript(js, baseUrl) {
    let output = String(js || "");

    // Conservative rewriting for common ES module import forms.
    output = output.replace(
        /(\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?)(['"])([^'"]+)\2/g,
        (match, prefix, quote, specifier) => {
            if (shouldSkipUrl(specifier)) return match;
            const rewritten = rewriteUrl(specifier, baseUrl);
            return `${prefix}${quote}${rewritten}${quote}`;
        }
    );

    output = output.replace(
        /(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
        (match, prefix, quote, specifier, suffix) => {
            if (shouldSkipUrl(specifier)) return match;
            const rewritten = rewriteUrl(specifier, baseUrl);
            return `${prefix}${quote}${rewritten}${quote}${suffix}`;
        }
    );

    return output;
}

function runtimeShim(pageUrl) {
    const target = JSON.stringify(pageUrl);

    return `
<script>
(() => {
    const SCHOOLIO_TARGET = ${target};

    function toProxy(value) {
        try {
            const raw =
                value instanceof URL
                    ? value.href
                    : String(value || "");

            if (
                raw.startsWith(location.origin + "/proxy?url=") ||
                raw.startsWith("/proxy?url=") ||
                raw.startsWith("/blocked?url=") ||
                /^(data|blob|javascript|mailto|tel|about):/i.test(raw)
            ) {
                return raw;
            }

            const absolute = new URL(raw, SCHOOLIO_TARGET);

            if (!/^https?:$/i.test(absolute.protocol)) {
                return raw;
            }

            return "/proxy?url=" + encodeURIComponent(absolute.href);
        } catch {
            return value;
        }
    }

    const nativeFetch = window.fetch.bind(window);

    window.fetch = function(input, init) {
        try {
            if (input instanceof Request) {
                input = new Request(toProxy(input.url), input);
            } else {
                input = toProxy(input);
            }
        } catch {}

        return nativeFetch(input, init);
    };

    const nativeXhrOpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        return nativeXhrOpen.call(this, method, toProxy(url), ...rest);
    };

    if (window.EventSource) {
        const NativeEventSource = window.EventSource;
        window.EventSource = function(url, config) {
            return new NativeEventSource(toProxy(url), config);
        };
        window.EventSource.prototype = NativeEventSource.prototype;
    }

    if (navigator.sendBeacon) {
        const nativeBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => nativeBeacon(toProxy(url), data);
    }

    const nativeOpen = window.open;

    window.open = function(url, ...args) {
        return nativeOpen.call(window, toProxy(url), ...args);
    };

    document.addEventListener("click", event => {
        const anchor = event.target && event.target.closest
            ? event.target.closest("a[href]")
            : null;

        if (anchor) {
            anchor.href = toProxy(anchor.getAttribute("href"));
        }
    }, true);

    document.addEventListener("submit", event => {
        const form = event.target;

        if (form && form.action) {
            form.action = toProxy(form.action);
        }
    }, true);
})();
</script>`;
}

function rewriteHtml(html, pageUrl) {
    const $ = cheerio.load(String(html || ""), {
        decodeEntities: false
    });

    // Target CSP/meta refresh rules can conflict with rewritten proxy resources.
    $('meta[http-equiv]').each((_, element) => {
        const equiv = String($(element).attr("http-equiv") || "").toLowerCase();

        if (equiv === "content-security-policy") {
            $(element).remove();
        }

        if (equiv === "refresh") {
            const content = String($(element).attr("content") || "");
            const match = content.match(/^\s*(\d+(?:\.\d+)?)\s*;\s*url\s*=\s*(.+)\s*$/i);

            if (match) {
                $(element).attr(
                    "content",
                    `${match[1]};url=${rewriteUrl(match[2], pageUrl)}`
                );
            }
        }
    });

    const attrs = [
        ["a[href]", "href"],
        ["link[href]", "href"],
        ["img[src]", "src"],
        ["script[src]", "src"],
        ["iframe[src]", "src"],
        ["source[src]", "src"],
        ["video[src]", "src"],
        ["audio[src]", "src"],
        ["input[src]", "src"],
        ["track[src]", "src"],
        ["embed[src]", "src"],
        ["object[data]", "data"],
        ["form[action]", "action"]
    ];

    for (const [selector, attr] of attrs) {
        $(selector).each((_, element) => {
            const current = $(element).attr(attr);

            if (current) {
                $(element).attr(
                    attr,
                    rewriteUrl(current, pageUrl)
                );
            }
        });
    }

    $("[srcset]").each((_, element) => {
        const value = $(element).attr("srcset");

        if (value) {
            $(element).attr(
                "srcset",
                rewriteSrcset(value, pageUrl)
            );
        }
    });

    $("style").each((_, element) => {
        const css = $(element).html();

        if (css) {
            $(element).html(rewriteCss(css, pageUrl));
        }
    });

    $("[style]").each((_, element) => {
        const css = $(element).attr("style");

        if (css) {
            $(element).attr(
                "style",
                rewriteCss(css, pageUrl)
            );
        }
    });

    // Rewritten CSS/module resources no longer necessarily match target SRI hashes.
    $("[integrity]").removeAttr("integrity");

    $("a[target='_top'], a[target='_parent'], a[target='_blank']")
        .attr("target", "_self");

    $("form[target='_top'], form[target='_parent'], form[target='_blank']")
        .attr("target", "_self");

    const shim = runtimeShim(pageUrl);

    if ($("head").length) {
        $("head").prepend(shim);
    } else {
        $.root().prepend(shim);
    }

    return $.html();
}

function escapeHtml(value) {
    return String(value || "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char])
    );
}

function cookiePrefix(hostname) {
    const digest = crypto
        .createHash("sha256")
        .update(normalizeHost(hostname))
        .digest("hex")
        .slice(0, 12);

    return `__sio_${digest}_`;
}

function targetCookieHeader(cookieHeader, hostname) {
    if (!cookieHeader) return "";

    const prefix = cookiePrefix(hostname);
    const output = [];

    for (const part of String(cookieHeader).split(";")) {
        const trimmed = part.trim();
        const equals = trimmed.indexOf("=");

        if (equals <= 0) continue;

        const name = trimmed.slice(0, equals);
        const value = trimmed.slice(equals + 1);

        if (name.startsWith(prefix)) {
            output.push(
                name.slice(prefix.length) + "=" + value
            );
        }
    }

    return output.join("; ");
}

function splitSetCookie(headerValue) {
    if (!headerValue) return [];

    // Handles the common combined-header case while avoiding commas inside Expires.
    return String(headerValue)
        .split(/,(?=\s*[^;,=\s]+=[^;,]*)/)
        .map(value => value.trim())
        .filter(Boolean);
}

function getSetCookies(headers) {
    if (
        headers &&
        typeof headers.getSetCookie === "function"
    ) {
        return headers.getSetCookie();
    }

    return splitSetCookie(
        headers ? headers.get("set-cookie") : ""
    );
}

function rewriteSetCookie(cookie, hostname) {
    const parts = String(cookie || "")
        .split(";")
        .map(part => part.trim())
        .filter(Boolean);

    if (!parts.length) return null;

    const first = parts.shift();
    const equals = first.indexOf("=");

    if (equals <= 0) return null;

    const originalName = first.slice(0, equals).trim();
    const value = first.slice(equals + 1);
    const attributes = [];
    let hasHttpOnly = false;

    for (const attr of parts) {
        const lower = attr.toLowerCase();

        if (
            lower.startsWith("expires=") ||
            lower.startsWith("max-age=")
        ) {
            attributes.push(attr);
        } else if (lower === "httponly") {
            hasHttpOnly = true;
        }
    }

    attributes.push("Path=/");
    attributes.push("Secure");
    attributes.push("SameSite=None");

    if (hasHttpOnly) {
        attributes.push("HttpOnly");
    }

    return (
        cookiePrefix(hostname) +
        originalName +
        "=" +
        value +
        "; " +
        attributes.join("; ")
    );
}

function buildTargetHeaders(req, targetUrl) {
    const headers = new Headers();

    const passthrough = [
        "accept",
        "accept-language",
        "content-type",
        "range",
        "if-none-match",
        "if-modified-since",
        "cache-control",
        "pragma"
    ];

    for (const name of passthrough) {
        const value = req.headers[name];

        if (value) {
            headers.set(name, String(value));
        }
    }

    headers.set(
        "user-agent",
        req.headers["user-agent"] ||
        "Mozilla/5.0 SchoolioProxy/5.0"
    );

    const cookies = targetCookieHeader(
        req.headers.cookie,
        targetUrl.hostname
    );

    if (cookies) {
        headers.set("cookie", cookies);
    }

    // Many applications expect same-origin Origin/Referer values.
    if (req.headers.origin) {
        headers.set("origin", targetUrl.origin);
    }

    if (req.headers.referer) {
        headers.set("referer", targetUrl.href);
    }

    return headers;
}

function loadAllowedCatalogVariants() {
    const seen = new Set();
    const output = [];

    for (const value of SITE_CATALOG) {
        const url = parseHttpUrl(value);

        if (!url || !isAllowedHost(url.hostname)) {
            continue;
        }

        const key = url.href.toLowerCase();

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        output.push({
            type: "variant",
            host: normalizeHost(url.hostname),
            url: url.href,
            label: url.hostname + url.pathname
        });
    }

    return output;
}

const ALLOWED_CATALOG_VARIANTS = loadAllowedCatalogVariants();

app.get("/", (req, res) => {
    res.type("html").send(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${VERSION}</title>
<style>
body{margin:0;padding:40px;font-family:Arial,sans-serif;background:#070707;color:#eee}
.box{max-width:760px;margin:auto;padding:28px;border:1px solid #222;border-radius:16px;background:#0d0d0d}
h1{color:#ff263d;margin-top:0}
.ok{color:#73d889}
code{display:block;padding:10px;background:#050505;border-radius:8px;color:#aaa;overflow-wrap:anywhere}
</style>
</head>
<body>
<div class="box">
<h1>${VERSION}</h1>
<p class="ok">● ONLINE</p>
<p>${ALLOWED_HOSTS.length} allowed base domains.</p>
<p>${ALLOWED_CATALOG_VARIANTS.length} catalog URL variations currently match the allowlist.</p>
<code>/proxy?url=https%3A%2F%2Fen.wikipedia.org%2F</code>
</div>
</body>
</html>`);
});

app.get("/api/test", (req, res) => {
    res.json({
        working: true,
        message: "Schoolio connected successfully!",
        version: VERSION,
        allowedDomains: ALLOWED_HOSTS.length,
        catalogUrls: SITE_CATALOG.length,
        allowedCatalogVariants: ALLOWED_CATALOG_VARIANTS.length
    });
});

app.get("/api/allowed", (req, res) => {
    res.json({
        count: ALLOWED_HOSTS.length,
        domains: ALLOWED_HOSTS
    });
});

app.get("/api/allowed-sites", (req, res) => {
    const query = String(req.query.q || "")
        .trim()
        .toLowerCase();

    const requestedLimit = Number(req.query.limit || 200);
    const limit = Math.min(
        Math.max(
            Number.isFinite(requestedLimit)
                ? requestedLimit
                : 200,
            1
        ),
        500
    );

    const roots = ALLOWED_HOSTS.map(host => ({
        type: "domain",
        host,
        label: host,
        url: "https://" + host + "/"
    }));

    let items;

    if (!query) {
        items = roots.slice(0, limit);
    } else {
        const matchedRoots = roots.filter(item => (
            item.host.includes(query) ||
            item.url.toLowerCase().includes(query)
        ));

        const matchedVariants = ALLOWED_CATALOG_VARIANTS.filter(item => (
            item.host.includes(query) ||
            item.url.toLowerCase().includes(query)
        ));

        const seen = new Set();
        items = [];

        for (const item of [...matchedRoots, ...matchedVariants]) {
            const key = item.url.toLowerCase();

            if (seen.has(key)) continue;
            seen.add(key);
            items.push(item);

            if (items.length >= limit) break;
        }
    }

    res.json({
        query,
        allowedDomains: ALLOWED_HOSTS.length,
        allowedCatalogVariants: ALLOWED_CATALOG_VARIANTS.length,
        returned: items.length,
        items
    });
});

app.get("/api/sites", (req, res) => {
    const requestedLimit = Number(req.query.limit || 200);
    const requestedOffset = Number(req.query.offset || 0);

    const limit = Math.min(
        Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1),
        500
    );

    const offset = Math.max(
        Number.isFinite(requestedOffset)
            ? requestedOffset
            : 0,
        0
    );

    const items = SITE_CATALOG.slice(offset, offset + limit);

    res.json({
        total: SITE_CATALOG.length,
        offset,
        limit,
        returned: items.length,
        items
    });
});

app.get("/api/sites/search", (req, res) => {
    const query = String(req.query.q || "")
        .trim()
        .toLowerCase();

    if (!query) {
        return res.json({
            query: "",
            total: 0,
            items: []
        });
    }

    const items = SITE_CATALOG
        .filter(url => url.toLowerCase().includes(query))
        .slice(0, 200);

    res.json({
        query,
        total: items.length,
        items
    });
});

app.get("/api/check", async (req, res) => {
    const target = req.query.url;

    if (!target) {
        return res.status(400).json({
            allowed: false,
            error: "Missing url"
        });
    }

    try {
        const url = await validateUrl(target);

        res.json({
            allowed: true,
            url: url.href,
            hostname: url.hostname
        });
    } catch (error) {
        res.status(403).json({
            allowed: false,
            error: error.message
        });
    }
});

app.get("/blocked", (req, res) => {
    const attempted = String(req.query.url || "");

    res.status(403)
        .type("html")
        .send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Blocked</title></head>
<body style="font-family:Arial;background:#070707;color:#ddd;padding:40px">
<h2 style="color:#ff4458">Site not allowed</h2>
<p>This destination is not in the Schoolio proxy allowlist.</p>
<code>${escapeHtml(attempted)}</code>
</body>
</html>`);
});

app.all("/proxy", async (req, res) => {
    const targetValue = req.query.url;

    if (!targetValue) {
        return res.status(400).json({
            error: "Missing 'url' query parameter"
        });
    }

    try {
        const targetUrl = await validateUrl(targetValue);
        const headers = buildTargetHeaders(req, targetUrl);

        const method = String(req.method || "GET").toUpperCase();

        const options = {
            method,
            headers,
            redirect: "manual"
        };

        if (
            !["GET", "HEAD"].includes(method) &&
            Buffer.isBuffer(req.body) &&
            req.body.length
        ) {
            options.body = req.body;
        }

        const response = await fetch(targetUrl.href, options);

        // Keep redirects inside the proxy and revalidate the next destination.
        if (
            response.status >= 300 &&
            response.status < 400
        ) {
            const location = response.headers.get("location");

            if (!location) {
                return res
                    .status(response.status)
                    .send("Redirect has no destination");
            }

            const next = new URL(location, targetUrl);
            await validateUrl(next.href);

            const setCookies = getSetCookies(response.headers)
                .map(cookie => rewriteSetCookie(cookie, targetUrl.hostname))
                .filter(Boolean);

            for (const cookie of setCookies) {
                res.append("Set-Cookie", cookie);
            }

            res.status(response.status);
            res.setHeader("Location", proxyUrl(next.href));
            return res.end();
        }

        const setCookies = getSetCookies(response.headers)
            .map(cookie => rewriteSetCookie(cookie, targetUrl.hostname))
            .filter(Boolean);

        for (const cookie of setCookies) {
            res.append("Set-Cookie", cookie);
        }

        res.status(response.status);

        const contentType =
            response.headers.get("content-type") ||
            "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Schoolio-Final-URL", targetUrl.href);

        const etag = response.headers.get("etag");
        const lastModified = response.headers.get("last-modified");
        const acceptRanges = response.headers.get("accept-ranges");
        const contentRange = response.headers.get("content-range");

        if (etag) res.setHeader("ETag", etag);
        if (lastModified) res.setHeader("Last-Modified", lastModified);
        if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
        if (contentRange) res.setHeader("Content-Range", contentRange);

        if (
            method === "HEAD" ||
            response.status === 204 ||
            response.status === 304
        ) {
            return res.end();
        }

        const declaredLength = Number(
            response.headers.get("content-length") || 0
        );

        if (
            declaredLength &&
            declaredLength > MAX_RESPONSE_BYTES
        ) {
            return res
                .status(413)
                .send("Response is too large");
        }

        const buffer = Buffer.from(
            await response.arrayBuffer()
        );

        if (buffer.length > MAX_RESPONSE_BYTES) {
            return res
                .status(413)
                .send("Response is too large");
        }

        if (contentType.includes("text/html")) {
            res.setHeader("Cache-Control", "no-store");
            return res
                .type("html")
                .send(
                    rewriteHtml(
                        buffer.toString("utf8"),
                        targetUrl.href
                    )
                );
        }

        if (contentType.includes("text/css")) {
            res.setHeader("Cache-Control", "public, max-age=120");
            return res
                .type("css")
                .send(
                    rewriteCss(
                        buffer.toString("utf8"),
                        targetUrl.href
                    )
                );
        }

        if (
            contentType.includes("javascript") ||
            contentType.includes("ecmascript")
        ) {
            res.setHeader("Cache-Control", "public, max-age=120");
            return res.send(
                Buffer.from(
                    rewriteJavaScript(
                        buffer.toString("utf8"),
                        targetUrl.href
                    ),
                    "utf8"
                )
            );
        }

        if (
            /^image\//i.test(contentType) ||
            /^font\//i.test(contentType) ||
            /woff|font|octet-stream/i.test(contentType)
        ) {
            res.setHeader("Cache-Control", "public, max-age=600");
        } else {
            res.setHeader("Cache-Control", "public, max-age=120");
        }

        return res.send(buffer);
    } catch (error) {
        res.status(403)
            .type("html")
            .send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Schoolio Proxy Error</title></head>
<body style="font-family:Arial;background:#070707;color:#ddd;padding:40px">
<h2 style="color:#ff4458">Schoolio Proxy Error</h2>
<p>${escapeHtml(error.message)}</p>
</body>
</html>`);
    }
});

app.use((req, res) => {
    res.status(404).json({
        error: "Schoolio route not found"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(VERSION);
    console.log("Port:", PORT);
    console.log("Allowed domains:", ALLOWED_HOSTS.length);
    console.log("Catalog URLs:", SITE_CATALOG.length);
    console.log(
        "Allowed catalog variations:",
        ALLOWED_CATALOG_VARIANTS.length
    );
});
