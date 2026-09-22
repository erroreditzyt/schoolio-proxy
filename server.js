const express = require("express");
const dns = require("dns").promises;
const net = require("net");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,HEAD,OPTIONS");

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

const EXTRA_ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

const ALLOWED_HOSTS = Array.from(
    new Set([...DEFAULT_ALLOWED_HOSTS, ...EXTRA_ALLOWED_HOSTS])
);

let SITE_CATALOG = [];

try {
    const catalogPath = path.join(
        __dirname,
        "SCHOOLIO_URL_CATALOG.json"
    );

    SITE_CATALOG = JSON.parse(
        fs.readFileSync(catalogPath, "utf8")
    );

    if (!Array.isArray(SITE_CATALOG)) {
        SITE_CATALOG = [];
    }
} catch (error) {
    console.warn(
        "Could not load SCHOOLIO_URL_CATALOG.json:",
        error.message
    );

    SITE_CATALOG = [];
}

function normalizeHost(hostname) {
    return String(hostname || "")
        .toLowerCase()
        .replace(/\.$/, "");
}

function isAllowedHost(hostname) {
    const host = normalizeHost(hostname);

    return ALLOWED_HOSTS.some(domain => {
        const allowed = normalizeHost(domain);

        return (
            host === allowed ||
            host.endsWith("." + allowed)
        );
    });
}

