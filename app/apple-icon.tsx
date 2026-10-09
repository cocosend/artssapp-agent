import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", borderRadius: 38, position: "relative",
      background: "linear-gradient(140deg,#8d2553 0%,#3c1833 59%,#130a1b 100%)",
    }}>
      <div style={{
        color: "#ffe4ad", fontSize: 133, lineHeight: 1, fontWeight: 800,
        marginTop: -21, marginRight: 9, letterSpacing: -10,
      }}>a</div>
      <div style={{
        position: "absolute", top: 22, right: 29, width: 20, height: 20,
        background: "#ffb0c6", transform: "rotate(45deg)", borderRadius: 5,
      }} />
      <div style={{
        position: "absolute", bottom: 21, width: 80, height: 5,
        borderRadius: 4, background: "#7ee8d8",
      }} />
    </div>,
    { ...size },
  );
}
