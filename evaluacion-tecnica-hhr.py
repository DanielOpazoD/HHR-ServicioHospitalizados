#!/usr/bin/env python3
"""Generate the HHR 2026 Tracker Technical Evaluation PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# --- Colors ---
DARK_BG = HexColor("#1a1a2e")
ACCENT_BLUE = HexColor("#0f3460")
ACCENT_TEAL = HexColor("#16213e")
HEADER_BG = HexColor("#1b2838")
ROW_ALT = HexColor("#f0f4f8")
ROW_WHITE = HexColor("#ffffff")
BORDER_GRAY = HexColor("#d1d5db")
TEXT_DARK = HexColor("#1f2937")
TEXT_MEDIUM = HexColor("#4b5563")
TEXT_LIGHT = HexColor("#6b7280")
ACCENT_GREEN = HexColor("#059669")
ACCENT_AMBER = HexColor("#d97706")
ACCENT_RED = HexColor("#dc2626")
SCORE_BG = HexColor("#e0f2fe")
SCORE_BORDER = HexColor("#0284c7")
P0_BG = HexColor("#fef2f2")
P0_BORDER = HexColor("#ef4444")
P1_BG = HexColor("#fffbeb")
P1_BORDER = HexColor("#f59e0b")
P2_BG = HexColor("#f0fdf4")
P2_BORDER = HexColor("#22c55e")
STRENGTH_BG = HexColor("#f0fdf4")
WEAKNESS_BG = HexColor("#fef2f2")

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "Evaluacion_Tecnica_HHR_2026.pdf"
)

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
    )

    styles = getSampleStyleSheet()
    W = doc.width

    # --- Custom Styles ---
    s_title = ParagraphStyle(
        "DocTitle", parent=styles["Title"],
        fontSize=22, leading=28, textColor=ACCENT_BLUE,
        spaceAfter=2, alignment=TA_LEFT, fontName="Helvetica-Bold",
    )
    s_subtitle = ParagraphStyle(
        "DocSubtitle", parent=styles["Normal"],
        fontSize=11, leading=15, textColor=TEXT_LIGHT,
        spaceAfter=4, alignment=TA_LEFT, fontName="Helvetica",
    )
    s_scope = ParagraphStyle(
        "Scope", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=TEXT_MEDIUM,
        spaceAfter=12, fontName="Helvetica",
    )
    s_section = ParagraphStyle(
        "SectionHead", parent=styles["Heading1"],
        fontSize=14, leading=18, textColor=ACCENT_BLUE,
        spaceBefore=18, spaceAfter=8, fontName="Helvetica-Bold",
    )
    s_subsection = ParagraphStyle(
        "SubSection", parent=styles["Heading2"],
        fontSize=11, leading=15, textColor=HEADER_BG,
        spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold",
    )
    s_body = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=TEXT_DARK,
        spaceAfter=6, alignment=TA_JUSTIFY, fontName="Helvetica",
    )
    s_body_bold = ParagraphStyle(
        "BodyBold", parent=s_body,
        fontName="Helvetica-Bold",
    )
    s_table_header = ParagraphStyle(
        "TH", parent=styles["Normal"],
        fontSize=8.5, leading=11, textColor=white,
        fontName="Helvetica-Bold", alignment=TA_LEFT,
    )
    s_table_cell = ParagraphStyle(
        "TC", parent=styles["Normal"],
        fontSize=8, leading=11, textColor=TEXT_DARK,
        fontName="Helvetica", alignment=TA_LEFT,
    )
    s_table_cell_bold = ParagraphStyle(
        "TCBold", parent=s_table_cell,
        fontName="Helvetica-Bold",
    )
    s_table_cell_center = ParagraphStyle(
        "TCC", parent=s_table_cell,
        alignment=TA_CENTER, fontName="Helvetica-Bold",
    )
    s_score_big = ParagraphStyle(
        "ScoreBig", parent=styles["Normal"],
        fontSize=36, leading=42, textColor=ACCENT_BLUE,
        fontName="Helvetica-Bold", alignment=TA_CENTER,
    )
    s_score_label = ParagraphStyle(
        "ScoreLabel", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=TEXT_MEDIUM,
        fontName="Helvetica", alignment=TA_CENTER,
    )
    s_score_desc = ParagraphStyle(
        "ScoreDesc", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=TEXT_DARK,
        fontName="Helvetica", alignment=TA_JUSTIFY,
        spaceBefore=8,
    )
    s_bullet_title = ParagraphStyle(
        "BulletTitle", parent=s_body,
        fontName="Helvetica-Bold", spaceAfter=2,
    )
    s_bullet_body = ParagraphStyle(
        "BulletBody", parent=s_body,
        leftIndent=12, spaceAfter=8,
    )
    s_footer = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=7, leading=9, textColor=TEXT_LIGHT,
        fontName="Helvetica", alignment=TA_CENTER,
    )

    story = []

    # =========================================================================
    # COVER / HEADER
    # =========================================================================
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Evaluacion Tecnica: HHR 2026 Tracker", s_title))
    story.append(Paragraph("Abril 2026 - Auditoria de Codigo y Arquitectura", s_subtitle))
    story.append(HRFlowable(
        width="100%", thickness=2, color=ACCENT_BLUE,
        spaceAfter=10, spaceBefore=6
    ))
    story.append(Paragraph(
        "<b>Scope:</b> ~257K lineas TS/TSX  |  2,576 archivos  |  910 tests  |  "
        "React 19 + Firebase + Dexie  |  Netlify",
        s_scope
    ))
    story.append(Spacer(1, 0.1 * inch))

    # =========================================================================
    # SECTION 1: NOTAS POR PARAMETRO
    # =========================================================================
    story.append(Paragraph("1. Notas por Parametro", s_section))

    params = [
        ("Estructura", "6 / 7",
         "Arquitectura por capas con boundary enforcement real (20+ scripts + ESLint boundaries plugin). "
         "13 feature modules, 34 service modules, 14 contextos fragmentados. Path aliases limpios. "
         "Pierde por: directorio infrastructure/ deprecated pero presente, y acoplamiento residual con legacy Firebase."),
        ("Organizacion", "6 / 7",
         "Feature-driven con repository pattern. 130+ scripts de governance. Naming conventions consistentes. "
         "Import organization disciplinada con import type. Re-exports indirectos a" + chr(241) + "aden una capa de "
         "indireccion navegacional innecesaria."),
        ("Buenas practicas", "6 / 7",
         "TypeScript strict con solo 9 'any' en produccion (todos en legacy/infra). "
         "ApplicationOutcome&lt;T&gt; como patron de error unificado. Zod en runtime boundaries. "
         "AbortController en 6 servicios. Pierde por: 3 librerias PDF redundantes y 2 de Excel sin justificacion documentada."),
        ("Limitacion de componentes", "5 / 7",
         "Hooks bien acotados con SRP. Contextos fragmentados son excelente practica anti-rerender. "
         "Pero 4 componentes &gt;300 lineas mezclan responsabilidades. CensusEmailRecipientsSection "
         "tiene 28 props - prop drilling severo."),
        ("Estabilidad", "5.5 / 7",
         "Sync queue con limite de 192 tasks, budgets operacionales, exponential backoff con jitter, "
         "retry policies por dominio. Auth persistence con fallback chain de 3 niveles. "
         "Pierde por: bug conocido en produccion (multi-tab staff catalogs) y claim sync que no valida resultado."),
        ("Escalabilidad", "5 / 7",
         "Lazy loading, virtual scrolling, manual chunks en Vite, compresion gzip+brotli, PWA con service worker. "
         "Penalizan: dependencias pesadas redundantes, vendor-firebase-firestore near-limit en budget "
         "(360KB/400KB), sin paginacion visible en queries de daily records."),
        ("Tests", "6 / 7",
         "910 test files. Cobertura critica por zonas: sync 95%, recovery 99%, census 93.6%. "
         "Tests behavioral. DataFactory para mocks tipados. Governance: megatest limit 500 loc. "
         "Stress test de sync queue. Sin test unitario para el bug multi-tab. Umbrales globales modestos (72% lines)."),
        ("Seguridad", "5.5 / 7",
         "CSP sin unsafe-inline en scripts. HTML sanitization con allowlist. RBAC con 7+ roles y permisos "
         "por modulo. Firestore rules con claims + role hierarchy. Pierde por: 4 overrides en window para "
         "E2E sin verificacion de eliminacion en produccion, y Firestore rules que dependen de claims potencialmente stale."),
        ("Documentacion", "6 / 7",
         "204 archivos .md. 18 ADRs. 11 runbooks operacionales. README de 330 lineas. Quality guardrails, "
         "definition of done. Pierde porque JSDoc es escaso (137 anotaciones en 2,576 archivos - 5.3% de coverage) "
         "y distribucion desigual."),
    ]

    # Build table
    col_widths = [W * 0.18, W * 0.08, W * 0.74]
    header_row = [
        Paragraph("Parametro", s_table_header),
        Paragraph("Nota", s_table_header),
        Paragraph("Justificacion", s_table_header),
    ]
    data = [header_row]
    for name, score, justification in params:
        data.append([
            Paragraph(name, s_table_cell_bold),
            Paragraph(score, s_table_cell_center),
            Paragraph(justification, s_table_cell),
        ])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [ROW_WHITE, ROW_ALT]),
    ]
    t.setStyle(TableStyle(t_style))
    story.append(t)

    # =========================================================================
    # SECTION 2: NOTA GLOBAL
    # =========================================================================
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("2. Nota Global", s_section))

    score_box_data = [[
        Paragraph("5.7 / 7", s_score_big),
    ]]
    score_box = Table(score_box_data, colWidths=[W * 0.3])
    score_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SCORE_BG),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("BOX", (0, 0), (-1, -1), 1.5, SCORE_BORDER),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))

    desc = Paragraph(
        "Un proyecto con madurez arquitectonica y de governance inusual para su escala (250K+ LOC, "
        "aparentemente equipo peque" + chr(241) + "o). La infraestructura de testing, documentacion y boundary "
        "enforcement esta por encima de la mayoria de proyectos enterprise. Las debilidades reales son "
        "acotadas pero concretas: un bug de produccion en multi-tab, dependencias redundantes que inflan "
        "el bundle, y componentes que concentran demasiada responsabilidad.",
        s_score_desc,
    )
    wrapper_data = [[score_box, desc]]
    wrapper = Table(wrapper_data, colWidths=[W * 0.32, W * 0.68])
    wrapper.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
    ]))
    story.append(wrapper)

    # =========================================================================
    # SECTION 3: PUNTOS FUERTES
    # =========================================================================
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("3. Principales Puntos Fuertes", s_section))

    strengths = [
        ("Boundary enforcement automatizado y real",
         "No es organizacion por convencion - hay 20+ scripts de verificacion arquitectonica + ESLint "
         "boundaries plugin que bloquean en CI imports cross-layer. Esto es raro incluso en equipos grandes "
         "y es la razon por la que 2,576 archivos no se han convertido en espagueti."),
        ("Sync queue con operational budgets",
         "El sistema de cola offline tiene limite de 192 tasks, batches de 25, umbrales de warning/critical "
         "por edad y tama" + chr(241) + "o, exponential backoff con jitter, y retry policies por dominio de error. "
         "Dise" + chr(241) + "o de sistemas distribuidos real en un frontend."),
        ("Testing multi-capa con zonas criticas diferenciadas",
         "910 tests con zonas de sync (95%), recovery (99%), y census (93.6%) con umbrales propios. "
         "Stress test de sync queue, E2E con Playwright contra emulador, y tests de Firestore rules. "
         "Test governance impide tests >500 lineas."),
        ("Auth persistence fallback chain",
         "Tres niveles (local 2.5s, session 1.5s, memory 0.5s) con timeout individual, cleanup, y logging. "
         "Si falla el primer candidato, escala automaticamente."),
        ("Documentacion ejecutiva y operacional",
         "18 ADRs documentan por que se tomaron decisiones. 11 runbooks cubren operaciones reales. "
         "Definition of done, quality guardrails, y change policy formalizan el proceso."),
    ]

    for i, (title, desc) in enumerate(strengths):
        num = str(i + 1)
        row_data = [[
            Paragraph("<b>" + num + ". " + title + ".</b> " + desc, s_table_cell),
        ]]
        row_t = Table(row_data, colWidths=[W - 12])
        row_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), STRENGTH_BG),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, ACCENT_GREEN),
        ]))
        story.append(row_t)
        story.append(Spacer(1, 4))

    # =========================================================================
    # SECTION 4: DEBILIDADES Y RIESGOS
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("4. Debilidades y Riesgos Mas Importantes", s_section))

    weaknesses = [
        ("Bug de produccion: multi-tab staff catalogs",
         "La segunda pesta" + chr(241) + "a no muestra nombres de enfermeros/TENS hasta que el usuario cambia de tab y "
         "vuelve. Causa: el query de catalogos resuelve antes de que la suscripcion Firestore este activa "
         "en la pesta" + chr(241) + "a secundaria, y refetchOnWindowFocus: 'always' lo rescata al volver."),
        ("Dependencias redundantes sin justificacion",
         "3 librerias PDF (jsPDF, pdf-lib, html2canvas) y 2 de Excel (exceljs, xlsx-populate) coexisten. "
         "A" + chr(241) + "ade ~300-500KB al bundle potencial, multiplica superficie de CVE, y no hay ADR que "
         "justifique por que se necesitan todas."),
        ("Componentes con prop drilling severo",
         "CensusEmailRecipientsSection tiene 28 props - necesita un container component o contexto local. "
         "DualSpecialtyCell mezcla logica de portal positioning, estado de subtype, y rendering en 354 lineas."),
        ("Test backdoors sin verificacion de produccion",
         "Cuatro propiedades globales de window para testing sin documentacion ni script en CI que verifique "
         "que no son accesibles en builds de produccion. En una app de salud, esto es un gap de auditoria."),
        ("JSDoc escaso en la capa de features",
         "137 anotaciones en 2,576 archivos es 5.3% de coverage. Los servicios core estan bien documentados, "
         "pero los hooks de features y componentes de dominio no."),
    ]

    for i, (title, desc) in enumerate(weaknesses):
        num = str(i + 1)
        row_data = [[
            Paragraph("<b>" + num + ". " + title + ".</b> " + desc, s_table_cell),
        ]]
        row_t = Table(row_data, colWidths=[W - 12])
        row_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), WEAKNESS_BG),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, ACCENT_RED),
        ]))
        story.append(row_t)
        story.append(Spacer(1, 4))

    # =========================================================================
    # SECTION 5: MEJORAS
    # =========================================================================
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("5. Mejoras de Alto Valor y Prioridad", s_section))

    improvements = [
        ("P0", "Fix multi-tab staff",
         "Invalidar queries de catalogo cuando isCatalogRealtimeReady transiciona a true.",
         "Elimina bug de produccion visible.", "Bajo (1-2 archivos)", P0_BG, P0_BORDER),
        ("P0", "Verificar test backdoors en produccion",
         "Agregar script CI que escanee el bundle final por __HHR_E2E_ y falle si encuentra acceso.",
         "Cierra gap de auditoria de seguridad.", "Bajo (1 script)", P0_BG, P0_BORDER),
        ("P1", "Consolidar librerias de export",
         "Elegir jsPDF o pdf-lib, exceljs o xlsx-populate. Documentar la eleccion en un ADR.",
         "Reduce bundle 200-400KB, reduce CVE surface.", "Medio", P1_BG, P1_BORDER),
        ("P1", "Extraer container de CensusEmailRecipientsSection",
         "Crear CensusEmailRecipientsContainer que maneje estado local y pase &lt;10 props.",
         "Mejora testability y reduce acoplamiento.", "Bajo (refactor)", P1_BG, P1_BORDER),
        ("P2", "Aumentar JSDoc en hooks de features",
         "Documentar @param, @returns, y contrato de cada hook publico.",
         "Reduce costo de onboarding.", "Medio (progresivo)", P2_BG, P2_BORDER),
        ("P2", "Test unitario para multi-tab de catalogos",
         "Simular timing de query vs suscripcion en useStaffQuery.",
         "Previene regresion del bug P0.", "Bajo", P2_BG, P2_BORDER),
    ]

    imp_header = [
        Paragraph("Prior.", s_table_header),
        Paragraph("Mejora", s_table_header),
        Paragraph("Descripcion", s_table_header),
        Paragraph("Impacto", s_table_header),
        Paragraph("Esfuerzo", s_table_header),
    ]
    imp_col_widths = [W * 0.06, W * 0.17, W * 0.35, W * 0.27, W * 0.15]
    imp_data = [imp_header]

    for prio, name, desc, impact, effort, bg, border in improvements:
        imp_data.append([
            Paragraph("<b>" + prio + "</b>", s_table_cell_center),
            Paragraph("<b>" + name + "</b>", s_table_cell_bold),
            Paragraph(desc, s_table_cell),
            Paragraph(impact, s_table_cell),
            Paragraph(effort, s_table_cell_center),
        ])

    imp_t = Table(imp_data, colWidths=imp_col_widths, repeatRows=1)
    imp_style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]
    # Color rows by priority
    for idx, (prio, _, _, _, _, bg, border) in enumerate(improvements):
        row = idx + 1
        imp_style.append(("BACKGROUND", (0, row), (-1, row), bg))

    imp_t.setStyle(TableStyle(imp_style))
    story.append(imp_t)

    # =========================================================================
    # FOOTER NOTE
    # =========================================================================
    story.append(Spacer(1, 0.4 * inch))
    story.append(HRFlowable(
        width="100%", thickness=0.5, color=BORDER_GRAY,
        spaceAfter=6, spaceBefore=6
    ))
    story.append(Paragraph(
        "Evaluacion generada mediante analisis automatizado del codigo fuente.  |  "
        "Abril 2026  |  Confidencial",
        s_footer,
    ))

    # Build
    doc.build(story)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
