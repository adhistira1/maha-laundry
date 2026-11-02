const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "laundry_pos",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "local",
  decimalNumbers: true,
  // Hosted MySQL-compatible providers (for example TiDB Cloud) may require TLS.
  ...(String(process.env.DB_SSL || "false").toLowerCase() === "true" ? { ssl: { minVersion: "TLSv1.2" } } : {})
});

module.exports = pool;
