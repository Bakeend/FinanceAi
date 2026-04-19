/**
 * Exporta o primeiro <svg> dentro de um elemento como PNG.
 * Zero deps — serializa o SVG, converte em Image via data URL, desenha em canvas e baixa.
 */
export async function exportSvgAsPng(container: HTMLElement, filename = 'chart.png'): Promise<void> {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('Gráfico não encontrado');
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || svg.clientWidth || 800));
  const height = Math.max(1, Math.round(rect.height || svg.clientHeight || 400));

  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  // Embed computed background color of the container so PNG isn't transparent on dark themes
  const bg = getComputedStyle(container).getPropertyValue('background-color') || '#0b0f1a';
  const rectBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rectBg.setAttribute('width', '100%');
  rectBg.setAttribute('height', '100%');
  rectBg.setAttribute('fill', bg || '#0b0f1a');
  clone.insertBefore(rectBg, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Falha ao renderizar SVG'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas sem contexto 2D');
    ctx.fillStyle = bg || '#0b0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
