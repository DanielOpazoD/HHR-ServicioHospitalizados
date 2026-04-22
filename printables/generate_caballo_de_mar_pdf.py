from pathlib import Path

from reportlab.lib import colors
from reportlab.pdfgen import canvas


LETTER_W = 612
LETTER_H = 792
POSTER_W = LETTER_W * 2
POSTER_H = LETTER_H * 3


def traced_path(pdf: canvas.Canvas, start, curves, stroke_width):
    path = pdf.beginPath()
    path.moveTo(*start)
    for c1, c2, end in curves:
        path.curveTo(*c1, *c2, *end)
    pdf.setLineWidth(stroke_width)
    pdf.setLineCap(1)
    pdf.setLineJoin(1)
    pdf.drawPath(path, stroke=1, fill=0)


def draw_seahorse(pdf: canvas.Canvas):
    pdf.saveState()
    pdf.translate(180, 2320)
    pdf.scale(5.6, -5.6)
    pdf.setStrokeColor(colors.black)
    pdf.setFillColor(colors.white)
    pdf.setLineCap(1)
    pdf.setLineJoin(1)

    body = pdf.beginPath()
    body.moveTo(8, 96)
    body.curveTo(7, 84, 18, 73, 31, 72)
    body.curveTo(35, 47, 52, 29, 74, 18)
    body.curveTo(97, 9, 121, 14, 133, 33)
    body.curveTo(146, 53, 148, 80, 143, 106)
    body.curveTo(141, 121, 141, 133, 144, 147)
    body.curveTo(147, 167, 147, 190, 145, 217)
    body.curveTo(143, 244, 146, 272, 144, 298)
    body.curveTo(142, 329, 134, 354, 120, 370)
    body.curveTo(105, 386, 79, 392, 54, 387)
    body.curveTo(30, 382, 14, 368, 8, 347)
    body.curveTo(4, 331, 6, 314, 16, 302)
    body.curveTo(24, 292, 38, 287, 51, 289)
    body.curveTo(66, 291, 77, 301, 80, 315)
    body.curveTo(83, 329, 78, 342, 68, 350)
    body.curveTo(59, 356, 48, 358, 39, 355)
    body.curveTo(54, 365, 72, 368, 88, 363)
    body.curveTo(103, 358, 113, 347, 116, 331)
    body.curveTo(120, 312, 114, 297, 101, 287)
    body.curveTo(86, 276, 63, 269, 47, 255)
    body.curveTo(30, 240, 24, 220, 29, 198)
    body.curveTo(34, 177, 47, 161, 62, 151)
    body.curveTo(78, 140, 85, 126, 82, 108)
    body.curveTo(79, 92, 65, 83, 50, 84)
    body.curveTo(36, 84, 22, 91, 14, 103)
    body.curveTo(12, 100, 10, 98, 8, 96)
    pdf.setLineWidth(1.15)
    pdf.drawPath(body, stroke=1, fill=0)

    snout = pdf.beginPath()
    snout.moveTo(8, 96)
    snout.curveTo(4, 103, 0, 108, -2, 115)
    snout.curveTo(-4, 123, 1, 130, 10, 132)
    snout.curveTo(18, 134, 26, 131, 31, 124)
    pdf.setLineWidth(1.0)
    pdf.drawPath(snout, stroke=1, fill=0)

    mouth = pdf.beginPath()
    mouth.moveTo(29, 120)
    mouth.curveTo(33, 126, 38, 129, 44, 130)
    mouth.curveTo(47, 124, 46, 119, 43, 115)
    pdf.setLineWidth(0.7)
    pdf.drawPath(mouth, stroke=1, fill=0)

    smile = pdf.beginPath()
    smile.moveTo(29, 120)
    smile.curveTo(34, 124, 39, 125, 44, 124)
    pdf.drawPath(smile, stroke=1, fill=0)

    eye_outer = pdf.beginPath()
    eye_outer.circle(52, 90, 9)
    pdf.setLineWidth(0.9)
    pdf.drawPath(eye_outer, stroke=1, fill=0)
    pdf.setFillColor(colors.black)
    pdf.circle(54, 92, 4.3, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.circle(50, 87, 2.2, stroke=0, fill=1)
    pdf.circle(55, 95, 1.1, stroke=0, fill=1)
    pdf.setFillColor(colors.black)
    pdf.circle(26, 90, 9, stroke=1, fill=0)
    pdf.circle(28, 92, 4.3, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.circle(24, 87, 2.2, stroke=0, fill=1)
    pdf.circle(29, 95, 1.1, stroke=0, fill=1)
    pdf.setFillColor(colors.white)

    lashes = [
        ((58, 82), (65, 74)),
        ((61, 88), (72, 85)),
        ((58, 96), (67, 100)),
    ]
    pdf.setLineWidth(0.8)
    for start, end in lashes:
        pdf.line(*start, *end)

    cheek_star = pdf.beginPath()
    cheek_star.moveTo(73, 86)
    cheek_star.lineTo(82, 79)
    cheek_star.lineTo(89, 82)
    cheek_star.lineTo(86, 91)
    cheek_star.lineTo(79, 96)
    cheek_star.lineTo(70, 93)
    cheek_star.close()
    pdf.setLineWidth(0.7)
    pdf.drawPath(cheek_star, stroke=1, fill=0)
    pdf.line(73, 86, 79, 96)
    pdf.line(79, 96, 82, 79)
    pdf.line(82, 79, 86, 91)

    belly_stripes = [
        ((31, 146), (59, 144)),
        ((28, 172), (56, 170)),
        ((27, 198), (56, 196)),
        ((27, 224), (56, 222)),
    ]
    pdf.setLineWidth(0.9)
    for start, end in belly_stripes:
        stripe = pdf.beginPath()
        stripe.moveTo(*start)
        stripe.curveTo(start[0] + 10, start[1] + 3, end[0] - 10, end[1] + 3, *end)
        pdf.drawPath(stripe, stroke=1, fill=0)

    fin = pdf.beginPath()
    fin.moveTo(101, 230)
    fin.curveTo(118, 220, 128, 220, 136, 228)
    fin.curveTo(129, 238, 129, 250, 134, 262)
    fin.curveTo(121, 264, 111, 258, 101, 246)
    fin.curveTo(96, 239, 96, 234, 101, 230)
    pdf.setLineWidth(1.0)
    pdf.drawPath(fin, stroke=1, fill=0)
    pdf.line(106, 235, 128, 231)
    pdf.line(104, 241, 128, 246)
    pdf.line(103, 247, 126, 258)

    inner_tail = pdf.beginPath()
    inner_tail.moveTo(52, 299)
    inner_tail.curveTo(72, 294, 90, 299, 99, 312)
    inner_tail.curveTo(108, 326, 106, 341, 96, 351)
    inner_tail.curveTo(84, 362, 67, 363, 54, 356)
    pdf.setLineWidth(0.9)
    pdf.drawPath(inner_tail, stroke=1, fill=0)

    body_marks = [(92, 194), (94, 228), (92, 262)]
    pdf.setLineWidth(0.7)
    for x, y in body_marks:
        mark = pdf.beginPath()
        mark.moveTo(x - 4, y)
        mark.curveTo(x - 1, y - 3, x + 1, y - 3, x + 4, y)
        mark.moveTo(x - 4, y + 8)
        mark.curveTo(x - 1, y + 5, x + 1, y + 5, x + 4, y + 8)
        pdf.drawPath(mark, stroke=1, fill=0)

    top_spikes = [
        ((58, 20), (67, -3), (76, 20)),
        ((74, 18), (88, -10), (104, 18)),
        ((100, 22), (117, 3), (126, 30)),
    ]
    back_spikes = [
        ((131, 46), (148, 58), (133, 76)),
        ((133, 96), (152, 108), (136, 126)),
        ((134, 145), (152, 156), (137, 176)),
        ((136, 194), (153, 208), (138, 228)),
        ((137, 244), (151, 258), (138, 278)),
        ((136, 292), (146, 308), (132, 326)),
    ]
    pdf.setLineWidth(0.9)
    for left, tip, right in top_spikes + back_spikes:
        spike = pdf.beginPath()
        spike.moveTo(*left)
        spike.lineTo(*tip)
        spike.lineTo(*right)
        pdf.drawPath(spike, stroke=1, fill=0)

    bubble_centers = [
        (16, 28, 2.8),
        (25, 15, 4.0),
        (37, 2, 2.4),
    ]
    pdf.setLineWidth(0.5)
    for x, y, radius in bubble_centers:
        pdf.circle(x, y, radius, stroke=1, fill=0)

    pdf.restoreState()


def add_page_label(pdf: canvas.Canvas, label: str):
    pdf.saveState()
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#555555"))
    pdf.drawRightString(LETTER_W - 24, 20, label)
    pdf.restoreState()


def build_poster(output_path: Path):
    pdf = canvas.Canvas(str(output_path), pagesize=(POSTER_W, POSTER_H))
    draw_seahorse(pdf)
    pdf.showPage()
    pdf.save()


def build_tiled(output_path: Path):
    pdf = canvas.Canvas(str(output_path), pagesize=(LETTER_W, LETTER_H))
    for row in range(3):
        for col in range(2):
            pdf.saveState()
            x_offset = -col * LETTER_W
            y_offset = -(POSTER_H - (row + 1) * LETTER_H)
            pdf.translate(x_offset, y_offset)
            draw_seahorse(pdf)
            pdf.restoreState()
            add_page_label(pdf, f"Tile {row + 1}-{col + 1}")
            pdf.showPage()
    pdf.save()


def main():
    base_dir = Path(__file__).resolve().parent
    base_dir.mkdir(parents=True, exist_ok=True)
    build_poster(base_dir / "caballo_de_mar_poster_2x3_carta.pdf")
    build_tiled(base_dir / "caballo_de_mar_6_paginas_carta.pdf")


if __name__ == "__main__":
    main()
