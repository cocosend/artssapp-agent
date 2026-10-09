import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", borderRadius: 38, position: "relative",
      background: "linear-gradient(140deg,#224D86 0%,#10243D 59%,#050910 100%)",
    }}>
      <div style={{
        color: "#F7FBFF", fontSize: 133, lineHeight: 1, fontWeight: 800,
        marginTop: -21, marginRight: 9, letterSpacing: -10,
      }}>A</div>
      <div style={{
        position: "absolute", top: 22, right: 29, width: 20, height: 20,
        background: "#C8E1FF", transform: "rotate(45deg)", borderRadius: 5,
      }} />
      <div style={{
        position: "absolute", bottom: 21, width: 80, height: 5,
        borderRadius: 4, background: "#529BFF",
      }} />
    </div>,
    { ...size },
  );
}
