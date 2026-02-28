const ts = require('typescript');
const fs = require('fs');

const path = './src/services/terminology/cie10SpanishDatabase.ts';
const content = fs.readFileSync(path, 'utf8');

const sourceFile = ts.createSourceFile(
    'cie10SpanishDatabase.ts',
    content,
    ts.ScriptTarget.Latest,
    true
);

let arrayContent = null;

// Traverse the AST to find the CIE10_SPANISH_DATABASE array declaration
function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.text === 'CIE10_SPANISH_DATABASE') {
        if (node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
            arrayContent = node.initializer.getText();
        }
    }
    ts.forEachChild(node, visit);
}

visit(sourceFile);

if (arrayContent) {
    // We can safely evaluate the array literal itself now since there are no import statements here.
    try {
        const data = (new Function(`return ${arrayContent}`))();

        fs.mkdirSync('./public/data', { recursive: true });
        fs.writeFileSync('./public/data/cie10_spanish.json', JSON.stringify(data));

        console.log(`Successfully extracted ${data.length} records to public/data/cie10_spanish.json.`);
    } catch (e) {
        console.error("Evaluation failed", e);
    }
} else {
    console.error("Could not parse AST to find the array.");
}
