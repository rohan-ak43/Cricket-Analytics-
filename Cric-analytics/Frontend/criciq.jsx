import { useState, useEffect, useRef } from "react";

const GREEN = "#4AFF5C";
const GREEN_DIM = "#1a4d1e";
const BG = "#080808";
const GLASS = "rgba(255,255,255,0.04)";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Bebas+Neue&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:${BG};color:#fff;font-family:'Inter',sans-serif;overflow-x:hidden}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#111}
::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
.bebas{font-family:'Bebas Neue',sans-serif}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.5)}}
@keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-12px)}}
@keyframes glow-line{0%{stroke-dashoffset:500}100%{stroke-dashoffset:0}}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes orbit{0%{transform:rotate(0deg) translateX(90px) rotate(0deg)}100%{transform:rotate(360deg) translateX(90px) rotate(-360deg)}}
@keyframes spin-slow{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes scanline{0%{top:-10%}100%{top:110%}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.animate-fadeUp{animation:fadeUp 0.8s ease forwards}
.marquee-track{display:flex;animation:marquee 24s linear infinite}
`;

function useInView(threshold = 0.15) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);
    return [ref, inView];
}

function FadeUp({ children, delay = 0, style = {} }) {
    const [ref, inView] = useInView();
    return (
        <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(40px)", transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`, ...style }}>
            {children}
        </div>
    );
}

