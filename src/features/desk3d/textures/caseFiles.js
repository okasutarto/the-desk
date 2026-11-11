import { FILE_PAGES, FOLDER_COLORS } from "@/data/projectFiles";
import { BODY, DISPLAY, brutalBox, fitFont, wrap } from "./base";
import { paperclip, rubberStamp, stockGrain } from "./finishes";

// ---------- project case files: same five sheets and palette as the 2D drawer ----------
function fileCanvas(c, w, h, draw, height = 740) {
  c.save();
  c.scale(w / 1000, h / height);
  c.textAlign = "left";
  c.textBaseline = "top";
  const hotspots = draw() || [];
  c.restore();
  return hotspots.map((spot) => ({ ...spot, x: spot.x * w / 1000, y: spot.y * h / height, w: spot.w * w / 1000, h: spot.h * h / height }));
}
function fileText(c, text, x, y, width, { size = 25, lines = 4, weight = 500, ink = "#111" } = {}) {
  c.fillStyle = ink;
  c.font = `${weight} ${size}px ${BODY}`;
  const wrapped = wrap(c, String(text || ""), width, lines);
  wrapped.forEach((line, i) => c.fillText(line, x, y + i * size * 1.35));
  return wrapped.length * size * 1.35;
}
function drawClip(c, x, y, w, h, api) {
  brutalBox(c, x, y, w, h, "#fffdf5", { shadow: 7, line: 4 });
  c.save();
  c.beginPath();
  c.rect(x + 2, y + 2, w - 4, h - 4);
  c.clip();
  c.translate(x, y);
  stockGrain(c, w, h, { seed: x + y, wear: 0 });
  c.restore();
  // the clip grips the top edge and reaches about 56 px down the sheet: the writing starts below it
  paperclip(c, x + 45, y - 26, 82, 0.05);
  if (api) {
    fileText(c, api.request, x + 16, y + 78, w - 32, { size: 17, weight: 800, lines: 2 });
    fileText(c, api.status, x + 16, y + 135, w - 32, { size: 16, ink: "#166534", lines: 1 });
    fileText(c, typeof api.body === "string" ? api.body : JSON.stringify(api.body, null, 2), x + 16, y + 168, w - 32, { size: 15, ink: "#7c3aed", lines: 7 });
  } else {
    brutalBox(c, x + 20, y + 66, w - 40, 25, "#fff", { shadow: 0, line: 3 });
    brutalBox(c, x + 20, y + 104, w - 40, h * 0.28, "#d9d9d9", { shadow: 0, line: 3 });
    for (let i = 0; i < 2; i++) brutalBox(c, x + 20 + i * (w / 2 - 10), y + h * 0.64, w / 2 - 30, h * 0.15, "#fff", { shadow: 0, line: 3 });
    c.fillStyle = "#111";
    c.fillRect(x + 20, y + h - 35, w * 0.55, 16);
  }
}
function drawFileMetrics(c, metrics, color, y = 630) {
  metrics.slice(0, 3).forEach((metric, i) => {
    const x = 42 + i * 310;
    brutalBox(c, x, y, 292, 78, color, { shadow: 5, line: 4 });
    c.fillStyle = "#111";
    fitFont(c, metric.value, 800, DISPLAY, 34, 266);
    c.fillText(metric.value, x + 14, y + 8);
    fileText(c, metric.label.toUpperCase(), x + 14, y + 49, 266, { size: 14, lines: 1, weight: 800 });
  });
}
// Three punched holes down a sheet's hinged edge, at `x` in the 1000-wide page
function punchHoles(c, x) {
  [190, 370, 550].forEach((y) => {
    c.beginPath();
    c.arc(x, y, 11, 0, Math.PI * 2);
    c.fillStyle = "#3a3530";
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = "#1a1714";
    c.stroke();
    c.beginPath();
    c.arc(x + 2, y + 2, 7, Math.PI * 0.9, Math.PI * 1.9);
    c.strokeStyle = "rgba(255,255,255,.25)";
    c.stroke();
  });
}
// The folder's board: coloured card with a fibre grain, a scored crease along the spine (the
// hinged left edge), a rubber stamp and the faint ring of a mug once set down on it
function folderBoard(c, color, index, creaseX = 20) {
  c.fillStyle = color;
  c.fillRect(0, 0, 1000, 740);
  stockGrain(c, 1000, 740, { seed: index + 3, density: 1.2, wear: 0.07 });
  c.fillStyle = "rgba(0,0,0,.14)";
  c.fillRect(creaseX, 0, 5, 740);
  c.fillStyle = "rgba(255,255,255,.3)";
  c.fillRect(creaseX + 5, 0, 3, 740);
}
export function drawFolderCover(c, w, h, project, index = 0) {
  return fileCanvas(c, w, h, () => {
    const color = FOLDER_COLORS[index % FOLDER_COLORS.length];
    folderBoard(c, color, index);
    rubberStamp(c, 160, 655, `CASE Nº ${String(index + 1).padStart(2, "0")}`, { color: "rgba(26,23,20,.55)", size: 26, angle: -0.08, seed: index + 1 });
    brutalBox(c, 42, 42, 245, 46, "#fff", { shadow: 5, line: 4 });
    fileText(c, project.type.toUpperCase(), 58, 53, 220, { size: 20, weight: 800, lines: 1 });
    const longestWord = project.title.toUpperCase().split(/\s+/).sort((a, b) => b.length - a.length)[0];
    fitFont(c, longestWord, 800, DISPLAY, 61, 560);
    const title = wrap(c, project.title.toUpperCase(), 560, 3);
    title.forEach((line, i) => c.fillText(line, 42, 122 + i * 76));
    fileText(c, project.description, 42, 142 + title.length * 76, 550, { size: 25, lines: 3 });
    drawClip(c, 660, 140, 290, 330, project.caseFile?.api);
    c.strokeStyle = "#000";
    c.lineWidth = 7;
    c.strokeRect(4, 4, 992, 732);
  });
}
export const CASE_SHEETS = FILE_PAGES.map((page) => page.id);
export function drawCaseSheet(c, w, h, project, kind, { index = 0 } = {}) {
  return fileCanvas(c, w, h, () => {
    const page = CASE_SHEETS.indexOf(kind);
    const color = FOLDER_COLORS[index % FOLDER_COLORS.length];
    const metrics = (project.results?.metrics || []).slice(0, 3);
    const cf = project.caseFile || {};
    c.fillStyle = "#fffdf5";
    c.fillRect(0, 0, 1000, 740);
    stockGrain(c, 1000, 740, { seed: index * 7 + page + 1, wear: 0.05 });
    punchHoles(c, 17);
    brutalBox(c, 35, 28, 58, 40, "#111", { shadow: 0, line: 0 });
    fileText(c, String(page + 1).padStart(2, "0"), 46, 36, 45, { size: 23, weight: 800, lines: 1, ink: "#ffdd00" });
    fileText(c, FILE_PAGES[page].title.toUpperCase(), 110, 34, 840, { size: 31, weight: 800, lines: 1 });
    fileText(c, `NO. ${String(index + 1).padStart(2, "0")} · ${project.title.toUpperCase()}`, 38, 84, 920, { size: 16, weight: 700, lines: 1, ink: "#666" });
    const hotspots = [];
    if (kind === "overview") {
      const storyH = fileText(c, project.overview || project.description, 38, 135, 540, { size: 25, lines: 8 });
      if (cf.quote) fileText(c, `“${cf.quote}.”`, 38, Math.min(450, 160 + storyH), 540, { size: 24, weight: 700, ink: "#555", lines: 2 });
      brutalBox(c, 620, 135, 340, 370, "#fff", { shadow: 5, line: 4 });
      [["CLIENT", cf.client || "Personal project"], ["TYPE", project.type], ["YEAR", project.year], ["BUILT IN", project.duration], ["ROLE", project.role]].forEach(([label, value], i) => {
        fileText(c, label, 638, 151 + i * 67, 295, { size: 15, weight: 800, ink: "#666", lines: 1 });
        fileText(c, value, 638, 174 + i * 67, 295, { size: 22, weight: 700, lines: 1 });
      });
      drawFileMetrics(c, metrics, color, 555);
    } else if (kind === "challenge") {
      fileText(c, "THE PROBLEM", 38, 130, 400, { size: 22, weight: 800, lines: 1 });
      fileText(c, "WHAT I BUILT", 565, 130, 400, { size: 22, weight: 800, lines: 1 });
      (project.problem?.points || []).slice(0, 4).forEach((point, i) => {
        const y = 175 + i * 115;
        brutalBox(c, 38, y, 410, 100, "#fecaca", { shadow: 4, line: 3 });
        brutalBox(c, 555, y, 410, 100, "#bbf7d0", { shadow: 4, line: 3 });
        fileText(c, point, 51, y + 12, 384, { size: 20, lines: 3 });
        fileText(c, "→", 477, y + 28, 65, { size: 38, weight: 800, lines: 1 });
        fileText(c, project.solution?.points?.[i], 568, y + 12, 384, { size: 20, lines: 3 });
      });
    } else if (kind === "features") {
      (project.features || []).slice(0, 9).forEach((feature, i) => {
        const x = 40 + (i % 3) * 317;
        const y = 140 + Math.floor(i / 3) * 170;
        brutalBox(c, x, y, 297, 148, ["#fff", color, "#ffdd00", "#bfdbfe"][i % 4], { shadow: 5, line: 4 });
        fileText(c, String(i + 1).padStart(2, "0"), x + 14, y + 12, 60, { size: 17, weight: 800, lines: 1 });
        fileText(c, feature, x + 14, y + 42, 270, { size: 22, weight: 700, lines: 3 });
      });
    } else if (kind === "how") {
      let y = 142;
      (cf.flows || []).forEach((flow) => {
        fileText(c, flow.label.toUpperCase(), 38, y, 545, { size: 20, weight: 800, lines: 1 });
        y += 40;
        y += fileText(c, flow.nodes.join(" → "), 38, y, 550, { size: 27, weight: 700, lines: 3 }) + 50;
      });
      drawClip(c, 645, 155, 310, 390, cf.api);
    } else {
      let x = 38;
      let y = 140;
      for (const tech of project.technologies || []) {
        c.font = `700 21px ${BODY}`;
        const width = c.measureText(tech).width + 28;
        if (x + width > 605) { x = 38; y += 58; }
        brutalBox(c, x, y, width, 42, "#fff", { shadow: 4, line: 3 });
        fileText(c, tech, x + 12, y + 8, width - 24, { size: 21, weight: 700, lines: 1 });
        x += width + 14;
      }
      y += 80;
      if (project.learnings?.length) {
        fileText(c, "WHAT I LEARNED", 38, y, 550, { size: 18, weight: 800, lines: 1 });
        project.learnings.slice(0, 3).forEach((item, i) => fileText(c, `• ${item}`, 38, y + 36 + i * 70, 550, { size: 22, lines: 2 }));
      }
      metrics.forEach((metric, i) => {
        brutalBox(c, 650, 140 + i * 155, 305, 130, color, { shadow: 5, line: 4 });
        fileText(c, metric.value, 670, 158 + i * 155, 265, { size: 42, weight: 800, lines: 1 });
        fileText(c, metric.label.toUpperCase(), 670, 214 + i * 155, 265, { size: 18, weight: 800, lines: 2 });
      });
      const links = [{ label: "OPEN LIVE ↗", href: project.demoLink }, { label: "CODE ↗", href: project.codeLink }].filter((link) => link.href && link.href !== "#");
      links.forEach((link, i) => {
        const box = { x: 38 + i * 255, y: 580, w: 235, h: 58 };
        brutalBox(c, box.x, box.y, box.w, box.h, i ? "#fff" : "#00e0c6", { shadow: 5, line: 4 });
        fileText(c, link.label, box.x + 13, box.y + 16, box.w - 26, { size: 23, weight: 800, lines: 1 });
        hotspots.push({ ...box, href: link.href });
      });
      if (!links.length) fileText(c, "PRIVATE BUILD", 38, 595, 540, { size: 22, weight: 800, ink: "#666", lines: 1 });
    }
    // Going back lives on the left page (the back of the sheet just turned)
    fileText(c, page < CASE_SHEETS.length - 1 ? "NEXT →" : "END", 820, 684, 150, { size: 19, weight: 800, lines: 1 });
    if (page < CASE_SHEETS.length - 1) hotspots.push({ x: 760, y: 660, w: 230, h: 70, action: "next" });
    c.strokeStyle = "#000";
    c.lineWidth = 6;
    c.strokeRect(3, 3, 994, 734);
    return hotspots;
  });
}
// Back of a turned sheet / inside of the cover: drawn upside down so they read once flipped.
// A turned sheet's back is the left page of the spread, in the same paper as the right page,
// and carries the way back to the page it belongs to (`kind`).
export function drawCaseBack(c, w, h, project, { inside = false, index = 0, kind } = {}) {
  c.save();
  c.translate(w, h);
  c.rotate(Math.PI);
  let hotspots = [];
  if (inside) {
    c.save();
    c.scale(w / 1000, h / 740);
    // drawn turned round, so the spine's crease is on the far side here
    folderBoard(c, FOLDER_COLORS[index % FOLDER_COLORS.length], index + 11, 972);
    c.restore();
    c.fillStyle = "#000";
    c.font = `800 30px ${DISPLAY}`;
    c.fillText(`CASE FILE #${String(index + 1).padStart(3, "0")}`, 30, 70);
    c.font = `600 30px 'Caveat', cursive`;
    c.fillText(`re: ${project.title}`, 30, 120);
    c.fillText("handle with care ✦", 30, 160);
    // a sticky note slapped on the inside, a little crooked, with a hard shadow
    c.save();
    c.translate(w * 0.62, h * 0.1);
    c.rotate(0.06);
    const note = h * 0.38;
    c.fillStyle = "#000";
    c.fillRect(7, 7, note, note);
    c.fillStyle = "#ffdd00";
    c.fillRect(0, 0, note, note);
    c.lineWidth = 3;
    c.strokeRect(0, 0, note, note);
    c.fillStyle = "rgba(0,0,0,.08)";
    c.fillRect(0, 0, note, note * 0.14);
    c.fillStyle = "#111";
    c.font = `700 ${Math.round(note * 0.2)}px 'Caveat', cursive`;
    c.fillText("notes:", note * 0.1, note * 0.36);
    c.fillText("ship it! ✓", note * 0.1, note * 0.6);
    c.fillText("— O.", note * 0.45, note * 0.85);
    c.restore();
    // a rubber stamp, inked a bit unevenly
    c.save();
    c.translate(w * 0.24, h * 0.72);
    c.rotate(-0.14);
    c.globalAlpha = 0.8;
    c.strokeStyle = "#d62828";
    c.lineWidth = 6;
    c.beginPath();
    c.roundRect(-w * 0.17, -h * 0.08, w * 0.34, h * 0.16, 10);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(-w * 0.155, -h * 0.065, w * 0.31, h * 0.13, 7);
    c.stroke();
    c.fillStyle = "#d62828";
    c.font = `800 ${Math.round(h * 0.075)}px ${DISPLAY}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("ON FILE", 0, 2);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.restore();
    // a marker doodle by the signature line
    c.globalAlpha = 1;
    c.strokeStyle = "#111";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(30, h * 0.92);
    c.lineTo(w * 0.42, h * 0.92);
    c.stroke();
    c.font = `600 26px 'Caveat', cursive`;
    c.fillStyle = "#111";
    c.fillText("signed:", 30, h * 0.9);
    c.beginPath();
    c.moveTo(120, h * 0.9);
    c.bezierCurveTo(150, h * 0.83, 165, h * 0.95, 190, h * 0.88);
    c.bezierCurveTo(205, h * 0.84, 215, h * 0.92, 245, h * 0.87);
    c.stroke();
    c.lineWidth = 6;
    c.strokeStyle = "#000";
    c.strokeRect(3, 3, w - 6, h - 6);
  } else {
    const page = Math.max(0, CASE_SHEETS.indexOf(kind));
    hotspots = fileCanvas(c, w, h, () => {
      c.fillStyle = "#fffdf5";
      c.fillRect(0, 0, 1000, 740);
      stockGrain(c, 1000, 740, { seed: index * 7 + page + 40, wear: 0.05 });
      // the holes go through: here they sit on the far side, which turns to the hinge
      punchHoles(c, 983);
      // Same header as the right page, for the page this sheet holds
      brutalBox(c, 35, 28, 58, 40, "#111", { shadow: 0, line: 0 });
      fileText(c, String(page + 1).padStart(2, "0"), 46, 36, 45, { size: 23, weight: 800, lines: 1, ink: "#ffdd00" });
      fileText(c, FILE_PAGES[page].title.toUpperCase(), 110, 34, 840, { size: 31, weight: 800, lines: 1 });
      fileText(c, `NO. ${String(index + 1).padStart(2, "0")} · ${project.title.toUpperCase()}`, 38, 84, 920, { size: 16, weight: 700, lines: 1, ink: "#666" });
      // Notes page: a few ruled lines and the page number, large and faint
      c.fillStyle = "rgba(0,0,0,.07)";
      for (let y = 160; y < 640; y += 48) c.fillRect(38, y, 924, 3);
      c.fillStyle = "rgba(0,0,0,.06)";
      c.font = `800 260px ${DISPLAY}`;
      c.textAlign = "center";
      c.fillText(String(page + 1).padStart(2, "0"), 500, 250);
      c.textAlign = "left";
      fileText(c, "← BACK", 38, 684, 250, { size: 19, weight: 800, lines: 1 });
      c.strokeStyle = "#000";
      c.lineWidth = 6;
      c.strokeRect(3, 3, 994, 734);
      return [{ x: 20, y: 660, w: 260, h: 70, action: "prev" }];
    });
  }
  c.restore();
  // Hotspots were laid out in the upside-down frame; turn them into canvas coordinates
  return hotspots.map((hs) => ({ ...hs, x: w - hs.x - hs.w, y: h - hs.y - hs.h }));
}


// Shared with the other texture modules
export { fileCanvas, fileText };
