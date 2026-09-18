const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const dns = require("dns").promises;
const net = require("net");

const app = express();

const PORT = process.env.PORT || 3000;

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

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,HEAD,OPTIONS"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});


/* =========================================================
   ALLOWED WEBSITES
========================================================= */

const ALLOWED_HOSTS = [

    // GitHub / coding
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
    "java.com",
    "oracle.com",

    // Web development
    "developer.mozilla.org",
    "mozilla.org",
    "w3.org",
    "w3schools.com",

    // Hosting
    "render.com",
    "vercel.com",
    "netlify.com",
    "railway.app",
    "cloudflare.com",

    // Reference
    "wikipedia.org",
    "wikimedia.org",
    "wiktionary.org",
    "britannica.com",
    "merriam-webster.com",
    "dictionary.com",
    "thesaurus.com",
    "archive.org",
    "gutenberg.org",

    // Microsoft
    "microsoft.com",
    "learn.microsoft.com",
    "support.microsoft.com",
    "office.com",

    // Google public pages
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "googleusercontent.com",
    "scholar.google.com",
    "books.google.com",
    "translate.google.com",

    // Education
    "khanacademy.org",
    "quizlet.com",
    "desmos.com",
    "geogebra.org",
    "wolframalpha.com",

    // Science
    "nasa.gov",
    "noaa.gov",
    "usgs.gov",
    "nih.gov",
    "cdc.gov",
    "who.int",

    // Government / finance
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

    // News
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "npr.org",

    // General
    "imdb.com",
    "rottentomatoes.com",
    "goodreads.com",
    "medium.com",
    "substack.com",

    // Productivity
    "canva.com",
    "figma.com",
    "notion.so"
];


/* =========================================================
   DOMAIN CHECK
========================================================= */

function isAllowedHost(hostname) {

    hostname =
        hostname
            .toLowerCase()
            .replace(/\.$/, "");

    return ALLOWED_HOSTS.some(domain => {

        domain =
            domain
                .toLowerCase()
                .replace(/\.$/, "");

        return (
            hostname === domain ||
            hostname.endsWith("." + domain)
        );

    });
}


/* =========================================================
   PRIVATE IP BLOCK
========================================================= */

function isPrivateIP(ip) {

    if (net.isIPv4(ip)) {

        const p =
            ip
                .split(".")
                .map(Number);

        const a = p[0];
        const b = p[1];

        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||

            (
                a === 169 &&
                b === 254
            ) ||

            (
                a === 172 &&
                b >= 16 &&
                b <= 31
            ) ||

            (
                a === 192 &&
                b === 168
            ) ||

            (
                a === 100 &&
                b >= 64 &&
                b <= 127
            )
        );
    }

    if (net.isIPv6(ip)) {

        const value =
            ip.toLowerCase();

        return (
            value === "::1" ||
            value === "::" ||
            value.startsWith("fc") ||
            value.startsWith("fd") ||
            value.startsWith("fe80:")
        );
    }

    return true;
}


/* =========================================================
   URL VALIDATION
========================================================= */

async function validateUrl(input) {

    let url;

    try {

        url = new URL(input);

    } catch {

        throw new Error(
            "Invalid URL"
        );
    }

    if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
    ) {

        throw new Error(
            "Only HTTP and HTTPS URLs are supported"
        );
    }

    if (
        !isAllowedHost(
            url.hostname
        )
    ) {

        throw new Error(
            "That website is not in the Schoolio allowlist."
        );
    }

    const addresses =
        await dns.lookup(
            url.hostname,
            {
                all: true
            }
        );

    for (
        const result
        of addresses
    ) {

        if (
            isPrivateIP(
                result.address
            )
        ) {

            throw new Error(
                "Private/internal addresses are blocked."
            );
        }
    }

    return url;
}


/* =========================================================
   FETCH WITH REDIRECT CHECKING
========================================================= */