// ── SKELETON SVG HERO PLAYER ──────────────────────────────────────────────────
function SkeletonPlayer({ scroll }) {
    const swing = Math.min(scroll * 0.3, 30);
    const joints = [
        [120, 60],   // head
        [120, 95],   // neck
        [95, 115],   // l-shoulder
        [145, 115],  // r-shoulder
        [75, 155],   // l-elbow
        [155, 140],  // r-elbow
        [60, 190],   // l-wrist / bat top
        [170, 168],  // r-wrist
        [120, 175],  // hip-center
        [105, 175],  // l-hip
        [135, 175],  // r-hip
        [100, 225],  // l-knee
        [140, 215],  // r-knee
        [95, 270],   // l-ankle
        [145, 260],  // r-ankle
    ];
    const bones = [
        [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
        [8, 9], [8, 10], [9, 11], [10, 12], [11, 13], [12, 14]
    ];
    const cx = 120, batLen = 80;
    const batX = joints[6][0] + Math.sin((swing * Math.PI) / 180) * 10;
    const batY = joints[6][1];
    const batEndX = batX - Math.sin((swing * Math.PI) / 180) * batLen;
    const batEndY = batY + Math.cos((swing * Math.PI) / 180) * batLen;

    return (
        <svg viewBox="0 0 240 320" style={{ width: "100%", maxWidth: 340, filter: `drop-shadow(0 0 20px ${GREEN}55)` }}>
            <defs>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={GREEN} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse cx="120" cy="280" rx="60" ry="8" fill={GREEN} opacity="0.08" />
            {/* glow halo */}
            <circle cx="120" cy="160" r="100" fill="url(#glow)" />
            {/* bones */}
            {bones.map(([a, b], i) => (
                <line key={i}
                    x1={joints[a][0]} y1={joints[a][1]}
                    x2={joints[b][0]} y2={joints[b][1]}
                    stroke={GREEN} strokeWidth="1.5" strokeOpacity="0.6"
                    strokeDasharray="4 2"
                />
            ))}
            {/* bat */}
            <line x1={batX} y1={batY} x2={batEndX} y2={batEndY} stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <line x1={batX} y1={batY} x2={batEndX} y2={batEndY} stroke={GREEN} strokeWidth="6" strokeLinecap="round" opacity="0.2" />
            {/* joints */}
            {joints.map(([x, y], i) => (
                <g key={i}>
                    <circle cx={x} cy={y} r={i === 0 ? 8 : 4} fill={BG} stroke={GREEN} strokeWidth="1.5" />
                    <circle cx={x} cy={y} r={i === 0 ? 4 : 2} fill={GREEN} opacity={0.9}
                        style={{ animation: `pulse-dot ${1.2 + i * 0.15}s ease-in-out infinite` }} />
                </g>
            ))}
            {/* label lines */}
            <line x1="155" y1="140" x2="185" y2="125" stroke={GREEN} strokeWidth="0.5" opacity="0.4" />
            <text x="188" y="122" fill={GREEN} fontSize="8" fontFamily="Inter" opacity="0.7">R. ELBOW 142°</text>
            <line x1="100" y1="225" x2="70" y2="215" stroke={GREEN} strokeWidth="0.5" opacity="0.4" />
            <text x="8" y="213" fill={GREEN} fontSize="8" fontFamily="Inter" opacity="0.7">KNEE 118°</text>
        </svg>
    );
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────
function Navbar({ scrollY }) {
    const solid = scrollY > 60;
    return (
        <nav style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
            background: solid ? "rgba(8,8,8,0.92)" : "transparent",
            backdropFilter: solid ? "blur(20px)" : "none",
            borderBottom: solid ? "1px solid rgba(255,255,255,0.06)" : "none",
            transition: "all 0.4s ease", padding: "0 40px", height: 64,
            display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="13" fill="none" stroke={GREEN} strokeWidth="1.5" />
                    <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill={GREEN} opacity="0.8" />
                    <circle cx="14" cy="14" r="2.5" fill="#fff" />
                </svg>
                <span className="bebas" style={{ fontSize: 22, letterSpacing: 2, color: "#fff" }}>CrickIQ</span>
            </div>
            <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
                {["Features", "Pipeline", "Pricing", "Docs"].map(l => (
                    <a key={l} href="#" style={{
                        color: "rgba(255,255,255,0.55)", fontSize: 13, textDecoration: "none", letterSpacing: 0.5,
                        transition: "color 0.2s"
                    }}
                        onMouseEnter={e => e.target.style.color = "#fff"}
                        onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.55)"}>{l}</a>
                ))}
                <button style={{
                    background: GREEN, color: "#000", border: "none", borderRadius: 8,
                    padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "Inter", letterSpacing: 0.3
                }}>
                    Get Early Access
                </button>
            </div>
        </nav>
    );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ scrollY }) {
    return (
        <section style={{
            minHeight: "100vh", display: "flex", alignItems: "center",
            padding: "120px 80px 80px", position: "relative", overflow: "hidden"
        }}>
            {/* pitch grid bg */}
            <div style={{
                position: "absolute", inset: 0, backgroundImage:
                    `linear-gradient(rgba(74,255,92,0.04) 1px, transparent 1px),
         linear-gradient(90deg, rgba(74,255,92,0.04) 1px, transparent 1px)`,
                backgroundSize: "60px 60px", opacity: 0.6
            }} />
            {/* scanline */}
            <div style={{
                position: "absolute", left: 0, right: 0, height: "2px",
                background: `linear-gradient(90deg, transparent, ${GREEN}33, transparent)`,
                animation: "scanline 6s linear infinite", pointerEvents: "none"
            }} />
            {/* radial glow */}
            <div style={{
                position: "absolute", top: "30%", right: "25%", width: 500, height: 500,
                background: `radial-gradient(circle, ${GREEN}0f 0%, transparent 70%)`,
                transform: `translateY(${scrollY * 0.1}px)`, pointerEvents: "none"
            }} />

            <div style={{ flex: 1, maxWidth: 620, position: "relative", zIndex: 2 }}>
                <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8, background: GREEN_DIM,
                    border: `1px solid ${GREEN}44`, borderRadius: 100, padding: "5px 14px", marginBottom: 28
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: "50%", background: GREEN,
                        animation: "pulse-dot 1.5s ease-in-out infinite"
                    }} />
                    <span style={{ fontSize: 11, color: GREEN, letterSpacing: 1, fontWeight: 500 }}>AI-POWERED CRICKET ANALYTICS</span>
                </div>

                <h1 className="bebas" style={{
                    fontSize: "clamp(72px, 9vw, 120px)", lineHeight: 0.92,
                    letterSpacing: 2, marginBottom: 28,
                    animation: "fadeUp 0.9s ease forwards", opacity: 0, animationDelay: "0.1s"
                }}>
                    <span style={{ display: "block" }}>Train</span>
                    <span style={{ display: "block", color: GREEN }}>Smarter.</span>
                    <span style={{ display: "block" }}>Win</span>
                    <span style={{ display: "block" }}>Bigger.</span>
                </h1>

                <p style={{
                    fontSize: 17, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 480,
                    marginBottom: 40, animation: "fadeUp 0.9s ease forwards", opacity: 0, animationDelay: "0.3s"
                }}>
                    Upload your batting or bowling footage. Our AI detects biomechanical
                    weaknesses, tactical vulnerabilities, and generates personalized drill plans.
                </p>

                <div style={{
                    display: "flex", gap: 14, flexWrap: "wrap",
                    animation: "fadeUp 0.9s ease forwards", opacity: 0, animationDelay: "0.5s"
                }}>
                    <button style={{
                        background: GREEN, color: "#000", border: "none", borderRadius: 10,
                        padding: "14px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer",
                        fontFamily: "Inter", letterSpacing: 0.3, transition: "transform 0.2s, box-shadow 0.2s",
                        boxShadow: `0 0 24px ${GREEN}55`
                    }}
                        onMouseEnter={e => { e.target.style.transform = "scale(1.04)"; e.target.style.boxShadow = `0 0 40px ${GREEN}88`; }}
                        onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = `0 0 24px ${GREEN}55`; }}>
                        Analyze Performance →
                    </button>
                    <button style={{
                        background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10, padding: "14px 32px", fontSize: 15, cursor: "pointer",
                        fontFamily: "Inter", transition: "border-color 0.2s"
                    }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = GREEN}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}>
                        ▷ Watch Demo
                    </button>
                </div>

                <div style={{
                    display: "flex", gap: 32, marginTop: 52, paddingTop: 32,
                    borderTop: "1px solid rgba(255,255,255,0.06)"
                }}>
                    {[["98%", "Accuracy"], ["2.4s", "Analysis time"], ["3K+", "Players analyzed"]].map(([n, l]) => (
                        <div key={l}>
                            <div className="bebas" style={{ fontSize: 36, color: GREEN, letterSpacing: 1 }}>{n}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", letterSpacing: 0.5, marginTop: 2 }}>{l}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{
                flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
                position: "relative", zIndex: 2, animation: "float 4s ease-in-out infinite",
                transform: `translateY(${-scrollY * 0.06}px)`
            }}>
                <SkeletonPlayer scroll={scrollY} />
            </div>
        </section>
    );
}

