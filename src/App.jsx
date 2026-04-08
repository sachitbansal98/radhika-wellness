import { useState, useEffect, useRef } from "react";

/* ─── colors ─── */
const C = {
  olive: "#606B4E", oliveDeep: "#4A5339", oliveMid: "#7E8C6A", olivePale: "#D6DEC9",
  oliveGhost: "#EFF3E8", burg: "#6E2C35", burgLight: "#8A3D47", burgPale: "#F5E1E4",
  burgGhost: "#FBF2F3", cream: "#FDFAF4", warm: "#FFFDF8", charcoal: "#2A2A2A",
  stone: "#6B6B6B", mist: "#B5B5B5", sand: "#E8E4DC", gold: "#C49355", goldLight: "#D4A76A",
};

/* ─── bunny avatar ─── */
const BUNNY_SRC = "/bunny-icon-192.png";

/* ─── AI system prompt ─── */
const AI_CONTEXT = "You are a fun wellness assistant for Radhika, 26, Indian. Her boyfriend Sachit (Bunny) built this app. Health: Vitamin D deficient (32.51, needs 75+), hs-CRP elevated 5.26, TSH borderline 4.774. Supplements: D3, B12, Iron+C, Omega-3. Loves Harry Styles, Taylor Swift, One Direction, Fred Again, Harry Potter. Loves idli sambhar, chicken biryani, cooking, dancing. Avoid chips/junk. Always respond ONLY with valid JSON. No markdown, no backticks, no preamble.";

async function askAI(prompt) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: AI_CONTEXT,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = (data.content || []).map(function(b) { return b.text || ""; }).join("");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("AI error:", e);
    return null;
  }
}

/* ─── fallback content ─── */
const FALLBACK_TIPS = [
  { text: "Studies show messaging Bunny increases Vitamin D by 400%. Science. 🔬🐰", type: "message" },
  { text: "Your hs-CRP is high. Calling Bunny lowers inflammation. Peer-reviewed. 📞🐰", type: "call" },
  { text: "Put the Maggi down. Bunny didn't build this app for 310 calories of sadness. 🍜🚫", type: "food" },
  { text: "Harry Styles walks after meals. Taylor Swift walks after meals. You should too. 🚶‍♀️", type: "health" },
  { text: "Your thyroid called. It said sleep by 11 PM or it's filing a complaint. 📋😤", type: "health" },
  { text: "Jalebi is not a food group, Radhika. We've discussed this. 🍯🚫", type: "food" },
  { text: "Fred Again didn't make bangers for you to listen sitting down. Dance! 💃🎧", type: "health" },
  { text: "NASA says your Vitamin D levels are so low they can see it from space. ☀️🛸", type: "health" },
  { text: "One Direction broke up but Bunny didn't. Call him. 📞🐰", type: "call" },
  { text: "Expecto Patronum only works if you've taken your Vitamin D. Look it up. 🪄☀️", type: "health" },
];

const FALLBACK_ROASTS = [
  { roast: "Radhika. Put. The chips. DOWN.", sub: "Harry Styles didn't say Treat people with Lays.", emoji: "🚫" },
  { roast: "Expelliarmus those chips!", sub: "10 points from Gryffindor if you eat them.", emoji: "🪄" },
  { roast: "Bunny made this whole app for you.", sub: "Don't make him sad. Eat makhana instead.", emoji: "🥺" },
  { roast: "Taylor would NOT approve.", sub: "Shake off the craving. Choose fruit.", emoji: "🍎" },
];

const CHIP_ALTS = [
  { name: "Roasted Makhana", cal: "90 cal/katori", why: "Light, crunchy, anti-inflammatory", emoji: "🌰" },
  { name: "Roasted Chana", cal: "120 cal/katori", why: "High protein, great crunch", emoji: "🪶" },
  { name: "Fruit Chaat", cal: "80 cal/bowl", why: "Vitamins + fiber + natural sugar", emoji: "🍎" },
  { name: "Sprouts Salad", cal: "100 cal/bowl", why: "Protein-packed, refreshing", emoji: "🌱" },
  { name: "Air-popped Popcorn", cal: "95 cal/bowl", why: "Whole grain, satisfying crunch", emoji: "🍿" },
  { name: "Cucumber + Hummus", cal: "70 cal/serving", why: "Hydrating, protein from hummus", emoji: "🥒" },
  { name: "Roasted Peanuts", cal: "140 cal/handful", why: "Healthy fats, very filling", emoji: "🥜" },
];

const BREATHE_MSGS = ["Hey. Breathe. You're doing amazing. 💚", "Inhale the good stuff, exhale the stress. 🌿", "Close your eyes. You're safe. Let's breathe together. ✨", "As Taylor says — you need to calm down. 🫁"];

const SUPPS = [
  { name: "Vitamin D3 (60,000 IU)", when: "Morning · Weekly", emoji: "☀️", tip: "Take with a fatty meal — ghee on roti works!" },
  { name: "Vitamin B12", when: "Morning · Daily", emoji: "💊", tip: "Your B12 is 286 — low-normal. Keep supplementing." },
  { name: "Iron + Vitamin C", when: "Afternoon · Daily", emoji: "🩸", tip: "Take with nimbu pani. NO chai for 2 hrs after!" },
  { name: "Omega-3 Fish Oil", when: "Dinner · Daily", emoji: "🐟", tip: "Fights inflammation — your CRP needs this." },
];

const QUOTES = [
  ["Treat people with kindness.", "Harry Styles"],
  ["Happiness can be found even in the darkest of times, if one only remembers to turn on the light.", "Dumbledore"],
  ["Long story short, I survived.", "Taylor Swift"],
  ["You need to calm down.", "Taylor Swift"],
  ["In this world of darkness, we're gonna find the light.", "One Direction"],
  ["It does not do to dwell on dreams and forget to live.", "Dumbledore"],
];

var pick = function(a) { return a[Math.floor(Math.random() * a.length)]; };
var shuffle = function(a) { return a.slice().sort(function() { return Math.random() - 0.5; }); };

/* ─── Bunny Tip (AI) ─── */
function BunnyTip() {
  var _s1 = useState(pick(FALLBACK_TIPS)); var tip = _s1[0]; var setTip = _s1[1];
  var _s2 = useState(false); var loading = _s2[0]; var setLoading = _s2[1];
  var _s3 = useState(true); var anim = _s3[0]; var setAnim = _s3[1];

  var fetchTip = async function() {
    setLoading(true); setAnim(false);
    var result = await askAI("Generate ONE funny wellness tip for Radhika from Bunny. Reference her health data, interests (Harry Styles, Fred Again, Taylor Swift, Harry Potter, One Direction), and Bunny. Be comical, warm, 1-2 sentences with emojis. Respond as JSON: {\"text\":\"the tip\",\"type\":\"call\"} where type is call, message, food, or health.");
    setTimeout(function() {
      if (result && result.text) { setTip(result); }
      else { setTip(pick(FALLBACK_TIPS)); }
      setAnim(true); setLoading(false);
    }, 200);
  };

  var actionBtn = null;
  if (tip.type === "call") actionBtn = <a href="tel:9146244811" className="bunny-action-btn bunny-call">📞 Call Bunny</a>;
  if (tip.type === "message") actionBtn = <a href="sms:9146244811" className="bunny-action-btn bunny-msg">💬 Message Bunny</a>;

  return (
    <div className="bunny-tip-card">
      <div className="bunny-tip-header">
        <img src={BUNNY_SRC} alt="Bunny" className="bunny-avatar" />
        <span className="bunny-tip-label">Bunny says</span>
        <button onClick={fetchTip} className="bunny-refresh" disabled={loading}>{loading ? "⏳" : "↻"}</button>
      </div>
      <p className={"bunny-tip-text" + (anim ? " bunny-tip-in" : "")}>{loading ? "Bunny is thinking... 🐰" : tip.text}</p>
      <div className="bunny-tip-actions">
        {!loading && actionBtn}
        <button onClick={fetchTip} className="bunny-another" disabled={loading}>{loading ? "Thinking..." : "Fresh tip from AI 🤖"}</button>
      </div>
    </div>
  );
}

