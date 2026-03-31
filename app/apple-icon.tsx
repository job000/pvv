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
          background: "linear-gradient(145deg, #171717 0%, #3f3f46 100%)",
          borderRadius: 40,
        }}
      >
        <span
          style={{
            color: "#fafafa",
            fontSize: 56,
            fontWeight: 700,
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          PVV
        </span>
      </div>
    ),
    { ...size },
  );
}
