// Flickr-style justified row packing: rows are filled to the container
// width, each row scaled so every image in it shares one row height.
// Ultra-wide panoramas naturally end up alone in a shorter, full-width row -
// which is exactly how the format should be shown off.
window.justifyRows = function justifyRows(items, containerWidth, targetHeight, gap) {
  const rows = [];
  let row = [];
  let aspectSum = 0;

  for (const item of items) {
    row.push(item);
    aspectSum += item.aspect;
    const widthAtTarget = aspectSum * targetHeight + gap * (row.length - 1);
    if (widthAtTarget >= containerWidth) {
      const scale = (containerWidth - gap * (row.length - 1)) / (aspectSum * targetHeight);
      const height = targetHeight * scale;
      rows.push({
        height,
        items: row.map((it) => ({ item: it, width: it.aspect * height })),
      });
      row = [];
      aspectSum = 0;
    }
  }
  if (row.length) {
    rows.push({
      height: targetHeight,
      items: row.map((it) => ({ item: it, width: it.aspect * targetHeight })),
      isLast: true,
    });
  }
  return rows;
};
