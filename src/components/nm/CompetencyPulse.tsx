"use client";

import { useEffect, useState } from "react";
import { NMElement, STUDENT_RATING_SCALE } from "@/lib/nm/constants";

interface CompetencyPulseProps {
  pageId: string;
  unitId: string;
  elements: NMElement[];
  onComplete: () => void;
}

// Pop art palette — bold, saturated, unmistakable
const POP = {
  hotPink: "#FF2D78",
  electricYellow: "#FFE135",
  cyan: "#00D4FF",
  black: "#1a1a1a",
  white: "#ffffff",
  cream: "#FFF8E7",
  dotPink: "radial-gradient(circle, #FF2D78 1px, transparent 1px)",
  // Rating pill colors
  pill1Bg: "#FFE135",
  pill1Border: "#E6CA00",
  pill1Text: "#1a1a1a",
  pill2Bg: "#00D4FF",
  pill2Border: "#00A8CC",
  pill2Text: "#1a1a1a",
  pill3Bg: "#FF2D78",
  pill3Border: "#D4005A",
  pill3Text: "#ffffff",
};

const PILL_COLORS = [
  { bg: POP.pill1Bg, border: POP.pill1Border, text: POP.pill1Text, selectedBg: "#E6CA00" },
  { bg: POP.pill2Bg, border: POP.pill2Border, text: POP.pill2Text, selectedBg: "#00A8CC" },
  { bg: POP.pill3Bg, border: POP.pill3Border, text: POP.pill3Text, selectedBg: "#D4005A" },
];

