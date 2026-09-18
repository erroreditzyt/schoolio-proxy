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
   SCHOOLIO ALLOWED WEBSITES
========================================================= */

const ALLOWED_HOSTS = [

    /* GitHub */
    "github.com",
    "api.github.com",
    "docs.github.com",
    "githubusercontent.com",
    "raw.githubusercontent.com",
    "githubassets.com",

    /* Coding */
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

    /* Web Development */
    "developer.mozilla.org",
    "mozilla.org",
    "mozilla.net",
    "w3.org",
    "w3schools.com",

    /* Hosting */
    "render.com",
    "vercel.com",
    "netlify.com",
    "railway.app",
    "cloudflare.com",

    /* Wikipedia / Reference */
    "wikipedia.org",
    "wikimedia.org",
    "wiktionary.org",
    "britannica.com",
    "merriam-webster.com",
    "dictionary.com",
    "thesaurus.com",
    "archive.org",
    "gutenberg.org",

    /* Microsoft */
    "microsoft.com",
    "learn.microsoft.com",
    "support.microsoft.com",
    "office.com",

    /* Google Public Services */
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "googleusercontent.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "scholar.google.com",
    "books.google.com",
    "translate.google.com",

    /* Education */
    "khanacademy.org",
    "kastatic.org",
    "kasandbox.org",
    "quizlet.com",
    "desmos.com",
    "geogebra.org",
    "wolframalpha.com",

    /* Science */
    "nasa.gov",
    "noaa.gov",
    "usgs.gov",
    "nih.gov",
    "cdc.gov",
    "who.int",

    /* Government */
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

    /* Finance */
    "investopedia.com",
    "nasdaq.com",
    "nyse.com",
    "finance.yahoo.com",

    /* News */
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "npr.org",

    /* General */
    "imdb.com",
    "rottentomatoes.com",
    "goodreads.com",
    "medium.com",
    "substack.com",

    /* Productivity */
    "canva.com",
    "figma.com",
    "notion.so",
    "petezah.games"
];


/* =========================================================
   CHECK ALLOWED HOST
========================================================= */

function isAllowedHost(hostname) {

    hostname =
        String(hostname)
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
   PRIVATE IP CHECK
========================================================= */

function isPrivateIPv4(ip) {

    const pieces =
        ip
            .split(".")
            .map(Number);

    if (pieces.length !== 4) {
        return true;
    }

    const a = pieces[0];
    const b = pieces[1];

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


function isPrivateIPv6(ip) {

    const value =
        ip.toLowerCase();

    return (

        value === "::" ||

        value === "::1" ||

        value.startsWith("fc") ||

        value.startsWith("fd") ||

        value.startsWith("fe80:")
    );
}


function isPrivateIP(ip) {

    if (net.isIPv4(ip)) {
        return isPrivateIPv4(ip);
    }

    if (net.isIPv6(ip)) {
        return isPrivateIPv6(ip);
    }

    return true;
}


/* =========================================================
   VALIDATE TARGET URL
========================================================= */

async function validateUrl(input) {

    let url;

    try {

        url =
            new URL(input);

    } catch {

        throw new Error(
            "Invalid website address."
        );
    }


    if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
    ) {

        throw new Error(
            "Only HTTP and HTTPS websites are supported."
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


    let addresses;

    try {

        addresses =
            await dns.lookup(
                url.hostname,
                {
                    all: true
                }
            );

    } catch {

        throw new Error(
            "Website hostname could not be resolved."
        );
    }


    if (!addresses.length) {

        throw new Error(
            "Website hostname could not be resolved."
        );
    }


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
                "Private or internal network addresses are blocked."
            );
        }
    }


    return url;
}


/* =========================================================
   SAFE FETCH
========================================================= */

async function safeFetch(
    input,
    redirects = 0
) {

    if (redirects > 5) {

        throw new Error(
            "Too many redirects."
        );
    }


    const url =
        await validateUrl(
            input
        );


    const response =
        await fetch(
            url.href,
            {

                method:
                    "GET",

                redirect:
                    "manual",

                headers: {

                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Schoolio/2.0",

                    "Accept":
                        "text/html,text/css,image/avif,image/webp,image/png,image/jpeg,application/json,text/plain,*/*",

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
                "Redirect destination was missing."
            );
        }


        const nextUrl =
            new URL(
                location,
                url
            );


        return safeFetch(
            nextUrl.href,
            redirects + 1
        );
    }


    return {

        response,

        finalUrl:
            url.href
    };
}


/* =========================================================
   CREATE SCHOOLIO PROXY URL
========================================================= */

function createProxyUrl(url) {

    return (
        "/proxy?url=" +
        encodeURIComponent(url)
    );
}


/* =========================================================
   SHOULD SKIP URL
========================================================= */