async function safeFetch(
    target,
    redirectCount = 0
) {

    if (redirectCount > 5) {

        throw new Error(
            "Too many redirects."
        );
    }

    const url =
        await validateUrl(
            target
        );

    const response =
        await fetch(
            url.href,
            {
                method: "GET",

                redirect:
                    "manual",

                headers: {

                    "User-Agent":
                        "Mozilla/5.0 Schoolio/2.0",

                    "Accept":
                        "text/html,text/css,image/*,application/json,text/plain,*/*",

                    "Accept-Language":
                        "en-US,en;q=0.9"
                }
            }
        );

    if (
        response.status >= 300 &&
        response.status < 400
    ) {

        const location =
            response.headers.get(
                "location"
            );

        if (!location) {

            throw new Error(
                "Redirect has no destination."
            );
        }

        const next =
            new URL(
                location,
                url
            );

        return safeFetch(
            next.href,
            redirectCount + 1
        );
    }

    return {
        response,
        finalUrl:
            url.href
    };
}


/* =========================================================
   PROXY URL CREATOR
========================================================= */

function proxyUrl(url) {

    return (
        "/proxy?url=" +
        encodeURIComponent(url)
    );
}


/* =========================================================
   REWRITE HTML
========================================================= */

function rewriteHTML(
    html,
    pageUrl
) {

    const $ =
        cheerio.load(
            html
        );

    const rewrite =
        (
            selector,
            attribute
        ) => {

            $(
                selector
            )
            .each(
                (_, element) => {

                    const oldValue =
                        $(element)
                        .attr(
                            attribute
                        );

                    if (
                        !oldValue ||
                        oldValue.startsWith("#") ||
                        oldValue.startsWith("data:") ||
                        oldValue.startsWith("javascript:") ||
                        oldValue.startsWith("mailto:") ||
                        oldValue.startsWith("tel:")
                    ) {

                        return;
                    }

                    try {

                        const absolute =
                            new URL(
                                oldValue,
                                pageUrl
                            );

                        $(element)
                        .attr(
                            attribute,
                            proxyUrl(
                                absolute.href
                            )
                        );

                    } catch {}

                }
            );
        };

    rewrite(
        "a[href]",
        "href"
    );

    rewrite(
        "img[src]",
        "src"
    );

    rewrite(
        "script[src]",
        "src"
    );

    rewrite(
        "link[href]",
        "href"
    );

    rewrite(
        "iframe[src]",
        "src"
    );

    rewrite(
        "source[src]",
        "src"
    );

    rewrite(
        "video[src]",
        "src"
    );

    rewrite(
        "audio[src]",
        "src"
    );

    rewrite(
        "form[action]",
        "action"
    );

    $("meta[http-equiv='refresh']")
    .remove();

    $("head")
    .prepend(`
        <script>
        window.__SCHOOLIO_PROXY__ = true;
        </script>
    `);

    return $.html();
}


/* =========================================================
   REWRITE CSS URL(...)
========================================================= */

function rewriteCSS(
    css,
    pageUrl
) {

    return css.replace(
        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,

        (
            match,
            quote,
            value
        ) => {

            if (
                !value ||
                value.startsWith("data:") ||
                value.startsWith("#")
            ) {

                return match;
            }

            try {

                const absolute =
                    new URL(
                        value,
                        pageUrl
                    );

                return (
                    `url("${proxyUrl(
                        absolute.href
                    )}")`
                );

            } catch {

                return match;
            }
        }
    );
}


/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
Schoolio Proxy
</title>

<style>

body {
    margin: 0;
    padding: 50px;

    font-family:
        Arial,
        sans-serif;

    color: #eee;

    background:
        #070707;
}

.card {

    max-width:
        650px;

    margin:
        auto;

    padding:
        30px;

    border-radius:
        16px;

    background:
        #0d0d0d;

    border:
        1px solid #222;
}

h1 {
    color:
        #ff263d;
}

.online {
    color:
        #65dc7c;
}

code {

    display:
        block;

    margin-top:
        15px;

    padding:
        12px;

    border-radius:
        8px;

    background:
        #050505;

    color:
        #aaa;
}

