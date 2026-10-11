"""Render an already-hashed Analytics exhibit. No engineering calculation runs here.

Optional authoring tool: explicit Python with reportlab and pypdf is required.
The browser app and its JSON/CSV/SVG exports remain Node/browser only.
"""
import argparse
import io
import json
import math
from pathlib import Path
import shutil
import subprocess
from xml.sax.saxutils import escape

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Flowable, PageBreak, Paragraph, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

INK = colors.HexColor("#173d54")
STEEL = colors.HexColor("#32799c")
SAND = colors.HexColor("#a98b4d")
RUST = colors.HexColor("#9b432d")
PALE = colors.HexColor("#e9f2f6")
MUTED = colors.HexColor("#536773")
WIDTH = 720

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("ExTitle", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle("ExSub", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle("ExBody", fontName="Helvetica", fontSize=9, leading=13, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle("ExSmall", fontName="Helvetica", fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=6, wordWrap="CJK"))
styles.add(ParagraphStyle("ExCell", fontName="Helvetica", fontSize=8, leading=10, textColor=INK))
styles.add(ParagraphStyle("ExHead", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=INK))


def para(value, style="ExBody"):
    return Paragraph(escape(str(value)), styles[style])


def fmt(value, decimals=0):
    return "Not reported" if value is None else f"{value:,.{decimals}f}"


def table(headers, rows, widths, font_size=8):
    cell_style = ParagraphStyle("SizedCell", parent=styles["ExCell"], fontSize=font_size, leading=font_size+2)
    cells = [[para(h, "ExHead") for h in headers]]
    cells.extend([[Paragraph(escape(str(c)), cell_style) for c in row] for row in rows])
    result = Table(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7fafb")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 2 if font_size < 8 else 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 if font_size < 8 else 4),
        ("LINEBELOW", (0, 0), (-1, 0), .8, STEEL),
        ("LINEBELOW", (0, 1), (-1, -1), .3, colors.HexColor("#d9e3e8")),
    ]))
    return result


class Chart(Flowable):
    """Vector drawing of serialized output points; interpolation is visual only."""
    def __init__(self, title, xlabels, series, unit, width=WIDTH, height=192, limit=None):
        super().__init__()
        self.width, self.height = width, height
        self.title, self.xlabels, self.series, self.unit = title, xlabels, series, unit
        self.limit = limit

    def draw(self):
        c = self.canv
        left, right, bottom, top = 53, 14, 38, 34
        plot_w, plot_h = self.width-left-right, self.height-bottom-top
        highest = max([v for _, values, _, _ in self.series for v in values] + [self.limit or 0, 1])
        step = 1000 if highest < 10000 else 100000
        ymax = max(step, math.ceil(highest*1.08/step)*step)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0, self.height-12, self.title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.5)
        c.drawString(left, self.height-25, self.unit)
        for tick in range(5):
            y = bottom + plot_h*tick/4
            c.setStrokeColor(colors.HexColor("#d9e3e8"))
            c.setLineWidth(.5)
            c.line(left, y, self.width-right, y)
            c.setFillColor(MUTED)
            c.drawRightString(left-7, y-2, fmt(ymax*tick/4))
        for i, label in enumerate(self.xlabels):
            x = left+plot_w*i/max(1, len(self.xlabels)-1)
            c.drawCentredString(x, bottom-12, str(label))
        if self.limit is not None:
            c.setStrokeColor(RUST)
            c.setDash(4, 3)
            c.line(left, bottom+plot_h*self.limit/ymax, self.width-right, bottom+plot_h*self.limit/ymax)
            c.setDash()
        legend_x = left
        for label, values, color, dashed in self.series:
            c.setStrokeColor(color)
            c.setLineWidth(1.7)
            c.setDash(4, 3) if dashed else c.setDash()
            p = c.beginPath()
            for i, value in enumerate(values):
                x, y = left+plot_w*i/max(1, len(values)-1), bottom+plot_h*value/ymax
                p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
            c.drawPath(p)
            c.line(legend_x, 8, legend_x+14, 8)
            c.setDash()
            c.setFillColor(MUTED)
            c.drawString(legend_x+19, 5, label)
            legend_x += c.stringWidth(label, "Helvetica", 7.5)+43


def verify_input(original):
    # Match JavaScript's exact canonical numeric/Unicode serialization.
    # Python json.dumps is deliberately not used to recalculate this JS hash.
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node is required to verify the technical exhibit SHA-256")
    code = """import {readFileSync} from 'node:fs';import {verifiedExhibit} from './dist/exhibitIntegrity.js';
const e=verifiedExhibit(JSON.parse(readFileSync(0,'utf8')));const {contentSha256}=e;
if(![1,2].includes(e.schemaVersion)||e.outputs?.monthly?.length!==12||!Array.isArray(e.outputs?.injectors))throw Error('Unsupported exhibit');
console.log(contentSha256);"""
    result = subprocess.run([node, "--input-type=module", "-e", code], input=original, capture_output=True)
    if result.returncode:
        raise RuntimeError("Input exhibit failed Node SHA-256/schema verification")


