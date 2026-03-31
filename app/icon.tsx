import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "linear-gradient(145deg, #0f172a 0%, #0d9488 100%)",
          borderRadius: 6,
        }}
      >
        <span
          style={{
            color: "#f8fafc",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          FRO
        </span>
      </div>
    ),
    { ...size },
  );
}
