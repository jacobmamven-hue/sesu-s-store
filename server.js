require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

/* =========================
DATABASE
========================= */

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

/* =========================
APP CONFIG
========================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 8
        }
    })
);

/* =========================
AUTH MIDDLEWARE
========================= */

function requireAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    next();
}

/* =========================
AUTH API
========================= */

app.post("/api/login", async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                error: "Password is required"
            });
        }

        const correct = password === process.env.ADMIN_PASSWORD;

        if (!correct) {
            return res.status(401).json({
                error: "Incorrect password"
            });
        }

        req.session.admin = true;

        res.json({
            success: true
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Login failed"
        });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            success: true
        });
    });
});

app.get("/api/session", (req, res) => {
    res.json({
        authenticated: !!req.session.admin
    });
});

/* =========================
PRODUCTS
========================= */

app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge,
                image,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM products
            ORDER BY created_at DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not load products"
        });
    }
});

/* Random selection for the "Trending Items" section */
app.get("/api/products/trending", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge AS badgeText,
                image
            FROM products
            ORDER BY RAND()
            LIMIT 6
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not load trending products"
        });
    }
});

/* Items discounted 30% or more for "Latest Offers" */
app.get("/api/products/offers", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge AS badgeText,
                image
            FROM products
            WHERE old_price IS NOT NULL
                AND old_price > 0
                AND ((old_price - price) / old_price) >= 0.30
            ORDER BY ((old_price - price) / old_price) DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not load offers"
        });
    }
});

/* Items with stock below 20 for "Low In Stock" */
app.get("/api/products/low-stock", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge AS badgeText,
                image
            FROM products
            WHERE stock < 20
            ORDER BY stock ASC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not load low-stock products"
        });
    }
});

app.post("/api/products", requireAdmin, async (req, res) => {
    try {
        const {
            name,
            category,
            price,
            oldPrice,
            stock,
            badge,
            image
        } = req.body;

        if (!name || !category || !image) {
            return res.status(400).json({
                error: "Name, category and image are required"
            });
        }

        const id = "p" + Date.now();

        await pool.execute(
            `
            INSERT INTO products
            (id, name, category, price, old_price, stock, badge, image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                id,
                name.trim(),
                category.trim(),
                Number(price),
                oldPrice === null || oldPrice === ""
                    ? null
                    : Number(oldPrice),
                Number(stock),
                badge || null,
                image.trim()
            ]
        );

        const [rows] = await pool.execute(
            `SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge,
                image
            FROM products
            WHERE id = ?`,
            [id]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not create product"
        });
    }
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            category,
            price,
            oldPrice,
            stock,
            badge,
            image
        } = req.body;

        const [result] = await pool.execute(
            `
            UPDATE products
            SET
                name = ?,
                category = ?,
                price = ?,
                old_price = ?,
                stock = ?,
                badge = ?,
                image = ?
            WHERE id = ?
            `,
            [
                name.trim(),
                category.trim(),
                Number(price),
                oldPrice === null || oldPrice === ""
                    ? null
                    : Number(oldPrice),
                Number(stock),
                badge || null,
                image.trim(),
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Product not found"
            });
        }

        const [rows] = await pool.execute(
            `SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge,
                image
            FROM products
            WHERE id = ?`,
            [id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not update product"
        });
    }
});

app.patch("/api/products/:id/price", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const delta = Number(req.body.delta);

        if (!Number.isFinite(delta)) {
            return res.status(400).json({
                error: "Invalid price adjustment"
            });
        }

        const [result] = await pool.execute(
            `
            UPDATE products
            SET price = GREATEST(0, price + ?)
            WHERE id = ?
            `,
            [delta, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Product not found"
            });
        }

        const [rows] = await pool.execute(
            `SELECT
                id,
                name,
                category,
                price,
                old_price AS oldPrice,
                stock,
                badge,
                image
            FROM products
            WHERE id = ?`,
            [id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not adjust price"
        });
    }
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.execute(
            `DELETE FROM products WHERE id = ?`,
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Product not found"
            });
        }

        res.json({
            success: true
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not delete product"
        });
    }
});

/* =========================
AFFILIATES
========================= */

app.get("/api/affiliates", async (req, res) => {
    try {
        const [rows] = await pool.query(`
    SELECT
        id,
        name,
        category,
        price,
        image,
        url
    FROM affiliates
    ORDER BY id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error("GET affiliates error:", error);
        res.status(500).json({ error: "Could not load affiliates" });
    }
});


app.post("/api/affiliates", async (req, res) => {
    try {
        const {
            name,
            category,
            price,
            image,
            url
        } = req.body;

        const id = "a" + Date.now();

        await pool.query(`
            INSERT INTO affiliates
            (id, name, category, price, image, url)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id,
            name,
            category,
            price,
            image,
            url
        ]);

        const [rows] = await pool.query(
            "SELECT * FROM affiliates WHERE id = ?",
            [id]
        );

        res.status(201).json(rows[0]);

    } catch (error) {
        console.error("POST affiliate error:", error);
        res.status(500).json({ error: "Could not add affiliate" });
    }
});


app.put("/api/affiliates/:id", async (req, res) => {
    try {
        const {
            name,
            category,
            price,
            image,
            url
        } = req.body;

        await pool.query(`
            UPDATE affiliates
            SET
                name = ?,
                category = ?,
                price = ?,
                image = ?,
                url = ?
            WHERE id = ?
        `, [
            name,
            category,
            price,
            image,
            url,
            req.params.id
        ]);

        const [rows] = await pool.query(
            "SELECT * FROM affiliates WHERE id = ?",
            [req.params.id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("PUT affiliate error:", error);
        res.status(500).json({ error: "Could not update affiliate" });
    }
});


app.delete("/api/affiliates/:id", async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM affiliates WHERE id = ?",
            [req.params.id]
        );

        res.json({ success: true });

    } catch (error) {
        console.error("DELETE affiliate error:", error);
        res.status(500).json({ error: "Could not delete affiliate" });
    }
});

/* =========================
STATIC WEBSITE
========================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================
START SERVER
========================= */

async function startServer() {
    try {
        const connection = await pool.getConnection();

        console.log("MySQL database connected.");

        connection.release();

        app.listen(PORT, () => {
            console.log(`SESU's Store running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Could not connect to MySQL:");
        console.error(error);
        process.exit(1);
    }
}

startServer();