require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./db");

(async()=>{
  try {
    const username="admin";
    const [[existing]]=await pool.query("SELECT id FROM users WHERE username=?",[username]);
    if(existing){
      console.log("Akun admin sudah ada. Tidak ada perubahan.");
    } else {
      const password="Admin123!";
      const hash=await bcrypt.hash(password,12);
      await pool.query("INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,'admin')",["Administrator",username,hash]);
      console.log("Admin awal berhasil dibuat.");
      console.log("Username: admin");
      console.log("Password: Admin123!");
      console.log("Segera ubah password awal setelah login. Buat akun admin baru dengan password pribadi sebelum dipakai operasional.");
    }
  } catch(e){console.error(e);process.exitCode=1;}
  finally{await pool.end();}
})();
