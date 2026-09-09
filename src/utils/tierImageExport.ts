import { Category, ArchiveItem, MainTabType } from '../types';
import { sanitizeFilename, getFormattedDateForFilename } from './fileSystem';

// Helper to safely load image element from dataURL/URL
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

export interface TierExportOptions {
  scale?: number;
  includeTitles?: boolean;
  isClassic?: boolean;
}

/**
 * Renders a full Tier List (Rows + Unranked Pool) into an HTML5 Canvas and returns a PNG Blob
 */
export async function renderTierListToPngBlob(
  category: Category,
  categoryItems: ArchiveItem[],
  mainTab: MainTabType,
  options?: TierExportOptions
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  const scale = options?.scale ?? 2;
  const isClassic = Boolean(options?.isClassic);
  const includeTitles = Boolean(options?.includeTitles);

  const canvasWidth = 1400;
  const padding = 28;
  const headerHeight = 90;
  const rowLabelWidth = 84;
  const cardWidth = 84;
  const cardHeight = 126;
  const rowCardGap = isClassic ? 0 : 10;
  const rowCardsAreaWidth = canvasWidth - padding * 2 - rowLabelWidth;
  const cardsPerRow = isClassic
    ? Math.max(1, Math.floor(rowCardsAreaWidth / cardWidth))
    : Math.max(1, Math.floor((rowCardsAreaWidth - rowCardGap) / (cardWidth + rowCardGap)));

  const validRowIds = new Set(category.tierRows.map((r) => r.id));
  const poolItems = categoryItems.filter((it) => !it.tier || !validRowIds.has(it.tier));

  // Pre-load all available thumbnail images
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    categoryItems.map(async (item) => {
      if (item.thumbnail) {
        try {
          const img = await loadImage(item.thumbnail);
          imageMap.set(item.id, img);
        } catch {
          // Fallback to text box if image fails
        }
      }
    })
  );

  // Calculate layout heights for each tier row
  interface RowLayout {
    row: (typeof category.tierRows)[0];
    items: ArchiveItem[];
    height: number;
    lines: number;
  }

  const rowLayouts: RowLayout[] = category.tierRows.map((row) => {
    const items = categoryItems.filter((it) => it.tier === row.id);
    const lines = Math.max(1, Math.ceil(items.length / cardsPerRow));
    const height = isClassic
      ? lines * cardHeight
      : Math.max(110, lines * (cardHeight + rowCardGap) + rowCardGap);
    return { row, items, height, lines };
  });

  // Calculate layout height for unranked pool (pool mantığına dokunulmadı, korundu)
  const poolCardGap = isClassic ? 4 : 10;
  const poolLines = poolItems.length > 0 ? Math.ceil(poolItems.length / (Math.floor((canvasWidth - padding * 2) / (cardWidth + poolCardGap)))) : 0;
  const poolHeight = poolItems.length > 0 ? 55 + poolLines * (cardHeight + poolCardGap) + poolCardGap : 0;

  const totalRowsHeight = rowLayouts.reduce((acc, r) => acc + r.height + (isClassic ? 2 : 8), 0);
  const totalHeight = padding * 2 + headerHeight + totalRowsHeight + (poolHeight > 0 ? poolHeight + 20 : 0);

  canvas.width = Math.round(canvasWidth * scale);
  canvas.height = Math.round(totalHeight * scale);

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Helper: Card Title Overlay (Yöntem A: alt kısma degrade + okunaklı beyaz metin)
  const drawCardTitle = (item: ArchiveItem, x: number, y: number, w: number, h: number) => {
    if (!includeTitles) return;
    const gradH = Math.min(42, Math.round(h * 0.35));
    const gradY = y + h - gradH;
    const grad = ctx.createLinearGradient(x, gradY, x, y + h);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, gradY, w, gradH);

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    const maxW = w - 8;
    let title = item.title;
    if (ctx.measureText(title).width > maxW) {
      while (title.length > 2 && ctx.measureText(title + '…').width > maxW) {
        title = title.slice(0, -1);
      }
      title += '…';
    }
    ctx.fillText(title, x + w / 2, y + h - 8);
    ctx.restore();
  };

  // 1. Background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // 2. Header Banner
  ctx.fillStyle = '#161922';
  ctx.beginPath();
  ctx.roundRect(padding, padding, canvasWidth - padding * 2, headerHeight - 16, isClassic ? 0 : 16);
  ctx.fill();
  ctx.strokeStyle = '#2d3343';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header Title & Date (Sadeleştirilmiş: Lore Library ve parantez içi çıkarıldı, yalnızca kategori adı ve tarih)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(category.name, padding + 24, padding + 42);

  ctx.fillStyle = '#8b949e';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText(dateStr, padding + 24, padding + 63);

  // Header Right: Yalın toplam kart sayısı (örn: 33)
  ctx.save();
  ctx.fillStyle = '#8b949e';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(categoryItems.length), canvasWidth - padding - 24, padding + (headerHeight - 16) / 2);
  ctx.restore();

  // 3. Render Tier Rows
  let currentY = padding + headerHeight;

  for (const layout of rowLayouts) {
    const { row, items, height } = layout;

    // Row Container background
    ctx.fillStyle = isClassic ? '#121212' : '#14161f';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, canvasWidth - padding * 2, height, isClassic ? 0 : 12);
    ctx.fill();
    ctx.strokeStyle = isClassic ? '#000000' : '#232734';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Row Label Box (Left side)
    ctx.fillStyle = row.color || '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, rowLabelWidth, height, isClassic ? 0 : [12, 0, 0, 12]);
    ctx.fill();
    if (isClassic) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, currentY, rowLabelWidth, height);
    }

    // Row Label Text - kompakt alana düzgünce ortalanmış
    ctx.save();
    ctx.fillStyle = '#ffffff';
    let labelFontSize = 26;
    ctx.font = `bold ${labelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const maxLabelTextWidth = rowLabelWidth - 10;
    while (labelFontSize > 12 && ctx.measureText(row.name).width > maxLabelTextWidth) {
      labelFontSize -= 2;
      ctx.font = `bold ${labelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.name, padding + rowLabelWidth / 2, currentY + height / 2);
    ctx.restore();

    // Render Cards in Row
    const cardsStartX = isClassic ? padding + rowLabelWidth : padding + rowLabelWidth + rowCardGap;
    items.forEach((item, index) => {
      const col = index % cardsPerRow;
      const line = Math.floor(index / cardsPerRow);
      const cardX = isClassic
        ? cardsStartX + col * cardWidth
        : cardsStartX + col * (cardWidth + rowCardGap);
      const cardY = isClassic
        ? currentY + line * cardHeight
        : currentY + rowCardGap + line * (cardHeight + rowCardGap);

      // Card Background / Border
      const cardRadius = isClassic ? 0 : 8;
      ctx.fillStyle = '#1c1f2a';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
      ctx.fill();

      const img = imageMap.get(item.id);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
        ctx.clip();
        ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
        drawCardTitle(item, cardX, cardY, cardWidth, cardHeight);
        ctx.restore();
      } else {
        // Fallback: title text
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const words = item.title.split(' ');
        let lineStr = '';
        let textY = cardY + 24;
        for (const w of words) {
          if ((lineStr + w).length > 11) {
            ctx.fillText(lineStr, cardX + 6, textY);
            lineStr = w + ' ';
            textY += 14;
          } else {
            lineStr += w + ' ';
          }
        }
        ctx.fillText(lineStr, cardX + 6, textY);
      }

      // Border around card
      if (isClassic) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
      } else {
        ctx.strokeStyle = '#383e52';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
        ctx.stroke();
      }
    });

    currentY += height + (isClassic ? 2 : 8);
  }

  // 4. Render Unranked Pool if exists
  if (poolItems.length > 0) {
    currentY += 12;
    // Pool Header
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`📦 Sıralanmamış Yapımlar Havuzu (${poolItems.length} adet)`, padding + 4, currentY + 16);
    currentY += 28;

    // Pool Container
    ctx.fillStyle = isClassic ? '#111111' : '#12141c';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, canvasWidth - padding * 2, poolHeight - 40, isClassic ? 0 : 12);
    ctx.fill();
    ctx.strokeStyle = isClassic ? '#000000' : '#272b38';
    ctx.lineWidth = 1;
    ctx.stroke();

    const poolCardsPerRow = Math.max(1, Math.floor((canvasWidth - padding * 2 - poolCardGap * 2) / (cardWidth + poolCardGap)));
    poolItems.forEach((item, index) => {
      const col = index % poolCardsPerRow;
      const line = Math.floor(index / poolCardsPerRow);
      const cardX = padding + poolCardGap + col * (cardWidth + poolCardGap);
      const cardY = currentY + poolCardGap + line * (cardHeight + poolCardGap);

      const cardRadius = isClassic ? 0 : 8;
      ctx.fillStyle = '#1c1f2a';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
      ctx.fill();
      ctx.strokeStyle = isClassic ? '#000000' : '#383e52';
      ctx.lineWidth = 1;
      ctx.stroke();

      const img = imageMap.get(item.id);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
        ctx.clip();
        ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
        drawCardTitle(item, cardX, cardY, cardWidth, cardHeight);
        ctx.restore();
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(item.title.slice(0, 18), cardX + 6, cardY + 24);
      }
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to Blob conversion failed'));
      }
    }, 'image/png');
  });
}

/**
 * Downloads a single category Tier List as a high quality PNG file to user's computer
 */
export async function downloadTierListAsPng(
  category: Category,
  categoryItems: ArchiveItem[],
  mainTab: MainTabType,
  options?: TierExportOptions
): Promise<void> {
  const blob = await renderTierListToPngBlob(category, categoryItems, mainTab, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = sanitizeFilename(category.name);
  const dateStr = getFormattedDateForFilename();
  a.download = `Lore_${safeName}_TierList_${dateStr}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