function shouldSkipUrl(value) {

    if (!value) {
        return true;
    }

    const lower =
        value
            .trim()
            .toLowerCase();

    return (

        lower.startsWith("#") ||

        lower.startsWith("data:") ||

        lower.startsWith("javascript:") ||

        lower.startsWith("mailto:") ||

        lower.startsWith("tel:") ||

        lower.startsWith("blob:")
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


    function rewriteAttribute(
        selector,
        attribute
    ) {

        $(selector)
            .each(
                (index, element) => {

                    const original =
                        $(element)
                            .attr(
                                attribute
                            );


                    if (
                        shouldSkipUrl(
                            original
                        )
                    ) {

                        return;
                    }


                    try {

                        const absolute =
                            new URL(
                                original,
                                pageUrl
                            );


                        if (
                            absolute.protocol !== "http:" &&
                            absolute.protocol !== "https:"
                        ) {

                            return;
                        }


                        $(element)
                            .attr(
                                attribute,
                                createProxyUrl(
                                    absolute.href
                                )
                            );

                    } catch {

                        // Ignore malformed resource URL

                    }
                }
            );
    }


    rewriteAttribute(
        "a[href]",
        "href"
    );

    rewriteAttribute(
        "img[src]",
        "src"
    );

    rewriteAttribute(
        "script[src]",
        "src"
    );

    rewriteAttribute(
        "link[href]",
        "href"
    );

    rewriteAttribute(
        "iframe[src]",
        "src"
    );

    rewriteAttribute(
        "source[src]",
        "src"
    );

    rewriteAttribute(
        "video[src]",
        "src"
    );

    rewriteAttribute(
        "audio[src]",
        "src"
    );


    /* Remove automatic page redirects */

    $(
        'meta[http-equiv="refresh"]'
    )
    .remove();


    /*
       Add base information for relative URLs
       used by some page scripts.
    */

    $("head")
        .prepend(`
            <meta
            name="schoolio-proxy"
            content="enabled">
        `);


    return $.html();
}


/* =========================================================
   REWRITE CSS url(...)
========================================================= */

function rewriteCSS(
    css,
    pageUrl
) {

    return css.replace(

        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,

        (
            whole,
            quote,
            value
        ) => {

            if (
                shouldSkipUrl(
                    value
                )
            ) {

                return whole;
            }


            try {

                const absolute =
                    new URL(
                        value,
                        pageUrl
                    );


                if (
                    absolute.protocol !== "http:" &&
                    absolute.protocol !== "https:"
                ) {

                    return whole;
                }


                return (
                    'url("' +
                    createProxyUrl(
                        absolute.href
                    ) +
                    '")'
                );

            } catch {

                return whole;
            }
        }
    );
}


/* =========================================================
   SERVER HOME
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1">

<title>
Schoolio Proxy
</title>

<style>

body {

    margin:
        0;

    padding:
        40px;

    font-family:
        Arial,
        sans-serif;

    color:
        #eeeeee;

    background:
        #050505;
}

.card {

    max-width:
        650px;

    margin:
        40px auto;

    padding:
        30px;

    border-radius:
        16px;

    background:
        #0d0d0d;

    border:
        1px solid #222222;
}

h1 {

    margin-top:
        0;

    color:
        #ff263d;
}

.online {

    color:
        #62db78;
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

    color:
        #aaaaaa;

    background:
        #050505;

    overflow-wrap:
        anywhere;
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

<p>
Test endpoint:
</p>

<code>
/api/test
</code>

<p>
Proxy example:
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
   TEST API
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
   CHECK WHETHER WEBSITE IS ALLOWED
========================================================= */

app.get(
    "/api/check",
    async (req, res) => {

        const target =
            req.query.url;


        if (!target) {

            return res
                .status(400)
                .json({

                    allowed:
                        false,

                    error:
                        "Missing url parameter."
                });
        }


        try {

            const url =
                await validateUrl(
                    target
                );


            return res.json({

                allowed:
                    true,

                url:
                    url.href,

                hostname:
                    url.hostname
            });


        } catch(error) {

            return res
                .status(403)
                .json({

                    allowed:
                        false,

                    error:
                        error.message
                });
        }
    }
);


/* =========================================================
   SHOW ALLOWED SITES
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
                        "GitHub request failed.",

                    details:
                        error.message
                });
        }
    }
);


/* =========================================================
   WEBSITE PROXY
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


            const declaredLength =
                Number(
                    response.headers.get(
                        "content-length"
                    ) ||
                    0
                );


            const maxSize =
                10 *
                1024 *
                1024;


            if (
                declaredLength >
                maxSize
            ) {

                return res
                    .status(413)
                    .send(
                        "Website response was too large."
                    );
            }


            /* ===============================
               HTML
            =============================== */

            if (
                contentType.includes(
                    "text/html"
                )
            ) {

                let html =
                    await response.text();


                if (
                    Buffer.byteLength(
                        html,
                        "utf8"
                    ) >
                    maxSize
                ) {

                    return res
                        .status(413)
                        .send(
                            "Website response was too large."
                        );
                }


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


                res.setHeader(
                    "X-Schoolio-Final-URL",
                    finalUrl
                );


                return res.send(
                    html
                );
            }


            /* ===============================
               CSS
            =============================== */

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


            /* ===============================
               OTHER FILE TYPES
            =============================== */

            const buffer =
                await response.buffer();


            if (
                buffer.length >
                maxSize
            ) {

                return res
                    .status(413)
                    .send(
                        "Website response was too large."
                    );
            }


            res.status(
                response.status
            );


            res.setHeader(
                "Content-Type",
                contentType
            );


            res.setHeader(
                "X-Schoolio-Final-URL",
                finalUrl
            );


            return res.send(
                buffer
            );


        } catch(error) {

            return res
                .status(403)
                .send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<style>

body {

    margin:
        0;

    padding:
        40px;

    font-family:
        Arial,
        sans-serif;

    color:
        #eeeeee;

    background:
        #070707;
}

.card {

    max-width:
        600px;

    margin:
        auto;

    padding:
        25px;

    border:
        1px solid #222222;

    border-radius:
        14px;

    background:
        #0d0d0d;
}

h2 {

    color:
        #ff263d;
}

</style>

</head>

<body>

<div class="card">

<h2>
Schoolio Proxy
</h2>

<p>
${escapeHtml(error.message)}
</p>

</div>

</body>

</html>
                `);
        }
    }
);


/* =========================================================
   ESCAPE ERROR TEXT
========================================================= */

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res
            .status(404)
            .json({

                error:
                    "Schoolio route not found."
            });
    }
);


/* =========================================================
   START SERVER
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
            "Allowed domains: " +
            ALLOWED_HOSTS.length
        );
    }
);