export function CompetencyPulse({
  pageId,
  unitId,
  elements,
  onComplete,
}: CompetencyPulseProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reflection, setReflection] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Round 32 (7 May 2026, NIS Class 1) — detect prior submission on
  // mount. Per Matt: "after a student completes the NM survey it
  // shows a big pop art 'New Metrics Feedback Done!' as i dont need
  // them to ever go back to a lesson and do it again."
  //
  // GET /api/student/nm-assessment?unitId=&pageId= → { submitted: bool }.
  // If true, jump straight to the celebration view; the form never
  // shows. No-op (silent fail) if the request errors — we'd rather
  // let the student attempt to submit again than block them on a
  // network blip.
  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/student/nm-assessment?unitId=${encodeURIComponent(unitId)}&pageId=${encodeURIComponent(pageId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.submitted) setSubmitted(true);
      })
      .catch(() => {
        // Silent — see comment above.
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, pageId]);

  const allRated = elements.every((e) => ratings[e.id] !== undefined);

  const handleRating = (elementId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [elementId]: value }));
  };

  const handleSubmit = async () => {
    if (!allRated) return;

    // Client-side content safety check on reflection text
    if (reflection.trim()) {
      const { checkClientSide, MODERATION_MESSAGES, detectLanguage } = await import("@/lib/content-safety/client-filter");
      const check = checkClientSide(reflection);
      if (!check.ok) {
        const lang = detectLanguage(reflection);
        setError(MODERATION_MESSAGES[lang === "zh" ? "zh" : "en"]);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/nm-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          unitId,
          assessments: elements.map((e, i) => ({
            element: e.id,
            rating: ratings[e.id],
            // Attach reflection text to the first element's comment
            comment: i === 0 && reflection.trim() ? reflection.trim() : null,
          })),
        }),
      });
      if (res.ok) {
        // Round 32 — celebration is now PERMANENT (was 1.5s then
        // unmounted). Per Matt: students should NOT be able to
        // re-do the survey on this lesson; future lessons offer
        // fresh NM checkpoints. Still call onComplete so the
        // parent can track that a submission landed (e.g. for
        // analytics / engagement signals).
        setSubmitted(true);
        onComplete();
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Assessment save failed:", res.status, errData);
        setError("Something went wrong — please try again.");
      }
    } catch (err) {
      console.error("Assessment submission failed:", err);
      setError("Connection error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    // Round 32 — big persistent pop-art "FEEDBACK DONE!" replacing
    // the v1 1.5s "POW! Reflection complete!". Stays on screen for
    // the rest of the session — no opportunity to re-do.
    return (
      <div
        style={{
          borderRadius: "20px",
          border: `4px solid ${POP.black}`,
          background: POP.electricYellow,
          padding: "48px 32px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          animation: "nmPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow: `8px 8px 0px ${POP.black}`,
        }}
        data-testid="nm-survey-complete"
      >
        {/* Halftone dots overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.10) 1.5px, transparent 1.5px)",
            backgroundSize: "10px 10px",
            pointerEvents: "none",
          }}
        />

        {/* Starburst rays — 8 lines radiating from center */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "0",
            height: "0",
            pointerEvents: "none",
          }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <div
              key={deg}
              style={{
                position: "absolute",
                top: "0",
                left: "0",
                width: "180px",
                height: "8px",
                background: POP.hotPink,
                transformOrigin: "0 50%",
                transform: `translate(-50%, -50%) rotate(${deg}deg)`,
                opacity: 0.18,
              }}
            />
          ))}
        </div>

        {/* "POW!" speech-bubble badge — top-right corner */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "12px",
            right: "16px",
            background: POP.hotPink,
            color: POP.white,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            fontSize: "20px",
            fontWeight: 900,
            padding: "6px 14px",
            border: `3px solid ${POP.black}`,
            borderRadius: "999px",
            letterSpacing: "1px",
            transform: "rotate(8deg)",
            boxShadow: `3px 3px 0 ${POP.black}`,
          }}
        >
          POW!
        </div>

        {/* The headline */}
        <h2
          style={{
            position: "relative",
            margin: "0 0 12px",
            fontSize: "clamp(28px, 5vw, 44px)",
            lineHeight: 1.05,
            fontWeight: 900,
            color: POP.black,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            letterSpacing: "1px",
            textTransform: "uppercase",
            WebkitTextStroke: "0",
          }}
        >
          New Metrics
          <br />
          Feedback Done!
        </h2>

        {/* Subtext */}
        <p
          style={{
            position: "relative",
            margin: 0,
            fontSize: "14px",
            fontWeight: 700,
            color: POP.black,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            letterSpacing: "0.5px",
            opacity: 0.78,
          }}
        >
          You&apos;ll get another chance to reflect in a future lesson.
        </p>

        <style>{`
          @keyframes nmPopIn {
            0% { transform: scale(0.7) rotate(-3deg); opacity: 0; }
            55% { transform: scale(1.08) rotate(1.5deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: "16px", border: `3px solid ${POP.black}`, background: POP.white,
      overflow: "hidden", animation: "nmSlideUp 0.4s ease-out",
      boxShadow: `6px 6px 0px ${POP.black}`,
    }}>
      <style>{`
        @keyframes nmSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes nmDotPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.25; }
        }
        .nm-pill:hover { transform: scale(1.04); }
        .nm-pill:active { transform: scale(0.97); }
      `}</style>

      {/* Header bar — hot pink with halftone pattern */}
      <div style={{
        background: POP.hotPink, padding: "16px 20px", position: "relative", overflow: "hidden",
      }}>
        {/* Halftone dot overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.2) 1.5px, transparent 1.5px)",
          backgroundSize: "8px 8px",
          animation: "nmDotPulse 3s ease-in-out infinite",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px", border: `2px solid ${POP.black}`,
            background: POP.electricYellow, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
            boxShadow: `2px 2px 0 ${POP.black}`,
          }}>
            NM
          </div>
          <div>
            <h3 style={{
              margin: 0, fontSize: "17px", fontWeight: 900, color: POP.white,
              fontFamily: "'Arial Black', 'Impact', sans-serif", letterSpacing: "0.5px",
              textShadow: `1px 1px 0 ${POP.black}`,
            }}>
              Quick Reflection
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
              How did you go? Be honest — there are no wrong answers.
            </p>
          </div>
        </div>
      </div>

      {/* Element ratings */}
      <div style={{ padding: "20px" }}>
        <div style={{ display: "grid", gap: "20px", marginBottom: "20px" }}>
          {elements.map((elem) => (
            <div key={elem.id} style={{
              padding: "16px", borderRadius: "12px", border: `2px solid ${POP.black}`,
              background: ratings[elem.id] !== undefined ? "#f0fdf4" : POP.cream,
              transition: "all 0.2s",
            }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{
                  fontSize: "14px", fontWeight: 800, color: POP.black,
                  fontFamily: "'Arial Black', sans-serif",
                }}>
                  {elem.name}
                </div>
                <div style={{ fontSize: "13px", color: "#555", marginTop: "2px" }}>
                  {elem.studentDescription}
                </div>
              </div>

              {/* 3-point rating pills — pop art buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {STUDENT_RATING_SCALE.map((option, i) => {
                  const colors = PILL_COLORS[i];
                  const selected = ratings[elem.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      className="nm-pill"
                      onClick={() => handleRating(elem.id, option.value)}
                      style={{
                        padding: "10px 8px", borderRadius: "10px",
                        border: `2px solid ${POP.black}`,
                        background: selected ? colors.selectedBg : colors.bg,
                        color: colors.text, fontSize: "13px", fontWeight: 800,
                        fontFamily: "'Arial Black', sans-serif",
                        cursor: "pointer", transition: "all 0.15s",
                        boxShadow: selected ? `3px 3px 0 ${POP.black}` : `2px 2px 0 ${POP.black}`,
                        transform: selected ? "translate(-1px, -1px)" : "none",
                        opacity: selected ? 1 : 0.85,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Reflection textarea */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block", fontSize: "13px", fontWeight: 800, color: POP.black,
            fontFamily: "'Arial Black', sans-serif", marginBottom: "6px",
          }}>
            One thing you noticed about yourself as a learner?
          </label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Optional — but great learners notice things..."
            style={{
              width: "100%", padding: "12px 14px", borderRadius: "10px",
              border: `2px solid ${POP.black}`, fontSize: "14px", fontFamily: "inherit",
              resize: "vertical", minHeight: "70px", outline: "none",
              boxShadow: `2px 2px 0 ${POP.black}`,
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            marginBottom: "12px", padding: "10px 14px", borderRadius: "10px",
            background: POP.electricYellow, border: `2px solid ${POP.black}`,
            color: POP.black, fontSize: "13px", fontWeight: 700,
            fontFamily: "'Arial Black', sans-serif",
          }}>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!allRated || loading}
          style={{
            width: "100%", padding: "14px",
            borderRadius: "12px", border: `3px solid ${POP.black}`,
            background: allRated && !loading ? POP.hotPink : "#ccc",
            color: allRated && !loading ? POP.white : "#888",
            fontSize: "16px", fontWeight: 900,
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            letterSpacing: "1px", textTransform: "uppercase",
            cursor: allRated && !loading ? "pointer" : "not-allowed",
            boxShadow: allRated && !loading ? `4px 4px 0 ${POP.black}` : "none",
            transition: "all 0.15s",
          }}
        >
          {loading ? "SAVING..." : "DONE!"}
        </button>
      </div>
    </div>
  );
}
