require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const { signToken, requireAuth, requireAdmin } = require("./auth");
const { sendLaundryFinished } = require("./whatsapp");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const normalizePhone = value => {
  let p = String(value || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  return p;
};
const invoiceNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `L${date}-${Date.now().toString().slice(-6)}`;
};

app.get("/api/health", (req,res)=>res.json({ok:true, app:"Maha Laundry POS"}));

app.post("/api/auth/login", asyncRoute(async (req,res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({message:"Username dan password wajib diisi."});
  const [rows] = await pool.query("SELECT id,name,username,password_hash,role,active FROM users WHERE username=? LIMIT 1",[String(username).trim()]);
  const user = rows[0];
  if (!user || !user.active || !(await bcrypt.compare(password,user.password_hash))) {
    return res.status(401).json({message:"Username atau password salah."});
  }
  const token = signToken(user);
  // Hormati HTTPS di reverse proxy; cookie Secure pada HTTP menyebabkan sesi tidak terkirim (401).
  const forwardedProto=String(req.headers["x-forwarded-proto"]||"").split(",")[0].trim();
  const isHttps=req.secure || forwardedProto==="https";
  res.cookie("laundry_token", token, { httpOnly:true, sameSite:"lax", secure:isHttps, path:"/", maxAge:8*60*60*1000 });
  res.json({user:{id:user.id,name:user.name,username:user.username,role:user.role}});
}));
app.post("/api/auth/logout",(req,res)=>{
  const forwardedProto=String(req.headers["x-forwarded-proto"]||"").split(",")[0].trim();
  res.clearCookie("laundry_token",{httpOnly:true,sameSite:"lax",secure:req.secure||forwardedProto==="https",path:"/"});
  res.json({message:"Berhasil logout."});
});
app.get("/api/auth/me",requireAuth,(req,res)=>res.json({user:req.user}));

app.get("/api/users",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const [rows]=await pool.query("SELECT id,name,username,role,active,created_at FROM users ORDER BY id DESC");
  res.json(rows);
}));
app.post("/api/users",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const {name,username,password,role}=req.body||{};
  if(!name||!username||!password||password.length<8||!["admin","kasir"].includes(role)) return res.status(400).json({message:"Lengkapi data. Password minimal 8 karakter."});
  const hash=await bcrypt.hash(password,12);
  try {
    const [result]=await pool.query("INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)",[name.trim(),username.trim(),hash,role]);
    res.status(201).json({id:result.insertId,message:"Akun berhasil dibuat."});
  } catch(e) { if(e.code==="ER_DUP_ENTRY") return res.status(409).json({message:"Username sudah digunakan."}); throw e; }
}));

// Admin dapat menonaktifkan/mengaktifkan akun tanpa menghapus riwayat transaksi.
app.patch("/api/users/:id/status",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const userId=Number(req.params.id);
  const active=req.body?.active;
  if(!Number.isSafeInteger(userId)||userId<1||typeof active!=="boolean")
    return res.status(400).json({message:"Data status pengguna tidak valid."});
  if(userId===Number(req.user.id)&&active===false)
    return res.status(400).json({message:"Anda tidak dapat menonaktifkan akun sendiri."});
  const [[target]]=await pool.query("SELECT id,role,active FROM users WHERE id=? LIMIT 1",[userId]);
  if(!target) return res.status(404).json({message:"Pengguna tidak ditemukan."});
  if(target.role==="admin"&&target.active&&!active){
    const [[row]]=await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND active=1");
    if(Number(row.total)<=1) return res.status(400).json({message:"Admin aktif terakhir tidak dapat dinonaktifkan."});
  }
  await pool.query("UPDATE users SET active=? WHERE id=?",[active?1:0,userId]);
  res.json({message:active?"Akun pengguna diaktifkan.":"Akun pengguna dinonaktifkan."});
}));

