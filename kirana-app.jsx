const { useState, useEffect, useRef } = React;

const API = "https://kirana-backend-production-c0bf.up.railway.app";
const ALL_EMOJIS = ["🌾","🫘","🍶","🌿","🍬","🧂","🟡","🌶️","🍵","🍪","🧼","🥛","🧴","🫙","🍫","🥜","🫚","🧅","🥕","🍅","🛒","📦","🎁","🍞","🥚","🧈","🧃","🍜","🫛","🌽"];

const api = async (path, options = {}, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Kuch galat hua!");
  return data;
};

// ✅ FIX 3: MongoDB _id → id normalize
const normalizeProduct = (p) => ({
  ...p,
  id:         p.id         || p._id,
  price:      Number(p.price      || 0),
  commission: Number(p.commission || 0),
  stock:      Number(p.stock      || 0),
  image:      p.image || "",
  emoji:      p.emoji || "🛒",
});

const getToken    = () => localStorage.getItem("kirana_token");
const setToken    = (t) => localStorage.setItem("kirana_token", t);
const removeToken = () => localStorage.removeItem("kirana_token");

const isAdScheduled = (ad) => {
  const now = new Date();
  if (ad.start_date && new Date(ad.start_date) > now) return false;
  if (ad.end_date   && new Date(ad.end_date)   < now) return false;
  return true;
};
const isAdTargeted = (ad, user) => {
  if (!ad.target_type || ad.target_type === "all") return true;
  if (ad.target_type === "phones" && ad.target_phones) {
    return ad.target_phones.split(",").map(p => p.trim()).includes(user?.phone);
  }
  return true;
};
const trackAdClick = async (adId, token) => {
  try { await fetch(`${API}/api/ads/${adId}/click`, { method:"POST", headers:{ "Authorization":`Bearer ${token}`, "Content-Type":"application/json" } }); } catch {}
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts]       = useState([]);
  const [orders, setOrders]           = useState([]);
  const [ads, setAds]                 = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [page, setPage]               = useState("login");
  const [cart, setCart]               = useState([]);
  const [toast, setToast]             = useState(null);
  const [searchQ, setSearchQ]         = useState("");
  const [filterCat, setFilterCat]     = useState("All");
  const [adIndex, setAdIndex]         = useState(0);
  const [adPaused, setAdPaused]       = useState(false);
  const [adminTab, setAdminTab]       = useState("products");
  const [modal, setModal]             = useState(null);
  const [loading, setLoading]         = useState(false);
  const [appLoading, setAppLoading]   = useState(true);
  const touchStartX = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api("/api/auth/me", {}, token)
        .then(data => { setCurrentUser({ ...data.user, token }); setPage(data.user.role === "admin" ? "admin" : "shop"); })
        .catch(() => removeToken())
        .finally(() => setAppLoading(false));
    } else setAppLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;
    loadAllUsers(); loadAllOrders();
    const iv = setInterval(() => { loadAllUsers(); loadAllOrders(); }, 30000);
    return () => clearInterval(iv);
  }, [page]);

  useEffect(() => {
    if (!currentUser) return;
    loadProducts(); loadAds();
    if (currentUser.role === "admin") { loadAllOrders(); loadAllUsers(); }
    else loadMyOrders();
  }, [currentUser?.id]);

  const activeAds = ads.filter(a => a.active && isAdScheduled(a) && isAdTargeted(a, currentUser));

  useEffect(() => {
    if (activeAds.length < 2 || adPaused) return;
    const t = setInterval(() => setAdIndex(i => (i + 1) % activeAds.length), 4000);
    return () => clearInterval(t);
  }, [activeAds.length, adPaused]);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // ✅ FIX 1 & 3: normalize products after loading
  const loadProducts = async () => {
    try {
      const d = await api("/api/products", {}, currentUser?.token || getToken());
      setProducts((d.products || []).map(normalizeProduct));
    } catch { showToast("Products load nahi hue!", "error"); }
  };

  const loadAds       = async () => { try { const d = await api("/api/ads/active", {}, currentUser?.token || getToken()); setAds(d.ads || []); } catch {} };
  const loadAllAds    = async () => { try { const d = await api("/api/ads",         {}, currentUser?.token || getToken()); setAds(d.ads || []); } catch {} };
  const loadMyOrders  = async () => { try { const d = await api("/api/orders/my",   {}, currentUser?.token || getToken()); setOrders(d.orders || []); } catch {} };
  const loadAllOrders = async () => { try { const d = await api("/api/orders",      {}, currentUser?.token || getToken()); setOrders(d.orders || []); } catch {} };
  const loadAllUsers  = async () => { try { const d = await api("/api/users",       {}, currentUser?.token || getToken()); setAllUsers(d.salesmen || d.users || []); } catch {} };

  const handleLogin = async (phone, password) => {
    setLoading(true);
    try {
      const data = await api("/api/auth/login", { method:"POST", body:JSON.stringify({ phone, password }) });
      setToken(data.token); setCurrentUser({ ...data.user, token: data.token });
      setPage(data.user.role === "admin" ? "admin" : "shop");
      showToast(`Swagat hai, ${data.user.name}! 🙏`);
    } catch(e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  const handleLogout = () => { removeToken(); setCurrentUser(null); setPage("login"); setCart([]); setProducts([]); setOrders([]); setAds([]); };

  const handleRegisterFinal = async (name, phone, password, tempToken) => {
    setLoading(true);
    try {
      const data = await api("/api/auth/register", { method:"POST", body:JSON.stringify({ name, phone, password, temp_token: tempToken }) });
      setToken(data.token); setCurrentUser({ ...data.user, token: data.token }); setPage("shop");
      showToast(`${name} ji, swagat hai! Kamaai shuru karo! 🎉`); return true;
    } catch(e) { showToast(e.message, "error"); return false; } finally { setLoading(false); }
  };

  // ✅ FIX: cart uses normalized id
  const addToCart = (p) => {
    setCart(prev => { const ex = prev.find(i => i.id === p.id); if(ex) return prev.map(i => i.id===p.id ? {...i, qty:i.qty+1} : i); return [...prev, {...p, qty:1}]; });
    showToast(`${p.emoji} ${p.name} cart mein! 🛒`);
  };
  const updateQty = (id, qty) => { if(qty<1){setCart(p=>p.filter(i=>i.id!==id));return;} setCart(p=>p.map(i=>i.id===id?{...i,qty}:i)); };

  const cartTotal = cart.reduce((s,i) => s + i.price * i.qty, 0);
  // ✅ FIX 2: commission is already Number after normalize
  const cartComm  = cart.reduce((s,i) => s + Math.round(i.price * i.qty * i.commission / 100), 0);

  const placeOrder = async () => {
    if(!cart.length){showToast("Cart khaali hai!","error");return;} setLoading(true);
    try {
      // ✅ FIX: send id (not _id) in items
      const items = cart.map(i => ({ ...i, id: i.id || i._id }));
      await api("/api/orders", { method:"POST", body:JSON.stringify({ items }) }, currentUser.token);
      setCart([]);
      const me = await api("/api/auth/me", {}, currentUser.token);
      setCurrentUser(prev => ({...prev, ...me.user}));
      await loadMyOrders(); setPage("dashboard");
      showToast(`🎊 Order ho gaya! ₹${cartComm} commission mila!`);
    } catch(e) { showToast(e.message,"error"); } finally { setLoading(false); }
  };

  const saveProduct = async (prod) => {
    setLoading(true);
    try {
      if(prod.id) { await api(`/api/products/${prod.id}`,{method:"PUT",body:JSON.stringify(prod)},currentUser.token); showToast("✅ Product update ho gaya!"); }
      else { await api("/api/products",{method:"POST",body:JSON.stringify(prod)},currentUser.token); showToast("✅ Naya product add ho gaya!"); }
      await loadProducts(); setModal(null);
    } catch(e){showToast(e.message,"error");} finally{setLoading(false);}
  };
  const deleteProduct = async (id) => {
    setLoading(true);
    try { await api(`/api/products/${id}`,{method:"DELETE"},currentUser.token); await loadProducts(); showToast("🗑️ Product hata diya!"); setModal(null); }
    catch(e){showToast(e.message,"error");} finally{setLoading(false);}
  };
  const saveAd = async (ad) => {
    setLoading(true);
    try {
      if(ad.id) await api(`/api/ads/${ad.id}`,{method:"PUT",body:JSON.stringify(ad)},currentUser.token);
      else await api("/api/ads",{method:"POST",body:JSON.stringify(ad)},currentUser.token);
      showToast("✅ Ad save ho gayi!"); await loadAllAds(); setModal(null);
    } catch(e){showToast(e.message,"error");} finally{setLoading(false);}
  };
  const deleteAd = async (id) => {
    setLoading(true);
    try { await api(`/api/ads/${id}`,{method:"DELETE"},currentUser.token); await loadAllAds(); showToast("🗑️ Ad hata di!"); setModal(null); }
    catch(e){showToast(e.message,"error");} finally{setLoading(false);}
  };
  const toggleAd = async (id) => { try { await api(`/api/ads/${id}/toggle`,{method:"PUT"},currentUser.token); await loadAllAds(); } catch(e){showToast(e.message,"error");} };

  const cats = ["All",...new Set(products.map(p=>p.category))];
  const filteredP = products.filter(p=>(filterCat==="All"||p.category===filterCat)&&p.name.toLowerCase().includes(searchQ.toLowerCase()));
  const userOrders = orders.filter(o=>o.user_id===currentUser?.id||o.userId===currentUser?.id);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    if(touchStartX.current===null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if(Math.abs(diff)>40){ diff>0 ? setAdIndex(i=>(i+1)%activeAds.length) : setAdIndex(i=>(i-1+activeAds.length)%activeAds.length); }
    touchStartX.current = null;
  };

  if(appLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#FDF6EC",flexDirection:"column",gap:16}}>
      <div style={{fontSize:56}}>🏪</div><div style={{fontWeight:800,fontSize:18,color:"#FF6B00"}}>Subhash Kirana Store</div><div style={{color:"#888",fontSize:14}}>Loading...</div>
    </div>
  );

  const curAd = activeAds[adIndex % Math.max(activeAds.length,1)];

  return (
    <div style={{fontFamily:"'Poppins', sans-serif",minHeight:"100vh",background:"#FDF6EC",color:"#2C1810"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Baloo+2:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        button{cursor:pointer;border:none;outline:none;font-family:inherit;}
        input,select{font-family:inherit;outline:none;}
        .nb{background:none;color:white;font-size:13px;padding:7px 12px;border-radius:20px;font-weight:600;transition:background .2s;}
        .nb:hover,.nb.act{background:rgba(255,255,255,0.22);}
        .pc{background:#FFFDF7;border:1px solid #F0E0C8;border-radius:16px;padding:14px;transition:transform .2s,box-shadow .2s;}
        .pc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(255,107,0,0.14);}
        .bdg{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
        .bp{background:linear-gradient(135deg,#FF6B00,#FF8C00);color:white;padding:10px 20px;border-radius:12px;font-weight:700;font-size:14px;transition:opacity .2s,transform .2s;}
        .bp:hover{opacity:.9;transform:translateY(-1px);}
        .bp:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .bg2{background:linear-gradient(135deg,#2E7D32,#43A047);color:white;padding:10px 20px;border-radius:12px;font-weight:700;font-size:14px;}
        .bg2:disabled{opacity:.5;cursor:not-allowed;}
        .br{background:linear-gradient(135deg,#C62828,#E53935);color:white;padding:8px 16px;border-radius:10px;font-weight:600;font-size:13px;}
        .bb{background:linear-gradient(135deg,#1565C0,#1E88E5);color:white;padding:8px 16px;border-radius:10px;font-weight:600;font-size:13px;}
        .inf{width:100%;padding:12px 16px;border:2px solid #F0E0C8;border-radius:12px;font-size:14px;background:white;transition:border .2s;color:#2C1810;}
        .inf:focus{border-color:#FF6B00;}
        .sc{background:#FFFDF7;border:1px solid #F0E0C8;border-radius:16px;padding:18px;text-align:center;}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:24px;font-size:14px;font-weight:700;z-index:9999;animation:sUp .3s ease;white-space:nowrap;max-width:92vw;}
        @keyframes sUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .sx{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}
        .sx::-webkit-scrollbar{display:none;}
        .cc{padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;border:2px solid #F0E0C8;background:white;white-space:nowrap;transition:all .2s;color:#666;}
        .cc.act{background:#FF6B00;border-color:#FF6B00;color:white;}
        .or{background:#FFFDF7;border:1px solid #F0E0C8;border-radius:12px;padding:14px 16px;margin-bottom:10px;}
        .ov{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
        .mb{background:white;border-radius:20px;padding:24px;width:100%;max-width:460px;max-height:92vh;overflow-y:auto;}
        .at{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;border:2px solid #F0E0C8;background:white;color:#666;transition:all .2s;white-space:nowrap;}
        .at.act{background:#2C1810;border-color:#2C1810;color:white;}
        .adb{border-radius:18px;color:white;position:relative;overflow:hidden;min-height:90px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;}
        .oi{width:44px;height:52px;text-align:center;font-size:22px;font-weight:800;border:2px solid #F0E0C8;border-radius:12px;transition:border .2s;color:#2C1810;background:white;}
        .oi:focus{border-color:#FF6B00;}
        @keyframes adIn{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        .ada{animation:adIn .4s ease;}
        @keyframes adProgress{from{width:0%}to{width:100%}}
        .st{font-size:18px;font-weight:800;color:#2C1810;margin-bottom:14px;}
        .spin{display:inline-block;animation:spin 1s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .sec-label{font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #F0E0C8;}
      `}</style>

      {/* ══ AD BANNER ══ */}
      {currentUser && activeAds.length > 0 && curAd && (
        <div style={{background:"#fff",borderBottom:"1px solid #F0E0C8",padding:"10px 16px"}}>
          <div style={{maxWidth:800,margin:"0 auto"}}>
            <div key={adIndex} className="ada adb"
              style={{background:curAd.image?"transparent":`linear-gradient(135deg,${curAd.bg_from||curAd.bgFrom},${curAd.bg_to||curAd.bgTo})`,padding:"16px 18px"}}
              onMouseEnter={()=>setAdPaused(true)} onMouseLeave={()=>setAdPaused(false)}
              onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
              onClick={()=>{ if(curAd.link){ trackAdClick(curAd.id,currentUser.token); window.open(curAd.link,"_blank"); } }}>
              {curAd.image&&<img src={curAd.image} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:18}}/>}
              {curAd.image&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.38)",borderRadius:18}}/>}
              <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,background:"rgba(255,255,255,0.08)",borderRadius:"50%"}}/>
              <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:10}}>
                {curAd.icon&&<span style={{fontSize:30}}>{curAd.icon}</span>}
                <div><div style={{fontSize:15,fontWeight:800}}>{curAd.title}</div><div style={{fontSize:12,opacity:0.9,marginTop:2}}>{curAd.subtitle}</div></div>
              </div>
              <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                {activeAds.length>1&&<span style={{fontSize:11,background:"rgba(0,0,0,0.28)",padding:"2px 9px",borderRadius:20,color:"white",fontWeight:800}}>{adIndex%activeAds.length+1}/{activeAds.length}</span>}
                <span style={{fontSize:11,opacity:0.8,background:"rgba(255,255,255,0.22)",padding:"3px 10px",borderRadius:20}}>{curAd.link?"Dekhein →":"📢 Ad"}</span>
                {adPaused&&<span style={{fontSize:10,background:"rgba(0,0,0,0.3)",padding:"2px 7px",borderRadius:10,color:"white"}}>⏸</span>}
              </div>
              {activeAds.length>1&&(
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"rgba(255,255,255,0.2)",borderRadius:"0 0 18px 18px",overflow:"hidden"}}>
                  <div key={`${adIndex}-${adPaused}`} style={{height:"100%",background:"rgba(255,255,255,0.85)",animation:"adProgress 4s linear",animationPlayState:adPaused?"paused":"running",animationFillMode:"forwards"}}/>
                </div>
              )}
            </div>
            {activeAds.length>1&&(
              <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:8}}>
                {activeAds.map((_,i)=>(<div key={i} onClick={()=>setAdIndex(i)} style={{width:i===adIndex%activeAds.length?18:7,height:7,borderRadius:4,background:i===adIndex%activeAds.length?"#FF6B00":"#F0E0C8",cursor:"pointer",transition:"all .3s"}}/>))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ NAV ══ */}
      {currentUser&&(
        <nav style={{background:"linear-gradient(135deg,#FF6B00,#E65100)",padding:"11px 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 18px rgba(255,107,0,0.28)"}}>
          <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <span style={{fontSize:24}}>🏪</span>
              <div><div style={{color:"white",fontWeight:800,fontSize:15,fontFamily:"'Baloo 2',sans-serif"}}>Subhash Kirana</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:10}}>{currentUser.name}</div></div>
            </div>
            <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
              {currentUser.role!=="admin"&&<>
                <button className={`nb ${page==="shop"?"act":""}`} onClick={()=>setPage("shop")}>🛍️ Shop</button>
                <button className={`nb ${page==="cart"?"act":""}`} onClick={()=>setPage("cart")}>🛒{cart.length>0&&<span style={{background:"#FFB300",borderRadius:"50%",padding:"1px 6px",fontSize:11,marginLeft:3}}>{cart.length}</span>}</button>
                <button className={`nb ${page==="dashboard"?"act":""}`} onClick={()=>setPage("dashboard")}>📊</button>
              </>}
              {currentUser.role==="admin"&&<button className={`nb ${page==="admin"?"act":""}`} onClick={()=>{setPage("admin");loadAllAds();loadAllOrders();loadAllUsers();}}>⚙️ Admin</button>}
              <button className="nb" onClick={handleLogout} style={{background:"rgba(0,0,0,0.18)"}}>🚪</button>
            </div>
          </div>
        </nav>
      )}

      {toast&&<div className="toast" style={{background:toast.type==="error"?"#C62828":"#1B5E20",color:"white"}}>{toast.msg}</div>}
      {loading&&<div style={{position:"fixed",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#FF6B00,#FFB300)",zIndex:999}}/>}

      {modal&&(
        <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          {modal.type==="product"&&<ProductModal product={modal.data} onSave={saveProduct} onDelete={deleteProduct} onClose={()=>setModal(null)} loading
