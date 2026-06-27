import { useState, useEffect, useRef, useCallback } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = "#ffffff";           // Primary accent (white on black, Apple style)
const BORDER = "rgba(255,255,255,0.1)";
const GLASS = "rgba(255,255,255,0.04)";
const BG = "#000000";
const API = "http://localhost:8000";

// Neon styling for stick figures
const NEON = "#00FF66";        // electric neon green
const NEON_GLOW = "rgba(0,255,102,0.35)";

// ── Global styles ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Bebas+Neue&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#000000;color:#f5f5f7;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
.bb{font-family:'Bebas Neue',sans-serif}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.6)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
@keyframes scan{0%{top:-6%}100%{top:106%}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes glow-pulse{0%,100%{box-shadow:0 0 20px rgba(255,255,255,.08)}50%{box-shadow:0 0 40px rgba(255,255,255,.15)}}
@keyframes slide-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes skeleton-load{0%{background-position:200% 0}100%{background-position:-200% 0}}
.fuv{opacity:0;transform:translateY(32px);transition:opacity .75s ease,transform .75s ease}
.fuv.in{opacity:1;transform:translateY(0)}
.marquee{display:flex;animation:marquee 28s linear infinite}
.spin{animation:spin 1s linear infinite}
.shimmer-bg{
  background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 75%);
  background-size:200% 100%;
  animation:skeleton-load 1.5s infinite;
}
`;

// ── Intersection observer hook ─────────────────────────────────────────────────
function useFadeUp(threshold = 0.12) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add("in"); }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return ref;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const Pill = ({ children, color = "#ffffff", style = {} }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px",
        borderRadius: 100, border: `1px solid rgba(255,255,255,0.15)`,
        background: `rgba(255,255,255,0.06)`,
        fontSize: 11, fontWeight: 500, letterSpacing: 1, color: "rgba(255,255,255,0.7)", ...style
    }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: color === "#ffffff" ? NEON : color, animation: "pulse 1.8s ease-in-out infinite" }} />
        {children}
    </span>
);

const GlassCard = ({ children, style = {}, hover = true, onClick }) => {
    const [hov, setHov] = useState(false);
    return (
        <div onClick={onClick}
            onMouseEnter={() => hover && setHov(true)}
            onMouseLeave={() => hover && setHov(false)}
            style={{
                background: hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${hov ? "rgba(255,255,255,0.18)" : BORDER}`,
                borderRadius: 16, backdropFilter: "blur(12px)",
                transition: "all .3s ease",
                boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.5)` : "none",
                cursor: onClick ? "pointer" : "default",
                ...style
            }}>
            {children}
        </div>
    );
};

const Btn = ({ children, variant = "solid", onClick, style = {}, disabled = false }) => {
    const [hov, setHov] = useState(false);
    const solid = variant === "solid";
    return (
        <button onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: solid ? (hov ? "#e8e8ed" : "#f5f5f7") : "transparent",
                color: solid ? "#000000" : (hov ? "#ffffff" : "rgba(255,255,255,0.8)"),
                border: solid ? "none" : `1px solid ${hov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"}`,
                borderRadius: 10, padding: "13px 28px", fontSize: 14, fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer", fontFamily: "Inter",
                letterSpacing: 0.2, opacity: disabled ? 0.5 : 1,
                boxShadow: "none",
                transition: "all .2s ease", whiteSpace: "nowrap", ...style
            }}>
            {children}
        </button>
    );
};