app.get("/api/services",requireAuth,asyncRoute(async(req,res)=>{
  const [rows]=await pool.query("SELECT * FROM services ORDER BY category,name");
  res.json(rows);
}));
app.post("/api/services",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const {name,category,unit,price}=req.body||{};
  if(!name||!["kiloan","satuan"].includes(category)||!["kg","pcs","pasang","item"].includes(unit)||!Number.isFinite(Number(price))||Number(price)<0)
    return res.status(400).json({message:"Data layanan tidak valid."});
  const [r]=await pool.query("INSERT INTO services(name,category,unit,price) VALUES(?,?,?,?)",[name.trim(),category,unit,Number(price)]);
  res.status(201).json({id:r.insertId,message:"Layanan ditambahkan."});
}));
app.delete("/api/services/:id",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const serviceId=Number(req.params.id);
  if(!Number.isSafeInteger(serviceId)||serviceId<1)
    return res.status(400).json({message:"ID layanan tidak valid."});
  const [[service]]=await pool.query("SELECT id,name FROM services WHERE id=? LIMIT 1",[serviceId]);
  if(!service) return res.status(404).json({message:"Layanan tidak ditemukan."});
  // order_items menyimpan snapshot nama, kategori, satuan, dan harga transaksi.
  // FK fk_item_service menggunakan ON DELETE SET NULL sehingga riwayat transaksi tetap utuh.
  await pool.query("DELETE FROM services WHERE id=?",[serviceId]);
  res.json({message:`Layanan \"${service.name}\" berhasil dihapus. Riwayat transaksi lama tetap dipertahankan.`});
}));
app.put("/api/services/:id",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const {name,category,unit,price,active}=req.body||{};
  if(!name||!["kiloan","satuan"].includes(category)||!["kg","pcs","pasang","item"].includes(unit)||!Number.isFinite(Number(price))||Number(price)<0)
    return res.status(400).json({message:"Data layanan tidak valid."});
  const serviceId=Number(req.params.id);
  if(!Number.isSafeInteger(serviceId)||serviceId<1) return res.status(400).json({message:"ID layanan tidak valid."});
  const [result]=await pool.query("UPDATE services SET name=?,category=?,unit=?,price=?,active=? WHERE id=?",[name.trim(),category,unit,Number(price),active?1:0,serviceId]);
  if(result.affectedRows===0){
    const [[existing]]=await pool.query("SELECT id FROM services WHERE id=?",[serviceId]);
    if(!existing) return res.status(404).json({message:"Layanan tidak ditemukan."});
  }
  res.json({message:"Layanan diperbarui."});
}));

app.post("/api/orders",requireAuth,asyncRoute(async(req,res)=>{
  const {customerName,phone,items,discount=0,paymentMethod="Belum Dibayar",dueDate=null,notes=""}=req.body||{};
  const customerPhone=normalizePhone(phone);
  if(!customerName||customerPhone.length<10||!Array.isArray(items)||items.length===0) return res.status(400).json({message:"Data pelanggan dan minimal satu layanan wajib diisi."});
  if(!["Tunai","Transfer","QRIS","Belum Dibayar"].includes(paymentMethod)) return res.status(400).json({message:"Metode pembayaran tidak valid."});
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("INSERT INTO customers(name,phone) VALUES(?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)",[customerName.trim(),customerPhone]);
    const [[customer]]=await conn.query("SELECT id FROM customers WHERE phone=?",[customerPhone]);
    let subtotal=0, lines=[];
    for(const item of items){
      const qty=Number(item.quantity);
      if(!Number.isFinite(qty)||qty<=0) throw new Error("Kuantitas layanan harus lebih dari 0.");
      const [[service]]=await conn.query("SELECT id,name,category,unit,price FROM services WHERE id=? AND active=1",[item.serviceId]);
      if(!service) throw new Error("Layanan tidak ditemukan atau tidak aktif.");
      const lineTotal=Number((qty*service.price).toFixed(2));
      subtotal+=lineTotal;
      lines.push({...service,quantity:qty,lineTotal});
    }
    const safeDiscount=Number(discount);
    if(!Number.isFinite(safeDiscount)||safeDiscount<0||safeDiscount>subtotal) throw new Error("Diskon tidak valid.");
    const total=Number((subtotal-safeDiscount).toFixed(2));
    const invoice=invoiceNumber();
    const [orderResult]=await conn.query(
      "INSERT INTO orders(invoice,customer_id,user_id,subtotal,discount,total,payment_method,payment_status,due_date,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [invoice,customer.id,req.user.id,subtotal,safeDiscount,total,paymentMethod,paymentMethod==="Belum Dibayar"?"Belum Lunas":"Lunas",dueDate||null,notes||null]
    );
    for(const line of lines) await conn.query(
      "INSERT INTO order_items(order_id,service_id,service_name,category,unit,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?,?)",
      [orderResult.insertId,line.id,line.name,line.category,line.unit,line.quantity,line.price,line.lineTotal]
    );
    await conn.commit();
    res.status(201).json({id:orderResult.insertId,invoice,subtotal,discount:safeDiscount,total,items:lines.map(l=>({name:l.name,quantity:l.quantity,unit:l.unit,lineTotal:l.lineTotal})),message:"Transaksi berhasil disimpan."});
  } catch(e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}));

