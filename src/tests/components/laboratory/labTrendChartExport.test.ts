import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportChartsAsPng } from '@/features/laboratory/components/labTrendChartExport';

const contextMock = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  scale: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  set fillStyle(_value: string) {},
  set strokeStyle(_value: string) {},
  set lineWidth(_value: number) {},
  set font(_value: string) {},
  set textBaseline(_value: string) {},
} as unknown as CanvasRenderingContext2D;

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    window.setTimeout(() => this.onload?.(), 0);
  }
}

const setRect = (element: Element, rect: Partial<DOMRect>) => {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        x: rect.x ?? 0,
        y: rect.y ?? 0,
        left: rect.left ?? rect.x ?? 0,
        top: rect.top ?? rect.y ?? 0,
        right: rect.right ?? (rect.left ?? rect.x ?? 0) + (rect.width ?? 0),
        bottom: rect.bottom ?? (rect.top ?? rect.y ?? 0) + (rect.height ?? 0),
        width: rect.width ?? 0,
        height: rect.height ?? 0,
        toJSON: () => ({}),
      }) as DOMRect
  );
};

describe('labTrendChartExport', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contextMock);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:trend-export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.values(contextMock as unknown as Record<string, unknown>).forEach(value => {
      if (typeof value === 'function' && 'mockClear' in value) {
        (value as { mockClear: () => void }).mockClear();
      }
    });
  });

  it('serializes visible SVG charts into a same-origin canvas and triggers a PNG download', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 520 });
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 320 });
    setRect(container, { left: 0, top: 0, width: 520, height: 320 });
    container.innerHTML = `
      <div data-lab-trend-card>
        <h4>Funcion Renal</h4>
        <span>Creatinina</span>
        <svg width="200" height="100">
          <polyline points="0,80 200,20" stroke="#10b981" fill="none"></polyline>
        </svg>
      </div>
    `;
    const card = container.querySelector('[data-lab-trend-card]')!;
    const title = container.querySelector('h4')!;
    const label = container.querySelector('span')!;
    const svg = container.querySelector('svg')!;
    setRect(card, { left: 0, top: 0, width: 240, height: 160 });
    setRect(title, { left: 16, top: 16, width: 120, height: 18 });
    setRect(label, { left: 16, top: 42, width: 90, height: 14 });
    setRect(svg, { left: 16, top: 64, width: 200, height: 100 });

    await exportChartsAsPng(container);

    expect(contextMock.drawImage).toHaveBeenCalledTimes(1);
    expect(contextMock.fillText).toHaveBeenCalledWith('Funcion Renal', 16, 16, expect.any(Number));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:trend-export');
  });
});
