import type { jsPDF } from 'jspdf';

export interface CellHookData {
  section: 'head' | 'body' | 'foot';
  column: { index: number };
  cell: {
    raw: unknown;
    x: number;
    y: number;
    width: number;
    height: number;
    styles: {
      textColor?: number | number[];
      fontStyle?: string;
      fillColor?: number | number[];
    };
  };
  row: { index: number };
}

interface AutoTableOptions {
  startY?: number;
  head?: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][];
  body?: (
    | string
    | number
    | boolean
    | null
    | { content: string; styles?: Record<string, unknown> }
    | Record<string, unknown>
  )[][];
  theme?: 'striped' | 'grid' | 'plain';
  styles?: Record<string, unknown>;
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  columnStyles?: Record<number | string, Record<string, unknown>>;
  didParseCell?: (data: CellHookData) => void;
  didDrawCell?: (data: CellHookData) => void;
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  pageBreak?: 'auto' | 'avoid' | 'always';
}

export type AutoTableFunction = (doc: jsPDF, options: AutoTableOptions) => void;

export type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };
