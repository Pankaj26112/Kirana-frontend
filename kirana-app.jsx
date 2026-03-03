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

const getToken = () => localStorage.getItem("kirana_token");
const setToken = (t) => localStorage.setItem("kirana_token", t);
const removeToken = () => localStorage.removeItem("kirana_token");

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
  const [adPaused, setAdPaused]       = useState(false); // ← hover pause
  const [adminTab, setAdminTab]       = useState("products");
  const [modal, setModal]             = useState(null);
  const [loading, setLoading]         = useState(false);
  const [appLoading, setAppLoading]   = useState(true);
  const touchStartX = useRef(null);   // ← swipe support

  useEffect(() => {
    const token = getToken();
    if (token) {
      api("/api/auth/me", {}, token)
        .then(data => {
          setCurrentUser({ ...data.user, token });
          setPage(data.user.role === "admin" ? "admin" : "shop");
        })
        .catch(() => removeToken())
        .finally(() => setAppLoading(false));
    } else {
      setAppLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    loadAllUsers(); loadAllOrders();
    const interval = setInterval(() => { loadAllUsers(); loadAllOrders(); }, 30000);
    return () => clearInterval(interval);
  }, [page]);

  useEffect(() => {
    if (!currentUser) return;
    loadProducts(); loadAds();
    if (currentUser.role === "admin") { loadAllOrders(); loadAllUsers(); }
    else loadMyOrders();
  }, [currentUser?.id]);

  const activeAds = ads.filter(a => a.active);

  // ── Ad rotation — pauses on hover ──
  useEffect(() => {
    if (activeAds.length < 2 || adPaused) return;
    const t = setInterval(() => setAdIndex(i => (i + 1) % activeAds.length), 4000);
    return () => clearInterval(t);
  }, [activeAds.length, adPaused]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProducts = async () => {
    try { const d = await api("/api/products", {}, currentUser?.token || getToken()); setProducts(d.products || []); }
    catch { showToast("Products load nahi hue!", "error"); }
  };
  const loadAds = async () => {
    try { const d = await api("/api/ads/active", {}, currentUser?.token || getToken()); setAds(d.ads || []); }
    catch {}
  };
  const loadAllAds = async () => {
    try { const d = await api("/api/ads", {}, currentUser?.token || getToken()); setAds(d.ads || []); }
    catch {}
  };
  const loadMyOrders = async () => {
    try { const d = await api("/api/orders/my", {}, currentUser?.token || getToken()); setOrders(d.orders || []); }
    catch {}
  };
  const loadAllOrders = async () => {
    try { const d = await api("/api/orders", {}, currentUser?.token || getToken()); setOrders(d.orders || []); }
    catch {}
  };
  const loadAllUsers = async () => {
    try { const d = await api("/api/users", {}, currentUser?.token || getToken()); setAllUsers(d.salesmen || d.users || []); }
    catch {}
  };

  const handleLogin = async (phone, password) => {
    setLoading(true);
    try {
      const data = await api("/api/auth/login", { method:"POST", body:JSON.stringify({ phone, password }) });
      setToken(data.token);
      setCurrentUser({ ...data.user, token: data.token });
      setPage(data.user.role === "admin" ? "admin" : "shop");
      showToast(`Swagat hai, ${data.user.name}! 🙏`);
    } catch(e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    removeToken(); setCurrentUser(null); setPage("login");
    setCart([]); setProducts([]); setOrders([]); setAds([]);
  };

  const handleRegisterFinal = async (name, phone, password, tempToken) => {
    setLoading(true);
    try {
      const data = await api("/api/auth/register", { method:"POST", body:JSON.stringify({ name, phone, password, temp_token: tempToken }) });
      setToken(data.token); setCurrentUser({ ...data.user, token: data.token }); setPage("shop");
      showToast(`${name} ji, swagat hai! Kamaai shuru karo! 🎉`);
      return true;
    } catch(e) { showToast(e.message, "error"); return false; }
    finally { setLoading(false); }
  };

  const addToCart = (p) => {
    setCart(prev => { const ex = prev.find(i => i.id===p.id); if(ex) return prev.map(i => i.id===p.id?{...i,qty:i.qty+1}:i); return [...prev,{...p,qty:1}]; });
    showToast(`${p.emoji} ${p.name} cart mein! 🛒`);
  };
  const updateQty = (id, qty) => {
    if(qty<1){setCart(prev=>prev.filter(i=>i.id!==id));return;}
    setCart(prev=>prev.map(i=>i.id===id?{...i,qty}:i));
  };
  const cartTotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const cartComm  = cart.reduce((s,i)=>s+Math.round(i.price*i.qty*i.commission/100),0);

  const placeOrder = async () => {
    if(!cart.length){showToast("Cart khaali hai!","error");return;}
    setLoading(true);
    try {
      await api("/api/orders",{method:"POST",body:JSON.stringify({items:cart})},currentUser.token);
      setCart([]);
      const me = await api("/api/auth/me",{},currentUser.token);
      setCurrentUser(prev=>({...prev,...me.user}));
      await loadMyOrders(); setPage("dashboard");
      showToast(`🎊 Order ho gaya! ₹${cartComm} commission mila!`);
    } catch(e){showToast(e.message,"error");}
    finally{setLoading(false);}
  };

  const saveProduct = async (prod) => {
    setLoading(true);
    try {
      if(prod.id){ await api(`/api/products/${prod.id}`,{method:"PUT",body:JSON.stringify(prod)},currentUser.token); showToast("✅ Product update ho gaya!"); }
      else { await api("/api/products",{method:"POST",body:JSON.stringify(prod)},currentUser.token); showToast("✅ Naya product add ho gaya!"); }
      await loadProducts(); setModal(null);
    } catch(e){showToast(e.message,"error");}
    finally{setLoading(false);}
  };
  const deleteProduct = async (id) => {
    setLoading(true);
    try { await api(`/api/products/${id}`,{method:"DELETE"},currentUser.token); await loadProducts(); showToast("🗑️ Product hata diya!"); setModal(null); }
    catch(e){showToast(e.message,"error");}
    finally{setLoading(false);}
  };

  const saveAd = async (ad) => {
    setLoading(true);
    try {
      if(ad.id) await api(`/api/ads/${ad.id}`,{method:"PUT",body:JSON.stringify(ad)},currentUser.token);
      else await api("/api/ads",{method:"POST",body:JSON.stringify(ad)},currentUser.token);
      showToast("✅ Ad save ho gayi!"); await loadAllAds(); setModal(null);
    } catch(e){showToast(e.message,"error");}
    finally{setLoading(false);}
  };
  const deleteAd = async (id) => {
    setLoading(true);
    try { await api(`/api/ads/${id}`,{method:"DELETE"},currentUser.token); await loadAllAds(); showToast("🗑️ Ad hata di!"); setModal(null); }
    catch(e){showToast(e.message,"error");}
    finally{setLoading(false);}
  };
  const toggleAd = async (id) => {
    try { await api(`/api/ads/${id}/toggle`,{method:"PUT"},currentUser.token); await loadAllAds(); }
    catch(e){showToast(e.message,"error");}
  };

  const cats = ["All",...new Set(products.map(p=>p.category))];
  const filteredP = products.filter(p=>(filterCat==="All"||p.category===filterCat)&&p.name.toLowerCase().includes(searchQ.toLowerCase()));
  const userOrders = orders.filter(o=>o.user_id===currentUser?.id||o.userId===currentUser?.id);

  // ── Swipe handlers ──
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    if(touchStartX.current===null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if(Math.abs(diff)>40){
      if(diff>0) setAdIndex(i=>(i+1)%activeAds.length);
      else setAdIndex(i=>(i-1+activeAds.length)%activeAds.length);
    }
    touchStartX.current = null;
  };

  if(appLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#FDF6EC",flexDirection:"column",gap:16}}>
      <div style={{fontSize:56}}>🏪</div>
      <div style={{fontWeight:800,fontSize:18,color:"#FF6B00"}}>Subhash Kirana Store</div>
      <div style={{color:"#888",fontSize:14}}>Loading...</div>
    </div>
  );

  const curAd = activeAds[adIndex % activeAds.length];

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
        .mb{background:white;border-radius:20px;padding:24px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;}
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
      `}</style>

      {/* ══════════════════════════════════════════
          🆕 IMPROVED AD BANNER
      ══════════════════════════════════════════ */}
      {currentUser && activeAds.length > 0 && (
        <div style={{background:"#fff",borderBottom:"1px solid #F0E0C8",padding:"10px 16px"}}>
          <div style={{maxWidth:800,margin:"0 auto"}}>

            <div
              key={adIndex}
              className="ada adb"
              style={{
                background: curAd.image ? "transparent" : `linear-gradient(135deg,${curAd.bg_from||curAd.bgFrom},${curAd.bg_to||curAd.bgTo})`,
                padding:"16px 18px",
              }}
              onMouseEnter={() => setAdPaused(true)}
              onMouseLeave={() => setAdPaused(false)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => curAd.link && window.open(curAd.link,"_blank")}
            >
              {/* Background image */}
              {curAd.image && (
                <img src={curAd.image} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:18}} />
              )}
              {/* Dark overlay for image ads */}
              {curAd.image && (
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.38)",borderRadius:18}} />
              )}
              {/* Decorative circle */}
              <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,background:"rgba(255,255,255,0.08)",borderRadius:"50%"}} />

              {/* Left: icon + text */}
              <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:10}}>
                {curAd.icon && <span style={{fontSize:30}}>{curAd.icon}</span>}
                <div>
                  <div style={{fontSize:15,fontWeight:800}}>{curAd.title}</div>
                  <div style={{fontSize:12,opacity:0.9,marginTop:2}}>{curAd.subtitle}</div>
                </div>
              </div>

              {/* Right: counter + link badge */}
              <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                {activeAds.length > 1 && (
                  <span style={{fontSize:11,background:"rgba(0,0,0,0.28)",padding:"2px 9px",borderRadius:20,color:"white",fontWeight:800,letterSpacing:0.5}}>
                    {adIndex % activeAds.length + 1}/{activeAds.length}
                  </span>
                )}
                <span style={{fontSize:11,opacity:0.8,background:"rgba(255,255,255,0.22)",padding:"3px 10px",borderRadius:20}}>
                  {curAd.link ? "Dekhein →" : "📢 Ad"}
                </span>
                {adPaused && (
                  <span style={{fontSize:10,background:"rgba(0,0,0,0.3)",padding:"2px 7px",borderRadius:10,color:"white"}}>⏸ Paused</span>
                )}
              </div>

              {/* Progress bar */}
              {activeAds.length > 1 && (
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"rgba(255,255,255,0.2)",borderRadius:"0 0 18px 18px",overflow:"hidden"}}>
                  <div
                    key={`${adIndex}-${adPaused}`}
                    style={{
                      height:"100%",
                      background:"rgba(255,255,255,0.85)",
                      animation:`adProgress 4s linear`,
                      animationPlayState: adPaused ? "paused" : "running",
                      animationFillMode:"forwards",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Dot indicators + swipe hint */}
            {activeAds.length > 1 && (
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:8}}>
                {activeAds.map((_,i) => (
                  <div key={i} onClick={() => setAdIndex(i)} style={{
                    width: i===adIndex%activeAds.length ? 18 : 7,
                    height:7, borderRadius:4,
                    background: i===adIndex%activeAds.length ? "#FF6B00" : "#F0E0C8",
                    cursor:"pointer", transition:"all .3s"
                  }} />
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ══ NAV ══ */}
      {currentUser && (
        <nav style={{background:"linear-gradient(135deg,#FF6B00,#E65100)",padding:"11px 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 18px rgba(255,107,0,0.28)"}}>
          <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <span style={{fontSize:24}}>🏪</span>
              <div>
                <div style={{color:"white",fontWeight:800,fontSize:15,fontFamily:"'Baloo 2',sans-serif"}}>Subhash Kirana</div>
                <div style={{color:"rgba(255,255,255,0.8)",fontSize:10}}>{currentUser.name}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
              {currentUser.role !== "admin" && <>
                <button className={`nb ${page==="shop"?"act":""}`} onClick={()=>setPage("shop")}>🛍️ Shop</button>
                <button className={`nb ${page==="cart"?"act":""}`} onClick={()=>setPage("cart")}>
                  🛒{cart.length>0&&<span style={{background:"#FFB300",borderRadius:"50%",padding:"1px 6px",fontSize:11,marginLeft:3}}>{cart.length}</span>}
                </button>
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
          {modal.type==="product"&&<ProductModal product={modal.data} onSave={saveProduct} onDelete={deleteProduct} onClose={()=>setModal(null)} loading={loading}/>}
          {modal.type==="ad"&&<AdModal ad={modal.data} onSave={saveAd} onDelete={deleteAd} onClose={()=>setModal(null)} loading={loading}/>}
          {modal.type==="del-product"&&(
            <div className="mb">
              <div style={{fontSize:40,textAlign:"center",marginBottom:10}}>⚠️</div>
              <h3 style={{textAlign:"center",marginBottom:8,fontWeight:800}}>Delete Karna Chahte Ho?</h3>
              <p style={{textAlign:"center",color:"#888",fontSize:14,marginBottom:20}}><strong>{modal.data.name}</strong> hamesha ke liye hat jayega!</p>
              <div style={{display:"flex",gap:10}}>
                <button className="br" style={{flex:1,padding:12}} onClick={()=>deleteProduct(modal.data.id)} disabled={loading}>{loading?"...":"Haan, Delete!"}</button>
                <button className="bb" style={{flex:1,padding:12}} onClick={()=>setModal(null)}>Nahi</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{maxWidth:800,margin:"0 auto",padding:"20px 16px"}}>

        {page==="login"&&<LoginPage onLogin={handleLogin} onSwitch={()=>setPage("register")} loading={loading}/>}
        {page==="register"&&<RegisterPage onRegister={handleRegisterFinal} showToast={showToast} onSwitch={()=>setPage("login")} loading={loading}/>}

        {page==="shop"&&(
          <div>
            <div style={{marginBottom:18,background:"linear-gradient(135deg,#FF6B00,#FFB300)",borderRadius:20,padding:"18px 20px",color:"white",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:800,fontSize:19,fontFamily:"'Baloo 2',sans-serif"}}>Namaskar {currentUser?.name?.split(" ")[0]} ji! 🙏</div>
                <div style={{fontSize:12,opacity:0.9}}>Har order par seedha commission milega!</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,opacity:0.85}}>Aapka Balance</div>
                <div style={{fontWeight:800,fontSize:22}}>₹{currentUser?.balance||0}</div>
              </div>
            </div>
            <input className="inf" placeholder="🔍 Product dhundo..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{marginBottom:12}}/>
            <div className="sx" style={{marginBottom:16}}>{cats.map(c=><button key={c} className={`cc ${filterCat===c?"act":""}`} onClick={()=>setFilterCat(c)}>{c}</button>)}</div>
            {products.length===0?(
              <div style={{textAlign:"center",padding:60,color:"#888"}}><div style={{fontSize:40}}>⏳</div><p style={{marginTop:8}}>Products load ho rahe hain...</p></div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:12}}>
                {filteredP.map(p=>(
                  <div key={p.id} className="pc">
                    <div style={{textAlign:"center",marginBottom:8,height:80,display:"flex",alignItems:"center",justifyContent:"center"}}>{p.image?<img src={p.image} alt={p.name} style={{width:80,height:80,objectFit:"cover",borderRadius:12}}/>:<span style={{fontSize:44}}>{p.emoji}</span>}</div>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:2,lineHeight:1.3}}>{p.name}</div>
                    <div style={{fontSize:11,color:"#999",marginBottom:5}}>{p.unit} • {p.category}</div>
                    <div style={{fontWeight:800,color:"#FF6B00",fontSize:18,marginBottom:4}}>₹{p.price}</div>
                    <div className="bdg" style={{background:"#E8F5E9",color:"#2E7D32",marginBottom:10}}>💰 {Number(p.commission||0)}% = ₹{Math.round(Number(p.price||0)*Number(p.commission||0)/100)}</div>
                    <button className="bp" style={{width:"100%",padding:"7px 0",fontSize:13}} onClick={()=>addToCart(p)}>+ Cart</button>
                  </div>
                ))}
                {!filteredP.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"#888"}}>🔍 Koi product nahi mila</div>}
              </div>
            )}
          </div>
        )}

        {page==="cart"&&(
          <div>
            <div className="st">🛒 Aapka Cart</div>
            {!cart.length?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:56}}>🛒</div>
                <p style={{color:"#888",marginTop:12}}>Cart khaali hai!</p>
                <button className="bp" style={{marginTop:14}} onClick={()=>setPage("shop")}>Shop Karo</button>
              </div>
            ):<>
              {cart.map(item=>(
                <div key={item.id} style={{background:"#FFFDF7",border:"1px solid #F0E0C8",borderRadius:14,padding:14,marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,flexShrink:0,borderRadius:10,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>{item.image?<img src={item.image} alt={item.name} style={{width:44,height:44,objectFit:"cover"}}/>:<span style={{fontSize:36}}>{item.emoji}</span>}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{item.name}</div>
                    <div style={{fontSize:12,color:"#888"}}>₹{item.price} × {item.qty} = <strong style={{color:"#FF6B00"}}>₹{item.price*item.qty}</strong></div>
                    <div style={{fontSize:12,color:"#2E7D32",fontWeight:600}}>💰 ₹{Math.round(item.price*item.qty*item.commission/100)}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <button onClick={()=>updateQty(item.id,item.qty-1)} style={{width:28,height:28,borderRadius:"50%",background:"#F5E6D3",fontSize:16,fontWeight:800,color:"#FF6B00"}}>−</button>
                    <span style={{fontWeight:800,minWidth:20,textAlign:"center"}}>{item.qty}</span>
                    <button onClick={()=>updateQty(item.id,item.qty+1)} style={{width:28,height:28,borderRadius:"50%",background:"#FF6B00",color:"white",fontSize:16,fontWeight:800}}>+</button>
                  </div>
                </div>
              ))}
              <div style={{background:"linear-gradient(135deg,#FFF8E1,#FFFDE7)",border:"2px solid #FFB300",borderRadius:16,padding:20,marginTop:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{color:"#666"}}>Kul Rakam:</span><span style={{fontWeight:800,fontSize:18}}>₹{cartTotal}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><span style={{color:"#2E7D32",fontWeight:700}}>💰 Aapka Commission:</span><span style={{fontWeight:800,fontSize:22,color:"#2E7D32"}}>₹{cartComm}</span></div>
                <button className="bg2" style={{width:"100%",padding:14,fontSize:16}} onClick={placeOrder} disabled={loading}>{loading?"⏳ Order ho raha hai...":"✅ Order Karo & Commission Pao!"}</button>
              </div>
            </>}
          </div>
        )}

        {page==="dashboard"&&currentUser&&(
          <div>
            <div style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)",borderRadius:20,padding:"22px 20px",color:"white",marginBottom:18,textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:6}}>👤</div>
              <h2 style={{fontWeight:800,fontSize:22}}>{currentUser.name}</h2>
              <p style={{opacity:0.85,fontSize:13}}>📱 {currentUser.phone}</p>
              <div style={{marginTop:8,display:"inline-flex",gap:6,background:"rgba(255,255,255,0.18)",borderRadius:20,padding:"4px 14px",fontSize:12}}>✅ Verified Salesman</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
              {[{icon:"💰",val:`₹${currentUser.balance||0}`,label:"Commission",clr:"#2E7D32"},{icon:"📦",val:userOrders.length,label:"Orders",clr:"#FF6B00"},{icon:"💳",val:`₹${currentUser.total_sales||currentUser.totalSales||0}`,label:"Kul Bikri",clr:"#1565C0"}].map((s,i)=><div key={i} className="sc"><div style={{fontSize:24}}>{s.icon}</div><div style={{fontWeight:800,fontSize:18,color:s.clr}}>{s.val}</div><div style={{fontSize:11,color:"#888"}}>{s.label}</div></div>)}
            </div>
            <div className="st">📋 Order History</div>
            {!userOrders.length?(
              <div style={{textAlign:"center",padding:40,color:"#888"}}><div style={{fontSize:40}}>📭</div><p style={{marginTop:8}}>Koi order nahi abhi</p><button className="bp" style={{marginTop:12}} onClick={()=>setPage("shop")}>Pehla Order Karo!</button></div>
            ):userOrders.map(o=>(
              <div key={o.id} className="or">
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div><div style={{fontWeight:700,fontSize:13}}>{o.id}</div><div style={{fontSize:11,color:"#888"}}>{new Date(o.created_at).toLocaleDateString("hi-IN")}</div></div>
                  <span className="bdg" style={{background:"#E8F5E9",color:"#2E7D32"}}>✅ {o.status}</span>
                </div>
                {o.items&&<div style={{fontSize:12,color:"#666",marginBottom:6}}>{o.items.map(i=>`${i.product_emoji||i.emoji||""} ${i.product_name||i.name} ×${i.quantity||i.qty}`).join(" • ")}</div>}
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13}}>₹{o.total}</span><span style={{fontSize:13,color:"#2E7D32",fontWeight:700}}>💰 ₹{o.commission}</span></div>
              </div>
            ))}
          </div>
        )}

        {page==="admin"&&(
          <div>
            <div style={{background:"linear-gradient(135deg,#2C1810,#4E342E)",borderRadius:20,padding:"18px 20px",color:"white",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:800,fontSize:20,fontFamily:"'Baloo 2',sans-serif"}}>⚙️ Admin Panel</div><div style={{fontSize:12,opacity:0.75}}>Sirf Aapka Control!</div></div>
              <div style={{textAlign:"right"}}><button onClick={()=>{loadAllUsers();loadAllOrders();loadAllAds();showToast("✅ Data refresh ho gaya!");}} style={{background:"rgba(255,255,255,0.2)",color:"white",padding:"6px 12px",borderRadius:10,fontSize:12,fontWeight:700,marginBottom:6,display:"block",width:"100%"}}>🔄 Refresh</button><div style={{fontSize:11,opacity:0.8}}>Total Bikri</div><div style={{fontWeight:800,fontSize:22}}>₹{orders.reduce((s,o)=>s+(Number(o.total)||0),0)}</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
              {[{icon:"👥",val:allUsers.length,label:"Salesmen",c:"#1565C0"},{icon:"📦",val:orders.length,label:"Orders",c:"#FF6B00"},{icon:"🛍️",val:products.length,label:"Products",c:"#2E7D32"},{icon:"💰",val:`₹${orders.reduce((s,o)=>s+(Number(o.commission)||0),0)}`,label:"Commission Diya",c:"#7B1FA2"}].map((s,i)=><div key={i} className="sc"><div style={{fontSize:22}}>{s.icon}</div><div style={{fontWeight:800,fontSize:21,color:s.c}}>{s.val}</div><div style={{fontSize:11,color:"#888"}}>{s.label}</div></div>)}
            </div>
            <div className="sx" style={{marginBottom:18}}>
              {[["products","🛍️ Products"],["ads","📢 Ads"],["salesmen","👥 Salesmen"],["orders","📋 Orders"]].map(([k,l])=>(
                <button key={k} className={`at ${adminTab===k?"act":""}`} onClick={()=>setAdminTab(k)}>{l}</button>
              ))}
            </div>

            {adminTab==="products"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div className="st" style={{margin:0}}>🛍️ Products ({products.length})</div>
                  <button className="bp" style={{padding:"8px 16px",fontSize:13}} onClick={()=>setModal({type:"product",data:null})}>+ Naya Product</button>
                </div>
                {products.map(p=>(
                  <div key={p.id} style={{background:"#FFFDF7",border:"1px solid #F0E0C8",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:44,height:44,flexShrink:0,borderRadius:10,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.image?<img src={p.image} alt={p.name} style={{width:44,height:44,objectFit:"cover"}}/>:<span style={{fontSize:36}}>{p.emoji}</span>}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                      <div style={{fontSize:11,color:"#888"}}>{p.unit} • {p.category}</div>
                      <div style={{display:"flex",gap:6,marginTop:4}}>
                        <span className="bdg" style={{background:"#FFF3E8",color:"#FF6B00"}}>₹{p.price}</span>
                        <span className="bdg" style={{background:"#E8F5E9",color:"#2E7D32"}}>💰 {p.commission}% = ₹{Math.round(p.price*p.commission/100)}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button className="bb" style={{padding:"6px 12px",fontSize:12}} onClick={()=>setModal({type:"product",data:p})}>✏️</button>
                      <button className="br" style={{padding:"6px 12px",fontSize:12}} onClick={()=>setModal({type:"del-product",data:p})}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab==="ads"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div className="st" style={{margin:0}}>📢 Advertisements ({ads.length})</div>
                  <button className="bp" style={{padding:"8px 16px",fontSize:13}} onClick={()=>setModal({type:"ad",data:null})}>+ Nayi Ad</button>
                </div>
                {ads.map(ad=>(
                  <div key={ad.id} style={{borderRadius:14,overflow:"hidden",border:"1px solid #F0E0C8",marginBottom:12}}>
                    <div style={{background:`linear-gradient(135deg,${ad.bg_from||ad.bgFrom},${ad.bg_to||ad.bgTo})`,padding:"14px 16px",color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative",minHeight:70}}>
                      {ad.image&&<img src={ad.image} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>}
                      {ad.image&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}}/>}
                      <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:8}}>
                        {ad.icon&&<span style={{fontSize:24}}>{ad.icon}</span>}
                        <div>
                          <div style={{fontWeight:800,fontSize:15}}>{ad.title}</div>
                          <div style={{fontSize:12,opacity:0.88}}>{ad.subtitle}</div>
                        </div>
                      </div>
                      <span className="bdg" style={{background:ad.active?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.2)",color:"white",position:"relative",zIndex:1}}>{ad.active?"🟢 Live":"🔴 Off"}</span>
                    </div>
                    <div style={{background:"white",padding:"10px 12px",display:"flex",gap:8}}>
                      <button className="bb" style={{padding:"6px 12px",fontSize:12}} onClick={()=>setModal({type:"ad",data:ad})}>✏️ Edit</button>
                      <button style={{padding:"6px 12px",fontSize:12,borderRadius:10,background:ad.active?"#FFF3E8":"#E8F5E9",color:ad.active?"#FF6B00":"#2E7D32",fontWeight:700}} onClick={()=>toggleAd(ad.id)}>{ad.active?"⏸ Pause":"▶ Chalao"}</button>
                      <button className="br" style={{padding:"6px 12px",fontSize:12}} onClick={()=>deleteAd(ad.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
                {!ads.length&&<p style={{color:"#888",textAlign:"center",padding:30}}>Koi ad nahi hai. Nayi ad banao!</p>}
              </div>
            )}

            {adminTab==="salesmen"&&(
              <div>
                <div className="st">👥 Salesmen ({allUsers.length})</div>
                {!allUsers.length?<p style={{color:"#888",textAlign:"center",padding:30}}>Koi register nahi hua abhi.</p>
                  :allUsers.map(u=>(
                    <div key={u.id} className="or">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:700}}>{u.name}{u.verified&&<span className="bdg" style={{background:"#E3F2FD",color:"#1565C0",fontSize:10,marginLeft:6}}>✅ Verified</span>}</div><div style={{fontSize:12,color:"#888"}}>📱 {u.phone}</div></div>
                        <div style={{textAlign:"right"}}><div style={{color:"#2E7D32",fontWeight:800,fontSize:16}}>₹{u.balance||0}</div><div style={{fontSize:11,color:"#888"}}>commission</div><div style={{fontSize:11,color:"#888"}}>₹{u.total_sales||0} bikri</div></div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {adminTab==="orders"&&(
              <div>
                <div className="st">📋 Saare Orders ({orders.length})</div>
                {!orders.length?<p style={{color:"#888",textAlign:"center",padding:30}}>Koi order nahi abhi.</p>
                  :orders.map(o=>(
                    <div key={o.id} className="or">
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:700,fontSize:13}}>{o.id}</span><span style={{fontSize:11,color:"#888"}}>{new Date(o.created_at).toLocaleDateString("hi-IN")}</span></div>
                      <div style={{fontSize:13,marginBottom:4}}>👤 {o.user_name||o.userName}</div>
                      {o.items&&<div style={{fontSize:12,color:"#666",marginBottom:6}}>{o.items.map(i=>`${i.product_emoji||""} ×${i.quantity||i.qty}`).join(" ")}</div>}
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>₹{o.total}</span><span style={{color:"#2E7D32",fontWeight:700}}>💰 ₹{o.commission}</span></div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
function LoginPage({ onLogin, onSwitch, loading }) {
  const [phone, setPhone] = useState("");
  const [pass, setPass]   = useState("");
  return (
    <div style={{maxWidth:400,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:26}}>
        <div style={{fontSize:64}}>🏪</div>
        <h1 style={{fontFamily:"'Baloo 2',sans-serif",fontWeight:800,fontSize:28,color:"#FF6B00"}}>Subhash Kirana Store</h1>
        <p style={{color:"#888",fontSize:14}}>Aap bhi salesman bano, commission kamao!</p>
      </div>
      <div style={{background:"white",borderRadius:20,padding:28,boxShadow:"0 8px 32px rgba(255,107,0,0.1)",border:"1px solid #F0E0C8"}}>
        <h2 style={{fontWeight:800,marginBottom:20,fontSize:20}}>Login Karo</h2>
        <label style={{fontSize:12,color:"#666",fontWeight:600}}>📱 Mobile Number</label>
        <input className="inf" type="tel" placeholder="10 digit number" value={phone} onChange={e=>setPhone(e.target.value)} style={{marginBottom:14,marginTop:4}} maxLength={10}/>
        <label style={{fontSize:12,color:"#666",fontWeight:600}}>🔑 Password</label>
        <input className="inf" type="password" placeholder="Apna password" value={pass} onChange={e=>setPass(e.target.value)} style={{marginBottom:20,marginTop:4}} onKeyDown={e=>e.key==="Enter"&&onLogin(phone,pass)}/>
        <button className="bp" style={{width:"100%",padding:14,fontSize:16}} onClick={()=>onLogin(phone,pass)} disabled={loading}>{loading?"⏳ Login ho raha hai...":"🚪 Login Karo"}</button>
        <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>Naya account? <span style={{color:"#FF6B00",cursor:"pointer",fontWeight:700}} onClick={onSwitch}>Register Karo</span></p>
        <div style={{marginTop:14,padding:12,background:"#FFF8E1",borderRadius:10,fontSize:12,color:"#666"}}>🔐 <strong>Admin:</strong> 9999999999 / admin123</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// REGISTER + OTP
// ══════════════════════════════════════════════════════════════
function RegisterPage({ onRegister, showToast, onSwitch, loading }) {
  const [step,setStep]=useState(1);const [name,setName]=useState("");const [phone,setPhone]=useState("");const [pass,setPass]=useState("");
  const [otp,setOtp]=useState(["","","","","",""]);const [timer,setTimer]=useState(0);const [canResend,setCanResend]=useState(false);
  const [tempToken,setTempToken]=useState("");const [sending,setSending]=useState(false);const [demoOtp,setDemoOtp]=useState("");
  const refs=useRef([]);
  useEffect(()=>{if(timer>0){const t=setTimeout(()=>setTimer(v=>v-1),1000);return()=>clearTimeout(t);}else if(step===2)setCanResend(true);},[timer,step]);
  const sendOtp=async()=>{
    if(phone.length!==10){showToast("10 digit ka number chahiye!","error");return;}
    if(!name.trim()){showToast("Naam likhna zaroori hai!","error");return;}
    if(!pass||pass.length<4){showToast("Password kam se kam 4 characters ka chahiye!","error");return;}
    setSending(true);
    try{const res=await fetch(`${API}/api/auth/send-otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});const data=await res.json();if(!data.success)throw new Error(data.message);setStep(2);setTimer(60);setCanResend(false);setOtp(["","","","","",""]);if(data.demo_otp){setDemoOtp(data.demo_otp);}else{showToast("OTP bhej diya gaya!");}}
    catch(e){showToast(e.message,"error");}finally{setSending(false);}
  };
  const verifyAndRegister=async()=>{
    const entered=otp.join("");if(entered.length!==6){showToast("6 digit OTP zaroori hai!","error");return;}
    setSending(true);
    try{const vRes=await fetch(`${API}/api/auth/verify-otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,otp:entered})});const vData=await vRes.json();if(!vData.success)throw new Error(vData.message);await onRegister(name.trim(),phone,pass,vData.temp_token);}
    catch(e){showToast(e.message,"error");}finally{setSending(false);}
  };
  const handleInput=(val,i)=>{if(!/^\d*$/.test(val))return;const n=[...otp];n[i]=val.slice(-1);setOtp(n);if(val&&i<5)refs.current[i+1]?.focus();if(!val&&i>0)refs.current[i-1]?.focus();};
  const resendOtp=async()=>{if(!canResend)return;setSending(true);try{const res=await fetch(`${API}/api/auth/send-otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});const data=await res.json();if(!data.success)throw new Error(data.message);setTimer(60);setCanResend(false);setOtp(["","","","","",""]);if(data.demo_otp){setDemoOtp(data.demo_otp);}else{showToast("OTP dobara bheja!");}refs.current[0]?.focus();}catch(e){showToast(e.message,"error");}finally{setSending(false);}};
  return (
    <div style={{maxWidth:400,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:22}}><div style={{fontSize:58}}>🤝</div><h1 style={{fontFamily:"'Baloo 2',sans-serif",fontWeight:800,fontSize:24,color:"#2E7D32"}}>Salesman Bano!</h1><p style={{color:"#888",fontSize:13}}>Register karo aur commission kamaao</p></div>
      <div style={{display:"flex",justifyContent:"center",gap:40,marginBottom:24}}>{["📝 Details","🔐 OTP"].map((l,i)=>(<div key={i} style={{textAlign:"center"}}><div style={{width:34,height:34,borderRadius:"50%",background:step===i+1?"#FF6B00":step>i+1?"#2E7D32":"#F0E0C8",color:step>=i+1?"white":"#999",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,margin:"0 auto 4px",boxShadow:step===i+1?"0 4px 12px rgba(255,107,0,0.35)":"none",transition:"all .3s"}}>{step>i+1?"✓":i+1}</div><div style={{fontSize:11,color:step===i+1?"#FF6B00":"#999",fontWeight:700}}>{l}</div></div>))}</div>
      <div style={{background:"white",borderRadius:20,padding:28,boxShadow:"0 8px 32px rgba(46,125,50,0.1)",border:"1px solid #F0E0C8"}}>
        {step===1&&(<><h2 style={{fontWeight:800,marginBottom:20}}>📝 Aapki Details</h2><label style={{fontSize:12,color:"#666",fontWeight:600}}>👤 Poora Naam</label><input className="inf" placeholder="Naam likhein..." value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:14,marginTop:4}}/><label style={{fontSize:12,color:"#666",fontWeight:600}}>📱 Mobile Number</label><input className="inf" type="tel" placeholder="10 digit number" value={phone} onChange={e=>setPhone(e.target.value)} style={{marginBottom:14,marginTop:4}} maxLength={10}/><label style={{fontSize:12,color:"#666",fontWeight:600}}>🔑 Password Banao</label><input className="inf" type="password" placeholder="Password (min 4 characters)" value={pass} onChange={e=>setPass(e.target.value)} style={{marginBottom:20,marginTop:4}}/><button className="bg2" style={{width:"100%",padding:14,fontSize:15}} onClick={sendOtp} disabled={sending}>{sending?"⏳ OTP bhej raha hai...":"📱 OTP Bhejo"}</button></>)}
        {step===2&&(<><h2 style={{fontWeight:800,marginBottom:8}}>🔐 OTP Verify Karo</h2>{demoOtp&&<div style={{background:"linear-gradient(135deg,#FFF8E1,#FFFDE7)",border:"2px solid #FFB300",borderRadius:16,padding:"16px 20px",marginBottom:16,textAlign:"center"}}><div style={{fontSize:12,color:"#795548",fontWeight:700,marginBottom:8}}>📱 Aapka OTP (Demo Mode)</div><div style={{fontSize:42,fontWeight:800,letterSpacing:10,color:"#FF6B00",fontFamily:"monospace"}}>{demoOtp}</div><div style={{fontSize:11,color:"#888",marginTop:8}}>👆 Yeh 6 digit neeche box mein bharo</div></div>}<p style={{color:"#888",fontSize:13,marginBottom:20}}><strong style={{color:"#2C1810"}}>{phone}</strong> par OTP bheja gaya!<br/><span style={{color:"#FF6B00",cursor:"pointer",fontWeight:700}} onClick={()=>setStep(1)}>← Number badlo</span></p><div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:20}}>{otp.map((d,i)=>(<input key={i} ref={el=>refs.current[i]=el} className="oi" type="tel" inputMode="numeric" maxLength={1} value={d} onChange={e=>handleInput(e.target.value,i)} onKeyDown={e=>{if(e.key==="Backspace"&&!d&&i>0)refs.current[i-1]?.focus();}} style={{border:d?"2px solid #FF6B00":"2px solid #F0E0C8"}}/>))}</div><div style={{textAlign:"center",marginBottom:20,fontSize:13}}>{!canResend?<span style={{color:"#888"}}>Dobara bhejein? <strong style={{color:"#FF6B00"}}>{timer}s</strong></span>:<span style={{color:"#FF6B00",cursor:"pointer",fontWeight:700}} onClick={resendOtp}>🔄 OTP Dobara Bhejo</span>}</div><button className="bg2" style={{width:"100%",padding:14,fontSize:15}} onClick={verifyAndRegister} disabled={sending||loading}>{sending||loading?"⏳ Verify ho raha hai...":"✅ Verify & Account Banao!"}</button></>)}
        <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>Pehle se account? <span style={{color:"#FF6B00",cursor:"pointer",fontWeight:700}} onClick={onSwitch}>Login Karo</span></p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ══════════════════════════════════════════════════════════════
