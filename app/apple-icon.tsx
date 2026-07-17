import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — samme merke som favicon, større. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #020617 0%, #0f172a 45%, #0f766e 100%)",
          borderRadius: 40,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 36,
            width: 96,
            height: 28,
            background: "#f1f5f9",
            transform: "skewX(-18deg)",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 68,
            left: 78,
            width: 28,
            height: 64,
            background: "linear-gradient(180deg, #f8fafc 0%, #5eead4 100%)",
            transform: "skewX(-28deg)",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 42,
            left: 52,
            width: 96,
            height: 28,
            background: "#5eead4",
            transform: "skewX(-18deg)",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 78,
            right: 44,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#5eead4",
            boxShadow: "0 0 24px rgba(45,212,191,0.7)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
