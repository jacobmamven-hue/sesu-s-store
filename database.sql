CREATE DATABASE IF NOT EXISTS sesu_store
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sesu_store;

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    old_price DECIMAL(12,2) NULL,
    stock INT NOT NULL DEFAULT 0,
    badge VARCHAR(50) NULL,
    image TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS affiliates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price VARCHAR(100) NOT NULL,
    image TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO products
(id, name, category, price, old_price, image, badge, stock)
VALUES
(
    'p1',
    'Pro Strike Boots',
    'Boots',
    89999,
    115000,
    'https://images.unsplash.com/photo-1542487354-fe4a8c7895a6?auto=format&fit=crop&w=600&q=80',
    'Trending',
    14
),
(
    'p2',
    'Aurea Black Jersey',
    'Jerseys',
    34999,
    45000,
    'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?auto=format&fit=crop&w=600&q=80',
    'Best Seller',
    3
),
(
    'p3',
    'Elysium Match Ball',
    'Footballs',
    24999,
    32000,
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=600&q=80',
    'New',
    2
)
ON DUPLICATE KEY UPDATE id = id;