function isPrivateIPv4(ip) {
    const parts = ip.split(".").map(Number);

    if (
        parts.length !== 4 ||
        parts.some(Number.isNaN)
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
    const value = ip.toLowerCase();

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
    let url;

    try {
        url = new URL(input);
    } catch {
        throw new Error("Invalid URL");
    }

    if (
        !["http:", "https:"].includes(url.protocol)
    ) {
        throw new Error(
            "Only HTTP and HTTPS URLs are supported"
        );
    }

    if (!isAllowedHost(url.hostname)) {
        throw new Error(
            "Website is not in the Schoolio allowlist"
        );
    }

    const addresses = await dns.lookup(
        url.hostname,
        { all: true }
    );

    if (!addresses.length) {
        throw new Error(
            "Could not resolve hostname"
        );
    }

    for (const item of addresses) {
        if (isPrivateIP(item.address)) {
            throw new Error(
                "Private/internal network addresses are blocked"
            );
        }
    }

    return url;
}

async function safeFetch(
    input,
    options = {},
    redirects = 0
) {
    if (redirects > 5) {
        throw new Error("Too many redirects");
    }

    const url = await validateUrl(input);

    const response = await fetch(
        url.href,
        {
            ...options,
            redirect: "manual"
        }
    );

    if (
        response.status >= 300 &&
        response.status < 400
    ) {
        const location =
            response.headers.get("location");

        if (!location) {
            throw new Error(
                "Redirect has no destination"
            );
        }

        const next = new URL(
            location,
            url
        );

        return safeFetch(
            next.href,
            options,
            redirects + 1
        );
    }

    return {
        response,
        finalUrl: url
    };
}

function shouldSkipUrl(value) {
    const v = String(value || "").trim();

    return (
        !v ||
        v.startsWith("#") ||
        /^(data|blob|javascript|mailto|tel):/i.test(v)
    );
}

function proxiedUrl(
    value,
    baseUrl
) {
    if (shouldSkipUrl(value)) {
        return value;
    }

    try {
        const absolute = new URL(
            value,
            baseUrl
        );

        if (
            !["http:", "https:"].includes(
                absolute.protocol
            )
        ) {
            return value;
        }

        if (
            !isAllowedHost(
                absolute.hostname
            )
        ) {
            return (
                "/blocked?url=" +
                encodeURIComponent(
                    absolute.href
                )
            );
        }

        return (
            "/proxy?url=" +
            encodeURIComponent(
                absolute.href
            )
        );
    } catch {
        return value;
    }
}

function rewriteSrcset(
    srcset,
    baseUrl
) {
    return String(srcset || "")
        .split(",")
        .map(part => {
            const bits =
                part.trim().split(/\s+/);

            if (!bits[0]) {
                return part;
            }

            bits[0] = proxiedUrl(
                bits[0],
                baseUrl
            );

            return bits.join(" ");
        })
        .join(", ");
}

function rewriteCss(
    css,
    baseUrl
) {
    return String(css || "").replace(
        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
        (
            match,
            quote,
            raw
        ) => {
            if (shouldSkipUrl(raw)) {
                return match;
            }

            const rewritten =
                proxiedUrl(
                    raw,
                    baseUrl
                );

            return `url(${quote}${rewritten}${quote})`;
        }
    );
}

function rewriteHtml(
    html,
    pageUrl
) {
    const $ = cheerio.load(
        html,
        {
            decodeEntities: false
        }
    );

    const attrs = [
        ["a[href]", "href"],
        ["link[href]", "href"],
        ["img[src]", "src"],
        ["script[src]", "src"],
        ["iframe[src]", "src"],
        ["source[src]", "src"],
        ["video[src]", "src"],
        ["audio[src]", "src"],
        ["form[action]", "action"]
    ];

    for (
        const [selector, attr]
        of attrs
    ) {
        $(selector).each(
            (_, element) => {
                const current =
                    $(element).attr(attr);

                if (current) {
                    $(element).attr(
                        attr,
                        proxiedUrl(
                            current,
                            pageUrl
                        )
                    );
                }
            }
        );
    }

    $("[srcset]").each(
        (_, element) => {
            const srcset =
                $(element).attr(
                    "srcset"
                );

            if (srcset) {
                $(element).attr(
                    "srcset",
                    rewriteSrcset(
                        srcset,
                        pageUrl
                    )
                );
            }
        }
    );

    $("style").each(
        (_, element) => {
            const css =
                $(element).html();

            if (css) {
                $(element).html(
                    rewriteCss(
                        css,
                        pageUrl
                    )
                );
            }
        }
    );

    $("[style]").each(
        (_, element) => {
            const css =
                $(element).attr(
                    "style"
                );

            if (css) {
                $(element).attr(
                    "style",
                    rewriteCss(
                        css,
                        pageUrl
                    )
                );
            }
        }
    );

    $("a[target='_top'], a[target='_parent']")
        .attr("target", "_self");

    $("form[target='_top'], form[target='_parent']")
        .attr("target", "_self");

    return $.html();
}

app.get("/", (req, res) => {
    res.type("html").send(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Schoolio Proxy</title>
<style>
body{
background:#070707;
color:#eee;
font-family:Arial;
padding:50px;
}
h1{
color:#ff263d;
}
</style>
</head>
<body>

<h1>Schoolio Proxy</h1>

<p>
● ONLINE
</p>

<p>
Catalog URLs:
${SITE_CATALOG.length}
</p>

</body>
</html>
`);
});

app.get(
    "/api/test",
    (req, res) => {
        res.json({
            working: true,
            message:
                "Schoolio connected successfully!",
            version:
                "Schoolio Proxy 4.2",
            allowedDomains:
                ALLOWED_HOSTS.length,
            catalogUrls:
                SITE_CATALOG.length
        });
    }
);

app.get(
    "/api/allowed",
    (req, res) => {
        res.json({
            count:
                ALLOWED_HOSTS.length,

            domains:
                ALLOWED_HOSTS
        });
    }
);

app.get(
    "/api/sites",
    (req, res) => {
        const requestedLimit =
            Number(
                req.query.limit ||
                200
            );

        const requestedOffset =
            Number(
                req.query.offset ||
                0
            );

        const limit =
            Math.min(
                Math.max(
                    Number.isFinite(
                        requestedLimit
                    )
                        ? requestedLimit
                        : 200,
                    1
                ),
                500
            );

        const offset =
            Math.max(
                Number.isFinite(
                    requestedOffset
                )
                    ? requestedOffset
                    : 0,
                0
            );

        const items =
            SITE_CATALOG.slice(
                offset,
                offset + limit
            );

        res.json({
            total:
                SITE_CATALOG.length,

            offset,

            limit,

            returned:
                items.length,

            items
        });
    }
);

app.get(
    "/api/sites/search",
    (req, res) => {
        const query =
            String(
                req.query.q || ""
            )
                .trim()
                .toLowerCase();

        if (!query) {
            return res.json({
                query: "",
                total: 0,
                items: []
            });
        }

        const items =
            SITE_CATALOG
                .filter(url =>
                    url
                        .toLowerCase()
                        .includes(query)
                )
                .slice(
                    0,
                    200
                );

        res.json({
            query,
            total:
                items.length,
            items
        });
    }
);

app.get(
    "/api/check",
    async (req, res) => {
        const target =
            req.query.url;

        if (!target) {
            return res
                .status(400)
                .json({
                    allowed: false,
                    error:
                        "Missing url"
                });
        }

        try {
            const url =
                await validateUrl(
                    target
                );

            res.json({
                allowed: true,
                url:
                    url.href,
                hostname:
                    url.hostname
            });
        } catch (error) {
            res
                .status(403)
                .json({
                    allowed: false,
                    error:
                        error.message
                });
        }
    }
);

app.get(
    "/blocked",
    (req, res) => {
        res.status(403)
            .type("html")
            .send(`
<h2>
Site not allowed
</h2>

<p>
This destination is not in the Schoolio allowlist.
</p>
`);
    }
);

app.all(
    "/proxy",
    async (req, res) => {
        const targetUrl =
            req.query.url;

        if (!targetUrl) {
            return res
                .status(400)
                .json({
                    error:
                        "Missing 'url' query parameter"
                });
        }

        try {
            const headers = {
                "User-Agent":
                    "Mozilla/5.0 Chrome/153 Schoolio/2.0",

                "Accept":
                    req.headers.accept ||
                    "text/html,application/xhtml+xml,application/json,text/plain,*/*",

                "Accept-Language":
                    "en-US,en;q=0.9"
            };

            const options = {
                method:
                    [
                        "GET",
                        "POST",
                        "HEAD"
                    ].includes(
                        req.method
                    )
                        ? req.method
                        : "GET",

                headers
            };

            if (
                options.method ===
                    "POST" &&
                req.body &&
                Object.keys(
                    req.body
                ).length
            ) {
                options.body =
                    new URLSearchParams(
                        req.body
                    ).toString();

                headers[
                    "Content-Type"
                ] =
                    "application/x-www-form-urlencoded";
            }

            const {
                response,
                finalUrl
            } =
                await safeFetch(
                    targetUrl,
                    options
                );

            const declaredLength =
                Number(
                    response.headers.get(
                        "content-length"
                    ) || 0
                );

            if (
                declaredLength >
                MAX_RESPONSE_BYTES
            ) {
                return res
                    .status(413)
                    .send(
                        "Response is too large"
                    );
            }

            const contentType =
                response.headers.get(
                    "content-type"
                ) ||
                "application/octet-stream";

            const buffer =
                Buffer.from(
                    await response.arrayBuffer()
                );

            if (
                buffer.length >
                MAX_RESPONSE_BYTES
            ) {
                return res
                    .status(413)
                    .send(
                        "Response is too large"
                    );
            }

            res.status(
                response.status
            );

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.setHeader(
                "X-Schoolio-Final-URL",
                finalUrl.href
            );

            if (
                contentType.includes(
                    "text/html"
                )
            ) {
                const rewritten =
                    rewriteHtml(
                        buffer.toString(
                            "utf8"
                        ),
                        finalUrl.href
                    );

                res.type("html")
                    .send(rewritten);

                return;
            }

            if (
                contentType.includes(
                    "text/css"
                )
            ) {
                const rewrittenCss =
                    rewriteCss(
                        buffer.toString(
                            "utf8"
                        ),
                        finalUrl.href
                    );

                res.type("css")
                    .send(
                        rewrittenCss
                    );

                return;
            }

            res.setHeader(
                "Content-Type",
                contentType
            );

            res.send(buffer);
        } catch (error) {
            res.status(403)
                .type("html")
                .send(`
<h2>
Schoolio Proxy Error
</h2>

<p>
${String(error.message)}
</p>
`);
        }
    }
);

app.use(
    (req, res) => {
        res.status(404)
            .json({
                error:
                    "Schoolio route not found"
            });
    }
);

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Schoolio Proxy 4.2 running on port ${PORT}`
        );

        console.log(
            `Allowed domains: ${ALLOWED_HOSTS.length}`
        );

        console.log(
            `Catalog URLs: ${SITE_CATALOG.length}`
        );
    }
);
