CREATE DATABASE IF NOT EXISTS laundry_pos
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE laundry_pos;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','kasir') NOT NULL DEFAULT 'kasir',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('kiloan','satuan') NOT NULL,
  unit ENUM('kg','pcs','pasang','item') NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_customer_phone (phone)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice VARCHAR(40) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  user_id INT NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  payment_method ENUM('Tunai','Transfer','QRIS','Belum Dibayar') NOT NULL DEFAULT 'Belum Dibayar',
  payment_status ENUM('Belum Lunas','Lunas') NOT NULL DEFAULT 'Belum Lunas',
  status ENUM('Diterima','Diproses','Selesai','Sudah Diambil') NOT NULL DEFAULT 'Diterima',
  due_date DATE NULL,
  notes TEXT NULL,
  whatsapp_notified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_status (status)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  service_id INT NULL,
  service_name VARCHAR(100) NOT NULL,
  category ENUM('kiloan','satuan') NOT NULL,
  unit ENUM('kg','pcs','pasang','item') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

INSERT INTO services (name, category, unit, price) VALUES
('Cuci Kering', 'kiloan', 'kg', 7000),
('Cuci Setrika', 'kiloan', 'kg', 9000),
('Setrika Saja', 'kiloan', 'kg', 6000),
('Express', 'kiloan', 'kg', 15000),
('Selimut', 'satuan', 'pcs', 15000),
('Bed Cover', 'satuan', 'pcs', 25000),
('Sepatu', 'satuan', 'pasang', 30000)
ON DUPLICATE KEY UPDATE name = VALUES(name);
