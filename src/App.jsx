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
const AI_CONTEXT = "You are a fun wellness assistant for Radhika, 26, Indian. Her boyfriend Sachit (Bunny) built this app. Health: Vitamin D deficient (32.51, needs 75+), hs-CRP elevated 5.26, TSH borderline 4.774. Supplements: D3, B12, Iron+C, Omega-3. Loves Harry Styles, Taylor Swift, One Direction, Fred Again, Harry Potter. Loves idli sambhar, chicken biryani, cooking, dancing. Avoid chips/junk. Never suggest makhana — she hates it. Suggest protein chips, protein shakes, roasted chana instead. Always respond ONLY with valid JSON. No markdown, no backticks, no preamble.";

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


/* ─── persistent storage ─── */
function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // "2026-04-08"
}

function loadToday(key) {
  try {
    var stored = localStorage.getItem(key);
    if (!stored) return null;
    var data = JSON.parse(stored);
    if (data.date !== getTodayKey()) return null; // expired, different day
    return data.value;
  } catch(e) { return null; }
}

function saveToday(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ date: getTodayKey(), value: value }));
  } catch(e) {}
}

function loadHistory(key) {
  try {
    var stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch(e) { return []; }
}

function saveHistory(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch(e) {}
}

function archiveDay(meals, supps) {
  var today = getTodayKey();
  var history = loadHistory("rw_history");
  var totalCal = meals.reduce(function(s, m) { return s + (m.tot && m.tot.cal ? m.tot.cal : 0); }, 0);
  var totalP = meals.reduce(function(s, m) { return s + (m.tot && m.tot.p ? m.tot.p : 0); }, 0);
  var suppsDone = supps.filter(function(s) { return s.done; }).length;
  var entry = {
    date: today,
    meals: meals.length,
    calories: Math.round(totalCal),
    protein: Math.round(totalP),
    supplements: suppsDone + "/" + supps.length
  };
  // Replace today's entry if it exists, otherwise add new
  var existingIdx = -1;
  for (var i = 0; i < history.length; i++) {
    if (history[i].date === today) { existingIdx = i; break; }
  }
  if (existingIdx >= 0) {
    history[existingIdx] = entry;
  } else {
    history.push(entry);
  }
  if (history.length > 90) history = history.slice(-90);
  saveHistory("rw_history", history);
}


/* ─── period tracker helpers ─── */
function getCycleInfo(periods) {
  if (!periods || periods.length === 0) return null;
  var sorted = periods.slice().sort(function(a, b) { return new Date(b.start) - new Date(a.start); });
  var last = sorted[0];
  var lastStart = new Date(last.start);
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var daysSinceLast = Math.floor((today - lastStart) / (1000 * 60 * 60 * 24));

  // Calculate average cycle length from history
  var avgCycle = 28;
  if (sorted.length >= 2) {
    var gaps = [];
    for (var i = 0; i < sorted.length - 1; i++) {
      var diff = Math.floor((new Date(sorted[i].start) - new Date(sorted[i + 1].start)) / (1000 * 60 * 60 * 24));
      if (diff > 15 && diff < 45) gaps.push(diff);
    }
    if (gaps.length > 0) avgCycle = Math.round(gaps.reduce(function(a, b) { return a + b; }, 0) / gaps.length);
  }

  var daysUntilNext = avgCycle - daysSinceLast;
  var nextDate = new Date(lastStart);
  nextDate.setDate(nextDate.getDate() + avgCycle);

  // Determine current phase
  var phase = "follicular";
  var phaseEmoji = "🌱";
  var phaseColor = "#7E8C6A";
  if (daysSinceLast <= (last.length || 5)) { phase = "period"; phaseEmoji = "🌸"; phaseColor = "#6E2C35"; }
  else if (daysSinceLast >= avgCycle - 14 && daysSinceLast <= avgCycle - 10) { phase = "ovulation"; phaseEmoji = "✨"; phaseColor = "#D4930D"; }
  else if (daysSinceLast > avgCycle - 10) { phase = "luteal"; phaseEmoji = "🍂"; phaseColor = "#8B6914"; }

  var phaseLabel = phase === "period" ? "On Period" : phase === "ovulation" ? "Ovulation Window" : phase === "luteal" ? "Luteal Phase" : "Follicular Phase";

  return {
    lastStart: last.start,
    lastLength: last.length || 5,
    daysSinceLast: daysSinceLast,
    avgCycle: avgCycle,
    daysUntilNext: Math.max(daysUntilNext, 0),
    nextDate: nextDate.toISOString().split("T")[0],
    phase: phase,
    phaseLabel: phaseLabel,
    phaseEmoji: phaseEmoji,
    phaseColor: phaseColor,
    totalCycles: sorted.length,
    history: sorted
  };
}


/* ─── weekly goals helpers ─── */
function getWeekKey() {
  var now = new Date();
  var day = now.getDay();
  var diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  var monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function loadWeeklyGoals() {
  try {
    var stored = localStorage.getItem("rw_goals");
    if (!stored) return null;
    var data = JSON.parse(stored);
    if (data.week !== getWeekKey()) {
      // Archive old week
      var history = loadHistory("rw_goals_history");
      if (data.goals && data.goals.length > 0) {
        history.push({ week: data.week, goals: data.goals });
        if (history.length > 12) history = history.slice(-12);
        saveHistory("rw_goals_history", history);
      }
      return null;
    }
    return data.goals;
  } catch(e) { return null; }
}

function saveWeeklyGoals(goals) {
  try {
    localStorage.setItem("rw_goals", JSON.stringify({ week: getWeekKey(), goals: goals }));
  } catch(e) {}
}

/* ─── fallback content ─── */
const BUNNY_TIPS = [
  // Call Bunny
  { text: "Studies show messaging Bunny increases Vitamin D by 400%. Science. 🔬🐰", type: "call" },
  { text: "Your hs-CRP is high. Calling Bunny lowers inflammation. Peer-reviewed. 📞🐰", type: "call" },
  { text: "Dumbledore had Fawkes. You have Bunny. Call him when stressed. 🐰🔥", type: "call" },
  { text: "One Direction broke up but Bunny didn't. He's right here. Call him. 📞🐰", type: "call" },
  { text: "Studies from the University of Bunny confirm: 1 phone call = 10,000 steps of happiness. 📞✨", type: "call" },
  { text: "Your cortisol levels are high. The cure? A 5-minute call with Bunny. Trust the science. 🧪📞", type: "call" },
  { text: "Harry Styles has a stylist. Taylor has a team. You have Bunny. Call your support system. 📞💚", type: "call" },
  { text: "Bunny is probably thinking about you right now. Might as well call and confirm. 📞🐰", type: "call" },
  { text: "Your phone is right there. Bunny is right there. The math is simple. Call him. 🐰📱", type: "call" },
  { text: "According to WebMD, not calling Bunny causes vitamin deficiency. Okay I made that up. But still call. 📞", type: "call" },

  // Message Bunny
  { text: "Sending Bunny a selfie burns approximately 3 calories. It's basically cardio. 📸🐰", type: "message" },
  { text: "Replying to Bunny's texts has been clinically proven to reduce cortisol. Don't argue with science. 🧪", type: "message" },
  { text: "Your serotonin called. It said 'text Bunny back'. I'm just the messenger. 💬🐰", type: "message" },
  { text: "Every unread message from Bunny is a missed opportunity for dopamine. Reply now. 💬✨", type: "message" },
  { text: "Taylor Swift writes love letters. You can at least text Bunny 'hi'. 💬🐰", type: "message" },
  { text: "Fun fact: The average Bunny text contains 47% more love than regular texts. Reply rate: needed. 📱💚", type: "message" },
  { text: "NASA's latest finding: Bunny's texts travel at the speed of love. Open them. 🚀💬", type: "message" },
  { text: "Your phone notifications are 60% Bunny. That's called dedication. Respond to it. 📱🐰", type: "message" },

  // Food roasts
  { text: "Put the Maggi down. Bunny didn't build this app for 310 calories of sadness. 🍜🚫", type: "food" },
  { text: "Jalebi is not a food group, Radhika. We've discussed this. 🍯🚫", type: "food" },
  { text: "Fun fact: Every time you skip chips, an angel gets its wings. And Bunny gets less stressed. 😇", type: "food" },
  { text: "Reminder: Bunny worries when you don't eat protein. Don't make Bunny worry. 🐰🍳", type: "food" },
  { text: "Hot take: Dal chawal > chips. This is not up for debate. 🍛✅", type: "food" },
  { text: "Eating chole bhature for the 3rd time this week? Your CRP just fainted. 📊😵", type: "food" },
  { text: "Your protein intake called. It said it's lonely. Please eat an egg. 🍳😢", type: "food" },
  { text: "Breaking news: Local woman chooses salad over chips. Bunny files report of extreme pride. 📰🐰", type: "food" },
  { text: "If Harry Styles saw you eating chips at 2 AM he'd be disappointed. Eat fruit. 🍎", type: "food" },
  { text: "Biryani is love. But biryani every day is inflammation. Balance, Radhika. ⚖️🍗", type: "food" },
  { text: "Your stomach: I want chips. Your blood report: Absolutely not. Listen to the blood report. 📋", type: "food" },
  { text: "Dumbledore ate in the Great Hall, not at the vending machine. Choose wisely. 🏰🍽️", type: "food" },
  { text: "Protein shake > sad packet of chips. One builds muscle, the other builds regret. 🥤💪", type: "food" },
  { text: "Your iron supplement wants to be friends with some dal. Introduce them. 🩸🤝🥘", type: "food" },
  { text: "Plot twist: Curd rice is actually comfort food AND healthy. Mind blown. 🍚✨", type: "food" },

  // Health
  { text: "Harry Styles walks after meals. Taylor Swift walks after meals. You should too. 🚶‍♀️", type: "health" },
  { text: "Your thyroid called. It said sleep by 11 PM or it's filing a complaint. 📋😤", type: "health" },
  { text: "Fred Again didn't make bangers for you to listen sitting down. Dance! 💃🎧", type: "health" },
  { text: "NASA says your Vitamin D levels are so low they can see it from space. Go outside. ☀️🛸", type: "health" },
  { text: "Expecto Patronum only works if you've taken your Vitamin D. Look it up. 🪄☀️", type: "health" },
  { text: "Taylor wrote 'All Too Well' in 10 minutes. You can take your supplements in 10 seconds. 💊⏱️", type: "health" },
  { text: "Your Vitamin D said please go outside. The sun misses you. ☀️😢", type: "health" },
  { text: "You haven't drunk water in a while. Your kidneys are sending a formal request. 💧📝", type: "health" },
  { text: "Your iron supplement is lonely. It's been waiting since afternoon. Don't ghost it. 🩸💔", type: "health" },
  { text: "Sleep is the best skincare, anti-inflammatory, and mood booster. It's free. Use it. 🌙", type: "health" },
  { text: "10 minutes of sunlight = free Vitamin D. The sun is literally giving you free medicine. ☀️💊", type: "health" },
  { text: "Your CRP is 5.26. The goal is under 1. Omega-3, sleep, and less stress. You've got this. 💪", type: "health" },
  { text: "Walking after meals is the most underrated health hack. 10 minutes. Just do it. 🚶‍♀️✨", type: "health" },
  { text: "Drinking water is not a personality trait but it should be. Go drink some. 💧", type: "health" },
  { text: "Your TSH is watching. Every hour of good sleep before midnight counts double. 🌙📊", type: "health" },
  { text: "Stretching for 5 minutes > scrolling for 30 minutes. Your body will thank you. 🧘‍♀️", type: "health" },
  { text: "Deep breaths don't just feel good — they literally lower your inflammation markers. 🫁📉", type: "health" },
  { text: "Morning sunlight before 10 AM is like a software update for your body. Install it. ☀️💻", type: "health" },
  { text: "Your omega-3 is the bouncer that kicks inflammation out of the club. Take it tonight. 🐟🎪", type: "health" },
  { text: "One day your Vitamin D will be at 75 and you'll look back at 32 and laugh. Keep going. ☀️📈", type: "health" },
  { text: "Harry Potter survived Voldemort. You can survive taking 5 supplements. 🪄💊", type: "health" },
  { text: "Ron Weasley ate every meal at Hogwarts. But he also moved a lot. Walk after eating. 🏰🚶‍♀️", type: "health" },
  { text: "Taylor Swift walks 10,000 steps during her concerts. Your post-meal walk is nothing. Go. 👟", type: "health" },
  { text: "Fred Again probably drinks water between sets. You should drink water between meals. 💧🎧", type: "health" },
  { text: "Your magnesium before bed is like a lullaby for your nervous system. Take it. 🌙😴", type: "health" },
  { text: "Stress eating at 11 PM won't solve the stress. But breathing for 2 minutes might. 🫁✨", type: "health" },
  { text: "Your B12 is at 286. Not bad, not great. Like a Hogwarts grade of Acceptable. Aim for Outstanding. 💊📊", type: "health" },
  { text: "Every supplement you take is a tiny soldier fighting for your health. Deploy them daily. 💊⚔️", type: "health" },
  { text: "Your body is doing its best with what you give it. Give it sunlight, protein, and water today. ☀️🍳💧", type: "health" },
  { text: "Hermione would've had a supplement schedule on a color-coded chart. Channel that energy. 📊🪄", type: "health" },
  { text: "You're literally getting healthier every day you use this app. Bunny sees you trying. 🐰💚", type: "health" },
  { text: "Some people count sheep to sleep. You should count supplements taken today. 💊🐑", type: "health" },
  { text: "The sorting hat would put your CRP in Slytherin. Let's get it to Gryffindor. 🎩📉", type: "health" },
  { text: "Niall Horan once said 'just do it'. Wait, that was Nike. Either way — take your Vitamin D. ☀️💊", type: "health" },
  { text: "Your body after supplements: 📈. Your body after chips: 📉. Choose wisely today. 🤔", type: "health" },
  { text: "Louis Tomlinson didn't give up on his dreams. Don't give up on your Vitamin D recovery. ☀️💪", type: "health" },
  { text: "Dance like nobody's watching. But also like your CRP levels depend on it. Because they do. 💃📊", type: "health" },
]

const CHIP_ROASTS_LIST = [
  { roast: "Radhika. Put. The chips. DOWN.", sub: "Harry Styles didn't say Treat people with Lays.", emoji: "🚫" },
  { roast: "Expelliarmus those chips!", sub: "10 points from Gryffindor if you eat them.", emoji: "🪄" },
  { roast: "Bunny made this whole app for you.", sub: "Don't make him sad. Have protein chips instead.", emoji: "🥺" },
  { roast: "Taylor would NOT approve.", sub: "Shake off the craving. Choose fruit.", emoji: "🍎" },
  { roast: "Chips won't fix it. Dancing will.", sub: "Put on Fred Again and dance for 5 mins instead!", emoji: "💃" },
  { roast: "Your CRP said NO to inflammation.", sub: "Chips = inflammation. Your blood report receipts don't lie.", emoji: "📋" },
  { roast: "What would Dumbledore do?", sub: "He'd eat a lemon drop, not a packet of Lays.", emoji: "🍋" },
  { roast: "One Direction walked so you could... walk.", sub: "Walk away from the chips. Towards a protein shake.", emoji: "🚶‍♀️" },
  { roast: "Your Vitamin D is already struggling.", sub: "Don't add chip-related inflammation to its problems.", emoji: "☀️" },
  { roast: "Plot twist: The chips don't love you back.", sub: "But Bunny does. Call him instead of snacking.", emoji: "💔" },
  { roast: "Harry Styles is vegan sometimes.", sub: "You can at least skip the chips. Have a banana.", emoji: "🍌" },
  { roast: "Your thyroid is WATCHING.", sub: "It doesn't need the extra sodium from chips right now.", emoji: "👁️" },
  { roast: "Snape would be disappointed.", sub: "After all this time? Always... eating chips. Stop it.", emoji: "🖤" },
  { roast: "Fred Again's drops hit harder than chip cravings.", sub: "Put on Delilah and dance instead.", emoji: "🎧" },
  { roast: "Your future self will thank you.", sub: "For choosing roasted chana over Kurkure today.", emoji: "🙏" },
  { roast: "The Room of Requirement has protein chips.", sub: "It does NOT have Lays. Hogwarts has standards.", emoji: "🏰" },
  { roast: "Taylor has Eras, you have... chip eras?", sub: "Time for a new era. The Healthy Snacking Era.", emoji: "✨" },
  { roast: "Zayn left 1D for a solo career.", sub: "You can leave chips for a protein shake. Same energy.", emoji: "🥤" },
  { roast: "Bunny spent hours building this app.", sub: "The LEAST you can do is not eat chips. Come on.", emoji: "🐰" },
  { roast: "Dobby is a free elf. You can be free from chips.", sub: "Here — have a protein bar. You're welcome.", emoji: "🧦" },
]

const CHIP_ALTS = [
  { name: "Protein Chips", cal: "120 cal/bag", why: "Crunchy, high protein, low guilt", emoji: "💪" },
  { name: "Roasted Chana", cal: "120 cal/katori", why: "High protein, great crunch", emoji: "🪶" },
  { name: "Fruit Chaat", cal: "80 cal/bowl", why: "Vitamins + fiber + natural sugar", emoji: "🍎" },
  { name: "Sprouts Salad", cal: "100 cal/bowl", why: "Protein-packed, refreshing", emoji: "🌱" },
  { name: "Air-popped Popcorn", cal: "95 cal/bowl", why: "Whole grain, satisfying crunch", emoji: "🍿" },
  { name: "Cucumber + Hummus", cal: "70 cal/serving", why: "Hydrating, protein from hummus", emoji: "🥒" },
  { name: "Protein Shake", cal: "150 cal/glass", why: "25g protein, fills you up instantly", emoji: "🥤" },
];

const BREATHE_MSGS = ["Hey. Breathe. You're doing amazing. 💚", "Inhale the good stuff, exhale the stress. 🌿", "Close your eyes. You're safe. Let's breathe together. ✨", "As Taylor says — you need to calm down. 🫁"];

const SUPPS = [
  { name: "Vitamin D3 (60,000 IU)", when: "Morning · Weekly", emoji: "☀️", tip: "Take with a fatty meal — ghee on roti works!" },
  { name: "Vitamin B12", when: "Morning · Daily", emoji: "💊", tip: "Your B12 is 286 — low-normal. Keep supplementing." },
  { name: "Iron + Vitamin C", when: "Afternoon · Daily", emoji: "🩸", tip: "Take with nimbu pani. NO chai for 2 hrs after!" },
  { name: "Omega-3 Fish Oil", when: "Dinner · Daily", emoji: "🐟", tip: "Fights inflammation — your CRP needs this." },
  { name: "Magnesium", when: "Night · Daily", emoji: "🌙", tip: "Helps sleep, reduces stress, supports thyroid. Take before bed." },
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


/* ─── Confetti Animation ─── */
function Confetti() {
  var colors = ["#6E2C35", "#606B4E", "#C49355", "#D6DEC9", "#F5E1E4", "#FFD60A", "#7E8C6A", "#8A3D47"];
  var pieces = [];
  for (var i = 0; i < 40; i++) {
    var style = {
      position: "fixed",
      left: (Math.random() * 100) + "%",
      top: "-10px",
      width: (6 + Math.random() * 8) + "px",
      height: (6 + Math.random() * 8) + "px",
      background: colors[Math.floor(Math.random() * colors.length)],
      borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      zIndex: 3000,
      pointerEvents: "none",
      animation: "confettiFall " + (1.5 + Math.random() * 2) + "s ease-out forwards",
      animationDelay: (Math.random() * 0.5) + "s",
      transform: "rotate(" + (Math.random() * 360) + "deg)",
    };
    pieces.push(<div key={i} style={style} />);
  }
  return <>{pieces}</>;
}

/* ─── Vitamin D Progress Meter ─── */
function VitDMeter(props) {
  var weeks = props.weeks;
  var total = 12; // 12 week treatment course
  var pct = Math.min((weeks / total) * 100, 100);
  var color = pct < 30 ? "#D44" : pct < 60 ? "#D4930D" : pct < 85 ? "#8BAD6A" : "#4A8B3A";
  var label = pct < 30 ? "Deficient" : pct < 60 ? "Getting there" : pct < 85 ? "Almost!" : "On track! 🌟";

  return (
    <div className="vitd-meter">
      <div className="vitd-header">
        <span style={{ fontSize: 13, fontWeight: 600, color: "#2A2A2A" }}>☀️ Vitamin D Recovery</span>
        <span style={{ fontSize: 11, color: "#6B6B6B" }}>{weeks}/{total} weeks</span>
      </div>
      <div className="vitd-track">
        <div className="vitd-fill" style={{ width: pct + "%", background: "linear-gradient(90deg, #D44, #D4930D, #8BAD6A, #4A8B3A)", transition: "width 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
        <div className="vitd-thumb" style={{ left: "calc(" + pct + "% - 8px)", transition: "left 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#D44" }}>32.5</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: color }}>{label}</span>
        <span style={{ fontSize: 10, color: "#4A8B3A" }}>75+</span>
      </div>
    </div>
  );
}

/* ─── Bunny Tip (AI) ─── */
function BunnyTip() {
  var _s1 = useState(pick(BUNNY_TIPS)); var tip = _s1[0]; var setTip = _s1[1];
  var _s3 = useState(true); var anim = _s3[0]; var setAnim = _s3[1];

  var fetchTip = function() {
    setAnim(false);
    setTimeout(function() {
      var pool = BUNNY_TIPS.filter(function(t) { return t.text !== tip.text; });
      setTip(pick(pool));
      setAnim(true);
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
        <button onClick={fetchTip} className="bunny-refresh" >{"↻"}</button>
      </div>
      <p className={"bunny-tip-text" + (anim ? " bunny-tip-in" : "")}>{tip.text}</p>
      <div className="bunny-tip-actions">
        {actionBtn}
        <button onClick={fetchTip} className="bunny-another" >{"Next tip 🔄"}</button>
      </div>
    </div>
  );
}

/* ─── Chip Popup (AI) ─── */
function ChipPopup(props) {
  var _s1 = useState(pick(CHIP_ROASTS_LIST)); var roast = _s1[0]; var setRoast = _s1[1];
  var _s2 = useState(function() { return shuffle(CHIP_ALTS).slice(0, 3); }); var alts = _s2[0];


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
      tot: { cal: Math.round(tot.cal) || 0, p: Math.round(tot.p) || 0, c: Math.round(tot.c) || 0, f: Math.round(tot.f) || 0 },
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
  var _s3 = useState(function() {
    var saved = loadToday("rw_supps");
    if (saved) return SUPPS.map(function(s, i) { return Object.assign({}, s, { done: saved[i] || false }); });
    return SUPPS.map(function(s) { return Object.assign({}, s, { done: false }); });
  }); var supps = _s3[0]; var setSupps = _s3[1];
  var _s4 = useState(function() { return loadToday("rw_meals") || []; }); var meals = _s4[0]; var setMeals = _s4[1];
  var _s5 = useState(false); var showBreathe = _s5[0]; var setShowBreathe = _s5[1];
  var _s6 = useState(false); var showMeal = _s6[0]; var setShowMeal = _s6[1];
  var _s7 = useState(false); var showChips = _s7[0]; var setShowChips = _s7[1];
  var _s7b = useState(false); var showVitdAnim = _s7b[0]; var setShowVitdAnim = _s7b[1];
  var _sconf = useState(false); var showConfetti = _sconf[0]; var setShowConfetti = _sconf[1];

  var triggerConfetti = function() {
    setShowConfetti(true);
    setTimeout(function() { setShowConfetti(false); }, 3000);
  };
  var _s8 = useState(null); var toast = _s8[0]; var setToast = _s8[1];
  var _s8b = useState(""); var kitchenQuery = _s8b[0]; var setKitchenQuery = _s8b[1];
  var _s8c = useState(false); var kitchenLoading = _s8c[0]; var setKitchenLoading = _s8c[1];
  var _s8d = useState(null); var kitchenRecipe = _s8d[0]; var setKitchenRecipe = _s8d[1];
  var _s9 = useState(false); var loaded = _s9[0]; var setLoaded = _s9[1];
  var _moodTap = useState(null); var tappedMood = _moodTap[0]; var setTappedMood = _moodTap[1];

  // Weekly goals states
  var _sg1 = useState(function() { return loadWeeklyGoals() || []; }); var weekGoals = _sg1[0]; var setWeekGoals = _sg1[1];
  var _sg2 = useState(false); var showGoalSetup = _sg2[0]; var setShowGoalSetup = _sg2[1];
  var _sg3 = useState(false); var goalsAiLoading = _sg3[0]; var setGoalsAiLoading = _sg3[1];
  var _sg4 = useState(["", "", ""]); var goalDrafts = _sg4[0]; var setGoalDrafts = _sg4[1];
  var _sg5 = useState([3, 3, 3]); var goalTargets = _sg5[0]; var setGoalTargets = _sg5[1];
  var _sg6 = useState(null); var goalCelebration = _sg6[0]; var setGoalCelebration = _sg6[1];

  // Daily mood check-in
  var _sm1 = useState(function() {
    var key = "rw_mood_" + new Date().toISOString().split("T")[0];
    var saved = localStorage.getItem(key);
    if (saved) return false; // Already checked in today
    var hr = new Date().getHours();
    return hr >= 10; // Show after 10 AM
  }); var showMoodCheckin = _sm1[0]; var setShowMoodCheckin = _sm1[1];
  var _sm2 = useState(null); var selectedMood = _sm2[0]; var setSelectedMood = _sm2[1];
  var _sm3 = useState(""); var moodNote = _sm3[0]; var setMoodNote = _sm3[1];

  var saveMoodCheckin = function() {
    if (!selectedMood) return;
    var key = "rw_mood_" + new Date().toISOString().split("T")[0];
    var entry = { mood: selectedMood, note: moodNote, time: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(entry));
    // Save to history
    var history = loadHistory("rw_mood_history");
    history.push(Object.assign({ date: new Date().toISOString().split("T")[0] }, entry));
    if (history.length > 90) history = history.slice(-90);
    saveHistory("rw_mood_history", history);
    setShowMoodCheckin(false);
    setSelectedMood(null);
    setMoodNote("");
    triggerConfetti();
    var responses = {
      amazing: "You're radiating today! Keep that energy going! ☀️🐰",
      good: "That's what we like to hear! Have a great day! 💚",
      okay: "Okay is okay. Small wins today — take your supplements and go for a walk. 🌿",
      low: "Hey, it's okay to feel low. Be gentle with yourself. Maybe call Bunny? 🐰💚",
      rough: "Sending you the biggest hug. You're not alone. Bunny is here. Call him? 🤗❤️"
    };
    flash(responses[selectedMood] || "Thanks for checking in! 💚");
  };

  // Wednesday Vitamin D reminder
  var _svd = useState(function() {
    var today = new Date();
    if (today.getDay() !== 3) return false; // Not Wednesday
    var key = "rw_vitd_wed_" + today.toISOString().split("T")[0];
    return !localStorage.getItem(key); // Show if not dismissed today
  }); var showVitDWed = _svd[0]; var setShowVitDWed = _svd[1];

  var dismissVitDWed = function(taken) {
    if (taken) {
      var key = "rw_vitd_wed_" + new Date().toISOString().split("T")[0];
      localStorage.setItem(key, "taken");
    } else {
      // "Later" - show again after 2 hours
      setTimeout(function() { setShowVitDWed(true); }, 2 * 60 * 60 * 1000);
    }
    setShowVitDWed(false);
    if (taken) {
      // Also mark supplement as done
      toggleSupp(0);
      var newDoses = vitdDoses + 1;
      setVitdDoses(newDoses);
      localStorage.setItem("rw_vitd_doses", String(newDoses));
      flash("☀️ Vitamin D taken! You're getting stronger every week! 💪🐰");
    }
  };

  // Period tracker states
  var _sc1 = useState(function() { return loadHistory("rw_periods") || []; }); var periods = _sc1[0]; var setPeriods = _sc1[1];
  var _sc2 = useState(false); var showLogPeriod = _sc2[0]; var setShowLogPeriod = _sc2[1];
  var _sc3 = useState(""); var periodStartDate = _sc3[0]; var setPeriodStartDate = _sc3[1];
  var _sc4 = useState("5"); var periodLength = _sc4[0]; var setPeriodLength = _sc4[1];
  var _sc5 = useState(null); var cycleAiTip = _sc5[0]; var setCycleAiTip = _sc5[1];
  var _sc6 = useState(false); var cycleAiLoading = _sc6[0]; var setCycleAiLoading = _sc6[1];
  var _s10 = useState(function() {
    var saved = localStorage.getItem("rw_vitd_weeks");
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return []; }
    }
    return [];
  }); var vitdWeeks = _s10[0]; var setVitdWeeks = _s10[1];
  var vitdDoses = vitdWeeks.length;

  useEffect(function() { setTimeout(function() { setLoaded(true); }, 100); }, []);

  // Persist supplements
  useEffect(function() {
    var doneStates = supps.map(function(s) { return s.done; });
    saveToday("rw_supps", doneStates);
  }, [supps]);

  // Persist weekly goals
  useEffect(function() {
    if (weekGoals.length > 0) saveWeeklyGoals(weekGoals);
  }, [weekGoals]);

  // Persist meals and archive to history
  useEffect(function() {
    saveToday("rw_meals", meals);
    archiveDay(meals, supps);
  }, [meals, supps]);

  var searchRecipeWith = async function(query) {
    if (!query.trim()) return;
    setKitchenLoading(true); setKitchenRecipe(null);
    var prompt = "Radhika wants to cook: \"" + query + "\". Give her a recipe that's healthy and suits her health (low inflammation, high protein, vitamin D friendly). She loves Indian food. Keep it practical with common Indian kitchen ingredients. Respond as JSON: {\"name\":\"dish name\",\"emoji\":\"one emoji\",\"time\":\"cook time\",\"calories\":number per serving,\"protein\":number grams per serving,\"ingredients\":[\"qty ingredient\"],\"steps\":[\"step 1\",\"step 2\"],\"healthNote\":\"1-2 sentence note about how this helps her health, be funny and reference Bunny or her interests\"}";
    var result = await askAI(prompt);
    if (result && result.name) { setKitchenRecipe(result); }
    else { setKitchenRecipe({ name: "Oops!", emoji: "😅", healthNote: "Couldn't find a recipe. Try something like 'healthy chicken recipe' or 'high protein breakfast'." }); }
    setKitchenLoading(false);
  };

  var searchRecipe = function() { searchRecipeWith(kitchenQuery); };

  var savePeriod = function() {
    if (!periodStartDate) return;
    var entry = { start: periodStartDate, length: parseInt(periodLength) || 5, logged: getTodayKey() };
    var updated = periods.concat([entry]);
    setPeriods(updated);
    saveHistory("rw_periods", updated);
    setShowLogPeriod(false);
    setPeriodStartDate("");
    setPeriodLength("5");
    flash("🌸 Period logged! Take care of yourself ❤️");
  };

  var incrementGoal = function(idx) {
    setWeekGoals(function(prev) {
      return prev.map(function(g, i) {
        if (i !== idx) return g;
        var newCount = Math.min(g.current + 1, g.target);
        var updated = Object.assign({}, g, { current: newCount });
        // Celebration when goal is completed
        if (newCount === g.target && g.current < g.target) {
          setGoalCelebration(g.name);
          setTimeout(function() { setGoalCelebration(null); }, 3000);
        }
        return updated;
      });
    });
  };

  var decrementGoal = function(idx) {
    setWeekGoals(function(prev) {
      return prev.map(function(g, i) {
        if (i !== idx) return g;
        return Object.assign({}, g, { current: Math.max(g.current - 1, 0) });
      });
    });
  };

  var saveNewGoals = function() {
    var goals = goalDrafts.map(function(name, i) {
      return { name: name.trim(), target: goalTargets[i], current: 0 };
    }).filter(function(g) { return g.name.length > 0; });
    if (goals.length === 0) return;
    setWeekGoals(goals);
    setShowGoalSetup(false);
  };

  var suggestGoalsAI = async function() {
    setGoalsAiLoading(true);
    var suppsDoneCount = supps.filter(function(s) { return s.done; }).length;
    var prompt = "Suggest 3 small, achievable weekly health goals for Radhika. She has Vitamin D deficiency, elevated inflammation (CRP), borderline thyroid. She takes supplements (D3, B12, Iron, Omega-3, Magnesium). She loves cooking, dancing, Harry Styles, Fred Again. Current supplement streak: " + suppsDoneCount + "/" + supps.length + " today. Goals should be specific with a number target (like 'Walk after meals - 4 times'). Mix health, fun, and food goals. Respond as JSON with keys: goals (array of objects with name and target number).";
    var result = await askAI(prompt);
    if (result && result.goals) {
      setGoalDrafts(result.goals.map(function(g) { return g.name; }));
      setGoalTargets(result.goals.map(function(g) { return g.target; }));
    }
    setGoalsAiLoading(false);
  };

  var getCycleAiTip = async function(info) {
    setCycleAiLoading(true);
    var prompt = "Radhika is in her " + info.phaseLabel + " (day " + info.daysSinceLast + " of cycle, avg cycle " + info.avgCycle + " days). Give her a SHORT (2-3 sentences) personalized tip about what to eat, how to exercise, and how to feel better during this phase. Consider her health: Vitamin D deficient, elevated CRP inflammation, borderline TSH. Be warm, funny, reference Bunny or her interests. Respond as JSON: {\"tip\":\"the tip with emojis\",\"foods\":[\"food1\",\"food2\",\"food3\"],\"avoid\":[\"thing1\",\"thing2\"]}";
    var result = await askAI(prompt);
    if (result) setCycleAiTip(result);
    setCycleAiLoading(false);
  };

  var flash = function(msg) { setToast(msg); setTimeout(function() { setToast(null); }, 6000); };
  var toggleSupp = function(i) {
    setSupps(function(p) {
      var newSupps = p.map(function(s, idx) { return idx === i ? Object.assign({}, s, { done: !s.done }) : s; });
      // Confetti for any supplement taken
      if (!p[i].done) { triggerConfetti(); }
      // Track Vitamin D doses (first supplement, index 0)
      if (i === 0 && !p[0].done) {
        var weekKey = getWeekKey();
        if (vitdWeeks.indexOf(weekKey) === -1) {
          var newWeeks = vitdWeeks.concat([weekKey]);
          setVitdWeeks(newWeeks);
          localStorage.setItem("rw_vitd_weeks", JSON.stringify(newWeeks));
        }
        setShowVitdAnim(true);
        setTimeout(function() { setShowVitdAnim(false); }, 2000);
      }
      return newSupps;
    });
  };

  var logMeal = function(m) {
    setMeals(function(p) { return p.concat([m]); });
    setShowMeal(false);
    triggerConfetti();
    var WALK_NUDGES = [
      "You just ate! Time for a 10-min walk 🚶‍♀️ Put on Harry Styles and go!",
      "Post-meal walk time! Dumbledore walked the castle halls — your turn! 🏰",
      "Fred Again + fresh air = the perfect post-meal combo. Walk! 🎧🚶‍♀️",
      "10 minutes. That's all. Walk it out! Your blood sugar will thank you. ✨",
      "Taylor walks during her shows for 3 hours. You can do 10 minutes. Go! 👟",
      "Harry Styles walks his dog. Walk yourself. Post-meal. Now. 🐕🚶‍♀️",
      "Your digestive system just sent a request: WALK. Please accept. 📱🚶‍♀️",
      "Sitting after eating is SO 2024. Walking after eating is the future. 🚶‍♀️✨",
      "Put your shoes on. Open the door. Walk. Bunny's orders. 🐰👟",
      "Post-meal walk = better digestion + better mood + Bunny is proud. Triple win. 🏆",
    ];
    flash(pick(WALK_NUDGES));
  };

  var suppDone = supps.filter(function(s) { return s.done; }).length;
  var dayCal = meals.reduce(function(s, m) { return s + (m.tot && m.tot.cal ? m.tot.cal : 0); }, 0);
  var dayP = meals.reduce(function(s, m) { return s + (m.tot && m.tot.p ? m.tot.p : 0); }, 0);
  var hr = new Date().getHours();
  var greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="app-root" style={{ opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(8px)", transition: "all 0.5s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {showBreathe && <Breathe onClose={function() { setShowBreathe(false); }} />}
      {showMeal && <MealLog onSave={logMeal} onClose={function() { setShowMeal(false); }} />}
      {showChips && <ChipPopup onClose={function() { setShowChips(false); }} />}
      {toast && <div className="toast">{toast}</div>}
      {showConfetti && <Confetti />}

      {/* Wednesday Vitamin D Popup - Can't ignore! */}
      {showVitDWed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>
          <div style={{ background: "#FDFAF4", borderRadius: 28, padding: "36px 24px", maxWidth: 340, width: "90%", textAlign: "center", animation: "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #FF9500, #FFD60A)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: "0 4px 20px rgba(255,149,0,0.3)" }}>
              ☀️
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "#2A2A2A", margin: "0 0 8px" }}>It's Vitamin D Wednesday!</h2>
            <p style={{ fontSize: 14, color: "#6B6B6B", lineHeight: 1.6, margin: "0 0 8px" }}>
              Time for your <strong style={{ color: "#6E2C35" }}>weekly liquid Vitamin D3</strong> dose (60,000 IU).
            </p>
            <p style={{ fontSize: 12, color: "#B5B5B5", margin: "0 0 20px" }}>
              Your level is 32.51 — you need 75+. Every dose counts! 💪
            </p>

            <div style={{ background: "#FFF8F0", borderRadius: 14, padding: "12px 16px", marginBottom: 20, textAlign: "left" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#8B6914", margin: "0 0 6px" }}>💡 Remember:</p>
              <p style={{ fontSize: 11, color: "#6B6B6B", margin: "0 0 4px", lineHeight: 1.5 }}>• Take it with a <strong>fatty meal</strong> (ghee, butter, nuts)</p>
              <p style={{ fontSize: 11, color: "#6B6B6B", margin: "0 0 4px", lineHeight: 1.5 }}>• Don't take with tea or coffee</p>
              <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>• Morning with breakfast is ideal</p>
            </div>

            <button onClick={function() { dismissVitDWed(true); }} style={{ width: "100%", padding: 16, borderRadius: 50, border: "none", background: "linear-gradient(135deg, #FF9500, #FFD60A)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif", marginBottom: 10, boxShadow: "0 4px 16px rgba(255,149,0,0.3)" }}>
              I've taken it! ☀️✅
            </button>
            <button onClick={function() { dismissVitDWed(false); }} style={{ width: "100%", padding: 12, borderRadius: 50, border: "1.5px solid #E8E4DC", background: "none", color: "#B5B5B5", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
              Remind me later today
            </button>
            <p style={{ fontSize: 10, color: "#B5B5B5", marginTop: 12 }}>🐰 Bunny is watching. Take your Vitamin D.</p>
          </div>
        </div>
      )}

            {/* Daily Mood Check-in */}
      {showMoodCheckin && !showVitDWed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", animation: "fadeIn 0.3s ease" }}>
          <div style={{ background: "#FDFAF4", borderRadius: 28, padding: "32px 24px", maxWidth: 340, width: "90%", textAlign: "center", animation: "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <img src={BUNNY_SRC} alt="Bunny" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "3px solid #D6DEC9", margin: "0 auto 12px", display: "block", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "#2A2A2A", margin: "0 0 4px" }}>How are you feeling?</h2>
            <p style={{ fontSize: 12, color: "#B5B5B5", margin: "0 0 20px" }}>Daily check-in — Bunny wants to know 🐰</p>

            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              {[
                { key: "amazing", emoji: "🤩", label: "Amazing" },
                { key: "good", emoji: "😊", label: "Good" },
                { key: "okay", emoji: "😐", label: "Okay" },
                { key: "low", emoji: "😔", label: "Low" },
                { key: "rough", emoji: "😢", label: "Rough" },
              ].map(function(m) {
                var isSelected = selectedMood === m.key;
                return (
                  <button key={m.key} onClick={function() { setSelectedMood(m.key); }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      padding: "10px 6px", borderRadius: 16, border: "none", cursor: "pointer",
                      background: isSelected ? (m.key === "rough" || m.key === "low" ? "#F5E1E4" : "#EFF3E8") : "transparent",
                      transform: isSelected ? "scale(1.15)" : "scale(1)",
                      transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}>
                    <span style={{ fontSize: 28 }}>{m.emoji}</span>
                    <span style={{ fontSize: 9, color: isSelected ? "#2A2A2A" : "#B5B5B5", fontWeight: isSelected ? 600 : 400 }}>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedMood && (
              <>
                <input
                  value={moodNote}
                  onChange={function(e) { setMoodNote(e.target.value); }}
                  placeholder="Want to say more? (optional)"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid #E8E4DC", fontSize: 13, fontFamily: "'Outfit',sans-serif", background: "#FFFDF8", outline: "none", marginBottom: 16, boxSizing: "border-box", textAlign: "center" }}
                />
                <button onClick={saveMoodCheckin} style={{ width: "100%", padding: 14, borderRadius: 50, border: "none", background: "#606B4E", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", boxShadow: "0 4px 12px rgba(96,107,78,0.25)" }}>
                  Save Check-in 💚
                </button>
              </>
            )}

            <button onClick={function() { setShowMoodCheckin(false); }} style={{ background: "none", border: "none", color: "#B5B5B5", fontSize: 12, cursor: "pointer", marginTop: 12, fontFamily: "'Outfit',sans-serif" }}>
              Not now
            </button>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-top"><span className="header-brand">🌿</span></div>
        <h1 className="header-greeting">{greet}, Radhika</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "0 0 8px", fontFamily: "'Outfit',sans-serif", letterSpacing: 0.5 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
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

                        {/* Weekly Goals */}
            {weekGoals.length > 0 ? (
              <div style={{ background: C.warm, borderRadius: 20, padding: "18px 16px", marginBottom: 20, border: "1px solid " + C.sand }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, color: C.charcoal }}>This Week's Goals 🎯</span>
                  <span style={{ fontSize: 10, color: C.mist }}>{getWeekKey()}</span>
                </div>
                {weekGoals.map(function(goal, i) {
                  var pct = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
                  var isDone = goal.current >= goal.target;
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: isDone ? C.olive : C.charcoal, fontWeight: isDone ? 600 : 400, textDecoration: isDone ? "line-through" : "none" }}>
                          {isDone ? "✅ " : ""}{goal.name}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={function() { decrementGoal(i); }} disabled={goal.current <= 0} style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid " + C.sand, background: C.cream, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.stone }}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? C.olive : C.burg, minWidth: 32, textAlign: "center" }}>{goal.current}/{goal.target}</span>
                          <button onClick={function() { incrementGoal(i); }} disabled={isDone} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: isDone ? C.sand : C.olive, fontSize: 14, cursor: isDone ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>+</button>
                        </div>
                      </div>
                      <div style={{ height: 6, background: C.sand, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, background: isDone ? C.olive : "linear-gradient(90deg, " + C.burg + ", " + C.gold + ")", width: pct + "%", transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                      </div>
                    </div>
                  );
                })}
                {weekGoals.every(function(g) { return g.current >= g.target; }) && (
                  <div style={{ textAlign: "center", padding: "8px 0 4px", color: C.olive, fontSize: 13, fontWeight: 600 }}>
                    🎉 All goals smashed this week! Bunny is SO proud! 🐰
                  </div>
                )}
                <button onClick={function() { setShowGoalSetup(true); setGoalDrafts(weekGoals.map(function(g) { return g.name; })); setGoalTargets(weekGoals.map(function(g) { return g.target; })); }} style={{ background: "none", border: "none", fontSize: 11, color: C.mist, cursor: "pointer", marginTop: 4, fontFamily: "'Outfit',sans-serif" }}>Edit goals</button>
              </div>
            ) : (
              <button onClick={function() { setShowGoalSetup(true); setGoalDrafts(["", "", ""]); setGoalTargets([3, 3, 3]); }} style={{ width: "100%", background: "linear-gradient(140deg, " + C.oliveGhost + ", " + C.warm + ")", border: "1.5px dashed " + C.olivePale + "", borderRadius: 20, padding: "20px 16px", cursor: "pointer", marginBottom: 20, textAlign: "center" }}>
                <p style={{ fontSize: 16, margin: "0 0 4px", fontFamily: "'Cormorant Garamond',serif", color: C.olive }}>🎯 Set This Week's Goals</p>
                <p style={{ fontSize: 12, color: C.stone, margin: 0 }}>Pick 3 small goals to work towards</p>
              </button>
            )}

            {/* Goal celebration toast */}
            {goalCelebration && (
              <div className="toast" style={{ background: "linear-gradient(135deg, " + C.olive + ", " + C.oliveMid + ")" }}>
                🎉 Goal completed: "{goalCelebration}"! You're amazing! 🐰✨
              </div>
            )}

            {/* Goal setup modal */}
            {showGoalSetup && (
              <div className="overlay">
                <div style={{ background: C.cream, borderRadius: 28, padding: "28px 22px", maxWidth: 380, width: "92%", maxHeight: "85vh", overflowY: "auto" }}>
                  <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: C.olive, margin: "0 0 4px", textAlign: "center" }}>🎯 Weekly Goals</h3>
                  <p style={{ fontSize: 12, color: C.stone, textAlign: "center", marginBottom: 16 }}>Set 3 small goals for this week</p>

                  <button onClick={suggestGoalsAI} className="btn-primary" style={{ width: "100%", marginBottom: 16, fontSize: 13, padding: "12px 0" }} disabled={goalsAiLoading}>
                    {goalsAiLoading ? "⏳ AI is thinking..." : "🤖 Suggest goals with AI"}
                  </button>

                  {[0, 1, 2].map(function(i) {
                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, color: C.stone, display: "block", marginBottom: 4 }}>Goal {i + 1}</label>
                        <input
                          value={goalDrafts[i] || ""}
                          onChange={function(e) { setGoalDrafts(function(prev) { var n = prev.slice(); n[i] = e.target.value; return n; }); }}
                          placeholder={["e.g. Walk after meals", "e.g. Sleep by 11 PM", "e.g. Try a new recipe"][i]}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid " + C.sand, fontSize: 14, fontFamily: "'Outfit',sans-serif", background: C.warm, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.stone }}>Target:</span>
                          {[1, 2, 3, 4, 5, 6, 7].map(function(n) {
                            return (
                              <button key={n} onClick={function() { setGoalTargets(function(prev) { var t = prev.slice(); t[i] = n; return t; }); }}
                                style={{ width: 28, height: 28, borderRadius: "50%", border: goalTargets[i] === n ? "2px solid " + C.olive : "1px solid " + C.sand, background: goalTargets[i] === n ? C.oliveGhost : C.warm, color: goalTargets[i] === n ? C.olive : C.stone, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {n}
                              </button>
                            );
                          })}
                          <span style={{ fontSize: 10, color: C.mist }}>times</span>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={function() { setShowGoalSetup(false); }} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={saveNewGoals} className="btn-primary" style={{ flex: 1 }}>Save Goals 🎯</button>
                  </div>
                </div>
              </div>
            )}

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

            <VitDMeter weeks={Math.min(vitdDoses, 12)} />
            {showVitdAnim && <div className="toast" style={{ background: "linear-gradient(135deg, #D4930D, #4A8B3A)" }}>☀️ Vitamin D taken! You're {Math.min(Math.round((vitdDoses/12)*100), 100)}% through your recovery! Keep going! 💪</div>}

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

        {tab === "reports" && (
          <div className="fade-in">
            <h3 className="section-title">Weekly Report 📊</h3>
            <button onClick={function() {
              archiveDay(meals, supps);
              flash("📊 Reports refreshed with latest data!");
            }} style={{ background: "none", border: "none", fontSize: 11, color: C.mist, cursor: "pointer", fontFamily: "'Outfit',sans-serif", marginBottom: 8 }}>↻ Refresh data</button>
            <p className="hint" style={{ marginBottom: 20 }}>Your progress over the past days</p>

            {(function() {
              var history = loadHistory("rw_history");
              var last7 = history.slice(-7);

              if (last7.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: C.stone }}>
                    <p style={{ fontSize: 40, marginBottom: 12 }}>📊</p>
                    <p style={{ fontSize: 14 }}>No data yet! Start logging meals and your chart will appear here.</p>
                  </div>
                );
              }

              var maxCal = Math.max.apply(null, last7.map(function(d) { return d.calories || 1; }));
              var maxP = Math.max.apply(null, last7.map(function(d) { return d.protein || 1; }));
              var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

              return (
                <>
                  {/* Protein Chart */}
                  <div style={{ background: C.warm, borderRadius: 20, padding: "20px 16px", marginBottom: 16, border: "1px solid " + C.sand }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: C.charcoal }}>🥚 Daily Protein (g)</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {last7.map(function(d, i) {
                        var maxProtein = Math.max.apply(null, last7.map(function(x) { return x.protein || 0; }).concat([70]));
                        var barH = Math.max(Math.round((d.protein / maxProtein) * 100), 4);
                        var dayName = days[new Date(d.date).getDay()];
                        var isGood = d.protein >= 50;
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 140 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: isGood ? C.olive : C.burg, marginBottom: 4 }}>{d.protein}g</span>
                            <div style={{ width: "80%", height: barH + "px", minHeight: 4, background: isGood ? "linear-gradient(180deg, " + C.olive + ", " + C.oliveMid + ")" : "linear-gradient(180deg, " + C.burg + ", " + C.burgLight + ")", borderRadius: 6, transition: "height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                            <span style={{ fontSize: 9, color: C.mist, marginTop: 4 }}>{dayName}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: C.mist }}>Target: 60-70g/day</span>
                      <span style={{ fontSize: 10, color: C.olive }}>Green = 50g+</span>
                    </div>
                  </div>

                  {/* Calories Chart */}
                  <div style={{ background: C.warm, borderRadius: 20, padding: "20px 16px", marginBottom: 16, border: "1px solid " + C.sand }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: C.charcoal }}>🔥 Daily Calories</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {last7.map(function(d, i) {
                        var maxCalories = Math.max.apply(null, last7.map(function(x) { return x.calories || 0; }).concat([1]));
                        var barH = Math.max(Math.round((d.calories / maxCalories) * 100), 4);
                        var dayName = days[new Date(d.date).getDay()];
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 140 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.burg, marginBottom: 4 }}>{d.calories}</span>
                            <div style={{ width: "80%", height: barH + "px", minHeight: 4, background: "linear-gradient(180deg, " + C.burg + ", " + C.burgLight + ")", borderRadius: 6, transition: "height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                            <span style={{ fontSize: 9, color: C.mist, marginTop: 4 }}>{dayName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Supplements Streak */}
                  <div style={{ background: C.warm, borderRadius: 20, padding: "20px 16px", marginBottom: 16, border: "1px solid " + C.sand }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.charcoal }}>💊 Supplement Streak</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {last7.map(function(d, i) {
                        var parts = (d.supplements || "0/5").split("/");
                        var done = parseInt(parts[0]);
                        var total = parseInt(parts[1]);
                        var allDone = done === total;
                        var dayName = days[new Date(d.date).getDay()];
                        return (
                          <div key={i} style={{ flex: 1, textAlign: "center" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, background: allDone ? C.olive : d.done > 0 ? C.oliveGhost : C.sand, color: allDone ? "#fff" : C.stone }}>
                              {allDone ? "✓" : done}
                            </div>
                            <span style={{ fontSize: 9, color: C.mist }}>{dayName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mood Tracker */}
                  {(function() {
                    var moodHistory = loadHistory("rw_mood_history");
                    var last7 = moodHistory.slice(-7);
                    if (last7.length === 0) return null;
                    var moodEmojis = { amazing: "🤩", good: "😊", okay: "😐", low: "😔", rough: "😢" };
                    var moodScores = { amazing: 5, good: 4, okay: 3, low: 2, rough: 1 };
                    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

                    return (
                      <div style={{ background: C.warm, borderRadius: 20, padding: "20px 16px", marginBottom: 16, border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.charcoal }}>😊 Mood This Week</p>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {last7.map(function(d, i) {
                            var dayName = days[new Date(d.date).getDay()];
                            var isActive = tappedMood === i;
                            return (
                              <div key={i} onClick={function() { setTappedMood(isActive ? null : i); }} style={{ flex: 1, textAlign: "center", cursor: "pointer", transition: "transform 0.2s", transform: isActive ? "scale(1.15)" : "scale(1)" }}>
                                <span style={{ fontSize: 24, display: "block", marginBottom: 4 }}>{moodEmojis[d.mood] || "😐"}</span>
                                <span style={{ fontSize: 9, color: C.mist }}>{dayName}</span>
                              </div>
                            );
                          })}
                        </div>
                        {tappedMood !== null && last7[tappedMood] && (
                          <div style={{ marginTop: 12, padding: "10px 14px", background: C.oliveGhost, borderRadius: 12, animation: "fadeUp 0.3s ease" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.charcoal }}>
                                {new Date(last7[tappedMood].date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                              </span>
                              <span style={{ fontSize: 18 }}>{moodEmojis[last7[tappedMood].mood]}</span>
                            </div>
                            {last7[tappedMood].note ? (
                              <p style={{ fontSize: 12, color: C.stone, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{last7[tappedMood].note}"</p>
                            ) : (
                              <p style={{ fontSize: 11, color: C.mist, margin: 0 }}>No note for this day</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Vitamin D Progress */}
                  <VitDMeter weeks={Math.min(vitdDoses, 12)} />
                </>
              );
            })()}

            <BunnyTip />
          </div>
        )}

        {tab === "kitchen" && (
          <div className="fade-in">
            <h3 className="section-title">Radhika's Kitchen 🧑‍🍳</h3>
            <p className="hint" style={{ marginBottom: 16 }}>Tell me what you're craving, I'll find you a recipe!</p>

            {/* Search */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={kitchenQuery}
                onChange={function(e) { setKitchenQuery(e.target.value); }}
                onKeyDown={function(e) { if (e.key === "Enter") searchRecipe(); }}
                placeholder="I want something spicy with chicken..."
                className="meal-input"
                disabled={kitchenLoading}
              />
              <button onClick={searchRecipe} className="btn-primary" style={{ padding: "0 20px", fontSize: 14 }} disabled={kitchenLoading}>
                {kitchenLoading ? "⏳" : "🔍"}
              </button>
            </div>

            {/* Quick mood buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {["high protein dinner", "quick healthy breakfast", "chicken recipe", "soya chop ideas", "comfort food but healthy", "something sweet but not junk", "easy dal recipe", "low calorie snack"].map(function(q) {
                return <button key={q} onClick={function() { setKitchenQuery(q); }} className="chip-btn" disabled={kitchenLoading}>{q}</button>;
              })}
            </div>

            {kitchenLoading && (
              <div style={{ textAlign: "center", padding: "30px 0", color: C.olive }}>
                <p style={{ fontSize: 16 }}>🧑‍🍳 Chef AI is cooking up ideas...</p>
                <p style={{ fontSize: 11, color: C.mist, marginTop: 4 }}>Finding the perfect recipe for you</p>
              </div>
            )}

            {/* Recipe result */}
            {kitchenRecipe && !kitchenLoading && (
              <div style={{ background: C.warm, borderRadius: 20, padding: "20px 18px", border: "1px solid " + C.sand, marginBottom: 16 }}>
                <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: C.charcoal, margin: "0 0 4px" }}>{kitchenRecipe.name} {kitchenRecipe.emoji || "🍽️"}</h4>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {kitchenRecipe.time && <span className="tip-tag">⏱️ {kitchenRecipe.time}</span>}
                  {kitchenRecipe.calories && <span className="tip-tag" style={{ background: C.burgGhost, color: C.burg }}>🔥 {kitchenRecipe.calories} cal</span>}
                  {kitchenRecipe.protein && <span className="tip-tag">💪 {kitchenRecipe.protein}g protein</span>}
                </div>

                {kitchenRecipe.ingredients && (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.olive, marginBottom: 6 }}>Ingredients</p>
                    {kitchenRecipe.ingredients.map(function(ing, i) {
                      return <p key={i} style={{ fontSize: 12.5, color: C.stone, margin: "2px 0", lineHeight: 1.5 }}>• {ing}</p>;
                    })}
                  </>
                )}

                {kitchenRecipe.steps && (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.olive, margin: "14px 0 6px" }}>Steps</p>
                    {kitchenRecipe.steps.map(function(step, i) {
                      return <p key={i} style={{ fontSize: 12.5, color: C.charcoal, margin: "4px 0", lineHeight: 1.6 }}><strong style={{ color: C.olive }}>{i + 1}.</strong> {step}</p>;
                    })}
                  </>
                )}

                {kitchenRecipe.healthNote && (
                  <div style={{ background: C.oliveGhost, borderRadius: 12, padding: "10px 14px", marginTop: 14, fontSize: 12, color: C.olive, lineHeight: 1.5 }}>
                    🤖 {kitchenRecipe.healthNote}
                  </div>
                )}
              </div>
            )}

            {/* Auto suggestions */}
            <h3 className="section-title" style={{ marginTop: 8 }}>Radhika's Favourites ❤️</h3>
            {[
              { name: "Chicken Biryani (Healthier)", desc: "Your fave but lighter — less oil, more protein, with raita", emoji: "🍗", q: "healthy chicken biryani recipe with less oil" },
              { name: "Soya Chop", desc: "Crispy outside, protein-packed inside — perfect snack", emoji: "🫘", q: "crispy soya chop recipe" },
              { name: "Idli Sambhar", desc: "Classic comfort — fermented goodness + protein-rich sambhar", emoji: "🥣", q: "soft idli with protein rich sambhar recipe" },
              { name: "High Protein Dal", desc: "Moong dal with tadka — easy, quick, 20g+ protein per bowl", emoji: "🥘", q: "high protein moong dal tadka recipe" },
              { name: "Chicken Tikka", desc: "Tandoori-style in oven — 22g protein per serving, low carb", emoji: "🍢", q: "easy oven chicken tikka recipe" },
              { name: "Protein Shake Recipes", desc: "Quick shakes with 25g+ protein — chocolate, banana, peanut butter", emoji: "🥤", q: "high protein shake recipe with banana and peanut butter" },
            ].map(function(fav, i) {
              return (
                <button key={i} onClick={function() { setKitchenQuery(fav.q); searchRecipeWith(fav.q); }} className="fav-recipe-card" style={{ animationDelay: (i * 0.05) + "s" }}>
                  <span style={{ fontSize: 24 }}>{fav.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: C.charcoal }}>{fav.name}</p>
                    <p style={{ fontSize: 11, color: C.stone, margin: "2px 0 0", lineHeight: 1.4 }}>{fav.desc}</p>
                  </div>
                  <span style={{ fontSize: 14, color: C.oliveMid }}>→</span>
                </button>
              );
            })}

            <BunnyTip />
          </div>
        )}

        {tab === "cycle" && (
          <div className="fade-in">
            <h3 className="section-title">Cycle Tracker 🌸</h3>

            {(function() {
              var info = getCycleInfo(periods);

              if (!info) {
                return (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <p style={{ fontSize: 48, marginBottom: 12 }}>🌸</p>
                    <p style={{ fontSize: 15, color: C.charcoal, fontWeight: 600, marginBottom: 8 }}>No periods logged yet</p>
                    <p style={{ fontSize: 12, color: C.stone, marginBottom: 20 }}>Log your last period to start tracking your cycle</p>
                    <button onClick={function() { setShowLogPeriod(true); }} className="btn-primary">Log Period 🌸</button>
                  </div>
                );
              }

              return (
                <>
                  {/* Current Phase Card */}
                  <div style={{ background: "linear-gradient(140deg, " + info.phaseColor + ", " + info.phaseColor + "CC)", borderRadius: 20, padding: "24px 20px", marginBottom: 16, color: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>Current Phase</p>
                        <p style={{ fontSize: 22, fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, margin: "4px 0 0" }}>{info.phaseEmoji} {info.phaseLabel}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Day {info.daysSinceLast}</p>
                        <p style={{ fontSize: 11, opacity: 0.8, margin: 0 }}>of ~{info.avgCycle} day cycle</p>
                      </div>
                    </div>

                    {/* Cycle progress bar */}
                    <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, height: 8, marginBottom: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 8, background: "rgba(255,255,255,0.7)", width: Math.min((info.daysSinceLast / info.avgCycle) * 100, 100) + "%", transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.7 }}>
                      <span>Period</span>
                      <span>Follicular</span>
                      <span>Ovulation</span>
                      <span>Luteal</span>
                    </div>
                  </div>

                  {/* Prediction Card */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: C.warm, borderRadius: 16, padding: "16px 14px", border: "1px solid " + C.sand, textAlign: "center" }}>
                      <p style={{ fontSize: 24, fontWeight: 700, color: C.burg, margin: 0 }}>{info.daysUntilNext}</p>
                      <p style={{ fontSize: 11, color: C.stone, margin: "4px 0 0" }}>days until next period</p>
                    </div>
                    <div style={{ background: C.warm, borderRadius: 16, padding: "16px 14px", border: "1px solid " + C.sand, textAlign: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.olive, margin: 0 }}>{new Date(info.nextDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      <p style={{ fontSize: 11, color: C.stone, margin: "4px 0 0" }}>predicted next date</p>
                    </div>
                  </div>

                  {/* AI phase tip */}
                  <div style={{ background: C.oliveGhost, borderRadius: 16, padding: "16px", marginBottom: 16, border: "1px dashed " + C.olivePale }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.olive }}>🤖 AI Tips for {info.phaseLabel}</span>
                      <button onClick={function() { getCycleAiTip(info); }} className="bunny-refresh" disabled={cycleAiLoading}>{cycleAiLoading ? "⏳" : "↻"}</button>
                    </div>
                    {cycleAiLoading ? (
                      <p style={{ fontSize: 12, color: C.stone }}>Generating personalized tips...</p>
                    ) : cycleAiTip ? (
                      <>
                        <p style={{ fontSize: 13, color: C.charcoal, lineHeight: 1.6, marginBottom: 10 }}>{cycleAiTip.tip}</p>
                        {cycleAiTip.foods && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.olive }}>Eat: </span>
                            {cycleAiTip.foods.map(function(f, i) { return <span key={i} className="tip-tag" style={{ marginRight: 4, marginBottom: 4, display: "inline-block" }}>{f}</span>; })}
                          </div>
                        )}
                        {cycleAiTip.avoid && (
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.burg }}>Avoid: </span>
                            {cycleAiTip.avoid.map(function(f, i) { return <span key={i} className="tip-tag" style={{ background: C.burgGhost, color: C.burg, marginRight: 4, marginBottom: 4, display: "inline-block" }}>{f}</span>; })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: 12, color: C.stone }}>Tap ↻ to get AI tips for your current phase</p>
                    )}
                  </div>

                  {/* Phase Guide */}
                  <h3 className="section-title">Cycle Phases Guide 📖</h3>
                  {[
                    { emoji: "🌸", name: "Period (Day 1-5)", desc: "Rest more, eat iron-rich foods (spinach, dal, eggs). Light walks only. Your body is shedding — be gentle.", color: C.burg },
                    { emoji: "🌱", name: "Follicular (Day 6-13)", desc: "Energy is rising! Great time for workouts, cooking experiments, and being social. Protein up!", color: C.olive },
                    { emoji: "✨", name: "Ovulation (Day 14-16)", desc: "Peak energy and mood. Best time for intense workouts and social plans. You'll feel amazing.", color: "#D4930D" },
                    { emoji: "🍂", name: "Luteal (Day 17-28)", desc: "Energy dips. Cravings hit. More rest, magnesium-rich foods, gentle exercise. Don't stress about cravings.", color: "#8B6914" },
                  ].map(function(p, i) {
                    var isActive = (p.name.toLowerCase().indexOf(info.phase) !== -1) || (info.phase === "period" && i === 0) || (info.phase === "follicular" && i === 1) || (info.phase === "ovulation" && i === 2) || (info.phase === "luteal" && i === 3);
                    return (
                      <div key={i} style={{ background: isActive ? p.color + "11" : C.warm, borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: isActive ? "2px solid " + p.color : "1px solid " + C.sand }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: p.color }}>{p.emoji} {p.name} {isActive ? " ← You're here" : ""}</p>
                        <p style={{ fontSize: 12, color: C.stone, margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
                      </div>
                    );
                  })}

                  {/* History */}
                  <h3 className="section-title" style={{ marginTop: 20 }}>Past Periods 📅</h3>
                  {info.history.slice(0, 6).map(function(p, i) {
                    var startD = new Date(p.start);
                    return (
                      <div key={i} className="health-row">
                        <span className="health-name">{startD.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="health-val">{p.length} days</span>
                      </div>
                    );
                  })}

                  <button onClick={function() { setShowLogPeriod(true); }} className="btn-primary" style={{ width: "100%", marginTop: 16 }}>Log New Period 🌸</button>
                </>
              );
            })()}

            {/* Log Period Modal */}
            {showLogPeriod && (
              <div className="overlay">
                <div style={{ background: C.cream, borderRadius: 28, padding: "32px 24px", maxWidth: 340, width: "90%", textAlign: "center" }}>
                  <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: C.burg, marginBottom: 4 }}>Log Period 🌸</p>
                  <p style={{ fontSize: 12, color: C.stone, marginBottom: 20 }}>When did your last period start?</p>

                  <div style={{ marginBottom: 16, textAlign: "left" }}>
                    <label style={{ fontSize: 12, color: C.stone, display: "block", marginBottom: 4 }}>Start Date</label>
                    <input type="date" value={periodStartDate} onChange={function(e) { setPeriodStartDate(e.target.value); }}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid " + C.sand, fontSize: 14, fontFamily: "'Outfit',sans-serif", background: C.warm, outline: "none" }} />
                  </div>

                  <div style={{ marginBottom: 20, textAlign: "left" }}>
                    <label style={{ fontSize: 12, color: C.stone, display: "block", marginBottom: 4 }}>How many days did it last?</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["3", "4", "5", "6", "7"].map(function(d) {
                        return (
                          <button key={d} onClick={function() { setPeriodLength(d); }}
                            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: periodLength === d ? "2px solid " + C.burg : "1px solid " + C.sand, background: periodLength === d ? C.burgGhost : C.warm, color: periodLength === d ? C.burg : C.stone, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={savePeriod} disabled={!periodStartDate} className="btn-primary" style={{ width: "100%", marginBottom: 8, background: periodStartDate ? C.burg : C.sand }}>Save 🌸</button>
                  <button onClick={function() { setShowLogPeriod(false); }} className="btn-ghost">Cancel</button>
                </div>
              </div>
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
            {/* Wellness Tips */}
            <h3 className="section-title" style={{ marginTop: 28 }}>Wellness Tips ✨</h3>
            {[
              { e: "☀️", t: "Morning Sunlight", d: "20-30 min before 10 AM. No sunscreen on arms. Most important for Vitamin D." },
              { e: "🚶‍♀️", t: "Walk After Every Meal", d: "10-15 min post-meal walks. Put on Fred Again or Harry Styles and go." },
              { e: "🍳", t: "Protein at Every Meal", d: "Aim for 60-70g daily. Eggs, dal, paneer, chicken, curd." },
              { e: "🫁", t: "Breathe When Stressed", d: "Your hs-CRP is elevated. Stress makes inflammation worse. Use 4-7-8." },
              { e: "💃", t: "Dance > Stress Eating", d: "When you want chips, dance for 5 minutes instead!" },
              { e: "🍵", t: "No Chai With Iron", d: "Tea blocks iron absorption. Take iron with nimbu pani. Wait 2 hrs." },
              { e: "🌙", t: "Sleep by 11 PM", d: "Your borderline TSH needs good sleep. Screen off by 10:30." },
            ].map(function(tip, i) {
              return (
                <div key={i} className="tip-card" style={{ animationDelay: (i * 0.05) + "s" }}>
                  <span className="tip-emoji">{tip.e}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="tip-title">{tip.t}</p>
                    <p className="tip-desc">{tip.d}</p>
                  </div>
                </div>
              );
            })}

            <BunnyTip />

            {/* History */}
            {(function() {
              var history = loadHistory("rw_history");
              if (history.length === 0) return null;
              return (
                <>
                  <h3 className="section-title" style={{ marginTop: 28 }}>Past Days 📅</h3>
                  {history.slice().reverse().slice(0, 14).map(function(day, i) {
                    return (
                      <div key={i} className="health-row" style={{ borderBottom: "1px solid " + C.sand, padding: "10px 0" }}>
                        <span className="health-name">{day.date}</span>
                        <span style={{ fontSize: 12, color: C.olive }}>{day.calories} cal</span>
                        <span style={{ fontSize: 12, color: C.stone }}>{day.protein}g P</span>
                        <span style={{ fontSize: 12, color: C.oliveMid }}>💊 {day.supplements}</span>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}

        
      </main>

      <nav className="bottom-nav">
        {[["home", "🏠", "Home"], ["reports", "📊", "Reports"], ["kitchen", "🧑‍🍳", "Kitchen"], ["cycle", "🌸", "Cycle"], ["health", "🩺", "Health"]].map(function(t) {
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
        html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}\
        ::-webkit-scrollbar{display:none}\
        .app-root{font-family:'Outfit',sans-serif;background:" + C.cream + ";min-height:100vh;max-width:430px;margin:0 auto;position:relative;color:" + C.charcoal + "}\
        .header{background:linear-gradient(160deg," + C.oliveDeep + " 0%," + C.olive + " 50%," + C.oliveMid + " 100%);padding:52px 24px 36px;border-radius:0 0 32px 32px;position:relative;overflow:hidden}\
        .header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.05)}\
        .header::after{content:'';position:absolute;bottom:-30px;left:20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.03)}\
        .header-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}\
        .header-brand{font-size:22}\
        .header-greeting{font-family:'Cormorant Garamond',serif;color:#fff;font-size:28px;font-weight:500;margin:0 0 6px;line-height:1.15;letter-spacing:-0.3px}\
        .header-quote{font-family:'Cormorant Garamond',serif;font-style:italic;color:" + C.olivePale + ";font-size:14px;line-height:1.5;margin:0;opacity:0.75;letter-spacing:0.2px}\
        .content{padding:20px 16px 110px}\
        .stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px}\
        .stat-card{background:" + C.warm + ";border-radius:20px;padding:18px 10px;text-align:center;border:none;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.02)}\
        .stat-ring{width:54px;height:54px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;margin-bottom:8px;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1)}\
        .stat-label{font-size:10px;color:" + C.mist + ";display:block;letter-spacing:0.5px;text-transform:uppercase;font-weight:500}\
        .action-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px}\
        .action-card{border:none;border-radius:22px;padding:18px 14px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:4px;transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06)}\
        .action-card:active{transform:scale(0.94);box-shadow:0 1px 4px rgba(0,0,0,0.08)}\
        .action-burg{background:linear-gradient(150deg," + C.burg + " 0%," + C.burgLight + " 100%);color:#fff;box-shadow:0 4px 16px rgba(110,44,53,0.2)}\
        .action-olive{background:linear-gradient(150deg," + C.olive + " 0%," + C.oliveMid + " 100%);color:#fff;box-shadow:0 4px 16px rgba(96,107,78,0.2)}\
        .action-bunny{background:linear-gradient(150deg," + C.gold + " 0%," + C.goldLight + " 100%);color:#fff;box-shadow:0 4px 16px rgba(196,147,85,0.25)}\
        .action-outline-burg{background:" + C.warm + ";border:none;color:" + C.burg + ";box-shadow:0 1px 3px rgba(0,0,0,0.04),inset 0 0 0 1.5px " + C.burgPale + "}\
        .action-outline-olive{background:" + C.warm + ";border:none;color:" + C.olive + ";box-shadow:0 1px 3px rgba(0,0,0,0.04),inset 0 0 0 1.5px " + C.olivePale + "}\
        .action-outline-warm{background:" + C.warm + ";border:none;color:" + C.stone + ";box-shadow:0 1px 3px rgba(0,0,0,0.04),inset 0 0 0 1.5px " + C.sand + "}\
        .action-emoji{font-size:20}\
        .action-title{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;letter-spacing:-0.2px}\
        .action-sub{font-size:10px;opacity:0.7}\
        .action-outline-burg .action-sub,.action-outline-olive .action-sub,.action-outline-warm .action-sub{color:" + C.stone + "}\
        .bunny-tip-card{background:linear-gradient(150deg,#FAF6EF 0%," + C.oliveGhost + " 100%);border-radius:22px;padding:20px 18px 16px;border:1.5px dashed " + C.olivePale + ";margin-bottom:8px;box-shadow:0 2px 12px rgba(96,107,78,0.06)}\
        .bunny-tip-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}\
        .bunny-avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2.5px solid " + C.olivePale + ";flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.08)}\
        .bunny-tip-label{font-family:'Cormorant Garamond',serif;font-size:14px;font-weight:600;color:" + C.olive + ";flex:1}\
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
        .section-title{font-family:'Cormorant Garamond',serif;font-size:20px;color:" + C.charcoal + ";margin-bottom:14px;font-weight:600;letter-spacing:-0.3px}\
        .supp-list{display:flex;flex-direction:column;gap:8px}\
        .supp-row{display:flex;align-items:center;gap:12px;padding:16px 16px;background:" + C.warm + ";border-radius:18px;border:none;box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);text-align:left;width:100%}\
        .supp-row:active{transform:scale(0.97);box-shadow:0 0 0 rgba(0,0,0,0)}\
        .supp-done{background:" + C.oliveGhost + ";box-shadow:0 1px 3px rgba(96,107,78,0.08)}\
        .supp-check{width:26px;height:26px;border-radius:50%;border:2px solid " + C.olivePale + ";display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);flex-shrink:0}\
        .supp-check.checked{background:" + C.olive + ";border-color:" + C.olive + ";transform:scale(1.1)}\
        .supp-name{font-size:13px;font-weight:600;margin:0 0 2px;color:" + C.charcoal + "}\
        .supp-done .supp-name{text-decoration:line-through;opacity:0.5}\
        .supp-tip{font-size:11px;color:" + C.stone + ";margin:0;line-height:1.4}\
        .supp-when{font-size:9px;color:" + C.oliveMid + ";text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;text-align:right;max-width:60px;line-height:1.3}\
        .logged-meal{background:" + C.warm + ";border-radius:18px;padding:16px 16px;margin-bottom:10px;border:none;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.02)}\
        .macro-tag{font-size:10px;padding:4px 10px;border-radius:20px;font-weight:600;letter-spacing:0.2px}\
        .tag-p{background:" + C.oliveGhost + ";color:" + C.olive + "}\
        .tag-c{background:" + C.burgGhost + ";color:" + C.burg + "}\
        .tag-f{background:" + C.sand + ";color:" + C.stone + "}\
        .health-alert{border-radius:18px;padding:18px 18px;margin-bottom:12px;border-left:4px solid;box-shadow:0 1px 3px rgba(0,0,0,0.03)}\
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
        .tip-card{display:flex;gap:14px;align-items:flex-start;padding:16px 18px;background:" + C.warm + ";border-radius:18px;margin-bottom:10px;border:none;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeUp 0.4s ease both}\
        .tip-emoji{font-size:22;flex-shrink:0;margin-top:2px}\
        .tip-title{font-size:14px;font-weight:600;margin:0 0 4px}\
        .tip-desc{font-size:12.5px;color:" + C.stone + ";margin:0 0 8px;line-height:1.5}\
        .tip-tag{font-size:9px;background:" + C.oliveGhost + ";color:" + C.olive + ";padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px}\
        .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);max-width:430px;width:100%;background:rgba(253,250,244,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:0.5px solid rgba(0,0,0,0.06);display:flex;justify-content:space-around;padding:6px 0 30px;z-index:100}\
        .nav-btn{background:none;border:none;cursor:pointer;text-align:center;padding:4px 10px;opacity:0.3;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)}\
        .nav-active{opacity:1;transform:translateY(-1px)}\
        .nav-icon{font-size:20px;display:block}\
        .nav-label{font-size:9px;color:" + C.olive + ";font-weight:600;display:block;margin-top:3px;letter-spacing:0.3px}\
        .overlay{position:fixed;inset:0;background:rgba(42,42,42,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);animation:fadeIn 0.3s ease}\
        .breathe-card{background:" + C.cream + ";border-radius:28px;padding:36px 28px;text-align:center;max-width:340px;width:90%}\
        .breathe-quote{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;color:" + C.olive + ";margin:0 0 8px;line-height:1.5}\
        .breathe-circle{border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto;transition:all 1.2s cubic-bezier(0.4,0,0.2,1)}\
        .chip-popup{background:" + C.cream + ";border-radius:28px;padding:32px 24px;max-width:370px;width:92%;text-align:center;animation:popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)}\
        .chip-popup-header{margin-bottom:20px}\
        .chip-popup-title{font-family:'Cormorant Garamond',serif;font-size:22px;color:" + C.burg + ";margin:0 0 8px;line-height:1.3}\
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
        .meal-sheet{background:" + C.cream + ";border-radius:32px 32px 0 0;padding:28px 20px 32px;max-width:430px;width:100%;max-height:88vh;overflow-y:auto;animation:slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 -8px 40px rgba(0,0,0,0.15)}\
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
        .btn-primary{background:" + C.olive + ";color:#fff;border:none;padding:14px 32px;border-radius:50px;font-size:15px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:500;box-shadow:0 4px 12px rgba(96,107,78,0.25);transition:transform 0.2s,box-shadow 0.2s}\
        .btn-primary:disabled{opacity:0.6;cursor:default}\
        .btn-ghost{background:none;border:1px solid " + C.olivePale + ";color:" + C.olive + ";padding:8px 24px;border-radius:50px;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif}\
        .btn-save{width:100%;padding:16px;border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;border:none;font-family:'Outfit',sans-serif;background:" + C.burg + ";color:#fff;box-shadow:0 4px 12px rgba(110,44,53,0.25);transition:transform 0.2s}\
        .btn-save:disabled{background:" + C.sand + ";color:" + C.mist + ";cursor:default}\
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:999;background:" + C.olive + ";color:#fff;padding:14px 24px;border-radius:20px;font-size:13px;max-width:340px;text-align:center;white-space:pre-line;box-shadow:0 8px 40px rgba(0,0,0,0.2),0 2px 8px rgba(0,0,0,0.1);animation:slideDown 0.5s cubic-bezier(0.34,1.56,0.64,1);line-height:1.5;backdrop-filter:blur(8px)}\
                .vitd-meter{background:#FFFDF8;border-radius:16px;padding:14px 16px;margin-bottom:16px;border:1px solid #E8E4DC}        .vitd-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}        .vitd-track{height:12px;background:#E8E4DC;border-radius:6px;position:relative;overflow:visible}        .vitd-fill{height:100%;border-radius:6px;position:relative}        .vitd-thumb{position:absolute;top:-2px;width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #606B4E;box-shadow:0 2px 8px rgba(0,0,0,0.2)}        .fav-recipe-card{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:#FFFDF8;border:1.5px solid #E8E4DC;border-radius:16px;margin-bottom:8px;cursor:pointer;transition:transform 0.15s;animation:fadeUp 0.4s ease both;font-family:'Outfit',sans-serif}        .fav-recipe-card:active{transform:scale(0.98)}@keyframes fadeIn{from{opacity:0}to{opacity:1}}\
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}\
        @keyframes slideDown{from{transform:translateX(-50%) translateY(-16px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}\
        @keyframes fadeUp{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}\
        @keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}50%{opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}\
        @keyframes popIn{0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.02)}100%{transform:scale(1);opacity:1}}\
        .fade-in>*{animation:fadeUp 0.4s ease both}\
        .fade-in>*:nth-child(2){animation-delay:0.05s}\
        .fade-in>*:nth-child(3){animation-delay:0.1s}\
        .fade-in>*:nth-child(4){animation-delay:0.15s}\
      "}</style>
    </div>
  );
}
