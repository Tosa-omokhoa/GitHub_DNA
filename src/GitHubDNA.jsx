import { useState, useCallback } from "react";

function TraitRadar({ data, color }) {
  const W = 260, H = 240, cx = W / 2, cy = H / 2, R = 82, n = data.length;
  const pt = (i, r) => { const a = (Math.PI * 2 * i / n) - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const rPath = s => Array.from({ length: n }, (_, i) => pt(i, R * s)).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + "Z";
  const dpts = data.map((d, i) => pt(i, (d.score / 100) * R));
  const dpath = dpts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + "Z";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((s, i) => <path key={i} d={rPath(s)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />)}
      {Array.from({ length: n }, (_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />; })}
      <path d={dpath} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {dpts.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill={color} />)}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 24);
        const anchor = x < cx - 10 ? "end" : x > cx + 10 ? "start" : "middle";
        const base = y < cy - 10 ? "auto" : y > cy + 10 ? "hanging" : "middle";
        return <text key={i} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={anchor} dominantBaseline={base} fill="#7878A0" fontSize="9.5" fontFamily="monospace">{d.name}</text>;
      })}
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#08080E;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.inp{background:#111119;border:1.5px solid rgba(124,92,252,0.22);border-radius:10px;padding:14px 18px;color:#E8E8FF;font-size:16px;font-family:monospace;outline:none;width:100%;transition:border-color 0.2s;}
.inp:focus{border-color:#7C5CFC;}
.btn-p{background:#7C5CFC;border:none;border-radius:10px;padding:15px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;width:100%;font-family:'Space Grotesk',system-ui,sans-serif;transition:opacity 0.15s;}
.btn-p:hover{opacity:0.88;}
.btn-p:active{transform:scale(0.98);}
.btn-g{background:none;border:1px solid rgba(124,92,252,0.25);border-radius:10px;padding:12px 20px;color:#7C5CFC;font-size:13px;cursor:pointer;font-family:monospace;transition:border-color 0.2s;width:100%;}
.btn-g:hover{border-color:#7C5CFC;}
`;

function scoreRhythm(events) {
  const pushes = events.filter(e => e.type === "PushEvent");
  if (pushes.length < 3) return 50;
  const byDay = {};
  pushes.forEach(e => { const d = e.created_at.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
  const vals = Object.values(byDay);
  if (vals.length < 2) return 50;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return Math.round(Math.max(5, Math.min(95, 100 - (sd / (mean || 1)) * 35)));
}
function scoreNight(events) {
  if (!events.length) return 30;
  const hours = events.map(e => new Date(e.created_at).getUTCHours());
  return Math.round((hours.filter(h => h >= 21 || h < 5).length / hours.length) * 100);
}
function scoreMessages(events) {
  const msgs = events.filter(e => e.type === "PushEvent").flatMap(e => (e.payload?.commits || []).map(c => c.message?.trim())).filter(Boolean);
  if (!msgs.length) return 40;
  return Math.round(Math.min(95, (msgs.reduce((a, m) => a + m.length, 0) / msgs.length / 55) * 100));
}
function scorePolyglot(repos) {
  return Math.round(Math.min(95, (new Set(repos.filter(r => r.language).map(r => r.language)).size / 7) * 100));
}
function scoreReadme(repos) {
  const orig = repos.filter(r => !r.fork);
  if (!orig.length) return 40;
  return Math.round((orig.filter(r => r.description && r.description.length > 20).length / orig.length) * 100);
}
function scoreCompletion(repos) {
  const orig = repos.filter(r => !r.fork);
  if (!orig.length) return 40;
  return Math.round((orig.filter(r => (new Date(r.updated_at) - new Date(r.created_at)) / 86400000 > 5 && r.size > 5).length / orig.length) * 100);
}
function scoreOriginality(repos) {
  if (!repos.length) return 50;
  return Math.round((repos.filter(r => !r.fork).length / repos.length) * 100);
}
function scoreFame(user, repos) {
  const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  return Math.round(Math.min(95, (stars / 200) * 70 + (user.followers / 150) * 30));
}
function computeScores(user, repos, events) {
  return {
    rhythm: scoreRhythm(events), night: scoreNight(events), messages: scoreMessages(events),
    polyglot: scorePolyglot(repos), readme: scoreReadme(repos), completion: scoreCompletion(repos),
    originality: scoreOriginality(repos), fame: scoreFame(user, repos),
  };
}

function getObservations(scores, user, repos) {
  const obs = [];
  const langs = new Set(repos.filter(r => r.language).map(r => r.language));
  const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  const forks = repos.filter(r => r.fork).length;
  const orig = repos.filter(r => !r.fork).length;
  if (scores.night > 60) obs.push(`${scores.night}% of public activity falls between 9pm and 5am. The IDE never sleeps.`);
  if (scores.rhythm < 30) obs.push("Commit pattern: quiet for weeks, then a full Saturday sprint. Classic binge architecture.");
  if (scores.rhythm > 75) obs.push("Commits arrive with metronomic regularity. Either deeply disciplined or running a cron job.");
  if (langs.size >= 5) obs.push(`Active across ${langs.size} languages. Language loyalty is not a value here.`);
  if (scores.originality < 35 && forks > 0) obs.push(`${forks} forks vs ${orig} original repos. A curator as much as a creator.`);
  if (scores.messages < 25) obs.push('Average commit message: under 10 characters. "fix" is apparently a complete thought.');
  if (stars > 100) obs.push(`${stars} total stars across all repos. People are watching.`);
  if (scores.completion > 75) obs.push("Most repos show sustained activity past day 7. Actual shipping is happening here.");
  if (scores.readme > 80) obs.push("Almost every repo has a description. Documentation is a love language.");
  if (user.followers === 0 && stars === 0) obs.push("Zero stars, zero followers, zero social footprint. Building for the void. Respectable.");
  return obs.slice(0, 3);
}

function getInsights(scores, user, repos, events) {
  const result = [];
  if (events.length > 0) {
    const hc = {};
    events.forEach(e => { const h = new Date(e.created_at).getUTCHours(); hc[h] = (hc[h] || 0) + 1; });
    const peakH = parseInt(Object.entries(hc).sort((a, b) => b[1] - a[1])[0][0]);
    const h12 = peakH % 12 || 12;
    result.push({ icon: "⏰", label: "Peak Hour", value: `${h12}:00 ${peakH >= 12 ? "PM" : "AM"}` });
  }
  const lc = {};
  repos.filter(r => r.language).forEach(r => { lc[r.language] = (lc[r.language] || 0) + 1; });
  const topL = Object.entries(lc).sort((a, b) => b[1] - a[1])[0];
  if (topL) result.push({ icon: "💻", label: "Top Language", value: topL[0] });
  const health = Math.round(scores.readme * 0.4 + scores.completion * 0.4 + scores.messages * 0.2);
  result.push({ icon: "🩺", label: "Repo Health", value: `${health} / 100` });
  const age = new Date().getFullYear() - new Date(user.created_at).getFullYear();
  result.push({ icon: "📅", label: "GitHub Age", value: age === 0 ? "< 1 yr" : `${age} yr${age !== 1 ? "s" : ""}` });
  return result;
}

const ARCHETYPES = [
  { name: "The Binge Monk", emoji: "⚡", color: "#FF8C42", tagline: "Nothing for three weeks. Then 60 commits on a Saturday. No in-between.", match: s => s.rhythm < 35 },
  { name: "The Midnight Architect", emoji: "🌙", color: "#7C5CFC", tagline: "Builds serious things at serious hours. Caffeine is the whole stack.", match: s => s.night > 50 && s.messages > 45 },
  { name: "The Polyglot Ghost", emoji: "👻", color: "#00D9A0", tagline: "Codes in 6 languages. Has 3 stars total. Building for craft, not clout.", match: s => s.polyglot > 60 && s.fame < 30 },
  { name: "The README Professor", emoji: "📚", color: "#F4C430", tagline: "Every repo has a contributing guide and a badge section. The code may or may not run.", match: s => s.readme > 70 && s.messages > 60 },
  { name: "The Serial Starter", emoji: "🚀", color: "#FF4D8D", tagline: "Forty repos. Average commits per repo: 3. The ideas, though, are excellent.", match: s => s.completion < 35 },
  { name: "The Open Source Evangelist", emoji: "🔗", color: "#4DAAFF", tagline: "More forks than originals. The best code is already written. You just find it.", match: s => s.originality < 45 },
  { name: "The Quiet Giant", emoji: "🏔", color: "#B388FF", tagline: "A few repos. Serious stars. Last commit: sometime before the discourse.", match: s => s.fame > 65 && s.rhythm < 55 },
  { name: "The Completionist", emoji: "✅", color: "#2DE89A", tagline: "Every repo deployed, documented, and done. Statistically rare. Possibly a robot.", match: s => s.completion > 70 && s.readme > 65 },
  { name: "The Consistent Grinder", emoji: "⚙", color: "#A8B5FF", tagline: "Every day, rain or shine. No drama, no binging. Just diffs.", match: s => s.rhythm > 70 },
];

const DIMS = [
  { key: "rhythm", low: "Binge", high: "Consistent", label: "Rhythm" },
  { key: "night", low: "Early Bird", high: "Midnight", label: "Night Owl" },
  { key: "messages", low: '"fix stuff"', high: "Verbose", label: "Messages" },
  { key: "polyglot", low: "Monolingual", high: "Polyglot", label: "Languages" },
  { key: "readme", low: "Ghost", high: "Professor", label: "README" },
  { key: "completion", low: "Starter", high: "Finisher", label: "Completion" },
  { key: "originality", low: "Sponge", high: "Inventor", label: "Originality" },
  { key: "fame", low: "Underground", high: "Star Magnet", label: "Fame" },
];

function getArchetype(s) { return ARCHETYPES.find(a => a.match(s)) || ARCHETYPES[4]; }

async function ghFetch(path, token) {
  const r = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github.v3+json", ...(token ? { Authorization: `token ${token}` } : {}) } });
  if (!r.ok) {
    if (r.status === 404) throw new Error("User not found. Check the username.");
    if (r.status === 403) throw new Error("Rate limit hit. Add a GitHub token for 5000 req/hr.");
    throw new Error(`GitHub returned ${r.status}. Try again shortly.`);
  }
  return r.json();
}

async function runAnalysis(username, token, onStep) {
  onStep("Fetching profile...");
  const user = await ghFetch(`/users/${username}`, token);
  onStep("Scanning repositories...");
  const reposRaw = await ghFetch(`/users/${username}/repos?per_page=100&sort=updated`, token);
  onStep("Analyzing activity...");
  const eventsRaw = await ghFetch(`/users/${username}/events/public?per_page=100`, token).catch(() => []);
  onStep("Computing personality...");
  const repos = Array.isArray(reposRaw) ? reposRaw : [];
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];
  const scores = computeScores(user, repos, events);
  const archetype = getArchetype(scores);
  const languages = [...new Set(repos.filter(r => r.language).map(r => r.language))].slice(0, 12);
  const observations = getObservations(scores, user, repos);
  const insights = getInsights(scores, user, repos, events);
  return { user, repos, scores, archetype, languages, observations, insights };
}

function LandingScreen({ onAnalyze, errProp }) {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [showTok, setShowTok] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const err = errProp || localErr;
  const go = () => {
    const u = username.trim();
    if (!u) { setLocalErr("Enter a GitHub username."); return; }
    setLocalErr("");
    onAnalyze(u, token.trim());
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", background: "#08080E", position: "relative", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "700px", height: "500px", background: "radial-gradient(ellipse at 50% 0%, rgba(124,92,252,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: "480px", width: "100%", animation: "rise 0.5s ease", position: "relative" }}>
        <p style={{ color: "#7C5CFC", fontSize: "11px", fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "22px", fontFamily: "monospace" }}>&lt;/&gt; GitHub DNA</p>
        <h1 style={{ fontSize: "clamp(34px, 8vw, 52px)", fontWeight: 700, lineHeight: 1.1, color: "#E8E8FF", marginBottom: "14px", letterSpacing: "-0.03em" }}>
          Know thyself,<br /><span style={{ color: "#7C5CFC" }}>commit</span> by commit.
        </h1>
        <p style={{ color: "#5A5A72", fontSize: "16px", lineHeight: 1.65, marginBottom: "36px" }}>Your GitHub is a personality test you did not know you were taking. Enter a username to see the results.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input className="inp" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="username" autoFocus />
          <button onClick={() => setShowTok(!showTok)} style={{ background: "none", border: "none", color: "#484860", fontSize: "12px", cursor: "pointer", textAlign: "left", padding: "2px 0", fontFamily: "monospace" }}>
            {showTok ? "[-] hide token" : "[+] add token"} (optional, 60 req/hr without one)
          </button>
          {showTok && <input className="inp" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_xxxx..." type="password" style={{ fontSize: "14px", padding: "12px 18px" }} />}
          {err && <p style={{ color: "#FF6B6B", fontSize: "13px", fontFamily: "monospace" }}>! {err}</p>}
          <button className="btn-p" onClick={go}>Analyze Profile</button>
        </div>
        <p style={{ color: "#4E4E6E", fontSize: "12px", marginTop: "18px", fontFamily: "monospace", textAlign: "center" }}>reads public data only. no account required.</p>
      </div>
    </div>
  );
}

const LOAD_STEPS = ["Fetching profile...", "Scanning repositories...", "Analyzing activity...", "Computing personality..."];
function LoadingScreen({ step, username }) {
  const ci = LOAD_STEPS.indexOf(step);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080E" }}>
      <div style={{ fontFamily: "monospace", padding: "24px", maxWidth: "400px", width: "100%" }}>
        <p style={{ color: "#7C5CFC", fontSize: "14px", marginBottom: "28px" }}>$ analyze {username}</p>
        {LOAD_STEPS.map((s, i) => (
          <p key={s} style={{ display: "flex", gap: "10px", alignItems: "center", color: ci > i ? "#383858" : ci === i ? "#E8E8FF" : "#18181F", fontSize: "14px", margin: "10px 0", transition: "color 0.3s" }}>
            <span style={{ color: ci > i ? "#00D9A0" : ci === i ? "#7C5CFC" : "#18181F", minWidth: "12px", fontSize: "12px" }}>{ci > i ? "+" : ci === i ? ">" : "."}</span>
            {s}
            {ci === i && <span style={{ animation: "blink 0.8s infinite", color: "#7C5CFC" }}>_</span>}
          </p>
        ))}
      </div>
    </div>
  );
}

function Bar({ dim, score, color }) {
  const isHigh = score >= 50;
  return (
    <div style={{ marginBottom: "15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
        <span style={{ color: "#B8B8D8", fontSize: "12px", fontWeight: 500 }}>{isHigh ? dim.high : dim.low}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#686888", fontSize: "10px", fontFamily: "monospace" }}>{dim.label}</span>
          <span style={{ color, fontSize: "13px", fontWeight: 700, fontFamily: "monospace", minWidth: "28px", textAlign: "right" }}>{score}</span>
        </div>
      </div>
      <div style={{ height: "6px", background: "#0A0A16", borderRadius: "999px" }}>
        <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg, ${color}55, ${color})`, borderRadius: "999px", transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
    </div>
  );
}

function InsightChip({ icon, label, value }) {
  return (
    <div style={{ background: "#0C0C18", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={{ fontSize: "18px", lineHeight: 1 }}>{icon}</span>
      <span style={{ color: "#5E5E80", fontSize: "10px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "4px" }}>{label}</span>
      <span style={{ color: "#D0D0F0", fontSize: "15px", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ResultsScreen({ data, onReset }) {
  const { user, repos, scores, archetype, languages, observations, insights } = data;
  const totalStars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  const joinYear = new Date(user.created_at).getFullYear();
  const ac = archetype.color;
  const radarData = DIMS.map(d => ({ name: d.label, score: scores[d.key] }));
  const dnaScore = Math.round((scores.rhythm + scores.messages + scores.readme + scores.completion + scores.originality) / 5);

  return (
    <div style={{ minHeight: "100vh", background: "#08080E", padding: "24px 20px 52px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div style={{ maxWidth: "700px", width: "100%", animation: "rise 0.5s ease" }}>

        {/* HERO */}
        <div style={{ background: "rgba(12,12,24,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${ac}28`, borderRadius: "24px", padding: "32px", marginBottom: "14px", position: "relative", overflow: "hidden", boxShadow: `0 24px 80px ${ac}12` }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${ac}, transparent)` }} />
          <div style={{ position: "absolute", top: 0, right: 0, width: "320px", height: "220px", background: `radial-gradient(circle at 100% 0%, ${ac}0C, transparent 60%)`, pointerEvents: "none" }} />

          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <img src={user.avatar_url} alt="" style={{ width: "96px", height: "96px", borderRadius: "50%", border: `3px solid ${ac}55`, display: "block" }} />
              <span style={{ fontSize: "30px", lineHeight: 1 }}>{archetype.emoji}</span>
            </div>

            <div style={{ flex: 1, minWidth: "180px", paddingTop: "2px" }}>
              <p style={{ color: ac, fontSize: "10px", fontFamily: "monospace", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "6px" }}>github dna</p>
              <h2 style={{ background: `linear-gradient(125deg, #F0F0FF 20%, ${ac} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "10px" }}>
                {archetype.name}
              </h2>
              <p style={{ color: "#505068", fontSize: "14px", fontStyle: "italic", lineHeight: 1.6 }}>"{archetype.tagline}"</p>
            </div>

            <div style={{ textAlign: "center", flexShrink: 0, padding: "4px 0" }}>
              <p style={{ color: "#5E5E80", fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>DNA Score</p>
              <div style={{ fontSize: "60px", fontWeight: 700, color: ac, lineHeight: 1, fontFamily: "monospace" }}>{dnaScore}</div>
              <p style={{ color: "#5E5E80", fontSize: "9px", fontFamily: "monospace", marginTop: "4px" }}>out of 100</p>
            </div>
          </div>

          <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: "1px solid #121222" }}>
            {user.name && <p style={{ color: "#C8C8E8", fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{user.name}</p>}
            {user.bio && <p style={{ color: "#42425A", fontSize: "13px", lineHeight: 1.55, marginBottom: "14px" }}>{user.bio.slice(0, 110)}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px" }}>
              {[{ label: "Repos", value: repos.length }, { label: "Stars", value: totalStars }, { label: "Followers", value: user.followers }, { label: "Member Since", value: joinYear }].map(({ label, value }) => (
                <div key={label} style={{ background: "#0A0A16", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "10px 14px" }}>
                  <div style={{ color: "#5E5E80", fontSize: "9px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{label}</div>
                  <div style={{ color: "#C0C0E0", fontSize: "15px", fontWeight: 600, fontFamily: "monospace" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {observations.length > 0 && (
            <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid #121222" }}>
              <p style={{ color: "#5E5E80", fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>Why We Think This Fits You</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {observations.map((obs, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ color: ac, fontSize: "10px", flexShrink: 0, marginTop: "4px" }}>◆</span>
                    <p style={{ color: "#7878A0", fontSize: "13px", lineHeight: 1.65, margin: 0 }}>{obs}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DEEPER ANALYSIS */}
        <div style={{ marginBottom: "14px" }}>
          <p style={{ color: "#4E4E6E", fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>deeper analysis</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
            {insights.map((ins, i) => <InsightChip key={i} {...ins} />)}
          </div>
        </div>

        {/* RADAR + DEVELOPER DNA BARS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginBottom: "14px" }}>
          <div style={{ background: "#0C0C18", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px", overflow: "hidden" }}>
            <p style={{ color: "#4E4E6E", fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>trait radar</p>
            <TraitRadar data={radarData} color={ac} />
          </div>
          <div style={{ background: "#0C0C18", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px" }}>
            <p style={{ color: "#4E4E6E", fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>developer dna</p>
            {DIMS.map(d => <Bar key={d.key} dim={d} score={scores[d.key]} color={ac} />)}
          </div>
        </div>

        {/* DEVELOPER GENOME */}
        {languages.length > 0 && (
          <div style={{ background: "#0C0C18", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px", marginBottom: "14px" }}>
            <p style={{ color: "#4E4E6E", fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>developer genome</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {languages.map(l => (
                <span key={l} style={{ background: `${ac}0D`, border: `1px solid ${ac}30`, borderRadius: "999px", padding: "6px 16px", color: "#686888", fontSize: "13px", fontFamily: "monospace" }}>{l}</span>
              ))}
            </div>
          </div>
        )}

        {/* SHARE CTA */}
        <div style={{ background: `${ac}0A`, border: `1px solid ${ac}20`, borderRadius: "14px", padding: "24px", textAlign: "center", marginBottom: "12px" }}>
          <p style={{ color: "#6060808", fontSize: "22px", marginBottom: "6px" }}>🧬</p>
          <p style={{ color: "#9090B0", fontSize: "14px", marginBottom: "6px" }}>Your GitHub DNA, decoded.</p>
          <p style={{ color: ac, fontSize: "13px", fontFamily: "monospace", fontWeight: 500, letterSpacing: "0.02em" }}>screenshot the card above and post it on X</p>
        </div>

        <button className="btn-g" onClick={onReset}>analyze another profile</button>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("landing");
  const [data, setData] = useState(null);
  const [step, setStep] = useState("Fetching profile...");
  const [activeUser, setActiveUser] = useState("");
  const [err, setErr] = useState("");

  const analyze = useCallback(async (username, token) => {
    setActiveUser(username);
    setErr("");
    setStep("Fetching profile...");
    setPhase("loading");
    try {
      const result = await runAnalysis(username, token, setStep);
      setData(result);
      setPhase("results");
    } catch (e) {
      setErr(e.message || "Something went wrong. Please try again.");
      setPhase("error");
    }
  }, []);

  return (
    <>
      <style>{CSS}</style>
      {phase === "loading" && <LoadingScreen step={step} username={activeUser} />}
      {phase === "results" && data && <ResultsScreen data={data} onReset={() => setPhase("landing")} />}
      {(phase === "landing" || phase === "error") && <LandingScreen onAnalyze={analyze} errProp={phase === "error" ? err : ""} />}
    </>
  );
}
