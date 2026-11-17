import React, { useState } from 'react';
import { customStampImageUrl } from '../store';
import { VENUE_CELL as C, VENUE_INK } from '../venueCatalog';

// A custom stamp's image in one C x C art box. The image is drawn only through <image>,
// never inlined, so an imported SVG cannot run script. A stamp whose image is gone (deleted,
// or the venue came from elsewhere) draws the dashed unknown-piece placeholder instead.
export default function CustomStampArt({ stampId }) {
  const [failedId, setFailedId] = useState(null);
  if (!stampId || failedId === stampId) {
    return (
      <rect
        className="custom-stamp-missing"
        x="10"
        y="10"
        width="20"
        height="20"
        fill="none"
        stroke={VENUE_INK}
        strokeWidth="1.6"
        strokeDasharray="3 2"
      />
    );
  }
  return (
    <image
      className="custom-stamp-image"
      href={customStampImageUrl(stampId)}
      x={C * 0.05}
      y={C * 0.05}
      width={C * 0.9}
      height={C * 0.9}
      preserveAspectRatio="xMidYMid meet"
      onError={() => setFailedId(stampId)}
    />
  );
}