function ProductModal({ product, onSave, onDelete, onClose, loading }) {
  const isEdit=!!product;
  const [form,setForm]=useState(product||{name:'',category:'',unit:'',price:'',commission:'',stock:'',emoji:'🛒',image:''});
  const [selEmoji,setSelEmoji]=useState(product?.emoji||'🛒');
  const [imgPreview,setImgPreview]=useState(product?.image||'');
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleImageUpload=(e)=>{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024){alert('Photo 2MB se chhoti honi chahiye!');return;}const reader=new FileReader();reader.onload=(ev)=>{setImgPreview(ev.target.result);set('image',ev.target.result);};reader.readAsDataURL(file);};
  const handleSave=()=>{if(!form.name||!form.category||!form.price||!form.commission){alert('Naam, category, price aur commission zaroori hain!');return;}onSave({...form,emoji:selEmoji,price:Number(form.price),commission:Number(form.commission),stock:Number(form.stock)||0});};
  return (
    <div className='mb'>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}><h3 style={{fontWeight:800,fontSize:18}}>{isEdit?'✏️ Product Edit':'➕ Naya Product'}</h3><button onClick={onClose} style={{background:'#F5F5F5',borderRadius:'50%',width:32,height:32,fontSize:18}}>×</button></div>
      <label style={{fontSize:12,fontWeight:600,color:'#666'}}>📸 Product Photo</label>
      <div style={{marginTop:8,marginBottom:16}}><div style={{display:'flex',gap:12,alignItems:'center'}}><div style={{width:80,height:80,borderRadius:14,border:'2px dashed #F0E0C8',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',background:'#FFFDF7',flexShrink:0}}>{imgPreview?<img src={imgPreview} style={{width:80,height:80,objectFit:'cover'}}/>:<span style={{fontSize:36}}>{selEmoji}</span>}</div><div style={{flex:1}}><label style={{display:'block',background:'linear-gradient(135deg,#FF6B00,#FF8C00)',color:'white',padding:'10px 16px',borderRadius:12,fontWeight:700,fontSize:13,textAlign:'center',cursor:'pointer',marginBottom:8}}>📱 Gallery se Photo Chuno<input type='file' accept='image/*' onChange={handleImageUpload} style={{display:'none'}}/></label>{imgPreview&&<button onClick={()=>{setImgPreview('');set('image','');}} style={{width:'100%',padding:'6px',borderRadius:10,background:'#FFF3E8',color:'#FF6B00',fontWeight:700,fontSize:12}}>🗑️ Photo Hatao</button>}</div></div></div>
      <label style={{fontSize:12,fontWeight:600,color:'#666'}}>Emoji Chuno (agar photo nahi hai)</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6,marginBottom:14}}>{ALL_EMOJIS.map(e=>(<button key={e} onClick={()=>setSelEmoji(e)} style={{width:40,height:40,borderRadius:10,background:selEmoji===e?'#FFF3E8':'#F9F9F9',border:selEmoji===e?'2px solid #FF6B00':'2px solid #F0E0C8',fontSize:20}}>{e}</button>))}</div>
      {[{label:'Product ka Naam *',key:'name',ph:'Jaise: Aata, Dal...'},{label:'Category *',key:'category',ph:'Jaise: Anaj, Dal, Tel...'},{label:'Unit',key:'unit',ph:'Jaise: 1 kg, 500 g, 1 L'}].map(({label,key,ph})=>(<div key={key} style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:'#666'}}>{label}</label><input className='inf' placeholder={ph} value={form[key]||''} onChange={e=>set(key,e.target.value)} style={{marginTop:4}}/></div>))}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>{[['💰 Price (₹) *','price','120'],['🎯 Commission % *','commission','10'],['📦 Stock','stock','50']].map(([l,k,ph])=>(<div key={k}><label style={{fontSize:12,fontWeight:600,color:'#666'}}>{l}</label><input className='inf' type='number' placeholder={ph} value={form[k]||''} onChange={e=>set(k,e.target.value)} style={{marginTop:4}}/></div>))}</div>
      {form.price&&form.commission&&Number(form.commission)>0&&(<div style={{background:'#E8F5E9',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#2E7D32',fontWeight:700}}>💰 Har sale par commission: ₹{Math.round(Number(form.price)*Number(form.commission)/100)}</div>)}
      <div style={{display:'flex',gap:10}}><button className='bp' style={{flex:1,padding:12}} onClick={handleSave} disabled={loading}>{loading?'⏳...':(isEdit?'✅ Update Karo':'✅ Add Karo')}</button>{isEdit&&<button className='br' style={{padding:'12px 16px'}} onClick={()=>onDelete(form.id)} disabled={loading}>🗑️</button>}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AD MODAL — with image upload support
// ══════════════════════════════════════════════════════════════
function AdModal({ ad, onSave, onDelete, onClose, loading }) {
  const isEdit=!!ad;
  const [form,setForm]=useState(ad?{...ad,bgFrom:ad.bg_from||ad.bgFrom||"#FF6B00",bgTo:ad.bg_to||ad.bgTo||"#FF8C42"}:{title:"",subtitle:"",bgFrom:"#FF6B00",bgTo:"#FF8C42",active:true,link:"",icon:"",image:""});
  const [imgPreview,setImgPreview]=useState(ad?.image||"");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const COLORS=[["#FF6B00","#FF8C42"],["#2E7D32","#43A047"],["#1565C0","#1E88E5"],["#7B1FA2","#AB47BC"],["#C62828","#E53935"],["#00695C","#00897B"],["#E65100","#F57C00"],["#1A237E","#303F9F"],["#263238","#37474F"]];

  const handleImageUpload=(e)=>{
    const file=e.target.files[0]; if(!file)return;
    if(file.size>2*1024*1024){alert('Photo 2MB se chhoti honi chahiye!');return;}
    const reader=new FileReader();
    reader.onload=(ev)=>{setImgPreview(ev.target.result);set('image',ev.target.result);};
    reader.readAsDataURL(file);
  };

  const handleSave=()=>{ onSave({...form,bg_from:form.bgFrom,bg_to:form.bgTo}); };

  return (
    <div className="mb">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <h3 style={{fontWeight:800,fontSize:18}}>{isEdit?"✏️ Ad Edit Karo":"📢 Nayi Ad Banao"}</h3>
        <button onClick={onClose} style={{background:"#F5F5F5",borderRadius:"50%",width:32,height:32,fontSize:18}}>×</button>
      </div>

      {/* Live preview */}
      <div style={{background:imgPreview?"transparent":`linear-gradient(135deg,${form.bgFrom},${form.bgTo})`,borderRadius:14,padding:"14px 18px",color:"white",marginBottom:16,minHeight:68,position:"relative",overflow:"hidden"}}>
        {imgPreview&&<img src={imgPreview} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:14}}/>}
        {imgPreview&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.38)",borderRadius:14}}/>}
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:8}}>
          {form.icon&&<span style={{fontSize:26}}>{form.icon}</span>}
          <div>
            <div style={{fontWeight:800,fontSize:15}}>{form.title||"Ad Title yahan dikhega..."}</div>
            <div style={{fontSize:12,opacity:0.88,marginTop:2}}>{form.subtitle||"Description..."}</div>
          </div>
        </div>
      </div>

      {/* 📸 Photo upload */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:600,color:"#666"}}>📸 Ad Photo (optional)</label>
        <div style={{display:"flex",gap:10,alignItems:"center",marginTop:6}}>
          <div style={{width:64,height:48,borderRadius:10,overflow:"hidden",border:"2px dashed #F0E0C8",background:"#FFFDF7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {imgPreview?<img src={imgPreview} style={{width:64,height:48,objectFit:"cover"}}/>:<span style={{fontSize:22}}>🖼️</span>}
          </div>
          <div style={{flex:1}}>
            <label style={{display:"block",background:"linear-gradient(135deg,#FF6B00,#FF8C00)",color:"white",padding:"8px 14px",borderRadius:10,fontWeight:700,fontSize:12,textAlign:"center",cursor:"pointer",marginBottom:6}}>
              📷 Photo Upload Karo
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{display:"none"}}/>
            </label>
            {imgPreview&&<button onClick={()=>{setImgPreview("");set("image","");}} style={{width:"100%",padding:"5px",borderRadius:8,background:"#FFF3E8",color:"#FF6B00",fontWeight:700,fontSize:12,border:"none",cursor:"pointer"}}>🗑️ Hatao</button>}
          </div>
        </div>
        {imgPreview&&<div style={{fontSize:11,color:"#888",marginTop:4}}>💡 Photo hone par gradient color chhup jayega</div>}
      </div>

      <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:"#666"}}>📢 Ad Title *</label><input className="inf" placeholder="🎉 Koi bhi catchy title!" value={form.title} onChange={e=>set("title",e.target.value)} style={{marginTop:4}}/></div>
      <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:"#666"}}>📝 Description</label><input className="inf" placeholder="Chhota sa description" value={form.subtitle} onChange={e=>set("subtitle",e.target.value)} style={{marginTop:4}}/></div>
      <div style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:600,color:"#666"}}>🔗 Click Link (optional)</label><input className="inf" placeholder="https://..." value={form.link||""} onChange={e=>set("link",e.target.value)} style={{marginTop:4}}/></div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,fontWeight:600,color:"#666"}}>🎨 Background Color</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          {COLORS.map(([f,t],i)=>(<div key={i} onClick={()=>{set("bgFrom",f);set("bgTo",t);}} style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${f},${t})`,cursor:"pointer",border:form.bgFrom===f?"3px solid #2C1810":"3px solid transparent"}}/>))}
        </div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button className="bp" style={{flex:1,padding:12}} onClick={handleSave} disabled={loading}>{loading?"⏳...":(isEdit?"✅ Update Karo":"📢 Ad Lagao")}</button>
        {isEdit&&<button className="br" style={{padding:"12px 16px"}} onClick={()=>onDelete(form.id)} disabled={loading}>🗑️</button>}
      </div>
    </div>
  );
}
