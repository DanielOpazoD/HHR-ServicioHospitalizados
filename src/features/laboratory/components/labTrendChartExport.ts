/**
 * Export chart container as PNG using native SVG serialization + Canvas.
 * Avoids html2canvas dependency by cloning the container, inlining styles,
 * and rendering via foreignObject -> Canvas -> PNG.
 */
export const exportChartsAsPng = async (container: HTMLDivElement) => {
  const clone = container.cloneNode(true) as HTMLDivElement;
  clone.style.background = '#ffffff';
  clone.style.padding = '16px';

  const width = container.offsetWidth * 2;
  const height = container.offsetHeight * 2;

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const foreignObject = document.createElementNS(svgNs, 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');
  foreignObject.setAttribute('transform', 'scale(2)');
  foreignObject.appendChild(clone);
  svg.appendChild(foreignObject);

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
    }

    URL.revokeObjectURL(svgUrl);
    const pngUrl = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = pngUrl;
    anchor.download = `laboratorio_tendencias_${new Date().toISOString().substring(0, 10)}.png`;
    anchor.click();
  };

  img.src = svgUrl;
};
