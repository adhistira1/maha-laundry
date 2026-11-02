const $ = id => document.getElementById(id);
let currentUser=null, services=[], orders=[];
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const dateToday=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notify(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),3000);}
async function api(url,options={}){
  const res=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||"Permintaan gagal.");
  return data;
}
function showLogin(){ $("login-view").classList.remove("hidden");$("app-view").classList.add("hidden"); }
function showApp(user){
  currentUser=user;$("login-view").classList.add("hidden");$("app-view").classList.remove("hidden");
  $("user-name").textContent=user.name;$("user-role").textContent=user.role;
  document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",user.role!=="admin"));
  $("today").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  go("dashboard");loadAll();
}
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();$("login-error").textContent="";
  try{const result=await api("/api/auth/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});showApp(result.user);}
  catch(err){$("login-error").textContent=err.message;}
});
$("logout").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"});}finally{currentUser=null;showLogin();}});
async function loadAll(){await loadServices();await loadOrders();await loadDashboard();}
function go(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $("page-"+page).classList.remove("hidden");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  $("page-title").textContent=({dashboard:"Dashboard",kasir:"Kasir Baru",transaksi:"Data Transaksi",harga:"Pengaturan Harga",laporan:"Laporan Pendapatan",pengguna:"Manajemen Pengguna"})[page];
  if(page==="laporan")loadReport();if(page==="harga")renderServices();if(page==="pengguna")loadUsers();if(page==="transaksi")renderOrders();
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
async function loadServices(){services=await api("/api/services");renderServices();renderItemRows();}
async function loadOrders(){orders=await api("/api/orders");renderOrders();}
async function loadDashboard(){
  const today=dateToday(),todays=orders.filter(o=>String(o.created_at).slice(0,10)===today);
  $("dash-orders").textContent=todays.length;$("dash-revenue").textContent=money(todays.reduce((a,o)=>a+Number(o.total),0));
  $("dash-process").textContent=orders.filter(o=>["Diterima","Diproses"].includes(o.status)).length;
  $("dash-done").textContent=orders.filter(o=>["Selesai","Sudah Diambil"].includes(o.status)).length;
  $("recent-table").innerHTML=orders.slice(0,6).map(o=>`<tr><td><b>${esc(o.invoice)}</b></td><td>${esc(o.customer_name)}</td><td>${money(o.total)}</td><td>${pill(o.status)}</td></tr>`).join("")||`<tr><td colspan="4" class="muted">Belum ada transaksi.</td></tr>`;
}
function pill(s){return `<span class="badge ${s.replaceAll(" ","-")}">${esc(s)}</span>`;}
function renderItemRows(){
  const active=services.filter(s=>s.active);
  if(!$("items-list"))return;
  if(!active.length){$("items-list").innerHTML='<p class="muted">Belum ada layanan aktif. Hubungi admin.</p>';return;}
  if(!$("items-list").children.length)addItemRow();
}
function addItemRow(){
  const active=services.filter(s=>s.active);if(!active.length)return;
  const row=document.createElement("div");row.className="item-row";
  row.innerHTML=`<label>Layanan<select class="item-service">${active.map(s=>`<option value="${s.id}">${esc(s.name)} — ${money(s.price)}/${s.unit}</option>`).join("")}</select></label><label>Jumlah<input class="item-qty" type="number" min="0.1" step="0.1" value="1"></label><label>Subtotal<input class="item-subtotal" readonly></label><button type="button" class="remove-item" title="Hapus">×</button>`;
  $("items-list").appendChild(row);
  row.querySelectorAll("select,input").forEach(el=>el.addEventListener("input",()=>{updateRow(row);updateGrandTotal();}));
  row.querySelector(".remove-item").addEventListener("click",()=>{row.remove();updateGrandTotal();});
  updateRow(row);updateGrandTotal();
}
function updateRow(row){
  const service=services.find(s=>s.id===Number(row.querySelector(".item-service").value));
  const qty=Number(row.querySelector(".item-qty").value)||0;
  row.querySelector(".item-subtotal").value=money((service?.price||0)*qty);
}
function updateGrandTotal(){
  let total=0;document.querySelectorAll(".item-row").forEach(row=>{
    const service=services.find(s=>s.id===Number(row.querySelector(".item-service").value));
    total+=(service?.price||0)*(Number(row.querySelector(".item-qty").value)||0);
  });
  total=Math.max(0,total-(Number($("discount").value)||0));$("order-total").textContent=money(total);
}
$("add-item").addEventListener("click",addItemRow);
$("discount").addEventListener("input",updateGrandTotal);
$("due-date").value=dateToday();
$("order-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const items=[...document.querySelectorAll(".item-row")].map(row=>({serviceId:Number(row.querySelector(".item-service").value),quantity:Number(row.querySelector(".item-qty").value)}));
  try{
    const result=await api("/api/orders",{method:"POST",body:JSON.stringify({
      customerName:$("cust-name").value,phone:$("cust-phone").value,items,
      discount:Number($("discount").value)||0,paymentMethod:$("payment").value,dueDate:$("due-date").value||null,notes:$("notes").value
    })});
    notify(`Nota ${result.invoice} berhasil disimpan.`);
    $("order-form").reset();$("items-list").innerHTML="";$("due-date").value=dateToday();addItemRow();updateGrandTotal();
    await loadOrders();await loadDashboard();go("transaksi");
  }catch(err){notify(err.message);}
});
function renderOrders(){
  if(!$("orders-table"))return;
  const q=($("order-search")?.value||"").toLowerCase();
  const list=orders.filter(o=>[o.invoice,o.customer_name,o.customer_phone].some(v=>String(v).toLowerCase().includes(q)));
  $("orders-table").innerHTML=list.map(o=>`<tr><td><b>${esc(o.invoice)}</b><br><small class="muted">${new Date(o.created_at).toLocaleString("id-ID")}</small></td><td>${esc(o.customer_name)}<br><small class="muted">${esc(o.customer_phone)}</small></td><td>${money(o.total)}</td><td><select class="status-select" data-id="${o.id}">${["Diterima","Diproses","Selesai","Sudah Diambil"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></td><td><button class="btn light" data-detail="${o.id}">Detail</button> ${currentUser?.role==="admin"?`<button class="btn danger" data-delete-order="${o.id}" data-invoice="${esc(o.invoice)}">Hapus</button>`:""}</td></tr>`).join("")||'<tr><td colspan="5">Transaksi tidak ditemukan.</td></tr>';
}
$("order-search").addEventListener("input",renderOrders);
$("orders-table").addEventListener("change",async e=>{
  if(!e.target.matches(".status-select"))return;
  try{
    const result=await api(`/api/orders/${e.target.dataset.id}/status`,{method:"PATCH",body:JSON.stringify({status:e.target.value})});
    notify(result.whatsapp?.sent?"Status diperbarui dan WhatsApp berhasil dikirim.":`Status diperbarui. ${result.whatsapp?.reason||result.whatsapp?.error||""}`);
    await loadOrders();await loadDashboard();
  }catch(err){notify(err.message);await loadOrders();}
});
$("orders-table").addEventListener("click",async e=>{
  const deleteButton=e.target.closest("[data-delete-order]");
  if(deleteButton){
    if(currentUser?.role!=="admin"){notify("Akses khusus admin.");return;}
    const id=deleteButton.dataset.deleteOrder;
    const invoice=deleteButton.dataset.invoice;
    if(!confirm(`Hapus transaksi ${invoice}?\n\nTindakan ini permanen dan data transaksi beserta itemnya akan dihapus.`))return;
    try{
      await api(`/api/orders/${id}`,{method:"DELETE"});
      await loadOrders();await loadDashboard();
      if(currentUser?.role==="admin" && !$("page-laporan").classList.contains("hidden")) await loadReport();
      notify(`Transaksi ${invoice} berhasil dihapus.`);
    }catch(err){notify(err.message);}
    return;
  }
  const id=e.target.closest("[data-detail]")?.dataset.detail;if(!id)return;
  try{const o=await api(`/api/orders/${id}`);alert(`NOTA ${o.invoice}\nPelanggan: ${o.customer_name}\nNo. WA: ${o.customer_phone}\n\n${o.items.map(i=>`${i.service_name}: ${i.quantity} ${i.unit} x ${money(i.unit_price)} = ${money(i.line_total)}`).join("\n")}\n\nTOTAL: ${money(o.total)}\nStatus: ${o.status}`);}
  catch(err){notify(err.message);}
});
let editingServiceId = null;
function resetServiceForm(){
  editingServiceId = null;
  $("service-form").reset();
  $("service-active").value="1";
  $("service-form-title").textContent = "Tambah layanan";
  $("service-submit").textContent = "＋ Tambah layanan";
  $("service-cancel").classList.add("hidden");
}
$("service-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={
    name:$("service-name").value.trim(),
    category:$("service-category").value,
    unit:$("service-unit").value,
    price:Number($("service-price").value),
    active:$("service-active").value==="1"
  };
  try{
    if(editingServiceId){
      await api(`/api/services/${editingServiceId}`,{method:"PUT",body:JSON.stringify(payload)});
      notify("Perubahan layanan berhasil disimpan.");
    } else {
      await api("/api/services",{method:"POST",body:JSON.stringify(payload)});
      notify("Layanan berhasil ditambahkan.");
    }
    resetServiceForm();
    await loadServices();
  }catch(err){notify(err.message);}
});
function renderServices(){
  if(!$("services-table"))return;
  $("services-table").innerHTML=services.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.category)}</td><td>${esc(s.unit)}</td><td>${money(s.price)}</td><td>${s.active?"Aktif":"Nonaktif"}</td><td><div class="form-actions"><button type="button" class="btn light" data-edit-service="${s.id}">Ubah</button><button type="button" class="btn danger" data-delete-service="${s.id}">Hapus</button></div></td></tr>`).join("")||'<tr><td colspan="6">Belum ada layanan.</td></tr>';
}
$("service-cancel").addEventListener("click",resetServiceForm);
$("services-table").addEventListener("click",async e=>{
  const deleteButton=e.target.closest("[data-delete-service]");
  if(deleteButton){
    if(currentUser?.role!=="admin"){notify("Akses khusus admin.");return;}
    const service=services.find(item=>item.id===Number(deleteButton.dataset.deleteService));
    if(!service)return;
    if(!window.confirm(`Hapus layanan "${service.name}"? Layanan tidak akan tersedia untuk transaksi baru. Riwayat transaksi lama tetap disimpan.`))return;
    deleteButton.disabled=true;
    try{
      await api(`/api/services/${service.id}`,{method:"DELETE"});
      if(editingServiceId===service.id)resetServiceForm();
      notify("Layanan berhasil dihapus.");
      await loadServices();
    }catch(err){notify(err.message);deleteButton.disabled=false;}
    return;
  }
  const button=e.target.closest("[data-edit-service]");
  if(!button)return;
  if(currentUser?.role!=="admin"){notify("Akses khusus admin.");return;}
  const service=services.find(item=>item.id===Number(button.dataset.editService));
  if(!service)return;
  editingServiceId=service.id;
  $("service-name").value=service.name;
  $("service-category").value=service.category;
  $("service-unit").value=service.unit;
  $("service-price").value=service.price;
  $("service-active").value=service.active?"1":"0";
  $("service-form-title").textContent=`Ubah layanan: ${service.name}`;
  $("service-submit").textContent="Simpan perubahan";
  $("service-cancel").classList.remove("hidden");
  $("service-form").scrollIntoView({behavior:"smooth",block:"center"});
  $("service-name").focus();
});
async function loadReport(){
  if(currentUser?.role!=="admin")return;
  $("report-date").value=$("report-date").value||dateToday();
  try{
    const data=await api(`/api/reports?period=${$("report-period").value}&date=${$("report-date").value}`);
    $("report-orders").textContent=data.summary.total_orders;
    $("report-revenue").textContent=money(data.summary.revenue);
    $("report-paid").textContent=money(data.summary.paid_revenue);
    $("report-table").innerHTML=data.rows.map(r=>`<tr><td>${new Date(r.report_date).toLocaleDateString("id-ID")}</td><td>${r.total_orders}</td><td>${money(r.revenue)}</td></tr>`).join("")||'<tr><td colspan="3">Belum ada transaksi pada periode ini.</td></tr>';
  }catch(err){notify(err.message);}
}
$("load-report").addEventListener("click",loadReport);
async function loadUsers(){
  if(currentUser?.role!=="admin")return;
  try{
    const users=await api("/api/users");
    $("users-table").innerHTML=users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td>${u.active?"Aktif":"Nonaktif"}</td><td>${Number(u.id)===Number(currentUser.id)?'<span class="muted">Akun Anda</span>':`<button type="button" class="btn ${u.active?'danger':'light'}" data-user-status="${u.id}" data-active="${u.active?'0':'1'}">${u.active?'Nonaktifkan':'Aktifkan'}</button>`}</td></tr>`).join("")||'<tr><td colspan="5">Belum ada pengguna.</td></tr>';
  }catch(err){notify(err.message);}
}
$("users-table").addEventListener("click",async e=>{
  const button=e.target.closest("[data-user-status]");
  if(!button)return;
  if(currentUser?.role!=="admin"){notify("Akses khusus admin.");return;}
  const active=button.dataset.active==="1";
  const action=active?"mengaktifkan":"menonaktifkan";
  if(!confirm(`Yakin ingin ${action} akun pengguna ini?`))return;
  try{
    await api(`/api/users/${button.dataset.userStatus}/status`,{method:"PATCH",body:JSON.stringify({active})});
    await loadUsers();
    notify(active?"Akun pengguna berhasil diaktifkan.":"Akun pengguna berhasil dinonaktifkan.");
  }catch(err){notify(err.message);}
});
$("user-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{await api("/api/users",{method:"POST",body:JSON.stringify({name:$("new-name").value,username:$("new-username").value,password:$("new-password").value,role:$("new-role").value})});$("user-form").reset();await loadUsers();notify("Akun pengguna berhasil dibuat.");}
  catch(err){notify(err.message);}
});
(async()=>{try{const data=await api("/api/auth/me");showApp(data.user);}catch{showLogin();}})();