// ── Skeleton player SVG ───────────────────────────────────────────────────────
function SkeletonPlayer({ scrollY = 0 }) {
    const t = (scrollY / 400) * 30;
    const swing = Math.min(t, 28);

    const J = [ // joints [x, y]
        [120, 52],  // 0 head
        [120, 82],  // 1 neck
        [92, 105],  // 2 l-shoulder
        [148, 105], // 3 r-shoulder
        [72, 148],  // 4 l-elbow
        [158, 132], // 5 r-elbow
        [58, 188],  // 6 l-wrist
        [172, 162], // 7 r-wrist
        [120, 168], // 8 hip-c
        [103, 168], // 9 l-hip
        [137, 168], // 10 r-hip
        [98, 220],  // 11 l-knee
        [142, 212], // 12 r-knee
        [93, 268],  // 13 l-ankle
        [147, 260], // 14 r-ankle
    ];

    const bones = [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [8, 9], [8, 10], [9, 11], [10, 12], [11, 13], [12, 14]];

    const rad = (swing * Math.PI) / 180;
    const batTipX = J[6][0] - Math.sin(rad) * 72;
    const batTipY = J[6][1] + Math.cos(rad) * 72;

    return (
        <svg viewBox="0 0 240 310" style={{ width: "100%", maxWidth: 320, filter: `drop-shadow(0 12px 28px rgba(0,0,0,0.12))` }}>
            <defs>
                <radialGradient id="halo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={NEON} stopOpacity=".15" />
                    <stop offset="100%" stopColor={NEON} stopOpacity="0" />
                </radialGradient>
            </defs>
            {/* Sleek dark circular disk for stick figure contrast */}
            <circle cx="120" cy="155" r="110" fill="#121212" />
            <ellipse cx="120" cy="288" rx="52" ry="7" fill={NEON} opacity=".07" />
            <circle cx="120" cy="155" r="105" fill="url(#halo)" />

            {bones.map(([a, b], i) => (
                <g key={i}>
                    <line x1={J[a][0]} y1={J[a][1]} x2={J[b][0]} y2={J[b][1]} stroke={NEON} strokeWidth="5" strokeOpacity=".12" strokeLinecap="round" />
                    <line x1={J[a][0]} y1={J[a][1]} x2={J[b][0]} y2={J[b][1]} stroke={NEON} strokeWidth="1.5" strokeOpacity=".7" strokeLinecap="round" strokeDasharray="3 2" />
                </g>
            ))}

            {/* Bat */}
            <line x1={J[6][0]} y1={J[6][1]} x2={batTipX} y2={batTipY} stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
            <line x1={J[6][0]} y1={J[6][1]} x2={batTipX} y2={batTipY} stroke={NEON} strokeWidth="8" strokeLinecap="round" opacity=".15" />

            {J.map(([x, y], i) => (
                <g key={i}>
                    <circle cx={x} cy={y} r={i === 0 ? 14 : 6} fill={NEON} opacity=".08" />
                    <circle cx={x} cy={y} r={i === 0 ? 9 : 4} fill="#121212" stroke={NEON} strokeWidth={i === 0 ? 1.8 : 1.2} />
                    <circle cx={x} cy={y} r={i === 0 ? 4.5 : 2.2} fill={NEON}
                        style={{ animation: `pulse ${1.1 + i * 0.13}s ease-in-out infinite`, animationDelay: `${i * 0.07}s` }} />
                </g>
            ))}

            {/* Angle callouts */}
            <line x1={J[5][0]} y1={J[5][1]} x2={J[5][0] + 26} y2={J[5][1] - 14} stroke={NEON} strokeWidth=".6" opacity=".5" />
            <text x={J[5][0] + 28} y={J[5][1] - 16} fill={NEON} fontSize="7" fontFamily="Inter" opacity=".8">138°</text>

            <line x1={J[11][0]} y1={J[11][1]} x2={J[11][0] - 26} y2={J[11][1] + 6} stroke={NEON} strokeWidth=".6" opacity=".5" />
            <text x={J[11][0] - 68} y={J[11][1] + 8} fill={NEON} fontSize="7" fontFamily="Inter" opacity=".8">121°</text>
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function Navbar({ scrollY, onCTA }) {
    const solid = scrollY > 60;
    return (
        <nav style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
            background: solid ? "rgba(0,0,0,0.88)" : "transparent",
            backdropFilter: solid ? "blur(20px)" : "none",
            borderBottom: solid ? `1px solid rgba(255,255,255,0.08)` : "none",
            transition: "all .35s ease", padding: "0 48px", height: 62,
            display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="26" height="26" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="13" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="#ffffff" opacity=".85" />
                    <circle cx="14" cy="14" r="2.5" fill="#000" />
                </svg>
                <span className="bb" style={{ fontSize: 21, letterSpacing: 2, color: "#f5f5f7" }}>CrickIQ</span>
            </div>

            <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                {["Features", "Pipeline", "Pricing"].map(l => (
                    <a key={l} href={`#${l.toLowerCase()}`} style={{ color: "rgba(245,245,247,0.5)", fontSize: 13, textDecoration: "none", transition: "color .2s" }}
                        onMouseEnter={e => e.target.style.color = "#ffffff"} onMouseLeave={e => e.target.style.color = "rgba(245,245,247,0.5)"}>{l}</a>
                ))}
                <Btn onClick={onCTA} style={{ padding: "9px 20px", fontSize: 13 }}>Get Early Access</Btn>
            </div>
        </nav>
    );
}

function Hero({ scrollY, onCTA }) {
    return (
        <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px 80px 80px", position: "relative", overflow: "hidden", background: "#000000" }}>
            {/* grid */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)`, backgroundSize: "56px 56px" }} />
            {/* scanline */}
            <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)`, animation: "scan 7s linear infinite", pointerEvents: "none" }} />
            {/* glow */}
            <div style={{ position: "absolute", top: "20%", right: "20%", width: 560, height: 560, background: `radial-gradient(circle,rgba(0,255,102,0.04) 0%,transparent 70%)`, transform: `translateY(${scrollY * 0.08}px)`, pointerEvents: "none" }} />

            <div style={{ flex: 1, maxWidth: 620, position: "relative", zIndex: 2 }}>
                <div style={{ marginBottom: 28 }}>
                    <Pill>AI-POWERED CRICKET ANALYTICS</Pill>
                </div>

                <h1 className="bb" style={{ fontSize: "clamp(68px,8.5vw,116px)", lineHeight: .92, letterSpacing: 2, marginBottom: 26, color: "#f5f5f7", animation: "fadeUp .9s ease forwards", opacity: 0, animationDelay: ".1s" }}>
                    <span style={{ display: "block" }}>TRAIN</span>
                    <span style={{ display: "block", color: "rgba(255,255,255,0.35)" }}>SMARTER.</span>
                    <span style={{ display: "block" }}>WIN</span>
                    <span style={{ display: "block", color: "#f5f5f7" }}>BIGGER.</span>
                </h1>

                <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, maxWidth: 460, marginBottom: 38, animation: "fadeUp .9s ease forwards", opacity: 0, animationDelay: ".28s" }}>
                    Upload your batting or bowling footage. Our AI detects biomechanical weaknesses, tactical vulnerabilities, and generates personalised drill plans — in seconds.
                </p>

                <div style={{ display: "flex", gap: 12, animation: "fadeUp .9s ease forwards", opacity: 0, animationDelay: ".44s" }}>
                    <Btn onClick={onCTA}>Analyze Performance →</Btn>
                    <Btn variant="outline">▷ Watch Demo</Btn>
                </div>

                <div style={{ display: "flex", gap: 36, marginTop: 52, paddingTop: 32, borderTop: `1px solid rgba(255,255,255,0.08)`, animation: "fadeUp .9s ease forwards", opacity: 0, animationDelay: ".58s" }}>
                    {[["98%", "Accuracy"], ["2.4s", "Analysis"], ["3K+", "Players"]].map(([n, l]) => (
                        <div key={l}>
                            <div className="bb" style={{ fontSize: 38, color: "#f5f5f7", letterSpacing: 1 }}>{n}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: .5, marginTop: 2 }}>{l}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2, animation: "float 4s ease-in-out infinite", transform: `translateY(${-scrollY * 0.05}px)` }}>
                <SkeletonPlayer scrollY={scrollY} />
            </div>
        </section>
    );
}

