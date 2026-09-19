const express = require("express");
const fetch = require("node-fetch");
const dns = require("dns").promises;
const net = require("net");
const cheerio = require("cheerio");

const app = express();

const PORT =
    process.env.PORT ||
    3000;

const MAX_RESPONSE_BYTES =
    10 * 1024 * 1024;


/* =========================================================
   EXPRESS
========================================================= */

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


/* =========================================================
   CORS
========================================================= */

app.use(
    (req, res, next) => {

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
            "GET,POST,HEAD,OPTIONS"
        );

        if (
            req.method ===
            "OPTIONS"
        ) {

            return res.sendStatus(
                204
            );
        }

        next();
    }
);


/* =========================================================
   APPROVED DOMAINS

   IMPORTANT:

   Adding:

       "roblox.com"

   automatically allows:

       roblox.com
       www.roblox.com
       create.roblox.com
       games.roblox.com
       anything.roblox.com

   It also allows ANY path/query under the domain:

       /games/123
       /users/123/profile
       ?placeId=123

========================================================= */

const DEFAULT_ALLOWED_HOSTS = [

    /* ==============================
       PETEZAH
    ============================== */

    "petezahgames.com",

    "petezahgames.github.io",


    /* ==============================
       ROBLOX
    ============================== */

    "roblox.com",

    "rbxcdn.com",


    /* ==============================
       GITHUB
    ============================== */

    "github.com",

    "api.github.com",

    "docs.github.com",

    "githubusercontent.com",

    "raw.githubusercontent.com",

    "githubassets.com",


    /* ==============================
       CODING
    ============================== */

    "stackoverflow.com",

    "stackexchange.com",

    "codepen.io",

    "jsfiddle.net",

    "replit.com",

    "npmjs.com",

    "nodejs.org",

    "python.org",

    "pypi.org",


    /* ==============================
       WEB DEVELOPMENT
    ============================== */

    "developer.mozilla.org",

    "mozilla.org",

    "mozilla.net",

    "w3.org",

    "w3schools.com",


    /* ==============================
       CDN / ASSETS
    ============================== */

    "cloudflare.com",

    "cdnjs.cloudflare.com",

    "jsdelivr.net",

    "unpkg.com",

    "bootstrapcdn.com",

    "fontawesome.com",


    /* ==============================
       HOSTING
    ============================== */

    "render.com",

    "vercel.com",

    "netlify.com",

    "railway.app",


    /* ==============================
       WIKIPEDIA / REFERENCE
    ============================== */

    "wikipedia.org",

    "wikimedia.org",

    "wiktionary.org",

    "britannica.com",

    "merriam-webster.com",

    "dictionary.com",

    "thesaurus.com",

    "archive.org",

    "gutenberg.org",


    /* ==============================
       EDUCATION
    ============================== */

    "khanacademy.org",

    "kastatic.org",

    "kasandbox.org",

    "quizlet.com",

    "desmos.com",

    "geogebra.org",

    "wolframalpha.com",


    /* ==============================
       MICROSOFT
    ============================== */

    "microsoft.com",

    "learn.microsoft.com",

    "support.microsoft.com",

    "office.com",


    /* ==============================
       GOOGLE PUBLIC SERVICES
    ============================== */

    "google.com",

    "googleapis.com",

    "gstatic.com",

    "googleusercontent.com",

    "fonts.googleapis.com",

    "fonts.gstatic.com",

    "scholar.google.com",

    "books.google.com",

    "translate.google.com",


    /* ==============================
       SCIENCE / GOVERNMENT
    ============================== */

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


    /* ==============================
       FINANCE
    ============================== */

    "investopedia.com",

    "nasdaq.com",

    "nyse.com",

    "yahoo.com",


    /* ==============================
       NEWS
    ============================== */

    "reuters.com",

    "apnews.com",

    "bbc.com",

    "npr.org",


    /* ==============================
       GENERAL
    ============================== */

    "imdb.com",

    "rottentomatoes.com",

    "goodreads.com",

    "medium.com",

    "substack.com",


    /* ==============================
       PRODUCTIVITY
    ============================== */

    "canva.com",

    "figma.com",

    "notion.so",


    /* ==============================
       TEST
    ============================== */

    "example.com"
];


