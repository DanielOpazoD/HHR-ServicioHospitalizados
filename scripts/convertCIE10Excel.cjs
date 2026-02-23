#!/usr/bin/env node
/**
 * Script to convert CIE-10 CSV export to TypeScript database.
 * Reads /tmp/cie10_raw.csv and generates the TS file.
 */
const fs = require('fs');
const path = require('path');

// CIE-10 category mapping based on code letter prefix
const CATEGORY_MAP = {
    'A': 'Infecciosas', 'B': 'Infecciosas',
    'C': 'Neoplasias', 'D0': 'Neoplasias', 'D1': 'Neoplasias', 'D2': 'Neoplasias',
    'D3': 'Neoplasias', 'D4': 'Neoplasias',
    'D5': 'Sangre', 'D6': 'Sangre', 'D7': 'Sangre', 'D8': 'Sangre', 'D9': 'Sangre',
    'E': 'Endocrinas',
    'F': 'Mental',
    'G': 'Neurológicas',
    'H0': 'Oftalmológicas', 'H1': 'Oftalmológicas', 'H2': 'Oftalmológicas',
    'H3': 'Oftalmológicas', 'H4': 'Oftalmológicas', 'H5': 'Oftalmológicas',
    'H6': 'Otorrinolaringológicas', 'H7': 'Otorrinolaringológicas',
    'H8': 'Otorrinolaringológicas', 'H9': 'Otorrinolaringológicas',
    'I': 'Cardiovascular',
    'J': 'Respiratorias',
    'K': 'Digestivas',
    'L': 'Piel',
    'M': 'Osteomusculares',
    'N': 'Genitourinarias',
    'O': 'Obstetricia',
    'P': 'Perinatal',
    'Q': 'Congénitas',
    'R': 'Síntomas',
    'S': 'Traumatismos', 'T': 'Traumatismos',
    'U': 'COVID-19',
    'V': 'Causas externas', 'W': 'Causas externas', 'X': 'Causas externas', 'Y': 'Causas externas',
    'Z': 'Factores',
};

function getCategory(code) {
    // Try 2-char prefix first (for D and H which split)
    const prefix2 = code.substring(0, 2);
    if (CATEGORY_MAP[prefix2]) return CATEGORY_MAP[prefix2];
    // Fall back to 1-char prefix
    const prefix1 = code.charAt(0);
    return CATEGORY_MAP[prefix1] || 'Otros';
}

function formatCode(rawCode) {
    // Convert "A000" -> "A00.0", "I10" -> "I10", "A09" -> "A09"
    const code = rawCode.trim();
    if (code.length <= 3) return code;
    return code.substring(0, 3) + '.' + code.substring(3);
}

function titleCase(str) {
    // Convert "FIEBRE TIFOIDEA" -> "Fiebre tifoidea"
    if (!str) return str;
    const lower = str.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++; // skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

const csvPath = '/tmp/cie10_raw.csv';
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim().length > 0);

// Skip header line
const entries = [];
for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    let code = cols[0].replace(/\uFEFF/g, '').trim();
    let desc = cols[1].replace(/\uFEFF/g, '').trim();

    if (!code || !desc) continue;

    const formattedCode = formatCode(code);
    const formattedDesc = titleCase(desc);
    const category = getCategory(code);

    entries.push({ code: formattedCode, description: formattedDesc, category });
}

console.log(`Parsed ${entries.length} CIE-10 entries`);

// Generate TypeScript
let ts = `/**
 * CIE-10 Spanish Database
 * 
 * Comprehensive CIE-10 codes with official Spanish descriptions.
 * Based on MINSAL and WHO ICD-10 Spanish edition.
 * Auto-generated from Excel: cie10_diagnosticos.xlsx (${entries.length} entries)
 */

export interface CIE10Entry {
    code: string;
    description: string;
    category?: string;
}

/**
 * Comprehensive list of CIE-10 codes in Spanish
 * Organized by category for maintainability
 */
export const CIE10_SPANISH_DATABASE: CIE10Entry[] = [\n`;

// Group by category for readability
let currentCat = '';
for (const e of entries) {
    if (e.category !== currentCat) {
        currentCat = e.category;
        ts += `\n    // === ${currentCat.toUpperCase()} ===\n`;
    }
    // Escape single quotes in description
    const safeDesc = e.description.replace(/'/g, "\\'");
    ts += `    { code: '${e.code}', description: '${safeDesc}', category: '${e.category}' },\n`;
}

ts += `];\n`;

// Append the search function
ts += `
import { preprocessQuery, scoreMatch, fuzzyMatch, normalizeText } from './nlpPreprocessor';

/**
 * Search CIE-10 codes in Spanish with NLP enhancement
 * Uses synonym expansion, fuzzy matching, and relevance scoring
 * @param query Search term
 * @returns Matching CIE-10 entries sorted by relevance
 */
export function searchCIE10Spanish(query: string): CIE10Entry[] {
    if (!query || query.length < 2) return [];

    const preprocessed = preprocessQuery(query);

    // Score all entries
    const scoredEntries = CIE10_SPANISH_DATABASE.map(entry => {
        const score = scoreMatch(entry.description, entry.code, preprocessed);
        return { entry, score };
    });

    // Filter entries with score > 0
    let results = scoredEntries
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ entry }) => entry);

    // If no results, try fuzzy matching as fallback
    if (results.length === 0) {
        results = CIE10_SPANISH_DATABASE.filter(entry => {
            const normalizedDesc = normalizeText(entry.description);
            return fuzzyMatch(preprocessed.normalized, normalizedDesc, 0.7);
        });
    }

    return results.slice(0, 15);
}
`;

const outPath = path.join(__dirname, '..', 'src/services/terminology/cie10SpanishDatabase.ts');
fs.writeFileSync(outPath, ts, 'utf-8');
console.log(`Written to: ${outPath}`);