def build_pdf(input_path, output_path):
    original = input_path.read_bytes()
    verify_input(original)
    e = json.loads(original)
    rows, injectors, controls = e["outputs"]["monthly"], e["inputs"]["injectors"], e["inputs"]["controls"]
    digest = e["contentSha256"]
    history = e.get("publicHistory")
    story = []

    def heading(title, subtitle):
        story.extend([para(title, "ExTitle"), para(subtitle, "ExBody")])

    def footer(c, doc):
        c.saveState()
        c.setStrokeColor(STEEL)
        c.line(36, 30, 756, 30)
        c.setFont("Helvetica", 7)
        c.setFillColor(MUTED)
        c.drawString(36, 19, f"SWD Analytics | exhibit {digest[:16]} | educational demonstration")
        c.drawRightString(756, 19, f"Page {doc.page}")
        c.restoreState()

    heading("SWD water planning exhibit", "Fictional production and injector scenarios, with separately identified public source evidence.")
    story.append(para(f"Forecast frozen through {e['inputs']['cutoff']}. Scenario: producer starts {controls['newWellStart']}; available expansion {fmt(controls['expansionStbd'])} STB/d from {controls['expansionMonth']}.", "ExBody"))
    shortfalls = [r for r in rows if r["shortfallBbl"] > 0]
    story.append(table(["Capacity shortfall months", "Annual unmet planned volume", "Peak planned demand"], [[f"{len(shortfalls)} of 12", f"{fmt(sum(r['shortfallBbl'] for r in rows))} bbl", f"{fmt(max(r['demandStbd'] for r in rows))} STB/d"]], [240, 240, 240]))
    story.append(Spacer(1, 12))
    labels = [r["month"][5:] for r in rows]
    story.append(Chart("Available capacity against planned demand", labels, [("Available capacity", [r["capacityBbl"] for r in rows], STEEL, False), ("Forecast + assumed producer", [r["demandBbl"] for r in rows], SAND, False)], "Monthly stock-tank water volume (bbl)", height=215))
    story.append(Spacer(1, 6))
    story.append(table(["Assumed injector", "Reservoir / limit (psia)", "J (STB/d/psi)", "Availability", "Available (STB/d)"], [[i["id"], f"{fmt(i['reservoirPsia'])} / {fmt(i['limitPsia'])}", str(i["injectivityStbdPerPsi"]), f"{100*i['availability']:.0f}%", fmt(next(o["availableStbd"] for o in e["outputs"]["injectors"] if o["id"] == i["id"]))] for i in injectors], [160, 180, 125, 110, 145]))
    story.append(Spacer(1, 7))
    story.append(para("All engineering pressures are bottomhole psia at the common formation reference depth. Constant J and pressure limits are assumed; no actual-well calibration or sustainable-capacity claim is made.", "ExSmall"))

    story.append(PageBreak())
    fixture_backed = bool(e["inputs"].get("planningFixture"))
    actual_label = "Fixture actual" if fixture_backed else "Declared actual"
    heading("Reconciliation and injector response", f"{actual_label} minus frozen forecast; declared producer portfolio. Planned demand includes an assumed new producer.")
    forecast = Chart("Forecast and declared actuals", labels, [("Frozen forecast", [r["forecastBbl"] for r in rows], STEEL, True), (actual_label, [r["actualBbl"] for r in rows], INK, False)], "Monthly water (bbl)", width=350, height=180)
    curves = [(o["id"].replace("FICTIONAL-INJ-", "Injector "), [p["bottomholePsia"] for p in o["curve"]], STEEL if n == 0 else SAND, False) for n, o in enumerate(e["outputs"]["injectors"])]
    pressure = Chart("Pressure required to inject", ["0", "2,500", "5,000", "7,500", "10,000"], curves, "Bottomhole psia; rate axis STB/d", width=350, height=180, limit=injectors[0]["limitPsia"])
    pair = Table([[forecast, pressure]], colWidths=[365, 355], hAlign="LEFT")
    pair.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(pair)
    story.append(Spacer(1, 10))
    story.append(table(["Month", "Days", "Forecast bbl", "Actual bbl", "Variance %", "Demand bbl", "Capacity bbl", "Headroom bbl"], [[r["month"], str(r["days"]), fmt(r["forecastBbl"]), fmt(r["actualBbl"]), "Undefined" if r["variancePct"] is None else f"{r['variancePct']:+.1f}%", fmt(r["demandBbl"]), fmt(r["capacityBbl"]), fmt(r["headroomBbl"])] for r in rows], [78, 40, 99, 99, 82, 105, 108, 109]))
    story.append(Spacer(1, 7))
    story.append(para("Pressure curve: Pwf = Pres + q/J. Dashed line: assumed bottomhole pressure limit; higher curve points are excluded rates. Availability and operating ceilings reduce pressure-limited capacity. Calendar volumes use actual days in each month. CSV/JSON retain unrounded values.", "ExSmall"))

    story.append(PageBreak())
    heading("Public reported injection history", "Public liquid injection remains separate from synthetic production and fictional injector calculations.")
    if history:
        public_rows = sorted(history["injectionMonthly"], key=lambda r: (r["period_start"], r["source_row_key"]))
        used = {r["parent_key"] for r in public_rows}
        parents = [r for r in history["inventory"] if r["source_record_key"] in used]
        reported_volumes = [r["injected_liquid_bbl"] for r in public_rows if r["injected_liquid_bbl"] is not None]
        missing_count = len(public_rows)-len(reported_volumes)
        total_label = "Not reported" if not reported_volumes else f"{fmt(sum(reported_volumes))} bbl" + (" (partial sum)" if missing_count else "")
        story.append(para("; ".join(f"UIC {p['uic_number']} / API {p['api_no']} / well {p['well_no_display']}" for p in parents), "ExSub"))
        story.append(para(f"Pinned artifact: {history['artifactId']}. {len(public_rows)} acquired reports; sum of known liquid volumes: {total_label}; {missing_count} volume(s) not reported. Average and maximum pressure are distinct source fields with unspecified pressure basis.", "ExSmall"))
        story.append(table(["Month", "Liquid bbl", "Avg pressure psi", "Max pressure psi", "Calculated bbl/day", "Source report ID"], [[r["period_start"][:7], fmt(r["injected_liquid_bbl"]), fmt(r["reported_avg_injection_pressure_psi"]), fmt(r["reported_max_injection_pressure_psi"]), fmt(r["calculated_calendar_day_avg_bpd"], 2), r["source_report_id"]] for r in public_rows], [90, 110, 125, 125, 140, 130], font_size=7))
        story.append(Spacer(1, 7))
        story.append(para("Calendar-day average is calculated from monthly reported liquid / calendar days. Monthly pressures do not establish bottomhole pressure or injectivity. Other inventory candidates have no acquired history here; no zero injection is inferred.", "ExSmall"))
    else:
        story.append(para("Public history was not loaded for this exhibit. No public observations are represented by this case.", "ExBody"))

    story.append(PageBreak())
    heading("Method, assumptions and source lineage", "The complete original JSON is embedded as an attachment; use it and the paired CSV for unrounded data and full source metadata.")
    story.append(para(f"Technical exhibit SHA-256: {digest}", "ExSmall"))
    story.append(para(e["inputs"].get("forecastEvidence", "Historical exhibit: raw-history verification status was not recorded"), "ExSmall"))
    story.append(para(f"Nexus local main: {e['inputs']['nexusSourceCommit']}. Fixture: {e['inputs']['fixtureId']}. Engineering: {e['modelVersions']['engineering']}; forecast: {e['modelVersions']['forecast']}.", "ExSmall"))
    for name, formula in e["formulas"].items():
        story.append(para(f"{name}: {formula}", "ExSmall"))
    story.append(para("Assumptions and limits", "ExSub"))
    for assumption in e["assumptions"]:
        story.append(para(assumption, "ExSmall"))
    brine = e["outputs"]["brine"]
    story.append(para(f"Calculated brine reference: {brine['pressurePsia']} psia, {brine['temperatureF']} F, {brine['salinityPpm']} ppm ({brine.get('salinityBasis', 'original declared salinity basis; see retained source')}); Bw {brine['bwRbPerStb']:.4f} rb/STB; density {brine['densityLbPerFt3']:.2f} lb/ft3; viscosity {brine['viscosityCp']:.3f} cP; compressibility {brine['compressibilityPerPsi']:.3e} 1/psi. {brine['source']} Carried reference fixtures are recorded historical oracle values; this report does not assert a fresh MCP call.", "ExSmall"))
    if history:
        story.append(para("Official source queries and preserved snapshots", "ExSub"))
        for source in history["manifest"].get("sources", []):
            if source.get("kind") not in ("inventory", "monthly"):
                continue
            story.append(para(f"{source.get('title', source.get('name'))} | retrieved {source['retrieved_at']}", "ExSmall"))
            story.append(para(source["url"], "ExSmall"))
            story.append(para(f"Snapshot SHA-256: {source['sha256']}", "ExSmall"))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), leftMargin=36, rightMargin=36, topMargin=32, bottomMargin=42, title="SWD water planning technical exhibit", author="SWD Analytics", invariant=1)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    writer = PdfWriter()
    writer.clone_document_from_reader(PdfReader(buffer))
    writer.add_attachment("swd-technical-exhibit.json", original)
    writer.add_metadata({"/Title": "SWD water planning technical exhibit", "/Author": "SWD Analytics", "/Subject": f"Technical exhibit SHA-256 {digest}"})
    output = io.BytesIO()
    writer.write(output)
    check = PdfReader(io.BytesIO(output.getvalue()))
    if len(check.pages) != 4 or check.attachments["swd-technical-exhibit.json"][0] != original:
        raise RuntimeError("PDF pagination or original JSON attachment verification failed")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output.getvalue())
    print(f"Exported {output_path}: {len(check.pages)} pages, verified original JSON attachment, exhibit {digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default="exhibits/default.json")
    parser.add_argument("output", nargs="?", default="output/pdf/swd-technical-exhibit.pdf")
    args = parser.parse_args()
    build_pdf(Path(args.input).resolve(), Path(args.output).resolve())