// ── TRUSTED BY ────────────────────────────────────────────────────────────────
function TrustedBy() {
    const orgs = ["Chennai Super Kings", "BCCI Academy", "ProFormance Labs", "Elite Cricket Co.", "Pitch Vision", "SportsAI Global", "Titan Cricket Club", "NCA Bangalore"];
    return (
        <section style={{
            padding: "48px 0", borderTop: "1px solid rgba(255,255,255,0.05)",
            borderBottom: "1px solid rgba(255,255,255,0.05)", overflow: "hidden"
        }}>
            <p style={{
                textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, marginBottom: 24
            }}>TRUSTED BY LEADING ACADEMIES & CLUBS</p>
            <div style={{ overflow: "hidden" }}>
                <div className="marquee-track">
                    {[...orgs, ...orgs].map((o, i) => (
                        <div key={i} style={{
                            flex: "0 0 auto", padding: "0 44px",
                            color: "rgba(255,255,255,0.25)", fontSize: 14, fontWeight: 500,
                            letterSpacing: 0.5, whiteSpace: "nowrap", transition: "color 0.3s",
                            cursor: "default"
                        }}
                            onMouseEnter={e => e.target.style.color = GREEN}
                            onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.25)"}>{o}</div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── PIPELINE ──────────────────────────────────────────────────────────────────
function Pipeline() {
    const steps = [
        { icon: "⬆", label: "Input layer", sub: "Video (.mp4 / .mov) or Image (.jpg / .png)", color: "#4AFF5C" },
        { icon: "⚙", label: "Preprocessing & pose estimation", sub: "Frame extraction · MediaPipe keypoints · Skeleton overlay", color: "#38bdf8" },
        { icon: "⬡", label: "Feature extraction engine", sub: "Joint angles · Foot balance · Swing arc · Release mechanics", color: "#a78bfa" },
        { icon: "✦", label: "Claude AI analysis", sub: "Vision API · Pose JSON + annotated frame · Weakness & vulnerability detection", color: GREEN },
        { icon: "↓", label: "Output layer", sub: "Weakness report · Annotated video · Drill plan · PDF export", color: "#fb923c" },
    ];
    return (
        <section style={{ padding: "120px 80px" }}>
            <FadeUp>
                <div style={{ textAlign: "center", marginBottom: 72 }}>
                    <p style={{ fontSize: 11, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>HOW IT WORKS</p>
                    <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 72px)", letterSpacing: 1 }}>The Intelligence Pipeline</h2>
                </div>
            </FadeUp>
            <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
                {/* vertical line */}
                <div style={{
                    position: "absolute", left: 31, top: 0, bottom: 0, width: 1,
                    background: "linear-gradient(to bottom, transparent, rgba(74,255,92,0.3), transparent)"
                }} />
                {steps.map((s, i) => (
                    <FadeUp key={i} delay={i * 0.12}>
                        <div style={{
                            display: "flex", gap: 24, marginBottom: i < steps.length - 1 ? 32 : 0,
                            position: "relative"
                        }}>
                            <div style={{
                                width: 62, height: 62, flexShrink: 0, borderRadius: 14,
                                background: GLASS, border: `1px solid ${s.color}33`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 22, color: s.color, backdropFilter: "blur(10px)",
                                boxShadow: `0 0 20px ${s.color}22`, position: "relative", zIndex: 1
                            }}>
                                {s.icon}
                            </div>
                            <div style={{
                                background: GLASS, border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 14, padding: "18px 22px", flex: 1, backdropFilter: "blur(10px)",
                                transition: "border-color 0.3s, box-shadow 0.3s"
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}44`; e.currentTarget.style.boxShadow = `0 0 24px ${s.color}18`; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#fff" }}>{s.label}</div>
                                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{s.sub}</div>
                            </div>
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{ width: 1, height: 32, background: `${s.color}40`, marginLeft: 30, marginBottom: 0 }} />
                        )}
                    </FadeUp>
                ))}
            </div>
        </section>
    );
}

// ── FEATURES ──────────────────────────────────────────────────────────────────
function Features() {
    const cards = [
        { title: "AI Biomechanics Engine", desc: "33-point MediaPipe skeleton analysis with joint angle computation across all key cricket movements.", icon: "🦾" },
        { title: "Batting Weakness Detection", desc: "Identifies playing across the line, late foot movement, head fall, and grip issues.", icon: "🏏" },
        { title: "Bowling Action Breakdown", desc: "Front-on vs side-on detection, illegal action flags, release height, front knee analysis.", icon: "⚡" },
        { title: "Vulnerability Prediction", desc: "AI maps your weaknesses to the specific ball type, line and length most likely to dismiss you.", icon: "🎯" },
        { title: "Pro Comparison Mode", desc: "Upload a reference clip of any professional. Get a side-by-side metric comparison instantly.", icon: "📊" },
        { title: "Session History", desc: "Track biomechanical progress across sessions. Firebase-backed coach dashboard included.", icon: "📈" },
    ];
    return (
        <section style={{ padding: "120px 80px", background: "rgba(255,255,255,0.01)" }}>
            <FadeUp>
                <div style={{ textAlign: "center", marginBottom: 64 }}>
                    <p style={{ fontSize: 11, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>CAPABILITIES</p>
                    <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 72px)", letterSpacing: 1 }}>Built for elite performance</h2>
                </div>
            </FadeUp>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16, maxWidth: 1080, margin: "0 auto" }}>
                {cards.map((c, i) => (
                    <FadeUp key={i} delay={i * 0.08}>
                        <div style={{
                            background: GLASS, border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 18, padding: "28px 28px", backdropFilter: "blur(12px)",
                            cursor: "default", transition: "transform 0.3s, border-color 0.3s, box-shadow 0.3s",
                            height: "100%"
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = `${GREEN}44`; e.currentTarget.style.boxShadow = `0 16px 40px rgba(74,255,92,0.08)`; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}>
                            <div style={{ fontSize: 28, marginBottom: 14 }}>{c.icon}</div>
                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{c.title}</div>
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{c.desc}</div>
                        </div>
                    </FadeUp>
                ))}
            </div>
        </section>
    );
}

// ── COMPARISON ────────────────────────────────────────────────────────────────
function Comparison() {
    const [slider, setSlider] = useState(50);
    const metrics = [
        { label: "Bat angle", user: 68, pro: 85 },
        { label: "Head stability", user: 74, pro: 96 },
        { label: "Front foot align", user: 55, pro: 91 },
        { label: "Release height", user: 80, pro: 88 },
        { label: "Knee bend", user: 62, pro: 90 },
    ];
    return (
        <section style={{ padding: "120px 80px" }}>
            <FadeUp>
                <div style={{ textAlign: "center", marginBottom: 64 }}>
                    <p style={{ fontSize: 11, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>PRO COMPARISON</p>
                    <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 72px)", letterSpacing: 1 }}>See the gap. Close it.</h2>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, marginTop: 12, maxWidth: 480, margin: "12px auto 0" }}>
                        Upload a reference clip of any professional. AI aligns, compares, and highlights every difference.
                    </p>
                </div>
            </FadeUp>
            <FadeUp delay={0.2}>
                <div style={{
                    maxWidth: 900, margin: "0 auto", background: GLASS,
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, overflow: "hidden",
                    backdropFilter: "blur(16px)"
                }}>
                    {/* header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ padding: "20px 28px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>YOUR ANALYSIS</div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>Match footage · Batsman</div>
                        </div>
                        <div style={{ padding: "20px 28px" }}>
                            <div style={{ fontSize: 11, color: GREEN, letterSpacing: 1, marginBottom: 4 }}>PRO REFERENCE</div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>Virat Kohli · Cover drive</div>
                        </div>
                    </div>
                    {/* slider area */}
                    <div style={{ position: "relative", height: 220, background: "#0d0d0d", overflow: "hidden" }}>
                        {/* user side */}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg viewBox="0 0 120 180" style={{ height: 160, opacity: 0.4, filter: "grayscale(1)" }}>
                                <line x1="60" y1="20" x2="60" y2="60" stroke="#fff" strokeWidth="2" />
                                <line x1="60" y1="60" x2="35" y2="90" stroke="#fff" strokeWidth="2" />
                                <line x1="60" y1="60" x2="85" y2="80" stroke="#fff" strokeWidth="2" />
                                <line x1="60" y1="100" x2="45" y2="140" stroke="#fff" strokeWidth="2" />
                                <line x1="60" y1="100" x2="75" y2="135" stroke="#fff" strokeWidth="2" />
                                <circle cx="60" cy="15" r="8" fill="none" stroke="#fff" strokeWidth="1.5" />
                                {[[60, 20], [60, 60], [35, 90], [85, 80], [60, 100], [45, 140], [75, 135]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#777" />)}
                            </svg>
                        </div>
                        {/* pro side */}
                        <div style={{
                            position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
                            clipPath: `inset(0 ${100 - slider}% 0 0)`,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                            <svg viewBox="0 0 120 180" style={{ height: 160 }}>
                                <line x1="60" y1="20" x2="60" y2="60" stroke={GREEN} strokeWidth="2" />
                                <line x1="60" y1="60" x2="30" y2="85" stroke={GREEN} strokeWidth="2" />
                                <line x1="60" y1="60" x2="88" y2="72" stroke={GREEN} strokeWidth="2" />
                                <line x1="60" y1="100" x2="42" y2="148" stroke={GREEN} strokeWidth="2" />
                                <line x1="60" y1="100" x2="78" y2="142" stroke={GREEN} strokeWidth="2" />
                                <circle cx="60" cy="15" r="8" fill="none" stroke={GREEN} strokeWidth="1.5" />
                                {[[60, 20], [60, 60], [30, 85], [88, 72], [60, 100], [42, 148], [78, 142]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={GREEN} />)}
                            </svg>
                        </div>
                        {/* divider */}
                        <div style={{
                            position: "absolute", top: 0, bottom: 0, left: `${slider}%`,
                            width: 2, background: "#fff", transform: "translateX(-50%)"
                        }}>
                            <div style={{
                                position: "absolute", top: "50%", left: "50%",
                                transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%",
                                background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, color: "#000", fontWeight: 700, cursor: "ew-resize", userSelect: "none"
                            }}>⇔</div>
                        </div>
                        <input type="range" min="10" max="90" value={slider}
                            onChange={e => setSlider(+e.target.value)}
                            style={{
                                position: "absolute", inset: 0, width: "100%", height: "100%",
                                opacity: 0, cursor: "ew-resize", zIndex: 10
                            }} />
                        <div style={{
                            position: "absolute", bottom: 12, left: 12, fontSize: 11,
                            color: "rgba(255,255,255,0.3)", letterSpacing: 1
                        }}>YOU</div>
                        <div style={{
                            position: "absolute", bottom: 12, right: 12, fontSize: 11,
                            color: GREEN, letterSpacing: 1
                        }}>PRO</div>
                    </div>
                    {/* metrics */}
                    <div style={{ padding: "24px 28px" }}>
                        {metrics.map((m, i) => (
                            <div key={i} style={{ marginBottom: i < metrics.length - 1 ? 14 : 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{m.label}</span>
                                    <span style={{ fontSize: 12, color: m.user >= 80 ? GREEN : m.user >= 65 ? "#fb923c" : "#ef4444" }}>
                                        {m.user} <span style={{ color: "rgba(255,255,255,0.2)" }}>/ {m.pro}</span>
                                    </span>
                                </div>
                                <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 4 }}>
                                    <div style={{
                                        position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 4,
                                        width: `${m.pro}%`, background: `${GREEN}33`
                                    }} />
                                    <div style={{
                                        position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 4,
                                        width: `${m.user}%`, background: m.user >= 80 ? GREEN : m.user >= 65 ? "#fb923c" : "#ef4444",
                                        transition: "width 1s ease"
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </FadeUp>
        </section>
    );
}

// ── AI INSIGHTS ───────────────────────────────────────────────────────────────
function Insights() {
    const [active, setActive] = useState(0);
    const tabs = ["Weaknesses", "Vulnerable zones", "Drill plan"];
    const content = [
        [
            { label: "Playing across the line", severity: "High", icon: "⚠" },
            { label: "Late front foot movement", severity: "High", icon: "⚠" },
            { label: "Head falling over at contact", severity: "Med", icon: "◈" },
            { label: "Closed bat face on drive", severity: "Med", icon: "◈" },
        ],
        [
            { label: "Yorker — off stump channel", severity: "Critical", icon: "🎯" },
            { label: "Short ball — rib height", severity: "Critical", icon: "🎯" },
            { label: "Away swing outside off", severity: "High", icon: "⚡" },
            { label: "Slow leg spin — flat trajectory", severity: "High", icon: "⚡" },
        ],
        [
            { label: "Front foot balance drill", note: "10 min × 3 sessions/week", icon: "1" },
            { label: "Shadow bat alignment drill", note: "Mirror feedback required", icon: "2" },
            { label: "Reaction ball footwork", note: "15 min, unpredictable surface", icon: "3" },
            { label: "Tee batting — head position", note: "Camera feedback loop", icon: "4" },
        ],
    ];
    const colors = { High: "#ef4444", Critical: "#ef4444", Med: "#fb923c" };
    return (
        <section style={{ padding: "120px 80px", background: "rgba(255,255,255,0.01)" }}>
            <FadeUp>
                <div style={{ textAlign: "center", marginBottom: 64 }}>
                    <p style={{ fontSize: 11, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>AI REPORT</p>
                    <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 72px)", letterSpacing: 1 }}>Intelligence, not just data.</h2>
                </div>
            </FadeUp>
            <FadeUp delay={0.2}>
                <div style={{
                    maxWidth: 760, margin: "0 auto", background: "#0d0d0d",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, overflow: "hidden"
                }}>
                    {/* mock browser bar */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "14px 20px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#111"
                    }}>
                        {["#ef4444", "#fb923c", GREEN].map((c, i) =>
                            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />)}
                        <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                            crickiq.app/report/session_2024_07
                        </div>
                        <div style={{ fontSize: 11, color: GREEN, opacity: 0.7 }}>● LIVE</div>
                    </div>
                    {/* tabs */}
                    <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px" }}>
                        {tabs.map((t, i) => (
                            <button key={i} onClick={() => setActive(i)}
                                style={{
                                    background: "none", border: "none", padding: "14px 18px", fontSize: 13,
                                    color: active === i ? "#fff" : "rgba(255,255,255,0.35)",
                                    borderBottom: active === i ? `2px solid ${GREEN}` : "2px solid transparent",
                                    cursor: "pointer", fontFamily: "Inter", transition: "color 0.2s"
                                }}>{t}</button>
                        ))}
                    </div>
                    {/* content */}
                    <div style={{ padding: "24px" }}>
                        {content[active].map((item, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "14px 16px", background: GLASS,
                                border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 10,
                                transition: "border-color 0.2s"
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = `${GREEN}33`}
                                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: active === 2 ? `${GREEN}18` : "rgba(239,68,68,0.1)",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14
                                }}>
                                    {item.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                                    {item.note && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{item.note}</div>}
                                </div>
                                {item.severity && (
                                    <div style={{
                                        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                                        color: colors[item.severity] || GREEN,
                                        background: `${colors[item.severity] || GREEN}15`,
                                        padding: "3px 8px", borderRadius: 6
                                    }}>{item.severity.toUpperCase()}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </FadeUp>
        </section>
    );
}

// ── TECH STACK ────────────────────────────────────────────────────────────────
function TechStack() {
    const techs = ["Python", "FastAPI", "OpenCV", "MediaPipe", "Claude AI", "React", "TypeScript", "Firebase", "Framer Motion"];
    return (
        <section style={{ padding: "120px 80px" }}>
            <FadeUp>
                <div style={{ textAlign: "center", marginBottom: 56 }}>
                    <p style={{ fontSize: 11, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>UNDER THE HOOD</p>
                    <h2 className="bebas" style={{ fontSize: "clamp(48px,6vw,72px)", letterSpacing: 1 }}>Engineered for precision</h2>
                </div>
            </FadeUp>
            <FadeUp delay={0.2}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: 720, margin: "0 auto" }}>
                    {techs.map((t, i) => (
                        <div key={i} style={{
                            background: GLASS, border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 100, padding: "10px 22px", fontSize: 13, fontWeight: 500,
                            backdropFilter: "blur(10px)", transition: "border-color 0.3s, color 0.3s, box-shadow 0.3s",
                            cursor: "default", animation: `float ${3 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s`
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.color = GREEN; e.currentTarget.style.boxShadow = `0 0 20px ${GREEN}33`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = "none"; }}>
                            {t}
                        </div>
                    ))}
                </div>
            </FadeUp>
        </section>
    );
}

// ── PRICING ───────────────────────────────────────────────────────────────────
function Pricing() {
    const plans = [
        { name: "Starter", price: "₹0", period: "free forever", features: ["5 analyses/month", "Image uploads only", "Basic weakness report", "Community support"], highlight: false },
        { name: "Pro", price: "₹799", period: "/month", features: ["Unlimited analyses", "Video + Image uploads", "Full AI report + drills", "Pro comparison mode", "PDF export", "Priority support"], highlight: true },
        { name: "Academy", price: "₹3,999", period: "/month", features: ["Everything in Pro", "Up to 50 player profiles", "Coach dashboard", "Session history & trends", "API access", "Dedicated support"], highlight: false },
    ];
    return (
        <section style={{ padding: "120px 80px", background: "rgba(255,255,255,0.01)" }}>
            <FadeUp>
                <div style={{ textAlign: "center", marginBottom: 64 }}>
                    <p style={{ fontSize: 11, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>PRICING</p>
                    <h2 className="bebas" style={{ fontSize: "clamp(48px,6vw,72px)", letterSpacing: 1 }}>Start free. Scale when you're ready.</h2>
                </div>
            </FadeUp>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, maxWidth: 900, margin: "0 auto" }}>
                {plans.map((p, i) => (
                    <FadeUp key={i} delay={i * 0.1}>
                        <div style={{
                            background: p.highlight ? `linear-gradient(135deg, #0f1f10 0%, #0a1a0b 100%)` : GLASS,
                            border: p.highlight ? `1px solid ${GREEN}55` : "1px solid rgba(255,255,255,0.07)",
                            borderRadius: 20, padding: "32px 28px", backdropFilter: "blur(12px)",
                            boxShadow: p.highlight ? `0 0 40px ${GREEN}18` : "none", position: "relative"
                        }}>
                            {p.highlight && <div style={{
                                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                                background: GREEN, color: "#000", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                                padding: "3px 14px", borderRadius: 100
                            }}>MOST POPULAR</div>}
                            <div style={{ fontSize: 12, color: p.highlight ? GREEN : "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 8 }}>{p.name.toUpperCase()}</div>
                            <div className="bebas" style={{ fontSize: 48, letterSpacing: 1, color: p.highlight ? GREEN : "#fff" }}>{p.price}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 28, marginTop: 2 }}>{p.period}</div>
                            {p.features.map((f, j) => (
                                <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                                    <span style={{ color: GREEN, fontSize: 13, marginTop: 1 }}>✓</span>
                                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{f}</span>
                                </div>
                            ))}
                            <button style={{
                                marginTop: 24, width: "100%", padding: "12px",
                                background: p.highlight ? GREEN : "transparent",
                                color: p.highlight ? "#000" : "#fff",
                                border: p.highlight ? "none" : "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                                fontFamily: "Inter", transition: "all 0.2s"
                            }}
                                onMouseEnter={e => { if (!p.highlight) { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.color = GREEN; } else { e.currentTarget.style.opacity = "0.85"; } }}
                                onMouseLeave={e => { if (!p.highlight) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; } else { e.currentTarget.style.opacity = "1"; } }}>
                                {i === 0 ? "Get started free" : i === 1 ? "Start Pro trial" : "Contact sales"}
                            </button>
                        </div>
                    </FadeUp>
                ))}
            </div>
        </section>
    );
}

// ── FINAL CTA ─────────────────────────────────────────────────────────────────
function CTA() {
    return (
        <section style={{ padding: "160px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{
                position: "absolute", inset: 0, backgroundImage:
                    `radial-gradient(circle at center, ${GREEN}08 0%, transparent 60%),
         linear-gradient(rgba(74,255,92,0.03) 1px, transparent 1px),
         linear-gradient(90deg, rgba(74,255,92,0.03) 1px, transparent 1px)`,
                backgroundSize: "auto, 40px 40px, 40px 40px"
            }} />
            <FadeUp>
                <h2 className="bebas" style={{
                    fontSize: "clamp(56px,8vw,100px)", letterSpacing: 1.5,
                    lineHeight: 0.95, marginBottom: 28
                }}>
                    Your breakthrough<br />
                    <span style={{ color: GREEN }}>starts here.</span>
                </h2>
                <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", maxWidth: 440, margin: "0 auto 44px" }}>
                    Upload your first video free. No credit card. Analysis in under 3 seconds.
                </p>
                <button style={{
                    background: GREEN, color: "#000", border: "none", borderRadius: 12,
                    padding: "16px 44px", fontSize: 16, fontWeight: 700, cursor: "pointer",
                    fontFamily: "Inter", letterSpacing: 0.3, boxShadow: `0 0 40px ${GREEN}55`,
                    transition: "transform 0.2s, box-shadow 0.2s"
                }}
                    onMouseEnter={e => { e.target.style.transform = "scale(1.05)"; e.target.style.boxShadow = `0 0 60px ${GREEN}88`; }}
                    onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = `0 0 40px ${GREEN}55`; }}>
                    Start Free Analysis →
                </button>
            </FadeUp>
        </section>
    );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
    return (
        <footer style={{
            borderTop: "1px solid rgba(255,255,255,0.05)", padding: "48px 80px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="22" height="22" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="13" fill="none" stroke={GREEN} strokeWidth="1.5" />
                    <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill={GREEN} opacity="0.8" />
                    <circle cx="14" cy="14" r="2.5" fill="#fff" />
                </svg>
                <span className="bebas" style={{ fontSize: 18, letterSpacing: 2 }}>CrickIQ</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginLeft: 8 }}>© 2025</span>
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                {["Product", "Docs", "API", "Privacy", "Contact"].map(l => (
                    <a key={l} href="#" style={{
                        fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none",
                        transition: "color 0.2s"
                    }}
                        onMouseEnter={e => e.target.style.color = "#fff"}
                        onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.35)"}>{l}</a>
                ))}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                Built with Claude AI · A Rohan
            </div>
        </footer>
    );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
    const [scrollY, setScrollY] = useState(0);
    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return (
        <>
            <style>{css}</style>
            <Navbar scrollY={scrollY} />
            <Hero scrollY={scrollY} />
            <TrustedBy />
            <Pipeline />
            <Features />
            <Comparison />
            <Insights />
            <TechStack />
            <Pricing />
            <CTA />
            <Footer />
        </>
    );
}