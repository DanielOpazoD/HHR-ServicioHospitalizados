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

    // Uniform font size: 12pt (20% larger than original 10pt)
    const FZ = 12;

    const draw = (text, x, y, bold = false) => {
        page.drawText(text.toUpperCase(), { x, y, size: FZ, font: bold ? fontBold : font, color: RED });
    };

    // Coordinates v3 (2026-02-23)

    // #4 NOMBRE
    draw('Opazo', 51.48, 827.86);
    draw('Damiani', 238.46, 824.86);
    draw('Daniel', 442.32, 827.11);
    // #52 NOMBRE SOCIAL
    draw('Danny', 114.9, 804.28);
    // #5 TIPO ID + RUN
    draw('1', 111.31, 782.21);
    draw('12.345.678-9', 57.01, 759.22);
    // #6 SEXO REGISTRAL
    draw('M', 305.82, 781.46, true);
    // #7 FECHA NAC
    draw('15', 450.35, 800.54);
    draw('03', 489.42, 799.04);
    draw('1990', 524.05, 799.79);
    // #8 EDAD
    draw('35', 79, 722.06);
    draw('1', 181.04, 720.09);
    // #10 PUEBLO INDÍGENA
    draw('3', 523.86, 750.12);
    // #18 PREVISIÓN
    draw('1', 54.37, 516.73);
    // #22 PROCEDENCIA
    draw('1', 225.78, 471.36);

    // #24 INGRESO
    draw('08', 102.35, 426.74);
    draw('30', 136.36, 426.74);
    draw('22', 181.71, 426.09);
    draw('02', 215.72, 427.4);
    draw('2025', 249.74, 426.09);

    // #29 EGRESO
    draw('14', 91.68, 341.43);
    draw('00', 124.36, 341.34);
    draw('25', 169.04, 339.37);
    draw('02', 204.39, 341.43);
    draw('2025', 238.4, 340.03);

    // #30 DÍAS ESTADA
    draw('3', 103.69, 326.75);

    // #31 CONDICIÓN
    draw('1', 250.41, 327.4);

    // #33 DIAGNÓSTICO + CIE-10
    draw('Diabetes Mellitus Tipo 2, No Insulinodependiente', 167.08, 280.72);
    draw('E11.9', 529.23, 281.38, true);

    // #50 ESPECIALIDAD
    draw('Medicina Interna', 327.77, 76.62);

    const result = await pdfDoc.save();
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'ieeh-test.pdf'), result);
    console.log('✅ Test PDF — uniform 12pt, UPPERCASE, coords v3');
}

verify().catch(console.error);