app.get("/api/orders",requireAuth,asyncRoute(async(req,res)=>{
  const [rows]=await pool.query(
    `SELECT o.id,o.invoice,o.subtotal,o.discount,o.total,o.payment_method,o.payment_status,o.status,o.due_date,o.created_at,
    c.name AS customer_name,c.phone AS customer_phone,u.name AS cashier_name
    FROM orders o JOIN customers c ON c.id=o.customer_id JOIN users u ON u.id=o.user_id
    ORDER BY o.created_at DESC LIMIT 500`
  );
  res.json(rows);
}));
app.get("/api/orders/:id",requireAuth,asyncRoute(async(req,res)=>{
  const [[order]]=await pool.query(
    `SELECT o.*,c.name customer_name,c.phone customer_phone,u.name cashier_name
     FROM orders o JOIN customers c ON c.id=o.customer_id JOIN users u ON u.id=o.user_id WHERE o.id=?`,[req.params.id]);
  if(!order) return res.status(404).json({message:"Transaksi tidak ditemukan."});
  const [items]=await pool.query("SELECT * FROM order_items WHERE order_id=?",[req.params.id]);
  res.json({...order,items});
}));

// Penghapusan transaksi hanya dapat dilakukan oleh admin.
app.delete("/api/orders/:id",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const [result]=await pool.query("DELETE FROM orders WHERE id=?",[req.params.id]);
  if(result.affectedRows===0) return res.status(404).json({message:"Transaksi tidak ditemukan."});
  // Detail item ikut terhapus melalui foreign key ON DELETE CASCADE.
  res.json({message:"Transaksi berhasil dihapus."});
}));

app.patch("/api/orders/:id/status",requireAuth,asyncRoute(async(req,res)=>{
  const {status}=req.body||{};
  if(!["Diterima","Diproses","Selesai","Sudah Diambil"].includes(status)) return res.status(400).json({message:"Status tidak valid."});
  const [[order]]=await pool.query(
    `SELECT o.id,o.invoice,o.total,o.status,o.whatsapp_notified_at,c.name customer_name,c.phone customer_phone
     FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=?`,[req.params.id]);
  if(!order) return res.status(404).json({message:"Transaksi tidak ditemukan."});
  await pool.query("UPDATE orders SET status=? WHERE id=?",[status,req.params.id]);
  let whatsapp={sent:false};
  if(status==="Selesai" && order.status!=="Selesai"){
    try {
      const result=await sendLaundryFinished({phone:order.customer_phone,customerName:order.customer_name,invoice:order.invoice,total:order.total});
      if(!result.skipped) {
        await pool.query("UPDATE orders SET whatsapp_notified_at=NOW() WHERE id=?",[req.params.id]);
        whatsapp={sent:true};
      } else whatsapp={sent:false,reason:result.reason};
    } catch(err) {
      console.error("WhatsApp error:",err.details||err.message);
      whatsapp={sent:false,error:err.message};
    }
  }
  res.json({message:"Status transaksi diperbarui.",status,whatsapp});
}));

app.get("/api/reports",requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const period=req.query.period||"daily";
  const date=req.query.date||new Date().toISOString().slice(0,10);
  let condition,params=[];
  if(period==="daily"){condition="DATE(created_at)=?";params=[date];}
  else if(period==="weekly"){condition="YEARWEEK(created_at,1)=YEARWEEK(?,1)";params=[date];}
  else if(period==="monthly"){condition="YEAR(created_at)=YEAR(?) AND MONTH(created_at)=MONTH(?)";params=[date,date];}
  else return res.status(400).json({message:"Periode laporan tidak valid."});
  const [[summary]]=await pool.query(
    `SELECT COUNT(*) total_orders,COALESCE(SUM(total),0) revenue,
     COALESCE(SUM(CASE WHEN payment_status='Lunas' THEN total ELSE 0 END),0) paid_revenue
     FROM orders WHERE ${condition}`,params);
  const [rows]=await pool.query(
    `SELECT DATE(created_at) AS report_date,COUNT(*) AS total_orders,COALESCE(SUM(total),0) AS revenue
     FROM orders WHERE ${condition} GROUP BY DATE(created_at) ORDER BY report_date`,params);
  res.json({period,date,summary,rows});
}));

app.use((err,req,res,next)=>{
  console.error(err);
  const message=err.message||"Terjadi kesalahan server.";
  res.status(500).json({message:process.env.NODE_ENV==="production"?"Terjadi kesalahan server.":message});
});

// Vercel menggunakan Express sebagai serverless function; lokal tetap memakai app.listen().
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Maha Laundry POS berjalan di http://localhost:${port}`));
}

module.exports = app;