</style>

</head>

<body>

<div class="card">

<h1>
SCHOOLIO PROXY
</h1>

<p class="online">
● ONLINE
</p>

<p>
Schoolio backend is running.
</p>

<code>
/proxy?url=https://en.wikipedia.org
</code>

</div>

</body>

</html>
        `);
    }
);


/* =========================================================
   TEST
========================================================= */

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            working:
                true,

            message:
                "Schoolio connected successfully!",

            allowedDomains:
                ALLOWED_HOSTS.length
        });
    }
);


/* =========================================================
   ALLOWED LIST
========================================================= */

app.get(
    "/api/allowed",
    (req, res) => {

        res.json({

            count:
                ALLOWED_HOSTS.length,

            websites:
                ALLOWED_HOSTS
        });
    }
);


/* =========================================================
   GITHUB TEST
========================================================= */

app.get(
    "/api/github",
    async (req, res) => {

        try {

            const response =
                await fetch(
                    "https://api.github.com/repos/microsoft/vscode",
                    {
                        headers: {
                            "User-Agent":
                                "Schoolio"
                        }
                    }
                );

            const data =
                await response.json();

            res.json({

                name:
                    data.name,

                stars:
                    data.stargazers_count,

                description:
                    data.description
            });

        } catch(error) {

            res
                .status(500)
                .json({

                    error:
                        error.message
                });
        }
    }
);


/* =========================================================
   PROXY
========================================================= */

app.get(
    "/proxy",
    async (req, res) => {

        const target =
            req.query.url;

        if (!target) {

            return res
                .status(400)
                .send(
                    "Missing url parameter."
                );
        }

        try {

            const {
                response,
                finalUrl
            } =
                await safeFetch(
                    target
                );

            const contentType =
                response.headers.get(
                    "content-type"
                ) ||
                "application/octet-stream";

            const maxSize =
                10 *
                1024 *
                1024;

            const declaredSize =
                Number(
                    response.headers.get(
                        "content-length"
                    ) || 0
                );

            if (
                declaredSize >
                maxSize
            ) {

                return res
                    .status(413)
                    .send(
                        "Response too large."
                    );
            }

            if (
                contentType.includes(
                    "text/html"
                )
            ) {

                let html =
                    await response.text();

                html =
                    rewriteHTML(
                        html,
                        finalUrl
                    );

                res.status(
                    response.status
                );

                res.setHeader(
                    "Content-Type",
                    "text/html; charset=utf-8"
                );

                return res.send(
                    html
                );
            }

            if (
                contentType.includes(
                    "text/css"
                )
            ) {

                let css =
                    await response.text();

                css =
                    rewriteCSS(
                        css,
                        finalUrl
                    );

                res.status(
                    response.status
                );

                res.setHeader(
                    "Content-Type",
                    "text/css; charset=utf-8"
                );

                return res.send(
                    css
                );
            }

            const buffer =
                await response.buffer();

            if (
                buffer.length >
                maxSize
            ) {

                return res
                    .status(413)
                    .send(
                        "Response too large."
                    );
            }

            res.status(
                response.status
            );

            res.setHeader(
                "Content-Type",
                contentType
            );

            return res.send(
                buffer
            );

        } catch(error) {

            return res
                .status(403)
                .send(`
<!DOCTYPE html>

<html>

<head>

<style>

body {

    background:
        #070707;

    color:
        #eee;

    font-family:
        Arial;

    padding:
        40px;
}

h2 {
    color:
        #ff263d;
}

</style>

</head>

<body>

<h2>
Schoolio Proxy
</h2>

<p>
${escapeHtml(error.message)}
</p>

</body>

</html>
                `);
        }
    }
);


/* =========================================================
   HTML ESCAPE
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
   START
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "Schoolio server running on port " +
            PORT
        );

        console.log(
            "Allowed websites: " +
            ALLOWED_HOSTS.length
        );
    }
);