/* =========================================================
   OPTIONAL EXTRA DOMAINS FROM RENDER

   Environment variable:

   ALLOWED_HOSTS

   Example value:

   example1.com,example2.com
========================================================= */

const EXTRA_ALLOWED_HOSTS =
    String(
        process.env.ALLOWED_HOSTS ||
        ""
    )
    .split(",")
    .map(
        host =>
            host
                .trim()
                .toLowerCase()
    )
    .filter(Boolean);


const ALLOWED_HOSTS =
    Array.from(
        new Set([
            ...DEFAULT_ALLOWED_HOSTS,
            ...EXTRA_ALLOWED_HOSTS
        ])
    );


/* =========================================================
   HOST MATCHING
========================================================= */

function normalizeHost(
    hostname
) {

    return String(
        hostname ||
        ""
    )
    .trim()
    .toLowerCase()
    .replace(
        /\.$/,
        ""
    );
}


function isAllowedHost(
    hostname
) {

    const host =
        normalizeHost(
            hostname
        );


    return ALLOWED_HOSTS.some(
        domain => {

            const allowed =
                normalizeHost(
                    domain
                );


            return (

                host ===
                allowed

                ||

                host.endsWith(
                    "." +
                    allowed
                )
            );
        }
    );
}


/* =========================================================
   PRIVATE IP PROTECTION
========================================================= */

function isPrivateIPv4(
    ip
) {

    const parts =
        ip
            .split(".")
            .map(Number);


    if (
        parts.length !==
        4
    ) {

        return true;
    }


    if (
        parts.some(
            value =>
                !Number.isInteger(
                    value
                )
        )
    ) {

        return true;
    }


    const [
        a,
        b
    ] =
        parts;


    return (

        a === 0

        ||

        a === 10

        ||

        a === 127

        ||

        (
            a === 169
            &&
            b === 254
        )

        ||

        (
            a === 172
            &&
            b >= 16
            &&
            b <= 31
        )

        ||

        (
            a === 192
            &&
            b === 168
        )

        ||

        (
            a === 100
            &&
            b >= 64
            &&
            b <= 127
        )

        ||

        a >= 224
    );
}


function isPrivateIPv6(
    ip
) {

    const value =
        String(
            ip
        )
        .toLowerCase();


    if (
        value.startsWith(
            "::ffff:"
        )
    ) {

        const mapped =
            value.slice(
                7
            );


        return net.isIPv4(
            mapped
        )
        ?
        isPrivateIPv4(
            mapped
        )
        :
        true;
    }


    return (

        value ===
        "::"

        ||

        value ===
        "::1"

        ||

        value.startsWith(
            "fc"
        )

        ||

        value.startsWith(
            "fd"
        )

        ||

        value.startsWith(
            "fe80:"
        )
    );
}


function isPrivateIP(
    ip
) {

    if (
        net.isIPv4(
            ip
        )
    ) {

        return isPrivateIPv4(
            ip
        );
    }


    if (
        net.isIPv6(
            ip
        )
    ) {

        return isPrivateIPv6(
            ip
        );
    }


    return true;
}


/* =========================================================
   URL VALIDATION
========================================================= */

