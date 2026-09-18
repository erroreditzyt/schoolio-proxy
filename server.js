const express = require("express");

const app = express();

app.use(express.json());

// Allow Schoolio HTML to call this server
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
});

app.get("/", (req, res) => {
    res.send(`
        <h1>Schoolio Server</h1>
        <p>✅ Proxy backend is online!</p>
    `);
});

// TEST API
app.get("/api/test", (req, res) => {
    res.json({
        working: true,
        message: "Schoolio connected successfully!"
    });
});

// Example approved API
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
        res.status(500).json({
            error: "Request failed"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Schoolio server running on port " + PORT);
});
