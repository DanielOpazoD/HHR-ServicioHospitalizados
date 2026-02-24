const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function verify() {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'docs', 'estadistico-egreso.pdf'));
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.getPage(0);
    const RED = rgb(1, 0, 0);

    // Font sizes increased +1pt (matching ieehPdfService.ts)
    const FZ = 10;
    const FZ_SMALL = 7;
    const FZ_CODE = 9;

    const draw = (text, x, y, size = FZ, bold = false) => {
        // Force uppercase (matching ieehPdfService.ts)
        page.drawText(text.toUpperCase(), { x, y, size, font: bold ? fontBold : font, color: RED });
    };

    // Refined coordinates with normalized Y values per row (2026-02-23 v2)

    // #4 NOMBRE (Y=825.15)
    draw('Opazo', 57.49, 825.15);
    draw('Damiani', 249.13, 825.15);
    draw('Daniel', 456.99, 825.15);
    // #52 NOMBRE SOCIAL
    draw('Danny', 114.25, 805);
    // #5 TIPO ID + RUN (Y=781.06)
    draw('1', 111.3, 781.06, FZ_CODE);
    draw('12.345.678-9', 59.7, 757.84);
    // #6 SEXO REGISTRAL (Y=781.06)
    draw('M', 305.15, 781.06, FZ_CODE, true);
    // #7 FECHA NAC (Y=799.35)
    draw('15', 450.36, 799.35, FZ_CODE);
    draw('03', 489.42, 799.35, FZ_CODE);
    draw('1990', 524.07, 799.35, FZ_CODE);
    // #8 EDAD (Y=720.74)
    draw('35', 79.7, 720.74, FZ_CODE);
    draw('1', 181.07, 720.74, FZ_CODE);
    // #10 PUEBLO INDÍGENA
    draw('3', 523.87, 750.08, FZ_CODE);
    // #18 PREVISIÓN
    draw('1', 54.35, 516.72, FZ_CODE);
    // #22 PROCEDENCIA
    draw('1', 225.75, 471.38, FZ_CODE);

    // #24 INGRESO (Y=426.58)
    draw('08', 102.37, 426.58, FZ_CODE);
    draw('30', 136.39, 426.58, FZ_CODE);
    draw('22', 181.07, 426.58, FZ_CODE);
    draw('02', 215.08, 426.58, FZ_CODE);
    draw('2025', 249.76, 426.58, FZ_CODE);

    // #29 EGRESO (Y=339.64)
    draw('14', 92.37, 339.64, FZ_CODE);
    draw('00', 125.05, 339.64, FZ_CODE);
    draw('25', 170.4, 339.64, FZ_CODE);
    draw('02', 205.08, 339.64, FZ_CODE);
    draw('2025', 238.43, 339.64, FZ_CODE);

    // #30 DÍAS ESTADA (Y=326.7)
    draw('3', 104.37, 326.7, FZ_CODE);

    // #31 CONDICIÓN (Y=326.7)
    draw('1', 250.43, 326.7, FZ_CODE);

    // #33 DIAGNÓSTICO + CIE-10 (Y=281.03)
    draw('Diabetes Mellitus Tipo 2, No Insulinodependiente', 167.06, 281.03, FZ_SMALL);
    draw('E11.9', 529.2, 281.03, FZ_CODE, true);

    // #50 ESPECIALIDAD
    draw('Medicina Interna', 327.79, 76.01);

    const result = await pdfDoc.save();
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'ieeh-test.pdf'), result);
    console.log('✅ Test PDF generated — font size 10, UPPERCASE, refined coords v2');
}

verify().catch(console.error);