async function validateUrl(
    input
) {

    let url;


    try {

        url =
            new URL(
                input
            );

    } catch {

        throw new Error(
            "Invalid URL."
        );
    }


    if (
        url.protocol !==
        "http:"
        &&
        url.protocol !==
        "https:"
    ) {

        throw new Error(
            "Only HTTP and HTTPS URLs are supported."
        );
    }


    if (
        url.username
        ||
        url.password
    ) {

        throw new Error(
            "URLs containing usernames or passwords are not supported."
        );
    }


    if (
        !isAllowedHost(
            url.hostname
        )
    ) {

        throw new Error(
            `${url.hostname} is not in the Schoolio allowlist.`
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
            "Could not resolve hostname."
        );
    }


    if (
        !addresses.length
    ) {

        throw new Error(
            "Could not resolve hostname."
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
                "Private/internal network addresses are blocked."
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
    options = {},
    redirects = 0
) {

    if (
        redirects >
        6
    ) {

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
                ...options,

                redirect:
                    "manual"
            }
        );


    if (
        response.status >=
        300
        &&
        response.status <
        400
    ) {

        const location =
            response.headers.get(
                "location"
            );


        if (!location) {

            throw new Error(
                "Redirect destination missing."
            );
        }


        const next =
            new URL(
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

        finalUrl:
            url
    };
}


/* =========================================================
   URL REWRITE HELPERS
========================================================= */

function shouldSkipUrl(
    value
) {

    const url =
        String(
            value ||
            ""
        )
        .trim();


    return (

        !url

        ||

        url.startsWith(
            "#"
        )

        ||

        /^(data|blob|javascript|mailto|tel):/i
        .test(
            url
        )
    );
}


function proxiedUrl(
    value,
    baseUrl
) {

    if (
        shouldSkipUrl(
            value
        )
    ) {

        return value;
    }


    try {

        const absolute =
            new URL(
                value,
                baseUrl
            );


        if (
            absolute.protocol !==
            "http:"
            &&
            absolute.protocol !==
            "https:"
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


/* =========================================================
   SRCSET REWRITE
========================================================= */

function rewriteSrcset(
    srcset,
    baseUrl
) {

    return String(
        srcset ||
        ""
    )
    .split(",")
    .map(
        part => {

            const bits =
                part
                    .trim()
                    .split(
                        /\s+/
                    );


            if (
                !bits[0]
            ) {

                return part;
            }


            bits[0] =
                proxiedUrl(
                    bits[0],
                    baseUrl
                );


            return bits.join(
                " "
            );
        }
    )
    .join(
        ", "
    );
}


/* =========================================================
   CSS REWRITE
========================================================= */

function rewriteCss(
    css,
    baseUrl
) {

    return String(
        css ||
        ""
    )
    .replace(

        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,

        (
            match,
            quote,
            raw
        ) => {

            if (
                shouldSkipUrl(
                    raw
                )
            ) {

                return match;
            }


            const rewritten =
                proxiedUrl(
                    raw,
                    baseUrl
                );


            return (
                `url(${quote}${rewritten}${quote})`
            );
        }
    );
}


/* =========================================================
   HTML REWRITE
========================================================= */

function rewriteHtml(
    html,
    pageUrl
) {

    const $ =
        cheerio.load(
            html,
            {
                decodeEntities:
                    false
            }
        );


    const attributes = [

        [
            "a[href]",
            "href"
        ],

        [
            "link[href]",
            "href"
        ],

        [
            "img[src]",
            "src"
        ],

        [
            "script[src]",
            "src"
        ],

        [
            "iframe[src]",
            "src"
        ],

        [
            "source[src]",
            "src"
        ],

        [
            "video[src]",
            "src"
        ],

        [
            "audio[src]",
            "src"
        ],

        [
            "input[src]",
            "src"
        ],

        [
            "track[src]",
            "src"
        ],

        [
            "form[action]",
            "action"
        ]
    ];


    for (
        const [
            selector,
            attribute
        ]
        of attributes
    ) {

        $(
            selector
        )
        .each(
            (
                index,
                element
            ) => {

                const current =
                    $(
                        element
                    )
                    .attr(
                        attribute
                    );


                if (
                    current
                ) {

                    $(
                        element
                    )
                    .attr(
                        attribute,
                        proxiedUrl(
                            current,
                            pageUrl
                        )
                    );
                }
            }
        );
    }


    /* SRCSET */

    $(
        "[srcset]"
    )
    .each(
        (
            index,
            element
        ) => {

            const srcset =
                $(
                    element
                )
                .attr(
                    "srcset"
                );


            if (
                srcset
            ) {

                $(
                    element
                )
                .attr(
                    "srcset",
                    rewriteSrcset(
                        srcset,
                        pageUrl
                    )
                );
            }
        }
    );


    /* STYLE TAGS */

    $(
        "style"
    )
    .each(
        (
            index,
            element
        ) => {

            const css =
                $(
                    element
                )
                .html();


            if (
                css
            ) {

                $(
                    element
                )
                .html(
                    rewriteCss(
                        css,
                        pageUrl
                    )
                );
            }
        }
    );


    /* INLINE STYLE */

    $(
        "[style]"
    )
    .each(
        (
            index,
            element
        ) => {

            const css =
                $(
                    element
                )
                .attr(
                    "style"
                );


            if (
                css
            ) {

                $(
                    element
                )
                .attr(
                    "style",
                    rewriteCss(
                        css,
                        pageUrl
                    )
                );
            }
        }
    );


    /* Prevent replacing Schoolio itself */

    $(
        "a[target='_top'], a[target='_parent']"
    )
    .attr(
        "target",
        "_self"
    );


    $(
        "form[target='_top'], form[target='_parent']"
    )
    .attr(
        "target",
        "_self"
    );


    /* Remove meta refresh */

    $(
        'meta[http-equiv="refresh"]'
    )
    .remove();


    return $.html();
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value
    )

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
   HOME
========================================================= */

app.get(
    "/",
    (
        req,
        res
    ) => {

        res
        .type(
            "html"
        )
        .send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1">

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

    color:
        #eeeeee;

    background:
        #070707;
}

.box {

    max-width:
        680px;

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
        #73d889;
}

code {

    display:
        block;

    margin-top:
        10px;

    padding:
        12px;

    border-radius:
        8px;

    background:
        #050505;

    color:
        #aaaaaa;

    overflow-wrap:
        anywhere;
}

</style>

</head>

<body>

<div class="box">

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
Approved base domains:
<strong>
${ALLOWED_HOSTS.length}
</strong>
</p>

<code>
/api/test
</code>

<code>
/api/allowed
</code>

<code>
/api/check?url=https://www.roblox.com
</code>

<code>
/proxy?url=https://petezahgames.github.io/games.html
</code>

</div>

</body>

</html>
        `);
    }
);


/* =========================================================
   API TEST
========================================================= */

app.get(
    "/api/test",
    (
        req,
        res
    ) => {

        res.json({

            working:
                true,

            message:
                "Schoolio connected successfully!",

            version:
                "Schoolio Proxy 4.1",

            allowedDomains:
                ALLOWED_HOSTS.length
        });
    }
);


/* =========================================================
   API ALLOWED
========================================================= */

app.get(
    "/api/allowed",
    (
        req,
        res
    ) => {

        res.json({

            count:
                ALLOWED_HOSTS.length,

            domains:
                ALLOWED_HOSTS
                    .slice()
                    .sort()
        });
    }
);


/* =========================================================
   API CHECK
========================================================= */

app.get(
    "/api/check",
    async (
        req,
        res
    ) => {

        const target =
            req.query.url;


        if (
            !target
        ) {

            return res
                .status(
                    400
                )
                .json({

                    allowed:
                        false,

                    error:
                        "Missing url."
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


        } catch (
            error
        ) {

            return res
                .status(
                    403
                )
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
   BLOCKED PAGE
========================================================= */

app.get(
    "/blocked",
    (
        req,
        res
    ) => {

        const attempted =
            String(
                req.query.url ||
                ""
            );


        res
        .status(
            403
        )
        .type(
            "html"
        )
        .send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
Site Not Allowed
</title>

<style>

body {

    margin: 0;

    padding:
        40px;

    font-family:
        Arial,
        sans-serif;

    background:
        #070707;

    color:
        #dddddd;
}

h2 {

    color:
        #ff4458;
}

code {

    overflow-wrap:
        anywhere;

    color:
        #aaaaaa;
}

</style>

</head>

<body>

<h2>
SITE NOT ALLOWED
</h2>

<p>
This destination is not in the Schoolio allowlist.
</p>

<code>
${escapeHtml(attempted)}
</code>

</body>

</html>
        `);
    }
);


/* =========================================================
   PROXY
========================================================= */

app.all(
    "/proxy",
    async (
        req,
        res
    ) => {

        const targetUrl =
            req.query.url;


        if (
            !targetUrl
        ) {

            return res
                .status(
                    400
                )
                .json({

                    error:
                        "Missing url parameter."
                });
        }


        try {

            const headers = {

                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36 Schoolio/4.1",

                "Accept":
                    req.headers.accept
                    ||
                    "text/html,application/xhtml+xml,application/json,text/plain,image/avif,image/webp,*/*",

                "Accept-Language":
                    req.headers[
                        "accept-language"
                    ]
                    ||
                    "en-US,en;q=0.9"
            };


            const method =
                [
                    "GET",
                    "POST",
                    "HEAD"
                ]
                .includes(
                    req.method
                )
                ?
                req.method
                :
                "GET";


            const options = {

                method,

                headers
            };


            if (
                method ===
                "POST"
                &&
                req.body
                &&
                Object.keys(
                    req.body
                )
                .length
            ) {

                options.body =
                    new URLSearchParams(
                        req.body
                    )
                    .toString();


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
                    response
                        .headers
                        .get(
                            "content-length"
                        )
                    ||
                    0
                );


            if (
                declaredLength >
                MAX_RESPONSE_BYTES
            ) {

                return res
                    .status(
                        413
                    )
                    .send(
                        "Response is too large."
                    );
            }


            const contentType =
                response
                    .headers
                    .get(
                        "content-type"
                    )
                ||
                "application/octet-stream";


            const buffer =
                await response
                    .buffer();


            if (
                buffer.length >
                MAX_RESPONSE_BYTES
            ) {

                return res
                    .status(
                        413
                    )
                    .send(
                        "Response is too large."
                    );
            }


            res.status(
                response.status
            );


            res.setHeader(
                "X-Schoolio-Final-URL",
                finalUrl.href
            );


            /*
               HTML pages should not be cached.
            */

            if (
                contentType.includes(
                    "text/html"
                )
            ) {

                const html =
                    rewriteHtml(
                        buffer
                            .toString(
                                "utf8"
                            ),
                        finalUrl.href
                    );


                res.setHeader(
                    "Cache-Control",
                    "no-store"
                );


                res.setHeader(
                    "Content-Type",
                    "text/html; charset=utf-8"
                );


                return res.send(
                    html
                );
            }


            /*
               CSS
            */

            if (
                contentType.includes(
                    "text/css"
                )
            ) {

                const css =
                    rewriteCss(
                        buffer
                            .toString(
                                "utf8"
                            ),
                        finalUrl.href
                    );


                res.setHeader(
                    "Cache-Control",
                    "public, max-age=300"
                );


                res.setHeader(
                    "Content-Type",
                    "text/css; charset=utf-8"
                );


                return res.send(
                    css
                );
            }


            /*
               Images / fonts / other assets can
               use a little browser caching.
            */

            if (
                contentType.startsWith(
                    "image/"
                )
                ||
                contentType.includes(
                    "font"
                )
            ) {

                res.setHeader(
                    "Cache-Control",
                    "public, max-age=600"
                );

            } else {

                res.setHeader(
                    "Cache-Control",
                    "public, max-age=120"
                );
            }


            res.setHeader(
                "Content-Type",
                contentType
            );


            return res.send(
                buffer
            );


        } catch (
            error
        ) {

            return res
                .status(
                    403
                )
                .type(
                    "html"
                )
                .send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
Schoolio Proxy Error
</title>

<style>

body {

    margin: 0;

    padding:
        40px;

    font-family:
        Arial,
        sans-serif;

    background:
        #070707;

    color:
        #dddddd;
}

h2 {

    color:
        #ff4458;
}

</style>

</head>

<body>

<h2>
Schoolio Proxy Error
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
   404
========================================================= */

app.use(
    (
        req,
        res
    ) => {

        res
            .status(
                404
            )
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
            "======================================"
        );

        console.log(
            "SCHOOLIO PROXY 4.1"
        );

        console.log(
            "Port: " +
            PORT
        );

        console.log(
            "Allowed base domains: " +
            ALLOWED_HOSTS.length
        );

        console.log(
            "======================================"
        );
    }
);