function TrustedBy() {
    const orgs = ["Chennai Super Kings", "BCCI Academy", "ProFormance Labs", "Elite Cricket Co.", "Pitch Vision", "SportsAI Global", "Titan CC", "NCA Bangalore"];
    return (
        <section style={{ padding: "44px 0", background: "#0a0a0a", borderTop: `1px solid rgba(255,255,255,0.07)`, borderBottom: `1px solid rgba(255,255,255,0.07)`, overflow: "hidden" }}>
            <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 20 }}>TRUSTED BY LEADING ACADEMIES & CLUBS</p>
            <div style={{ overflow: "hidden" }}>
                <div className="marquee">
                    {[...orgs, ...orgs].map((o, i) => (
                        <span key={i} style={{ flex: "0 0 auto", padding: "0 44px", color: "rgba(255,255,255,0.22)", fontSize: 13, fontWeight: 500, letterSpacing: .4, whiteSpace: "nowrap", transition: "color .3s", cursor: "default" }}
                            onMouseEnter={e => e.target.style.color = "#ffffff"} onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.22)"}>{o}</span>
                    ))}
                </div>
            </div>
        </section>
    );
}

function Pipeline() {
    const ref = useFadeUp();
    const steps = [
        { icon: "⬆", label: "Input layer", sub: "Video (.mp4 / .mov) or Image (.jpg / .png) of batsman or bowler", color: "#f5f5f7" },
        { icon: "⚙", label: "Preprocessing & pose estimation", sub: "Frame extraction · MediaPipe keypoints · Skeleton overlay rendering", color: "rgba(255,255,255,0.6)" },
        { icon: "⬡", label: "Feature extraction engine", sub: "Joint angles · Foot balance · Stance width · Wrist height · Swing arc", color: "rgba(255,255,255,0.45)" },
        { icon: "✦", label: "Claude AI analysis", sub: "Vision API + pose JSON → weakness detection + tactical vulnerability mapping", color: NEON },
        { icon: "↓", label: "Output layer", sub: "Weakness report · Annotated skeleton image · Drill plan · PDF export", color: "rgba(255,255,255,0.6)" },
    ];
    return (
        <section id="pipeline" style={{ padding: "120px 80px", background: "#0a0a0a" }}>
            <div ref={ref} className="fuv" style={{ textAlign: "center", marginBottom: 72 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>HOW IT WORKS</p>
                <h2 className="bb" style={{ fontSize: "clamp(44px,5.5vw,68px)", color: "#f5f5f7", letterSpacing: 1 }}>The Intelligence Pipeline</h2>
            </div>
            <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
                <div style={{ position: "absolute", left: 30, top: 0, bottom: 0, width: 1, background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)` }} />
                {steps.map((s, i) => {
                    const r = useFadeUp();
                    return (
                        <div key={i} ref={r} className="fuv" style={{ marginBottom: i < steps.length - 1 ? 0 : 0 }}>
                            <div style={{ display: "flex", gap: 20, marginBottom: 4 }}>
                                <div style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: s.color, backdropFilter: "blur(10px)", position: "relative", zIndex: 1 }}>
                                    {s.icon}
                                </div>
                                <GlassCard style={{ flex: 1, padding: "16px 20px" }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7", marginBottom: 4 }}>{s.label}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{s.sub}</div>
                                </GlassCard>
                            </div>
                            {i < steps.length - 1 && <div style={{ width: 1, height: 28, background: `rgba(255,255,255,0.06)`, marginLeft: 29 }} />}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function Features() {
    const ref = useFadeUp();
    const cards = [
        { icon: "🦾", t: "AI Biomechanics Engine", d: "33-point MediaPipe skeleton with joint angle computation across all cricket movements." },
        { icon: "🏏", t: "Batting Weakness Detection", d: "Identifies playing across the line, late footwork, head fall, and closed bat face issues." },
        { icon: "⚡", t: "Bowling Action Breakdown", d: "Front-on vs side-on detection, illegal action flags, release height & front knee analysis." },
        { icon: "🎯", t: "Vulnerability Prediction", d: "AI maps your weaknesses to the specific delivery most likely to dismiss you." },
        { icon: "📊", t: "Pro Comparison Mode", d: "Upload a professional reference clip and get a side-by-side metric breakdown instantly." },
        { icon: "📈", t: "Session History", d: "Track biomechanical progress across sessions with a Firebase-backed coach dashboard." },
    ];
    return (
        <section id="features" style={{ padding: "120px 80px", background: "#111111" }}>
            <div ref={ref} className="fuv" style={{ textAlign: "center", marginBottom: 60 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>CAPABILITIES</p>
                <h2 className="bb" style={{ fontSize: "clamp(44px,5.5vw,68px)", color: "#f5f5f7", letterSpacing: 1 }}>Built for elite performance</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(285px,1fr))", gap: 14, maxWidth: 1060, margin: "0 auto" }}>
                {cards.map((c, i) => {
                    const r = useFadeUp();
                    return (
                        <div key={i} ref={r} className="fuv" style={{ transitionDelay: `${i * 0.07}s` }}>
                            <GlassCard style={{ padding: "26px 26px", height: "100%" }}>
                                <div style={{ fontSize: 26, marginBottom: 14 }}>{c.icon}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7", marginBottom: 8 }}>{c.t}</div>
                                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>{c.d}</div>
                            </GlassCard>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function Comparison() {
    const ref = useFadeUp();
    const [slider, setSlider] = useState(50);
    const metrics = [
        { label: "Bat angle", u: 68, p: 88 },
        { label: "Head stability", u: 74, p: 95 },
        { label: "Front foot align", u: 55, p: 92 },
        { label: "Release height", u: 80, p: 87 },
        { label: "Knee bend depth", u: 62, p: 91 },
    ];
    return (
        <section style={{ padding: "120px 80px", background: "#000000" }}>
            <div ref={ref} className="fuv" style={{ textAlign: "center", marginBottom: 60 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>PRO COMPARISON</p>
                <h2 className="bb" style={{ fontSize: "clamp(44px,5.5vw,68px)", color: "#f5f5f7", letterSpacing: 1 }}>See the gap. Close it.</h2>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 12, maxWidth: 440, margin: "12px auto 0" }}>Upload a pro reference clip. AI aligns and compares every metric.</p>
            </div>
            <GlassCard hover={false} style={{ maxWidth: 860, margin: "0 auto", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                    <div style={{ padding: "18px 24px", borderRight: `1px solid rgba(255,255,255,0.08)` }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 4 }}>YOUR ANALYSIS</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#f5f5f7" }}>Match footage · Batsman</div>
                    </div>
                    <div style={{ padding: "18px 24px" }}>
                        <div style={{ fontSize: 10, color: NEON, letterSpacing: 1, marginBottom: 4 }}>PRO REFERENCE</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#f5f5f7" }}>Kohli · Cover drive</div>
                    </div>
                </div>

                <div style={{ position: "relative", height: 200, background: "#0a0a0a", overflow: "hidden" }}>
                    {/* user skeleton — grey */}
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg viewBox="0 0 120 180" style={{ height: 150, opacity: .35, filter: "grayscale(1)" }}>
                            {[[60, 18], [60, 55], [32, 82], [88, 72], [18, 120], [100, 108], [60, 95], [42, 145], [78, 138]].map(([x, y], i) =>
                                <circle key={i} cx={x} cy={y} r="4" fill="#888" />)}
                            {[[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [1, 6], [6, 7], [6, 8]].map(([a, b], i) => {
                                const pts = [[60, 18], [60, 55], [32, 82], [88, 72], [18, 120], [100, 108], [60, 95], [42, 145], [78, 138]];
                                return <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke="#666" strokeWidth="2" />;
                            })}
                        </svg>
                    </div>
                    {/* pro skeleton — neon green, clipped */}
                    <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, clipPath: `inset(0 ${100 - slider}% 0 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg viewBox="0 0 120 180" style={{ height: 150 }}>
                            {[[60, 18], [60, 55], [28, 78], [92, 66], [14, 116], [104, 102], [60, 95], [38, 148], [82, 140]].map(([x, y], i) =>
                                <circle key={i} cx={x} cy={y} r="4" fill={NEON} />)}
                            {[[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [1, 6], [6, 7], [6, 8]].map(([a, b], i) => {
                                const pts = [[60, 18], [60, 55], [28, 78], [92, 66], [14, 116], [104, 102], [60, 95], [38, 148], [82, 140]];
                                return <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={NEON} strokeWidth="2" />;
                            })}
                        </svg>
                    </div>
                    {/* divider */}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${slider}%`, width: 2, background: "#fff", transform: "translateX(-50%)", pointerEvents: "none" }}>
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 700 }}>⇔</div>
                    </div>
                    <input type="range" min="5" max="95" value={slider} onChange={e => setSlider(+e.target.value)}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", zIndex: 10 }} />
                    <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 10, color: "rgba(255,255,255,.3)", letterSpacing: 1 }}>YOU</div>
                    <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 10, color: NEON, letterSpacing: 1 }}>PRO</div>
                </div>

                <div style={{ padding: "20px 24px" }}>
                    {metrics.map((m, i) => (
                        <div key={i} style={{ marginBottom: i < metrics.length - 1 ? 12 : 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{m.label}</span>
                                <span style={{ fontSize: 12, color: m.u >= 80 ? "#34c759" : m.u >= 65 ? "#ff9500" : "#ff3b30" }}>{m.u} <span style={{ color: "rgba(255,255,255,0.2)" }}>/ {m.p}</span></span>
                            </div>
                            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 4, position: "relative" }}>
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${m.p}%`, borderRadius: 4, background: `rgba(255,255,255,0.04)` }} />
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${m.u}%`, borderRadius: 4, background: m.u >= 80 ? "#34c759" : m.u >= 65 ? "#ff9500" : "#ff3b30", transition: "width 1s ease" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </section>
    );
}

function Pricing({ onCTA }) {
    const ref = useFadeUp();
    const plans = [
        { name: "Starter", price: "₹0", period: "free forever", features: ["5 analyses/month", "Image uploads only", "Basic weakness report", "Community support"], cta: "Get started free", hi: false },
        { name: "Pro", price: "₹799", period: "/month", features: ["Unlimited analyses", "Video + Image uploads", "Full AI report + drills", "Pro comparison mode", "PDF export", "Priority support"], cta: "Start Pro trial", hi: true },
        { name: "Academy", price: "₹3,999", period: "/month", features: ["Everything in Pro", "50 player profiles", "Coach dashboard", "Session history", "API access", "Dedicated support"], cta: "Contact sales", hi: false },
    ];
    return (
        <section id="pricing" style={{ padding: "120px 80px", background: "#0a0a0a" }}>
            <div ref={ref} className="fuv" style={{ textAlign: "center", marginBottom: 60 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>PRICING</p>
                <h2 className="bb" style={{ fontSize: "clamp(44px,5.5vw,68px)", color: "#f5f5f7", letterSpacing: 1 }}>Start free. Scale up.</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(255px,1fr))", gap: 14, maxWidth: 880, margin: "0 auto" }}>
                {plans.map((p, i) => {
                    const r = useFadeUp();
                    return (
                        <div key={i} ref={r} className="fuv" style={{ transitionDelay: `${i * .08}s` }}>
                            <div style={{ background: p.hi ? "#f5f5f7" : "rgba(255,255,255,0.04)", border: `1px solid ${p.hi ? "#f5f5f7" : "rgba(255,255,255,0.1)"}`, borderRadius: 18, padding: "28px 24px", boxShadow: p.hi ? `0 12px 48px rgba(255,255,255,0.12)` : "0 4px 12px rgba(0,0,0,0.3)", position: "relative", height: "100%" }}>
                                {p.hi && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#000000", color: "#f5f5f7", border: "1px solid rgba(255,255,255,0.2)", fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "3px 12px", borderRadius: 100 }}>MOST POPULAR</div>}
                                <div style={{ fontSize: 11, color: p.hi ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>{p.name.toUpperCase()}</div>
                                <div className="bb" style={{ fontSize: 46, letterSpacing: 1, color: p.hi ? "#000000" : "#f5f5f7" }}>{p.price}</div>
                                <div style={{ fontSize: 11, color: p.hi ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)", marginBottom: 24, marginTop: 2 }}>{p.period}</div>
                                {p.features.map((f, j) => (
                                    <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                                        <span style={{ color: p.hi ? "#000000" : NEON, fontSize: 12, marginTop: 1, flexShrink: 0 }}>✓</span>
                                        <span style={{ fontSize: 12, color: p.hi ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.55)" }}>{f}</span>
                                    </div>
                                ))}
                                <div style={{ marginTop: 22 }}>
                                    <Btn onClick={onCTA} variant={p.hi ? "solid" : "outline"} style={p.hi ? { width: "100%", background: "#000000", color: "#ffffff" } : { width: "100%" }}>{p.cta}</Btn>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function FinalCTA({ onCTA }) {
    const ref = useFadeUp();
    return (
        <section style={{ padding: "160px 80px", textAlign: "center", position: "relative", overflow: "hidden", background: "#000000" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at center, rgba(0,255,102,0.04) 0%,transparent 60%),linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)`, backgroundSize: "auto,44px 44px,44px 44px" }} />
            <div ref={ref} className="fuv">
                <h2 className="bb" style={{ fontSize: "clamp(52px,7.5vw,96px)", color: "#f5f5f7", letterSpacing: 1.5, lineHeight: .95, marginBottom: 26 }}>
                    Your breakthrough<br /><span style={{ color: "rgba(255,255,255,0.3)" }}>starts here.</span>
                </h2>
                <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 400, margin: "0 auto 40px" }}>Upload your first video free. No card. Analysis in under 3 seconds.</p>
                <Btn onClick={onCTA} style={{ padding: "15px 44px", fontSize: 15, animation: "glow-pulse 2.5s ease-in-out infinite" }}>Start Free Analysis →</Btn>
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer style={{ borderTop: `1px solid rgba(255,255,255,0.08)`, padding: "44px 80px", background: "#0a0a0a", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="20" height="20" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="13" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="#ffffff" opacity=".85" />
                    <circle cx="14" cy="14" r="2.5" fill="#000" />
                </svg>
                <span className="bb" style={{ fontSize: 17, letterSpacing: 2, color: "#f5f5f7" }}>CrickIQ</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginLeft: 6 }}>© 2025</span>
            </div>
            <div style={{ display: "flex", gap: 24 }}>
                {["Product", "Docs", "API", "Privacy", "Contact"].map(l => (
                    <a key={l} href="#" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color .2s" }}
                        onMouseEnter={e => e.target.style.color = "#ffffff"} onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.3)"}>{l}</a>
                ))}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Built by A Rohan · Powered by Claude AI</div>
        </footer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT — ANALYSIS APP
