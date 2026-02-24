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

    // We are testing with font size 9
    const FZ = 9;

    const draw = (text, x, y, size = FZ, bold = false) => {
        page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: RED });
    };

    // #4 NOMBRE (✅ Y=830)
    draw('OPAZO', 85, 830);
    draw('DAMIANI', 255, 830);
    draw('DANIEL', 428, 830);
    // #52 NOMBRE SOCIAL
    draw('Danny', 85, 800);
    // #5 TIPO ID + RUN
    draw('1', 170, 785);
    draw('12.345.678-9', 85, 766);
    // #6 SEXO REGISTRAL (checkbox square)
    draw('M', 385, 773, FZ, true);
    // #7 FECHA NAC 
    draw('15', 460, 800);
    draw('03', 490, 800);
    draw('1990', 520, 800);
    // #8 EDAD
    draw('35', 105, 725);
    draw('1', 185, 725);
    // #10 PUEBLO INDÍGENA — "¿Pertenece?" checkbox (1=Sí)
    // The Sí/No checkbox is around X=1050 (screen) ≈ X=520 (PDF), same Y row as #53
    draw('1', 1050 / 2, 750);  // Sí=1
    // and the specific pueblo: 3=Rapa Nui, positioned in the list to the right
    draw('3', 1140 / 2, 735);  // Rapa Nui = 3 in the PUEBLOS INDÍGENAS numbered list
    // #18 PREVISIÓN 
    draw('1', 60, 503);
    // #22 PROCEDENCIA
    draw('1', 427, 453);

    // #24 INGRESO (✅ Y=428)
    draw('08', 110, 428);
    draw('30', 140, 428);
    draw('22', 190, 428);
    draw('02', 210, 428);
    draw('2025', 230, 428);

    // #29 EGRESO (Y lowered to 336 for perfect vertical centering in boxes)
    draw('14', 110, 336);
    draw('00', 140, 336);
    draw('25', 190, 336);
    draw('02', 210, 336);
    draw('2025', 230, 336);

    // #30 DÍAS ESTADA (Y corrected: 328→320 based on subagent report)
    draw('3', 110, 320);

    // #31 CONDICIÓN (Y corrected: 328→320)
    draw('1', 230, 320);

    // #33 DIAGNÓSTICO + CIE-10 (✅ Y=280)
    draw('DIABETES MELLITUS TIPO 2, NO INSULINODEPENDIENTE', 150, 280, 7); // kept a bit smaller for long text
    draw('E11.9', 548, 280, FZ, true);

    // #50 ESPECIALIDAD (✅ Y=82)
    draw('MEDICINA INTERNA', 430, 82);

    const result = await pdfDoc.save();
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'ieeh-test.pdf'), result);
    console.log('✅ Test PDF generated with size 9 and corrected Y coords');
}

verify().catch(console.error);
