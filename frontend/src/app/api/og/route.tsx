import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fcfcf8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" fill="#026370" />
            <text
              x="40"
              y="52"
              textAnchor="middle"
              fill="#e5ff97"
              fontSize="32"
              fontWeight="bold"
            >
              ن
            </text>
          </svg>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "#083d44",
              textAlign: "center",
            }}
          >
            Nabeeh
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#026370",
              textAlign: "center",
              maxWidth: "800px",
            }}
          >
            Smart Teaching Assistant for Tutors
          </div>
          <div
            style={{
              fontSize: "18px",
              color: "#083d44",
              opacity: 0.7,
              textAlign: "center",
              maxWidth: "700px",
            }}
          >
            Student management · Attendance · Grades · WhatsApp bot for parents
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
