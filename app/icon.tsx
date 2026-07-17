import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Tab-favicon — forenklet Zorlin-merke. */
export default function Icon() {
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
          borderRadius: 7,
          position: "relative",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 5,
            width: 18,
            height: 5,
            background: "#f1f5f9",
            transform: "skewX(-18deg)",
            borderRadius: 1,
          }}
        />
        {/* Diagonal */}
        <div
          style={{
            position: "absolute",
            top: 11,
            left: 13,
            width: 5,
            height: 12,
            background: "linear-gradient(180deg, #f8fafc 0%, #5eead4 100%)",
            transform: "skewX(-28deg)",
            borderRadius: 1,
          }}
        />
        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 9,
            width: 18,
            height: 5,
            background: "#5eead4",
            transform: "skewX(-18deg)",
            borderRadius: 1,
          }}
        />
        {/* Priority node */}
        <div
          style={{
            position: "absolute",
            top: 13,
            right: 7,
            width: 5,
            height: 5,
            borderRadius: 999,
            background: "#5eead4",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
