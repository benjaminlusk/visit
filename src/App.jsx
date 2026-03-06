import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "./supabase";

const CATEGORIES = [
  {
    id: "professionalism",
    label: "Teacher Professionalism",
    icon: "🎓",
    color: "#2563eb",
    indicators: [
      "Teacher is NOT sitting at desk",
      "No cellphones, headphones, or hoods on students",
      "No sleeping, off-task talking, food, or gum",
      "Teacher is actively demanding respect from students",
    ],
  },
  {
    id: "environment",
    label: "Learning Environment",
    icon: "🏫",
    color: "#16a34a",
    indicators: [
      "Teaching from bell to bell",
      "Hook / engaging activity when students walk in",
      "Hall pass system is in use",
      "Students using computers for school work only",
    ],
  },
  {
    id: "instruction",
    label: "Instruction",
    icon: "📚",
    color: "#9333ea",
    indicators: [
      "Clear learning focus is visible and communicated",
      "Students are actively engaged",
      "Teacher conveys belief that all students can learn",
    ],
  },
];

const RATINGS = [
  { value: "yes", label: "✓", color: "#16a34a", bg: "#f0fdf4", border: "#16a34a" },
  { value: "maybe", label: "~", color: "#d97706", bg: "#fffbeb", border: "#d97706" },
  { value: "no", label: "✗", color: "#dc2626", bg: "#fef2f2", border: "#dc2626" },
  { value: "n/o", label: "N/O", color: "#94a3b8", bg: "#f8fafc", border: "#cbd5e1" },
];

const OBSERVERS = ["Select your name", "Instructional Coach", "Principal", "Assistant Principal"];

const blank = () => ({
  teacher: "",
  date: new Date().toISOString().split("T")[0],
  ratings: {},
  notes: { professionalism: "", environment: "", instruction: "" },
});

function scoreForCategory(ratings, catId, indicators) {
  const scored = indicators.map((_, i) => ratings[`${catId}_${i}`]).filter((v) => v && v !== "n/o");
  if (!scored.length) return null;
  const yes = scored.filter((v) => v === "yes").length;
  const maybe = scored.filter((v) => v === "maybe").length;
  return { yes, maybe, no: scored.filter((v) => v === "no").length, total: scored.length };
}

function ScoreBadge({ ratings, catId, indicators }) {
  const s = scoreForCategory(ratings, catId, indicators);
  if (!s) return null;
  return (
    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
      <span style={{ color: "#16a34a" }}>{s.yes}✓</span>{" "}
      <span style={{ color: "#d97706" }}>{s.maybe}~</span>{" "}
      <span style={{ color: "#dc2626" }}>{s.no}✗</span>
    </span>
  );
}