/* ─── Chip Popup (AI) ─── */
function ChipPopup(props) {
  var _s1 = useState(pick(FALLBACK_ROASTS)); var roast = _s1[0]; var setRoast = _s1[1];
  var _s2 = useState(function() { return shuffle(CHIP_ALTS).slice(0, 3); }); var alts = _s2[0];
  var loaded = useRef(false);

  useEffect(function() {
    if (loaded.current) return;
    loaded.current = true;
    (async function() {
      var r = await askAI("Radhika is about to eat chips. Generate a funny roast to stop her. Reference Harry Styles, Taylor Swift, Dumbledore, Fred Again, or Bunny. Be dramatic, funny, 1-2 lines. Respond as JSON: {\"roast\":\"main line\",\"sub\":\"supporting line\",\"emoji\":\"one emoji\"}");
      if (r && r.roast) setRoast(r);
    })();
  }, []);

  return (
    <div className="overlay">
      <div className="chip-popup">
        <div className="chip-popup-header">
          <span style={{ fontSize: 48, display: "block", marginBottom: 8 }}>{roast.emoji}</span>
          <h2 className="chip-popup-title">{roast.roast}</h2>
          <p className="chip-popup-sub">{roast.sub}</p>
        </div>
        <div className="chip-divider"><span>eat this instead</span></div>
        <div className="chip-alts">
          {alts.map(function(a, i) {
            return (
              <div key={i} className="chip-alt-card" style={{ animationDelay: (0.1 + i * 0.08) + "s" }}>
                <span className="chip-alt-emoji">{a.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="chip-alt-name">{a.name}</p>
                  <p className="chip-alt-why">{a.why}</p>
                </div>
                <span className="chip-alt-cal">{a.cal}</span>
              </div>
            );
          })}
        </div>
        <div className="chip-compare">
          <span style={{ fontSize: 11, color: C.mist }}>1 packet of chips = <strong style={{ color: C.burg }}>274 cal</strong>, mostly fat & sodium 😬</span>
        </div>
        <button className="btn-chip-close" onClick={props.onClose}>Fine, I'll eat something healthy 🙄</button>
      </div>
    </div>
  );
}

/* ─── Breathing ─── */
function Breathe(props) {
  var _s1 = useState("ready"); var phase = _s1[0]; var setPhase = _s1[1];
  var _s2 = useState(0); var sec = _s2[0]; var setSec = _s2[1];
  var _s3 = useState(0); var cy = _s3[0]; var setCy = _s3[1];
  var ref = useRef();

  var start = function() { setPhase("in"); setSec(4); setCy(0); };

  useEffect(function() {
    if (phase === "ready" || phase === "done") return;
    ref.current = setInterval(function() {
      setSec(function(s) {
        if (s <= 1) {
          if (phase === "in") { setPhase("hold"); return 7; }
          if (phase === "hold") { setPhase("out"); return 8; }
          if (phase === "out") {
            setCy(function(c) { if (c >= 3) { setPhase("done"); return c; } setPhase("in"); return c + 1; });
            return 4;
          }
        }
        return s - 1;
      });
    }, 1000);
    return function() { clearInterval(ref.current); };
  }, [phase]);

  var sz = phase === "in" ? 160 : phase === "out" ? 90 : phase === "hold" ? 140 : 120;
  var lbl = phase === "in" ? "Breathe in" : phase === "hold" ? "Hold gently" : phase === "out" ? "Breathe out" : phase === "done" ? "Beautiful ✨" : "";

  return (
    <div className="overlay">
      <div className="breathe-card">
        <p className="breathe-quote">{pick(BREATHE_MSGS)}</p>
        <p style={{ fontSize: 11, color: C.mist, margin: "0 0 24px", letterSpacing: 1 }}>4 – 7 – 8 TECHNIQUE</p>
        {phase === "ready" ? (
          <button className="btn-primary" onClick={start}>Begin 🌿</button>
        ) : (
          <>
            <div className="breathe-circle" style={{ width: sz, height: sz, background: phase === "done" ? C.olive : C.oliveGhost, boxShadow: "0 0 " + (phase === "hold" ? 60 : 24) + "px " + C.olivePale }}>
              <span style={{ fontSize: phase === "done" ? 22 : 32, fontWeight: 700, color: phase === "done" ? "#fff" : C.olive }}>{phase === "done" ? "🌟" : sec}</span>
              <span style={{ fontSize: 12, color: phase === "done" ? "#fff" : C.oliveMid, marginTop: 2 }}>{lbl}</span>
            </div>
            <p style={{ fontSize: 11, color: C.mist, marginTop: 16 }}>Round {Math.min(cy + 1, 4)} of 4</p>
          </>
        )}
        <button className="btn-ghost" onClick={props.onClose} style={{ marginTop: 20 }}>Close</button>
      </div>
    </div>
  );
}

/* ─── AI Meal Logger ─── */
function MealLog(props) {
  var _s1 = useState(""); var txt = _s1[0]; var setTxt = _s1[1];
  var _s2 = useState([]); var items = _s2[0]; var setItems = _s2[1];
  var _s3 = useState(false); var loading = _s3[0]; var setLoading = _s3[1];
  var _s4 = useState(null); var aiNote = _s4[0]; var setAiNote = _s4[1];
  var _s5 = useState(null); var chipWarn = _s5[0]; var setChipWarn = _s5[1];
  var inputRef = useRef();

  var analyze = async function() {
    if (!txt.trim()) return;
    setLoading(true); setChipWarn(null); setAiNote(null);
    var prompt = "Radhika ate: \"" + txt + "\". Parse into items with Indian portion sizes. Calculate calories and macros accurately for typical Indian home-cooked portions. If any junk food (chips, maggi, pizza, burger, fries, cola), set hasJunk to true and add a funny junkRoast. Add a short funny mealNote (1-2 sentences). Respond as JSON: {\"items\":[{\"name\":\"food\",\"qty\":1,\"cal\":120,\"protein\":3,\"carbs\":20,\"fat\":3.5,\"unit\":\"pc or katori or plate\"}],\"hasJunk\":false,\"junkRoast\":null,\"mealNote\":\"short funny comment\"}";
    var result = await askAI(prompt);
    if (result && result.items) {
      setItems(result.items);
      if (result.hasJunk && result.junkRoast) setChipWarn(result.junkRoast);
      if (result.mealNote) setAiNote(result.mealNote);
    } else {
      setAiNote("Hmm, couldn't analyze that. Try common foods like 2 roti, dal, curd.");
    }
    setLoading(false); setTxt("");
    setTimeout(function() { if (inputRef.current) inputRef.current.focus(); }, 100);
  };

  var tot = items.reduce(function(a, i) {
    return { cal: a.cal + (i.cal || 0), p: a.p + (i.protein || 0), c: a.c + (i.carbs || 0), f: a.f + (i.fat || 0) };
  }, { cal: 0, p: 0, c: 0, f: 0 });

  var removeItem = function(idx) { setItems(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); }); };

  var save = function() {
    if (!items.length) return;
    props.onSave({
      items: items.slice(),
      tot: { cal: Math.round(tot.cal), p: Math.round(tot.p), c: Math.round(tot.c), f: Math.round(tot.f) },
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      note: aiNote
    });
    setItems([]); setChipWarn(null); setAiNote(null);
  };

  return (
    <div className="overlay" style={{ alignItems: "flex-end" }}>
      <div className="meal-sheet">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Log a Meal 🍽️</h3>
          <button onClick={props.onClose} style={{ background: "none", border: "none", fontSize: 24, color: C.mist, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <p className="hint">Type anything you ate — AI will calculate macros ✨</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input ref={inputRef} value={txt} onChange={function(e) { setTxt(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") analyze(); }}
            placeholder="half plate biryani, raita, lassi..." className="meal-input" disabled={loading} />
          <button onClick={analyze} className="btn-primary" style={{ padding: "0 20px", fontSize: 14 }} disabled={loading}>{loading ? "⏳" : "Analyze"}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {["3 idli, sambhar", "chicken biryani, raita", "2 roti, dal makhani", "paneer bhurji, paratha", "poha, chai"].map(function(s) {
            return <button key={s} onClick={function() { setTxt(s); }} className="chip-btn" disabled={loading}>{s}</button>;
          })}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.olive }}>
            <p style={{ fontSize: 14 }}>🤖 AI is calculating macros...</p>
            <p style={{ fontSize: 11, color: C.mist }}>Analyzing your meal with Claude</p>
          </div>
        )}

        {chipWarn && <div className="chip-warning">🚫 {chipWarn}</div>}

        {items.length > 0 && (
          <div className="meal-items">
            {items.map(function(it, i) {
              return (
                <div key={i} className="meal-row">
                  <div style={{ flex: 1 }}>
                    <span className="meal-name">{(it.qty || 1) > 1 ? it.qty + "× " : ""}{it.name}</span>
                    <span className="meal-unit">{it.unit}</span>
                  </div>
                  <div style={{ textAlign: "right", marginRight: 8 }}>
                    <span className="meal-cal">{it.cal}</span>
                    <span className="meal-macro">P:{it.protein} · C:{it.carbs} · F:{it.fat}</span>
                  </div>
                  <button onClick={function() { removeItem(i); }} style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                </div>
              );
            })}
            <div className="meal-total-row">
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.burg }}>{Math.round(tot.cal)} cal</span>
                <span className="meal-macro" style={{ display: "block" }}>P: {Math.round(tot.p)}g · C: {Math.round(tot.c)}g · F: {Math.round(tot.f)}g</span>
              </div>
            </div>
          </div>
        )}

        {aiNote && items.length > 0 && (
          <div style={{ background: C.oliveGhost, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: C.olive, lineHeight: 1.5 }}>
            🤖 {aiNote}
          </div>
        )}

        <button onClick={save} disabled={!items.length || loading} className="btn-save">{loading ? "Analyzing..." : items.length ? "Save Meal ✅" : "Type what you ate above"}</button>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  var _s1 = useState("home"); var tab = _s1[0]; var setTab = _s1[1];
  var _s2 = useState(pick(QUOTES)); var quote = _s2[0];
  var _s3 = useState(SUPPS.map(function(s) { return Object.assign({}, s, { done: false }); })); var supps = _s3[0]; var setSupps = _s3[1];
  var _s4 = useState([]); var meals = _s4[0]; var setMeals = _s4[1];
  var _s5 = useState(false); var showBreathe = _s5[0]; var setShowBreathe = _s5[1];
  var _s6 = useState(false); var showMeal = _s6[0]; var setShowMeal = _s6[1];
  var _s7 = useState(false); var showChips = _s7[0]; var setShowChips = _s7[1];
  var _s8 = useState(null); var toast = _s8[0]; var setToast = _s8[1];
  var _s9 = useState(false); var loaded = _s9[0]; var setLoaded = _s9[1];

  useEffect(function() { setTimeout(function() { setLoaded(true); }, 100); }, []);

  var flash = function(msg) { setToast(msg); setTimeout(function() { setToast(null); }, 6000); };
  var toggleSupp = function(i) { setSupps(function(p) { return p.map(function(s, idx) { return idx === i ? Object.assign({}, s, { done: !s.done }) : s; }); }); };

  var logMeal = function(m) {
    setMeals(function(p) { return p.concat([m]); });
    setShowMeal(false);
    (async function() {
      var r = await askAI("Radhika just finished eating. Generate a SHORT (1-2 sentence) funny post-meal walk reminder. Reference Harry Styles, Fred Again, Dumbledore, or Taylor Swift. Respond as JSON: {\"message\":\"the walk nudge with emojis\"}");
      flash(r && r.message ? r.message : "You just ate! Time for a 10-min walk 🚶‍♀️");
    })();
  };

  var suppDone = supps.filter(function(s) { return s.done; }).length;
  var dayCal = meals.reduce(function(s, m) { return s + m.tot.cal; }, 0);
  var dayP = meals.reduce(function(s, m) { return s + m.tot.p; }, 0);
  var hr = new Date().getHours();
  var greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="app-root" style={{ opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(8px)", transition: "all 0.5s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {showBreathe && <Breathe onClose={function() { setShowBreathe(false); }} />}
      {showMeal && <MealLog onSave={logMeal} onClose={function() { setShowMeal(false); }} />}
      {showChips && <ChipPopup onClose={function() { setShowChips(false); }} />}
      {toast && <div className="toast">{toast}</div>}

      <header className="header">
        <div className="header-top"><span className="header-brand">🌿</span></div>
        <h1 className="header-greeting">{greet}, Radhika</h1>
        <p className="header-quote">"{quote[0]}"<br /><span style={{ fontWeight: 400, fontSize: 11 }}>— {quote[1]}</span></p>
      </header>

      <main className="content">
        {tab === "home" && (
          <div className="fade-in">
            <div className="stats-row">
              <div className="stat-card"><div className="stat-ring" style={{ background: suppDone === supps.length ? C.olive : C.oliveGhost, color: suppDone === supps.length ? "#fff" : C.olive }}>{suppDone}/{supps.length}</div><span className="stat-label">Supplements</span></div>
              <div className="stat-card"><div className="stat-ring" style={{ background: dayCal > 0 ? C.burgGhost : C.cream, color: C.burg }}>{Math.round(dayCal)}</div><span className="stat-label">Calories</span></div>
              <div className="stat-card"><div className="stat-ring" style={{ background: dayP > 0 ? C.oliveGhost : C.cream, color: C.olive }}>{Math.round(dayP)}g</div><span className="stat-label">Protein</span></div>
            </div>

            <div className="action-grid-3">
              <button className="action-card action-burg" onClick={function() { setShowMeal(true); }}>
                <span className="action-emoji">🍽️</span><span className="action-title">Log Meal</span><span className="action-sub">AI-powered</span>
              </button>
              <button className="action-card action-olive" onClick={function() { setShowBreathe(true); }}>
                <span className="action-emoji">🫁</span><span className="action-title">Breathe</span><span className="action-sub">4-7-8 guided</span>
              </button>
              <a href="tel:9146244811" className="action-card action-bunny" style={{ textDecoration: "none" }}>
                <img src={BUNNY_SRC} alt="Bunny" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.4)" }} />
                <span className="action-title">Call Bunny</span><span className="action-sub">He misses you</span>
              </a>
              <button className="action-card action-outline-burg" onClick={function() { setShowChips(true); }}>
                <span className="action-emoji">🚫</span><span className="action-title">No Chips!</span><span className="action-sub">AI roast</span>
              </button>
              <button className="action-card action-outline-olive" onClick={function() {
                var artists = [
                  { name: "Fred Again..", spotify: "spotify:artist:4oLeXFyACqeem2VImYeBFe", web: "https://open.spotify.com/artist/4oLeXFyACqeem2VImYeBFe" },
                  { name: "Harry Styles", spotify: "spotify:artist:6KImCVD70vtIoJWnq6nGn3", web: "https://open.spotify.com/artist/6KImCVD70vtIoJWnq6nGn3" },
                  { name: "Taylor Swift", spotify: "spotify:artist:06HL4z0CvFAxyc27GXpf02", web: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02" },
                ];
                var a = pick(artists);
                window.location.href = a.spotify;
                setTimeout(function() { window.open(a.web, "_blank"); }, 1500);
                flash("💃 Playing " + a.name + " on Spotify!\nDance for 10 minutes. No excuses.");
              }}>
                <span className="action-emoji">💃</span><span className="action-title">Dance Break</span><span className="action-sub">Opens Spotify</span>
              </button>
              <button className="action-card action-outline-warm" onClick={function() { flash("💧 Drink a glass of water right now!\nYour Vitamin D absorption needs hydration too."); }}>
                <span className="action-emoji">💧</span><span className="action-title">Drink Water</span><span className="action-sub">Stay hydrated</span>
              </button>
            </div>

            <BunnyTip />

            <h3 className="section-title" style={{ marginTop: 24 }}>Daily Supplements 💊</h3>
            <div className="supp-list">
              {supps.map(function(s, i) {
                return (
                  <button key={i} className={"supp-row" + (s.done ? " supp-done" : "")} onClick={function() { toggleSupp(i); }}>
                    <div className={"supp-check" + (s.done ? " checked" : "")}>{s.done ? "✓" : ""}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="supp-name">{s.emoji} {s.name}</p>
                      <p className="supp-tip">{s.tip}</p>
                    </div>
                    <span className="supp-when">{s.when}</span>
                  </button>
                );
              })}
            </div>

            {meals.length > 0 && (
              <>
                <h3 className="section-title" style={{ marginTop: 28 }}>Today's Meals 📋</h3>
                {meals.map(function(m, i) {
                  return (
                    <div key={i} className="logged-meal">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: C.mist }}>{m.time}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.burg }}>{Math.round(m.tot.cal)} cal</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: C.charcoal, textTransform: "capitalize" }}>
                        {m.items.map(function(it) { return ((it.qty || 1) > 1 ? it.qty + "× " : "") + it.name; }).join(", ")}
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <span className="macro-tag tag-p">P: {Math.round(m.tot.p)}g</span>
                        <span className="macro-tag tag-c">C: {Math.round(m.tot.c)}g</span>
                        <span className="macro-tag tag-f">F: {Math.round(m.tot.f)}g</span>
                      </div>
                      {m.note && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.olive, fontStyle: "italic" }}>{"🤖"} {m.note}</p>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === "health" && (
          <div className="fade-in">
            <h3 className="section-title">Health Dashboard 🩺</h3>
            <p className="hint" style={{ marginBottom: 20 }}>From your blood report · June 4, 2026 · Dr Lal PathLabs</p>
            <div className="health-alert alert-red"><div className="alert-header"><span>⚠️</span><strong>Vitamin D — Deficient</strong></div><p>32.51 nmol/L — needs to be above 75. Take D3 as prescribed, get 20-30 min morning sun daily. #1 priority.</p></div>
            <div className="health-alert alert-amber"><div className="alert-header"><span>⚡</span><strong>hs-CRP — Elevated (Inflammation)</strong></div><p>5.26 mg/L — should be below 1. Omega-3, sleep, and stress management will help. Retest in 6 weeks.</p></div>
            <div className="health-alert alert-yellow"><div className="alert-header"><span>👀</span><strong>TSH — Borderline High</strong></div><p>4.774 µIU/mL (max is 4.780). Needs monitoring. Good sleep + less stress are key. Retest in 3 months.</p></div>
            <h3 className="section-title" style={{ marginTop: 28 }}>All Normal ✅</h3>
            <div className="health-grid">
              {[["Fasting Glucose", "79 mg/dL", "✓"], ["HbA1c", "5.4%", "✓"], ["Iron", "87 µg/dL", "✓"], ["B12", "286 pg/mL", "Low-normal"], ["Hemoglobin", "12.2 g/dL", "✓"], ["Total Cholesterol", "175 mg/dL", "✓"], ["HDL (good)", "60 mg/dL", "✓"], ["LDL", "96 mg/dL", "✓"], ["Triglycerides", "71 mg/dL", "✓"], ["SGOT / SGPT", "21 / 19 U/L", "✓"], ["Creatinine", "0.55 mg/dL", "✓"], ["Uric Acid", "4.1 mg/dL", "✓"], ["Calcium", "9.6 mg/dL", "✓"], ["FT3 / FT4", "3.07 / 1.22", "✓"], ["Platelets", "267K", "✓"]].map(function(row, i) {
                return (
                  <div key={i} className="health-row">
                    <span className="health-name">{row[0]}</span>
                    <span className="health-val">{row[1]}</span>
                    <span className="health-status">{row[2]}</span>
                  </div>
                );
              })}
            </div>
            <BunnyTip />
          </div>
        )}

        {tab === "tips" && (
          <div className="fade-in">
            <h3 className="section-title">Wellness Playbook ✨</h3>
            <p className="hint" style={{ marginBottom: 20 }}>Personalized for you, based on your report + lifestyle</p>
            {[
              { e: "☀️", t: "Morning Sunlight", d: "20-30 min before 10 AM. No sunscreen on arms. Most important for Vitamin D.", tag: "vitamin d" },
              { e: "🚶‍♀️", t: "Walk After Every Meal", d: "10-15 min post-meal walks. Put on Fred Again or Harry Styles and go.", tag: "fitness" },
              { e: "🍳", t: "Protein at Every Meal", d: "Aim for 60-70g daily. Eggs, dal, paneer, chicken, curd.", tag: "nutrition" },
              { e: "🫁", t: "Breathe When Stressed", d: "Your hs-CRP is elevated. Stress makes inflammation worse. Use 4-7-8.", tag: "mental health" },
              { e: "💃", t: "Dance > Stress Eating", d: "When you want chips, dance for 5 minutes instead!", tag: "de-stress" },
              { e: "🍵", t: "No Chai With Iron", d: "Tea blocks iron absorption. Take iron with nimbu pani. Wait 2 hrs.", tag: "supplements" },
              { e: "🌙", t: "Sleep by 11 PM", d: "Your borderline TSH needs good sleep. Screen off by 10:30.", tag: "lifestyle" },
              { e: "🧃‍🍳", t: "Sunday Meal Prep", d: "You love cooking! Batch-cook healthy meals on Sundays.", tag: "nutrition" },
            ].map(function(tip, i) {
              return (
                <div key={i} className="tip-card" style={{ animationDelay: (i * 0.05) + "s" }}>
                  <span className="tip-emoji">{tip.e}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="tip-title">{tip.t}</p>
                    <p className="tip-desc">{tip.d}</p>
                    <span className="tip-tag">{tip.tag}</span>
                  </div>
                </div>
              );
            })}
            <BunnyTip />
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        {[["home", "🏠", "Home"], ["health", "🩺", "Health"], ["tips", "✨", "Tips"]].map(function(t) {
          return (
            <button key={t[0]} className={"nav-btn" + (tab === t[0] ? " nav-active" : "")} onClick={function() { setTab(t[0]); }}>
              <span className="nav-icon">{t[1]}</span>
              <span className="nav-label">{t[2]}</span>
            </button>
          );
        })}
      </nav>

      <style>{"\
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0}\
        .app-root{font-family:'Outfit',sans-serif;background:" + C.cream + ";min-height:100vh;max-width:430px;margin:0 auto;position:relative;color:" + C.charcoal + "}\
        .header{background:linear-gradient(160deg," + C.oliveDeep + " 0%," + C.olive + " 60%," + C.oliveMid + " 100%);padding:44px 24px 32px;border-radius:0 0 28px 28px;position:relative;overflow:hidden}\
        .header::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.04)}\
        .header-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}\
        .header-brand{font-size:22}\
        .header-greeting{font-family:'Lora',serif;color:#fff;font-size:24px;font-weight:600;margin:0 0 12px;line-height:1.2}\
        .header-quote{font-family:'Lora',serif;font-style:italic;color:" + C.olivePale + ";font-size:13px;line-height:1.6;margin:0;opacity:0.85}\
        .content{padding:20px 16px 110px}\
        .stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px}\
        .stat-card{background:" + C.warm + ";border-radius:18px;padding:16px 8px;text-align:center;border:1px solid " + C.sand + "}\
        .stat-ring{width:52px;height:52px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;margin-bottom:6px;transition:all 0.3s}\
        .stat-label{font-size:11px;color:" + C.stone + ";display:block}\
        .action-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px}\
        .action-card{border:none;border-radius:20px;padding:18px 12px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:3px;transition:transform 0.15s}\
        .action-card:active{transform:scale(0.96)}\
        .action-burg{background:linear-gradient(140deg," + C.burg + "," + C.burgLight + ");color:#fff}\
        .action-olive{background:linear-gradient(140deg," + C.olive + "," + C.oliveMid + ");color:#fff}\
        .action-bunny{background:linear-gradient(140deg," + C.gold + "," + C.goldLight + ");color:#fff}\
        .action-outline-burg{background:" + C.warm + ";border:1.5px solid " + C.burgPale + ";color:" + C.burg + "}\
        .action-outline-olive{background:" + C.warm + ";border:1.5px solid " + C.olivePale + ";color:" + C.olive + "}\
        .action-outline-warm{background:" + C.warm + ";border:1.5px solid " + C.sand + ";color:" + C.stone + "}\
        .action-emoji{font-size:20}\
        .action-title{font-family:'Lora',serif;font-size:14px;font-weight:600}\
        .action-sub{font-size:10px;opacity:0.7}\
        .action-outline-burg .action-sub,.action-outline-olive .action-sub,.action-outline-warm .action-sub{color:" + C.stone + "}\
        .bunny-tip-card{background:linear-gradient(145deg,#F9F5EE," + C.oliveGhost + ");border-radius:20px;padding:18px 18px 14px;border:1px dashed " + C.olivePale + ";margin-bottom:4px}\
        .bunny-tip-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}\
        .bunny-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid " + C.olivePale + ";flex-shrink:0}\
        .bunny-tip-label{font-family:'Lora',serif;font-size:14px;font-weight:600;color:" + C.olive + ";flex:1}\
        .bunny-refresh{background:none;border:1px solid " + C.olivePale + ";width:28px;height:28px;border-radius:50%;font-size:14px;cursor:pointer;color:" + C.oliveMid + ";display:flex;align-items:center;justify-content:center}\
        .bunny-refresh:disabled{opacity:0.5}\
        .bunny-tip-text{font-size:13.5px;color:" + C.charcoal + ";line-height:1.6;margin:0 0 14px;min-height:42px}\
        .bunny-tip-in{animation:fadeUp 0.3s ease}\
        .bunny-tip-actions{display:flex;gap:8px;align-items:center}\
        .bunny-action-btn{font-size:12px;padding:7px 16px;border-radius:50px;text-decoration:none;font-family:'Outfit',sans-serif;font-weight:500}\
        .bunny-call{background:" + C.gold + ";color:#fff}\
        .bunny-msg{background:" + C.olive + ";color:#fff}\
        .bunny-another{background:none;border:none;font-size:11px;color:" + C.mist + ";cursor:pointer;font-family:'Outfit',sans-serif;margin-left:auto}\
        .bunny-another:disabled{opacity:0.5}\
        .section-title{font-family:'Lora',serif;font-size:18px;color:" + C.charcoal + ";margin-bottom:14px}\
        .supp-list{display:flex;flex-direction:column;gap:8px}\
        .supp-row{display:flex;align-items:center;gap:12px;padding:14px 16px;background:" + C.warm + ";border-radius:16px;border:1.5px solid " + C.sand + ";cursor:pointer;transition:all 0.2s;text-align:left;width:100%}\
        .supp-row:active{transform:scale(0.98)}\
        .supp-done{background:" + C.oliveGhost + ";border-color:" + C.olivePale + "}\
        .supp-check{width:26px;height:26px;border-radius:8px;border:2px solid " + C.olivePale + ";display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;transition:all 0.2s;flex-shrink:0}\
        .supp-check.checked{background:" + C.olive + ";border-color:" + C.olive + "}\
        .supp-name{font-size:13px;font-weight:600;margin:0 0 2px;color:" + C.charcoal + "}\
        .supp-done .supp-name{text-decoration:line-through;opacity:0.5}\
        .supp-tip{font-size:11px;color:" + C.stone + ";margin:0;line-height:1.4}\
        .supp-when{font-size:9px;color:" + C.oliveMid + ";text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;text-align:right;max-width:60px;line-height:1.3}\
        .logged-meal{background:" + C.warm + ";border-radius:16px;padding:14px 16px;margin-bottom:8px;border:1px solid " + C.sand + "}\
        .macro-tag{font-size:11px;padding:3px 10px;border-radius:8px;font-weight:500}\
        .tag-p{background:" + C.oliveGhost + ";color:" + C.olive + "}\
        .tag-c{background:" + C.burgGhost + ";color:" + C.burg + "}\
        .tag-f{background:" + C.sand + ";color:" + C.stone + "}\
        .health-alert{border-radius:16px;padding:16px 18px;margin-bottom:12px;border-left:4px solid}\
        .health-alert .alert-header{display:flex;gap:6px;align-items:center;margin-bottom:6px;font-size:14px}\
        .health-alert p{font-size:13px;line-height:1.5;margin:0;color:" + C.charcoal + "}\
        .alert-red{background:#FFF3F3;border-color:" + C.burg + "}\
        .alert-red .alert-header{color:" + C.burg + "}\
        .alert-amber{background:#FFF8F0;border-color:#D4930D}\
        .alert-amber .alert-header{color:#8B6914}\
        .alert-yellow{background:#FFFBE8;border-color:#C4A30D}\
        .alert-yellow .alert-header{color:#7A6B0A}\
        .health-grid{display:flex;flex-direction:column}\
        .health-row{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid " + C.sand + ";gap:8px}\
        .health-name{flex:1;font-size:13px}\
        .health-val{font-size:13px;font-weight:600;color:" + C.olive + ";min-width:80px;text-align:right}\
        .health-status{font-size:10px;color:" + C.oliveMid + ";min-width:60px;text-align:right}\
        .tip-card{display:flex;gap:14px;align-items:flex-start;padding:16px 18px;background:" + C.warm + ";border-radius:16px;margin-bottom:10px;border:1px solid " + C.sand + ";animation:fadeUp 0.4s ease both}\
        .tip-emoji{font-size:22;flex-shrink:0;margin-top:2px}\
        .tip-title{font-size:14px;font-weight:600;margin:0 0 4px}\
        .tip-desc{font-size:12.5px;color:" + C.stone + ";margin:0 0 8px;line-height:1.5}\
        .tip-tag{font-size:9px;background:" + C.oliveGhost + ";color:" + C.olive + ";padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px}\
        .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);max-width:430px;width:100%;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-top:1px solid " + C.sand + ";display:flex;justify-content:space-around;padding:8px 0 28px;z-index:100}\
        .nav-btn{background:none;border:none;cursor:pointer;text-align:center;padding:4px 20px;opacity:0.35;transition:all 0.2s}\
        .nav-active{opacity:1}\
        .nav-icon{font-size:20px;display:block}\
        .nav-label{font-size:10px;color:" + C.olive + ";font-weight:600;display:block;margin-top:2px}\
        .overlay{position:fixed;inset:0;background:rgba(42,42,42,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn 0.25s ease}\
        .breathe-card{background:" + C.cream + ";border-radius:28px;padding:36px 28px;text-align:center;max-width:340px;width:90%}\
        .breathe-quote{font-family:'Lora',serif;font-style:italic;font-size:15px;color:" + C.olive + ";margin:0 0 8px;line-height:1.5}\
        .breathe-circle{border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto;transition:all 1.2s cubic-bezier(0.4,0,0.2,1)}\
        .chip-popup{background:" + C.cream + ";border-radius:28px;padding:32px 24px;max-width:370px;width:92%;text-align:center;animation:popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)}\
        .chip-popup-header{margin-bottom:20px}\
        .chip-popup-title{font-family:'Lora',serif;font-size:22px;color:" + C.burg + ";margin:0 0 8px;line-height:1.3}\
        .chip-popup-sub{font-size:13px;color:" + C.stone + ";margin:0;line-height:1.5}\
        .chip-divider{display:flex;align-items:center;gap:12px;margin:0 0 16px}\
        .chip-divider::before,.chip-divider::after{content:'';flex:1;height:1px;background:" + C.sand + "}\
        .chip-divider span{font-size:10px;color:" + C.mist + ";text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap}\
        .chip-alts{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}\
        .chip-alt-card{display:flex;align-items:center;gap:10px;padding:12px 14px;background:" + C.oliveGhost + ";border-radius:14px;text-align:left;animation:fadeUp 0.3s ease both}\
        .chip-alt-emoji{font-size:20;flex-shrink:0}\
        .chip-alt-name{font-size:13px;font-weight:600;margin:0}\
        .chip-alt-why{font-size:11px;color:" + C.stone + ";margin:2px 0 0}\
        .chip-alt-cal{font-size:11px;font-weight:600;color:" + C.olive + ";flex-shrink:0}\
        .chip-compare{background:" + C.burgGhost + ";border-radius:12px;padding:10px 14px;margin-bottom:20px}\
        .btn-chip-close{width:100%;padding:14px;border-radius:50px;border:none;background:" + C.olive + ";color:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:'Outfit',sans-serif}\
        .btn-chip-close:active{transform:scale(0.97)}\
        .meal-sheet{background:" + C.cream + ";border-radius:28px 28px 0 0;padding:28px 20px 32px;max-width:430px;width:100%;max-height:88vh;overflow-y:auto;animation:slideUp 0.3s ease}\
        .hint{font-size:12px;color:" + C.mist + ";margin-bottom:12px}\
        .meal-input{flex:1;padding:13px 16px;border-radius:14px;border:1.5px solid " + C.sand + ";font-size:14px;font-family:'Outfit',sans-serif;background:" + C.warm + ";outline:none}\
        .meal-input:focus{border-color:" + C.olive + "}\
        .meal-input:disabled{opacity:0.6}\
        .chip-btn{background:" + C.oliveGhost + ";border:none;padding:6px 14px;border-radius:20px;font-size:11px;color:" + C.olive + ";cursor:pointer;font-family:'Outfit',sans-serif}\
        .chip-btn:disabled{opacity:0.5}\
        .chip-warning{display:flex;align-items:flex-start;gap:8px;background:" + C.burgGhost + ";border:1px solid " + C.burgPale + ";border-radius:14px;padding:14px 16px;margin-bottom:14px;font-size:13px;color:" + C.burg + ";line-height:1.5}\
        .meal-items{margin-bottom:16px}\
        .meal-row{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid " + C.sand + "}\
        .meal-name{font-size:14px;text-transform:capitalize}\
        .meal-unit{font-size:10px;color:" + C.mist + ";margin-left:6px}\
        .meal-cal{font-size:14px;font-weight:700;color:" + C.olive + ";display:block}\
        .meal-macro{font-size:10px;color:" + C.mist + "}\
        .meal-total-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0 4px;border-top:2px solid " + C.olive + ";margin-top:8px}\
        .btn-primary{background:" + C.olive + ";color:#fff;border:none;padding:14px 32px;border-radius:50px;font-size:15px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:500}\
        .btn-primary:disabled{opacity:0.6;cursor:default}\
        .btn-ghost{background:none;border:1px solid " + C.olivePale + ";color:" + C.olive + ";padding:8px 24px;border-radius:50px;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif}\
        .btn-save{width:100%;padding:15px;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;border:none;font-family:'Outfit',sans-serif;background:" + C.burg + ";color:#fff}\
        .btn-save:disabled{background:" + C.sand + ";color:" + C.mist + ";cursor:default}\
        .toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999;background:" + C.olive + ";color:#fff;padding:14px 24px;border-radius:16px;font-size:13px;max-width:360px;text-align:center;white-space:pre-line;box-shadow:0 8px 32px rgba(0,0,0,0.25);animation:slideDown 0.4s ease;line-height:1.5}\
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}\
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}\
        @keyframes slideDown{from{transform:translateX(-50%) translateY(-16px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}\
        @keyframes fadeUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}\
        @keyframes popIn{from{transform:scale(0.85);opacity:0}to{transform:scale(1);opacity:1}}\
        .fade-in>*{animation:fadeUp 0.4s ease both}\
        .fade-in>*:nth-child(2){animation-delay:0.05s}\
        .fade-in>*:nth-child(3){animation-delay:0.1s}\
        .fade-in>*:nth-child(4){animation-delay:0.15s}\
      "}</style>
    </div>
  );
}
