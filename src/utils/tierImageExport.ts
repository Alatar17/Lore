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

/**
 * Renders a full Tier List (Rows + Unranked Pool) into an HTML5 Canvas and returns a PNG Blob
 */
export async function renderTierListToPngBlob(
  category: Category,
  categoryItems: ArchiveItem[],
  mainTab: MainTabType
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  const canvasWidth = 1400;
  const padding = 28;
  const headerHeight = 90;
  const rowLabelWidth = 150;
  const cardWidth = 84;
  const cardHeight = 126;
  const cardGap = 10;
  const rowCardsAreaWidth = canvasWidth - padding * 2 - rowLabelWidth;
  const cardsPerRow = Math.max(1, Math.floor((rowCardsAreaWidth - cardGap) / (cardWidth + cardGap)));

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
    const height = Math.max(110, lines * (cardHeight + cardGap) + cardGap);
    return { row, items, height, lines };
  });

  // Calculate layout height for unranked pool
  const poolLines = poolItems.length > 0 ? Math.ceil(poolItems.length / (Math.floor((canvasWidth - padding * 2) / (cardWidth + cardGap)))) : 0;
  const poolHeight = poolItems.length > 0 ? 55 + poolLines * (cardHeight + cardGap) + cardGap : 0;

  const totalRowsHeight = rowLayouts.reduce((acc, r) => acc + r.height + 8, 0);
  const totalHeight = padding * 2 + headerHeight + totalRowsHeight + (poolHeight > 0 ? poolHeight + 20 : 0);

  canvas.width = canvasWidth;
  canvas.height = totalHeight;

  // 1. Background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // 2. Header Banner
  ctx.fillStyle = '#161922';
  ctx.beginPath();
  ctx.roundRect(padding, padding, canvasWidth - padding * 2, headerHeight - 16, 16);
  ctx.fill();
  ctx.strokeStyle = '#2d3343';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header Title & Icon
  const iconEmoji = mainTab === 'game' ? '🎮' : '🎬';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${iconEmoji} ${category.name} - Tier List`, padding + 24, padding + 44);

  // Header Subtitle / Branding
  ctx.fillStyle = '#8b949e';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const totalRanked = categoryItems.length - poolItems.length;
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText(
    `Lore Library • ${dateStr} • Toplam ${categoryItems.length} Yapım (${totalRanked} Sıralandı, ${poolItems.length} Havuzda)`,
    padding + 24,
    padding + 64
  );

  // 3. Render Tier Rows
  let currentY = padding + headerHeight;

  for (const layout of rowLayouts) {
    const { row, items, height } = layout;

    // Row Container background
    ctx.fillStyle = '#14161f';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, canvasWidth - padding * 2, height, 12);
    ctx.fill();
    ctx.strokeStyle = '#232734';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Row Label Box (Left side)
    ctx.fillStyle = row.color || '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, rowLabelWidth, height, [12, 0, 0, 12]);
    ctx.fill();

    // Row Label Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.name, padding + rowLabelWidth / 2, currentY + height / 2);

    // Reset alignment
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Render Cards in Row
    const cardsStartX = padding + rowLabelWidth + cardGap;
    items.forEach((item, index) => {
      const col = index % cardsPerRow;
      const line = Math.floor(index / cardsPerRow);
      const cardX = cardsStartX + col * (cardWidth + cardGap);
      const cardY = currentY + cardGap + line * (cardHeight + cardGap);

      // Card Background / Border
      ctx.fillStyle = '#1c1f2a';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fill();
      ctx.strokeStyle = '#383e52';
      ctx.lineWidth = 1;
      ctx.stroke();

      const img = imageMap.get(item.id);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
        ctx.clip();
        ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
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
    });

    currentY += height + 8;
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
    ctx.fillStyle = '#12141c';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, canvasWidth - padding * 2, poolHeight - 40, 12);
    ctx.fill();
    ctx.strokeStyle = '#272b38';
    ctx.lineWidth = 1;
    ctx.stroke();

    const poolCardsPerRow = Math.max(1, Math.floor((canvasWidth - padding * 2 - cardGap * 2) / (cardWidth + cardGap)));
    poolItems.forEach((item, index) => {
      const col = index % poolCardsPerRow;
      const line = Math.floor(index / poolCardsPerRow);
      const cardX = padding + cardGap + col * (cardWidth + cardGap);
      const cardY = currentY + cardGap + line * (cardHeight + cardGap);

      ctx.fillStyle = '#1c1f2a';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fill();
      ctx.strokeStyle = '#383e52';
      ctx.lineWidth = 1;
      ctx.stroke();

      const img = imageMap.get(item.id);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
        ctx.clip();
        ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
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
  mainTab: MainTabType
): Promise<void> {
  const blob = await renderTierListToPngBlob(category, categoryItems, mainTab);
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
