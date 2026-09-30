"use client";

/**
 * Last-resort boundary: catches failures thrown by the root layout itself
 * (which the segment-level error.tsx cannot render around). It must replace
 * the entire document, hence its own <html>/<body> and zero app chrome.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'Inter, "SF Pro Text", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: "linear-gradient(135deg, #f8f7f4 0%, #eef9f1 55%, #fdf3e0 100%)",
          color: "#3e3b37",
        }}
      >
        <main style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <div
            aria-hidden
            style={{
              margin: "0 auto",
              width: 72,
              height: 72,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              color: "#fff",
              fontWeight: 900,
              background: "linear-gradient(135deg, #0e8049, #052717)",
              boxShadow: "0 16px 40px -12px rgb(14 128 73 / 0.5)",
            }}
          >
            z
          </div>
          <h1 style={{ marginTop: 24, fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#817a6e" }}>
            z-freelance hit an unexpected error. Nothing you did — and money in escrow is safe in
            the ledger regardless. Try again and the incident is logged either way.
          </p>
          {error.digest ? (
            <p style={{ marginTop: 10, fontSize: 12, fontFamily: "monospace", color: "#9d968a" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #0e8049, #0c673d)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 8px 24px -8px rgb(14 128 73 / 0.6)",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
