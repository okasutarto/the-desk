import { BODY, DISPLAY, brutalBox, drawPortrait } from "./base";
import { ABOUT_NOTES } from "@/data/about";
import { guilloche, stockGrain } from "./finishes";

// ---------- ID badge (hero) ----------
export function drawBadge(c, w, h, { back = false, now = new Date() } = {}) {
  // One print layout at any texture density; hotspot coordinates follow the same scale.
  const sx = w / 480;
  const sy = h / 780;
  c.save();
  c.scale(sx, sy);
  w = 480;
  h = 780;
  c.fillStyle = "#fffdf5";
  c.fillRect(0, 0, w, h);
  stockGrain(c, w, h, { seed: back ? 21 : 20, density: 0.6, wear: 0.04 });
  guilloche(c, 0, 130, w, 300, "rgba(36,91,215,.06)", { lines: 6, waves: 3 });
  c.fillStyle = "#ffdd00";
  c.fillRect(0, 0, w, 112);
  guilloche(c, 0, 0, w, 108, "rgba(0,0,0,.08)", { lines: 6, waves: 4 });
  c.fillStyle = "#17243b";
  c.fillRect(0, 108, w, 6);
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.font = `800 20px ${DISPLAY}`;
  c.fillText("THE DESK", 30, 46);
  c.font = `700 15px ${BODY}`;
  c.fillText(back ? "RETURN TO OWNER" : "DEVELOPER ACCESS PASS", 30, 80);
  c.textAlign = "right";
  c.font = `800 32px ${BODY}`;
  c.fillText("{ }", w - 30, 50);
  c.textAlign = "center";
  const hotspots = [];
  if (back) {
    c.fillStyle = "#17243b";
    c.font = `800 32px ${DISPLAY}`;
    c.fillText("IF FOUND,", w / 2, 174);
    c.fillText("PLEASE HIRE.", w / 2, 220);
    c.font = `500 20px ${BODY}`;
    c.fillText("Good things start with a conversation.", w / 2, 270);
    // Links, printed as buttons
    // (the resume came here from the About board when that became the guestbook)
    [
      { label: "GITHUB ↗", color: "#ffdd00", href: "https://github.com/okasutarto" },
      { label: "LINKEDIN ↗", color: "#00e0c6", href: "https://linkedin.com/in/okasutarto" },
      { label: "EMAIL ME ↗", color: "#ff90e8", href: "mailto:okasputra@gmail.com" },
      { label: "RESUME ↓", color: "#7fb2ff", href: ABOUT_NOTES.find((note) => note.id === "resume")?.href },
    ].forEach((link, i) => {
      const box = { x: 38, y: 306 + i * 84, w: w - 76, h: 64 };
      brutalBox(c, box.x, box.y, box.w, box.h, link.color, { shadow: 6, line: 4 });
      c.fillStyle = "#17243b";
      c.font = `800 24px ${DISPLAY}`;
      c.fillText(link.label, w / 2, box.y + box.h / 2 + 2);
      hotspots.push({ ...box, href: link.href });
    });
    c.fillStyle = "#245bd7";
    c.font = `800 18px ${BODY}`;
    c.fillText("BUILD · BREAK · LEARN · REPEAT", w / 2, 676);
    c.fillStyle = "#526075";
    c.font = `500 18px ${BODY}`;
    c.fillText("property of okasp / Pontianak, ID", w / 2, 712);
  } else {
    // Framed portrait with a small staff tab, set off the warm PVC stock.
    c.fillStyle = "#17243b";
    c.fillRect(140, 150, 216, 264);
    drawPortrait(c, 132, 142, 216, 264, "#00e0c6");
    // the card's contact chip: gold, its pads cut by inked lines
    brutalBox(c, 40, 168, 66, 54, "#e2b53c", { shadow: 4, line: 3 });
    c.strokeStyle = "#8a6514";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(73, 168);
    c.lineTo(73, 222);
    c.moveTo(40, 186);
    c.lineTo(62, 186);
    c.moveTo(84, 186);
    c.lineTo(106, 186);
    c.moveTo(40, 204);
    c.lineTo(62, 204);
    c.moveTo(84, 204);
    c.lineTo(106, 204);
    c.rect(62, 182, 22, 26);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,.45)";
    c.fillRect(43, 171, 60, 5);
    c.fillStyle = "#245bd7";
    c.fillRect(310, 370, 112, 36);
    c.fillStyle = "#fff";
    c.font = `800 16px ${BODY}`;
    c.fillText("STAFF / 01", 366, 389);
    c.fillStyle = "#17243b";
    // name + role
    c.font = `800 38px ${DISPLAY}`;
    c.fillText("OKA S.", w / 2, 455);
    c.fillText("PUTRA", w / 2, 503);
    c.font = `700 22px ${BODY}`;
    c.fillText("FULL STACK DEVELOPER", w / 2, 549);
    // live status pill: green during working hours (WIB), orange otherwise
    const hour = (now.getUTCHours() + 7) % 24;
    const onDuty = hour >= 9 && hour < 19;
    brutalBox(c, 62, 585, w - 124, 52, onDuty ? "#8fd694" : "#ffb36b", { shadow: 5, line: 4 });
    c.fillStyle = "#17243b";
    c.font = `800 20px ${DISPLAY}`;
    c.fillText(onDuty ? "● ON DUTY" : "● OFF DUTY", w / 2, 612);
    // barcode
    c.fillStyle = "#17243b";
    for (let x = 90, i = 0; x < w - 90; i++) {
      const bw = [3, 6, 2, 8, 4][i % 5];
      c.fillRect(x, 679, bw, 34);
      x += bw + [4, 3, 6, 2, 5][(i * 3) % 5];
    }
    c.font = `600 14px ${BODY}`;
    c.fillStyle = "#526075";
    c.fillText("OKASP — DEV / 001", w / 2, 737);
  }
  c.lineWidth = 6;
  c.strokeStyle = "#17243b";
  c.strokeRect(3, 3, w - 6, h - 6);
  c.restore();
  return hotspots.map((box) => ({ ...box, x: box.x * sx, y: box.y * sy, w: box.w * sx, h: box.h * sy }));
}