// ═══════════════════════════════════════════════════════════════════════════════

function ScoreRing({ value, size = 72, label }) {
    const r = (size / 2) - 7;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = value >= 80 ? "#34c759" : value >= 60 ? "#ff9500" : "#ff3b30";
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={5} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1.2s ease" }} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color}
                    fontSize={size < 70 ? 12 : 15} fontWeight="600" fontFamily="Inter"
                    style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}>
                    {value}
                </text>
            </svg>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: .5, textAlign: "center" }}>{label}</span>
        </div>
    );
}

function UploadZone({ onFile, loading }) {
    const [drag, setDrag] = useState(false);
    const inputRef = useRef(null);

    const handleDrop = useCallback((e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
    }, [onFile]);

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
            style={{
                border: `2px dashed ${drag ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 20, padding: "52px 32px", textAlign: "center",
                cursor: loading ? "wait" : "pointer",
                background: drag ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                transition: "all .25s ease",
                boxShadow: drag ? `0 8px 32px rgba(0,0,0,0.5)` : "none",
            }}>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <svg className="spin" width="36" height="36" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#f5f5f7" strokeWidth="3"
                            strokeDasharray="88" strokeDashoffset="66" strokeLinecap="round" />
                    </svg>
                    <p style={{ color: "#f5f5f7", fontSize: 14, fontWeight: 500 }}>Analyzing with AI…</p>
                    <p style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>MediaPipe pose extraction + Claude Vision</p>
                </div>
            ) : (
                <>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>🏏</div>
                    <p style={{ fontSize: 15, fontWeight: 500, color: "#f5f5f7", marginBottom: 8 }}>Drop image here or click to browse</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,.38)", marginBottom: 20 }}>JPG · PNG · WEBP · up to 15 MB</p>
                    <Pill>Supports batting & bowling stances</Pill>
                </>
            )}
        </div>
    );
}

function ResultPanel({ result }) {
    const [tab, setTab] = useState(0);
    const { analysis, annotated_image, features } = result;
    const tabs = ["Weaknesses", "Vulnerable zones", "Drill plan", "Metrics"];
    const sevColor = { High: "#ff3b30", Critical: "#ff3b30", Med: "#ff9500", Low: "#34c759" };
    const sevBg = { High: "rgba(255,59,48,0.08)", Critical: "rgba(255,59,48,0.08)", Med: "rgba(255,149,0,0.08)", Low: "rgba(52,199,89,0.08)" };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* header scores */}
            <GlassCard hover={false} style={{ padding: "24px 24px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginBottom: 4 }}>OVERALL SCORE</div>
                        <div className="bb" style={{ fontSize: 56, color: "#f5f5f7", letterSpacing: 1, lineHeight: 1 }}>{analysis.overall_score}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 4 }}>{analysis.player_type?.toUpperCase()} ANALYSIS</div>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        {Object.entries(analysis.scores || {}).map(([k, v]) => (
                            <ScoreRing key={k} value={v} size={64} label={k.replace("_", " ").toUpperCase()} />
                        ))}
                    </div>
                </div>
                {analysis.summary && (
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginTop: 16, paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.08)` }}>
                        {analysis.summary}
                    </p>
                )}
            </GlassCard>

            {/* annotated image */}
            {annotated_image && (
                <GlassCard hover={false} style={{ marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", letterSpacing: 1.5, padding: "14px 20px 10px" }}>SKELETON OVERLAY</div>
                    <img src={annotated_image} alt="Annotated" style={{ width: "100%", display: "block", borderRadius: "0 0 14px 14px", maxHeight: 340, objectFit: "contain", background: "#0a0a0a" }} />
                </GlassCard>
            )}

            {/* tabs */}
            <GlassCard hover={false}>
                <div style={{ display: "flex", borderBottom: `1px solid rgba(255,255,255,0.08)`, padding: "0 8px" }}>
                    {tabs.map((t, i) => (
                        <button key={i} onClick={() => setTab(i)}
                            style={{
                                background: "none", border: "none", padding: "13px 14px", fontSize: 12,
                                color: tab === i ? "#ffffff" : "rgba(255,255,255,.35)",
                                borderBottom: tab === i ? "2px solid #ffffff" : "2px solid transparent",
                                cursor: "pointer", fontFamily: "Inter", transition: "color .2s", whiteSpace: "nowrap"
                            }}>{t}</button>
                    ))}
                </div>

                <div style={{ padding: "18px 18px" }}>
                    {tab === 0 && (
                        <div>
                            {(analysis.weaknesses || []).map((w, i) => (
                                <div key={i} style={{
                                    display: "flex", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, marginBottom: 8,
                                    transition: "border-color .2s"
                                }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
                                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,59,48,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>⚠</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f7", marginBottom: 2 }}>{w.title}</div>
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.42)", lineHeight: 1.6 }}>{w.detail}</div>
                                        {w.joint && <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)", marginTop: 3 }}>Joint: {w.joint}</div>}
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: .5, color: sevColor[w.severity] || "#34c759", background: sevBg[w.severity] || "rgba(52,199,89,0.08)", padding: "2px 8px", borderRadius: 6, alignSelf: "flex-start", flexShrink: 0 }}>{(w.severity || "").toUpperCase()}</div>
                                </div>
                            ))}
                            {analysis.strengths?.length > 0 && (
                                <div style={{ marginTop: 16, padding: "14px", background: "rgba(52,199,89,0.07)", borderRadius: 10, border: "1px solid rgba(52,199,89,0.18)" }}>
                                    <div style={{ fontSize: 11, color: "#34c759", fontWeight: 600, marginBottom: 8, letterSpacing: .5 }}>STRENGTHS DETECTED</div>
                                    {analysis.strengths.map((s, i) => (
                                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                                            <span style={{ color: "#34c759", flexShrink: 0 }}>✓</span>{s}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 1 && (
                        <div>
                            {(analysis.vulnerable_zones || []).map((z, i) => (
                                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, marginBottom: 8 }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
                                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,59,48,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>🎯</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f7", marginBottom: 2 }}>{z.delivery}</div>
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.42)", lineHeight: 1.6 }}>{z.reason}</div>
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: .5, color: sevColor[z.risk] || "#ff9500", background: sevBg[z.risk] || "rgba(255,149,0,0.08)", padding: "2px 8px", borderRadius: 6, alignSelf: "flex-start", flexShrink: 0 }}>{(z.risk || "").toUpperCase()}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 2 && (
                        <div>
                            {(analysis.drills || []).map((d, i) => (
                                <div key={i} style={{ padding: "14px", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, marginBottom: 8 }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#f5f5f7", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f7" }}>{d.name}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, marginLeft: 36 }}>{d.description}</div>
                                    {(d.duration || d.targets) && (
                                        <div style={{ display: "flex", gap: 12, marginLeft: 36, marginTop: 8, flexWrap: "wrap" }}>
                                            {d.duration && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 5 }}>⏱ {d.duration}</span>}
                                            {d.targets && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 5 }}>🎯 {d.targets}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 3 && (
                        <div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                                {Object.entries(features?.joint_angles || {}).filter(([, v]) => v !== null).map(([k, v]) => (
                                    <div key={k} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 8 }}>
                                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>{k.replace(/_/g, " ").toUpperCase()}</div>
                                        <div style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7" }}>{v}°</div>
                                    </div>
                                ))}
                            </div>
                            {Object.keys(features?.body_metrics || {}).length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 8 }}>BODY METRICS</div>
                                    {Object.entries(features.body_metrics).map(([k, v]) => (
                                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>{k.replace(/_/g, " ")}</span>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: "#f5f5f7" }}>{typeof v === "number" ? v.toFixed(2) : v}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {analysis.pro_comparison && (
                                <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10 }}>
                                    <div style={{ fontSize: 10, color: "#f5f5f7", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>PRO COMPARISON</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{analysis.pro_comparison}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}

function AnalysisApp({ onBack }) {
    const [playerType, setPlayerType] = useState("batsman");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);

    const handleFile = useCallback(async (file) => {
        setError(null); setResult(null);
        const url = URL.createObjectURL(file);
        setPreview(url);
        setLoading(true);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("player_type", playerType);

        try {
            const res = await fetch(`${API}/analyze`, { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Analysis failed");
            setResult(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [playerType]);

    const reset = () => { setResult(null); setError(null); setPreview(null); };

    return (
        <div style={{ minHeight: "100vh", background: "#000000", paddingTop: 0 }}>
            {/* App navbar */}
            <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(0,0,0,.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid rgba(255,255,255,0.08)`, padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button onClick={onBack} style={{ background: "none", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,.4)", cursor: "pointer", fontFamily: "Inter", transition: "all .2s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; e.currentTarget.style.color = "#ffffff"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,.4)"; }}>
                        ← Back
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 28 28">
                            <circle cx="14" cy="14" r="13" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="#ffffff" opacity=".85" />
                            <circle cx="14" cy="14" r="2.5" fill="#000" />
                        </svg>
                        <span className="bb" style={{ fontSize: 18, letterSpacing: 2, color: "#f5f5f7" }}>CrickIQ</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginLeft: 2 }}>Analysis Studio</span>
                    </div>
                </div>
                <Pill>BETA</Pill>
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px 60px" }}>
                {/* Player type selector */}
                {!result && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", letterSpacing: 1, marginBottom: 10 }}>PLAYER TYPE</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {["batsman", "bowler"].map(t => (
                                <button key={t} onClick={() => setPlayerType(t)}
                                    style={{
                                        padding: "8px 22px", borderRadius: 9,
                                        border: `1px solid ${playerType === t ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.1)"}`,
                                        background: playerType === t ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.04)",
                                        color: playerType === t ? "#000000" : "rgba(255,255,255,0.45)",
                                        fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "Inter", transition: "all .2s"
                                    }}>
                                    {t === "batsman" ? "🏏 Batsman" : "⚡ Bowler"}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{ padding: "14px 18px", background: "rgba(255,59,48,.08)", border: "1px solid rgba(255,59,48,.2)", borderRadius: 12, marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#ff3b30", marginBottom: 3 }}>Analysis failed</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{error}</div>
                            {error.includes("fetch") && <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 4 }}>Make sure the backend is running: <code style={{ color: "#f5f5f7" }}>uvicorn main:app --port 8000</code></div>}
                        </div>
                        <button onClick={reset} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,.3)", cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                )}

                {!result ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                        <div>
                            <UploadZone onFile={handleFile} loading={loading} />
                            {preview && !loading && (
                                <div style={{ marginTop: 12, position: "relative" }}>
                                    <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 260, objectFit: "contain", background: "#0a0a0a" }} />
                                    <button onClick={reset} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.7)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <GlassCard hover={false} style={{ padding: "22px 22px" }}>
                                <div style={{ fontSize: 12, color: "#f5f5f7", fontWeight: 600, letterSpacing: .5, marginBottom: 16 }}>WHAT YOU’LL GET</div>
                                {[
                                    ["🦴", "Skeleton overlay", "33-point MediaPipe pose mapped onto your image"],
                                    ["📐", "Joint angle analysis", "Elbow, knee, shoulder, hip angles measured precisely"],
                                    ["⚠", "Weakness detection", "AI identifies biomechanical flaws specific to your stance"],
                                    ["🎯", "Vulnerable zones", "Deliveries most likely to dismiss you, based on your gaps"],
                                    ["🏋", "Drill plan", "3–4 targeted drills with duration and focus areas"],
                                ].map(([icon, title, desc]) => (
                                    <div key={title} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f7", marginBottom: 2 }}>{title}</div>
                                            <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", lineHeight: 1.6 }}>{desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </GlassCard>

                            <GlassCard hover={false} style={{ padding: "18px 20px" }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.42)", lineHeight: 1.7 }}>
                                        <strong style={{ color: "#f5f5f7" }}>Best results:</strong> Upload a clear side-on or front-on shot of your full body. Natural light, plain background, full stance visible.
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div>
                                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f5f5f7" }}>Analysis complete</h2>
                                <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginTop: 2 }}>Processed in {result.elapsed_seconds}s · {result.analysis.player_type}</p>
                            </div>
                            <Btn variant="outline" onClick={reset} style={{ padding: "8px 18px", fontSize: 12 }}>← New analysis</Btn>
                        </div>
                        <ResultPanel result={result} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
    const [view, setView] = useState("landing"); // "landing" | "app"
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const launchApp = () => {
        setView("app");
        window.scrollTo(0, 0);
    };

    return (
        <>
            <style>{GLOBAL_CSS}</style>

            {view === "app" ? (
                <AnalysisApp onBack={() => setView("landing")} />
            ) : (
                <>
                    <Navbar scrollY={scrollY} onCTA={launchApp} />
                    <Hero scrollY={scrollY} onCTA={launchApp} />
                    <TrustedBy />
                    <Pipeline />
                    <Features />
                    <Comparison />
                    <Pricing onCTA={launchApp} />
                    <FinalCTA onCTA={launchApp} />
                    <Footer />
                </>
            )}
        </>
    );
}