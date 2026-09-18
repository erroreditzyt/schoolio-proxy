const express = require("express");
const fetch = require("node-fetch");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// Root endpoint
app.get("/", (req, res) => {
    res.send(`
        <h1>Schoolio Server</h1>
        <p>✅ Proxy backend is online!</p>
    `);
});

// Test API
app.get("/api/test", (req, res) => {
    res.json({
        working: true,
        message: "Schoolio connected successfully!"
    });
});

// Example API
app.get("/api/github", async (req, res) => {
    try {
        const response = await fetch(
            "https://api.github.com/repos/microsoft/vscode",
            {
                headers: {
                    "User-Agent": "Schoolio"
                }
            }
        );
        const data = await response.json();
        res.json({
            name: data.name,
            stars: data.stargazers_count,
            description: data.description
        });
    } catch (error) {
        res.status(500).json({ error: "Request failed" });
    }
});

// Proxy endpoint to handle any website request
app.all("/proxy", async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    try {
        const headers = { ...req.headers };
        delete headers.host; // Remove host header to avoid conflicts

        const fetchOptions = {
            method: req.method,
            headers: headers,
        };

        if (req.method !== "GET" && req.body) {
            fetchOptions.body = JSON.stringify(req.body);
            fetchOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(targetUrl, fetchOptions);
        const contentType = response.headers.get("content-type");

        res.status(response.status);
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            res.json(data);
        } else {
            const buffer = await response.buffer();
            res.send(buffer);
        }
    } catch (err) {
        res.status(500).json({ error: "Error fetching the target URL", details: err.message });
    }
});

// Note: Remove or comment out the catch-all route if you only want proxy functionality
/*
app.all("*", async (req, res) => {
    res.status(404).json({ error: "Route not found" });
});
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Schoolio server running on port " + PORT);
});
