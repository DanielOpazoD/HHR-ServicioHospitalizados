const fs = require('fs');
const ts = require('typescript');

const path = './src/services/terminology/cie10SpanishDatabase.ts';
const content = fs.readFileSync(path, 'utf8');

// A very simple regex approach won't work perfectly on 28k lines, but let's try to parse the JS array
// by extracting the array content and evaluating it (since it's just POJOs).
const match = content.match(
  /export const CIE10_SPANISH_DATABASE:\s*CIE10Entry\[\]\s*=\s*(\[[\s\S]*\]);/
);

if (match && match[1]) {
  try {
    // Evaluate the array string in a safe context to get the raw Javascript array
    // This requires some care with the string, but since it's just {code, description, category} it's safe.
    // Adding parentheses to evaluate it as an expression
    const arrayStr = match[1];

    // We can parse it by replacing keys with quotes and using JSON.parse, or just using Function
    const data = new Function(`return ${arrayStr}`)();

    fs.writeFileSync('./public/data/cie10_spanish.json', JSON.stringify(data));
    console.log(`Successfully extracted ${data.length} records to public/data/cie10_spanish.json`);
  } catch (e) {
    console.error('Evaluation failed', e);
  }
} else {
  console.error("Couln't match array pattern");
}
