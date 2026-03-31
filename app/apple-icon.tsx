import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "linear-gradient(145deg, #0f172a 0%, #0d9488 100%)",
          borderRadius: 40,
        }}
      >
        <span
          style={{
            color: "#fafafa",
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: "-0.03em",
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