export default function App() {
  const [observer, setObserver] = useState(() => localStorage.getItem("wt_observer") || "");
  const [view, setView] = useState("form");
  const [form, setForm] = useState(blank());
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filterTeacher, setFilterTeacher] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [filterObserver, setFilterObserver] = useState("All");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    if (observer) loadData();
  }, [observer]);

  async function loadData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("walkthroughs")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      setWalkthroughs(data || []);
    } catch (e) {
      console.error(e);
      setDbError(true);
    }
    setLoading(false);
  }

  const setRating = (catId, idx, val) => {
    const key = `${catId}_${idx}`;
    setForm((f) => ({ ...f, ratings: { ...f.ratings, [key]: f.ratings[key] === val ? null : val } }));
  };

  const submit = async () => {
    if (!form.teacher || !observer) return;
    setSaving(true);
    try {
      const entry = {
        teacher: form.teacher,
        date: form.date,
        observer,
        ratings: form.ratings,
        notes: form.notes,
        submitted_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("walkthroughs").insert([entry]).select();
      if (error) throw error;
      setWalkthroughs((prev) => [data[0], ...prev]);
      setSaved(true);
      setTimeout(() => { setSaved(false); setForm(blank()); }, 1800);
    } catch (e) {
      console.error(e);
      alert("Error saving. Check your Supabase connection.");
    }
    setSaving(false);
  };

  function exportCSV(type) {
    const data = walkthroughs.filter((w) => {
      if (exportFrom && w.date < exportFrom) return false;
      if (exportTo && w.date > exportTo) return false;
      return true;
    });
    let rows = [];
    if (type === "summary") {
      const headers = ["Date", "Teacher", "Observer",
        ...CATEGORIES.flatMap((c) => [c.label + " (Yes)", c.label + " (Maybe)", c.label + " (No)", c.label + " (N/O)"]),
        ...CATEGORIES.map((c) => c.label + " Notes"),
      ];
      rows.push(headers);
      data.forEach((w) => {
        const row = [w.date, w.teacher, w.observer];
        CATEGORIES.forEach((cat) => {
          let yes = 0, maybe = 0, no = 0, no_obs = 0;
          cat.indicators.forEach((_, i) => {
            const v = (w.ratings || {})[cat.id + "_" + i];
            if (v === "yes") yes++;
            else if (v === "maybe") maybe++;
            else if (v === "no") no++;
            else if (v === "n/o") no_obs++;
          });
          row.push(yes, maybe, no, no_obs);
        });
        CATEGORIES.forEach((cat) => row.push('"' + ((w.notes || {})[cat.id] || "").replace(/"/g, '""') + '"'));
        rows.push(row);
      });
    } else {
      rows.push(["Date", "Teacher", "Observer", "Category", "Indicator", "Rating", "Notes"]);
      data.forEach((w) => {
        CATEGORIES.forEach((cat) => {
          cat.indicators.forEach((text, i) => {
            const val = (w.ratings || {})[cat.id + "_" + i] || "";
            rows.push([w.date, w.teacher, w.observer, cat.label, '"' + text + '"', val, '"' + ((w.notes || {})[cat.id] || "").replace(/"/g, '""') + '"']);
          });
        });
      });
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `walkthroughs_${type}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleSelectObserver = (name) => {
    localStorage.setItem("wt_observer", name);
    setObserver(name);
  };

  // Login
  if (!observer) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 36, width: "100%", maxWidth: 340, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Welcome</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>Classroom Walkthrough Tool</div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8, textAlign: "left" }}>Who are you?</label>
          <select
            defaultValue="Select your name"
            onChange={(e) => { if (e.target.value !== "Select your name") handleSelectObserver(e.target.value); }}
            style={{ width: "100%", padding: "11px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 15, color: "#0f172a", background: "#f8fafc", cursor: "pointer" }}
          >
            {OBSERVERS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 18 }}>Data is shared between all observers in real time.</div>
        </div>
      </div>
    );
  }

  const teachers = ["All", ...Array.from(new Set(walkthroughs.map((w) => w.teacher))).sort()];
  const observers = ["All", ...Array.from(new Set(walkthroughs.map((w) => w.observer))).sort()];

  const filtered = walkthroughs.filter((w) => {
    if (filterTeacher !== "All" && w.teacher !== filterTeacher) return false;
    if (filterDate && w.date !== filterDate) return false;
    if (filterObserver !== "All" && w.observer !== filterObserver) return false;
    return true;
  });

  const chartData = CATEGORIES.map((cat) => {
    const all = walkthroughs.flatMap((w) =>
      cat.indicators.map((_, i) => (w.ratings || {})[`${cat.id}_${i}`]).filter((v) => v && v !== "n/o")
    );
    const yes = all.filter((v) => v === "yes").length;
    const pct = all.length ? Math.round((yes / all.length) * 100) : 0;
    return { name: cat.label.split(" ").slice(-1)[0], fullName: cat.label, pct, color: cat.color };
  });

  const teacherData = Array.from(new Set(walkthroughs.map((w) => w.teacher))).sort().map((teacher) => {
    const tw = walkthroughs.filter((w) => w.teacher === teacher);
    const all = tw.flatMap((w) =>
      CATEGORIES.flatMap((cat) => cat.indicators.map((_, i) => (w.ratings || {})[`${cat.id}_${i}`]).filter((v) => v && v !== "n/o"))
    );
    const yes = all.filter((v) => v === "yes").length;
    const pct = all.length ? Math.round((yes / all.length) * 100) : 0;
    return { name: teacher.split(",")[0], pct, visits: tw.length };
  });

  const inputStyle = { width: "100%", padding: "9px 11px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 14, color: "#0f172a", background: "#f8fafc", boxSizing: "border-box" };
  const labelStyle = { fontSize: 11, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif", color: "#1e293b" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "12px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Instructional Coaching</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Classroom Walkthrough</div>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>👤 {observer}</span>
            {["form", "history", "trends", "export"].map((v) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "5px 11px", borderRadius: 20, border: "none",
                background: view === v ? "#0f172a" : "#e2e8f0",
                color: view === v ? "#fff" : "#64748b",
                fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em"
              }}>
                {v === "form" ? "New" : v === "history" ? `Log (${walkthroughs.length})` : v === "trends" ? "Trends" : "Export"}
              </button>
            ))}
            <button onClick={() => { localStorage.removeItem("wt_observer"); setObserver(""); }}
              style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
              ⇄
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" }}>

        {dbError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            ⚠️ Could not connect to the database. Check that your Supabase environment variables are set correctly in Vercel.
          </div>
        )}

        {/* NEW WALKTHROUGH */}
        {view === "form" && (
          <>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Teacher Name</label>
                  <input value={form.teacher} onChange={(e) => setForm((f) => ({ ...f, teacher: e.target.value }))} placeholder="Last, First" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Observer</label>
                  <input value={observer} disabled style={{ ...inputStyle, color: "#94a3b8", background: "#f1f5f9" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 12, color: "#64748b", fontWeight: 600, flexWrap: "wrap" }}>
              {RATINGS.map((r) => <span key={r.value} style={{ color: r.color }}>{r.label} = {r.value === "n/o" ? "Not Observed" : r.value.charAt(0).toUpperCase() + r.value.slice(1)}</span>)}
            </div>

            {CATEGORIES.map((cat) => (
              <div key={cat.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: cat.color }}>{cat.icon} {cat.label}</span>
                  <ScoreBadge ratings={form.ratings} catId={cat.id} indicators={cat.indicators} />
                </div>
                {cat.indicators.map((text, i) => {
                  const current = form.ratings[`${cat.id}_${i}`];
                  return (
                    <div key={i} style={{ padding: "11px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>{text}</span>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        {RATINGS.map((r) => (
                          <button key={r.value} onClick={() => setRating(cat.id, i, r.value)} style={{
                            width: r.value === "n/o" ? 40 : 34, height: 34, borderRadius: 7,
                            border: `2px solid ${current === r.value ? r.border : "#e2e8f0"}`,
                            background: current === r.value ? r.bg : "#fff",
                            color: current === r.value ? r.color : "#94a3b8",
                            fontSize: r.value === "n/o" ? 9 : 15, fontWeight: 900, cursor: "pointer", transition: "all 0.15s",
                          }}>{r.label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: "10px 16px" }}>
                  <textarea placeholder={`Notes for ${cat.label}...`} value={form.notes[cat.id]}
                    onChange={(e) => setForm((f) => ({ ...f, notes: { ...f.notes, [cat.id]: e.target.value } }))}
                    rows={2} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 10px", fontSize: 13, resize: "vertical", color: "#0f172a", background: "#f8fafc", boxSizing: "border-box" }} />
                </div>
              </div>
            ))}

            <button onClick={submit} disabled={!form.teacher || saving} style={{
              width: "100%", padding: 15, borderRadius: 10, border: "none",
              background: saved ? "#16a34a" : !form.teacher ? "#e2e8f0" : "#0f172a",
              color: !form.teacher ? "#94a3b8" : "#fff",
              fontSize: 15, fontWeight: 800, cursor: !form.teacher ? "not-allowed" : "pointer", transition: "background 0.3s",
            }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Walkthrough"}
            </button>
          </>
        )}

        {/* HISTORY */}
        {view === "history" && (
          <>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Teacher", value: filterTeacher, set: setFilterTeacher, options: teachers },
                { label: "Observer", value: filterObserver, set: setFilterObserver, options: observers },
              ].map((f) => (
                <div key={f.label} style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <select value={f.value} onChange={(e) => f.set(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, color: "#0f172a", background: "#f8fafc" }}>
                    {f.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Date</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, color: "#0f172a", background: "#f8fafc", boxSizing: "border-box" }} />
              </div>
              {(filterTeacher !== "All" || filterDate || filterObserver !== "All") && (
                <button onClick={() => { setFilterTeacher("All"); setFilterDate(""); setFilterObserver("All"); }}
                  style={{ alignSelf: "flex-end", padding: "7px 12px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", fontSize: 12, color: "#64748b", cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>

            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>{filtered.length} walkthrough{filtered.length !== 1 ? "s" : ""} shown</div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                No walkthroughs found.
              </div>
            ) : filtered.map((w) => {
              const open = expanded === w.id;
              return (
                <div key={w.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 10, overflow: "hidden" }}>
                  <div onClick={() => setExpanded(open ? null : w.id)}
                    style={{ padding: "13px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{w.teacher}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{w.date} · {w.observer}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {CATEGORIES.map((cat) => (
                        <ScoreBadge key={cat.id} ratings={w.ratings || {}} catId={cat.id} indicators={cat.indicators} />
                      ))}
                      <span style={{ color: "#cbd5e1", fontSize: 14 }}>{open ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {open && (
                    <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 16px" }}>
                      {CATEGORIES.map((cat) => (
                        <div key={cat.id} style={{ marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: cat.color }}>{cat.icon} {cat.label}</div>
                          {cat.indicators.map((text, i) => {
                            const val = (w.ratings || {})[`${cat.id}_${i}`];
                            if (!val) return null;
                            const r = RATINGS.find((r) => r.value === val);
                            return (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, alignItems: "center" }}>
                                <span style={{ color: "#475569", flex: 1 }}>{text}</span>
                                <span style={{ color: r.color, fontWeight: 800, marginLeft: 8 }}>{r.label}</span>
                              </div>
                            );
                          })}
                          {(w.notes || {})[cat.id] && (
                            <div style={{ marginTop: 6, padding: "7px 10px", background: "#f8fafc", borderRadius: 6, fontSize: 12, color: "#475569", borderLeft: `3px solid ${cat.color}` }}>
                              {w.notes[cat.id]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* TRENDS */}
        {view === "trends" && (
          <>
            {walkthroughs.length < 2 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
                Complete more walkthroughs to see trends.
              </div>
            ) : (
              <>
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 20, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>School-Wide: % Yes by Category</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Based on {walkthroughs.length} walkthroughs</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} barSize={40}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l, p) => p[0]?.payload?.fullName || l} />
                      <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {teacherData.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 20, marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Per-Teacher Overall % Yes</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Across all categories</div>
                    <ResponsiveContainer width="100%" height={Math.max(160, teacherData.length * 44)}>
                      <BarChart data={teacherData} layout="vertical" barSize={22}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                        <Tooltip formatter={(v, n, p) => [`${v}% (${p.payload.visits} visit${p.payload.visits !== 1 ? "s" : ""})`, "Score"]} />
                        <Bar dataKey="pct" fill="#0f172a" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {CATEGORIES.map((cat) => {
                  const byTeacher = Array.from(new Set(walkthroughs.map((w) => w.teacher))).map((teacher) => {
                    const tw = walkthroughs.filter((w) => w.teacher === teacher);
                    const all = tw.flatMap((w) => cat.indicators.map((_, i) => (w.ratings || {})[`${cat.id}_${i}`]).filter((v) => v && v !== "n/o"));
                    const yes = all.filter((v) => v === "yes").length;
                    const pct = all.length ? Math.round((yes / all.length) * 100) : 0;
                    return { name: teacher.split(",")[0], pct };
                  });
                  return (
                    <div key={cat.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 20, marginBottom: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: cat.color }}>{cat.icon} {cat.label}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>% Yes per teacher</div>
                      {byTeacher.map((t) => (
                        <div key={t.name} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{t.name}</span>
                            <span style={{ color: cat.color, fontWeight: 700 }}>{t.pct}%</span>
                          </div>
                          <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${t.pct}%`, height: "100%", background: cat.color, borderRadius: 4, transition: "width 0.4s" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* EXPORT */}
        {view === "export" && (
          <>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>📤 Export Walkthrough Data</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Filter by date range, then download as CSV to open in Excel or Google Sheets.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>From Date</label>
                  <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>To Date</label>
                  <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} style={inputStyle} />
                </div>
              </div>
              {(exportFrom || exportTo) && (
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, padding: "8px 12px", background: "#f8fafc", borderRadius: 7 }}>
                  {walkthroughs.filter((w) => (!exportFrom || w.date >= exportFrom) && (!exportTo || w.date <= exportTo)).length} walkthrough(s) match this date range
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => exportCSV("summary")} style={{
                  padding: "14px 16px", borderRadius: 9, border: "2px solid #0f172a", background: "#0f172a",
                  color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div>Summary Export</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8", marginTop: 2 }}>One row per walkthrough — totals per category + notes</div>
                  </div>
                  <span style={{ fontSize: 18 }}>⬇</span>
                </button>
                <button onClick={() => exportCSV("detailed")} style={{
                  padding: "14px 16px", borderRadius: 9, border: "2px solid #e2e8f0", background: "#fff",
                  color: "#0f172a", fontSize: 14, fontWeight: 800, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div>Detailed Export</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8", marginTop: 2 }}>One row per indicator — every rating for every walkthrough</div>
                  </div>
                  <span style={{ fontSize: 18 }}>⬇</span>
                </button>
              </div>
              {(exportFrom || exportTo) && (
                <button onClick={() => { setExportFrom(""); setExportTo(""); }}
                  style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Clear date filter
                </button>
              )}
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#16a34a", marginBottom: 6 }}>💡 How to open in Google Sheets</div>
              <div style={{ fontSize: 12, color: "#15803d", lineHeight: 1.8 }}>
                1. Download the CSV file<br />
                2. Open Google Sheets → File → Import<br />
                3. Upload the CSV → Import data<br />
                Your walkthrough data will be ready to filter, sort, and chart!
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
