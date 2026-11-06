import { space, Text, useAppTheme } from '@citius/ui';
import { useState } from 'react';
import { View } from 'react-native';
import type PdfView from 'react-native-pdf';

import { logEvent } from '@/lib/safe-log';

type PdfComponent = typeof PdfView;

/**
 * react-native-pdf, loaded behind a guard: a build made before it was added has no native module,
 * and would otherwise fail to start. Such a build says it cannot show PDFs instead.
 */
function loadPdfView(): PdfComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native-pdf') as { default: PdfComponent }).default;
  } catch (error) {
    logEvent('passport.pdf-view-missing', error);
    return null;
  }
}

const NativePdf = loadPdfView();

/** Whether this build can show a PDF passport. Checked before any file is written. */
export function canShowPdf() {
  return NativePdf !== null;
}

/**
 * A PDF passport from a private `file://` URI: swipe between pages, pinch or double-tap to zoom.
 * The library's download cache and certificate trust are off (the file is local), text cannot
 * be selected and links inside the PDF go nowhere, so nothing on the passport leaves the view.
 */
export function PassportPdf({ name, onError, uri }: { name: string; onError: () => void; uri: string }) {
  const theme = useAppTheme();
  const [pages, setPages] = useState<{ page: number; total: number } | null>(null);
  if (!NativePdf) {
    return null;
  }
  return (
    <View style={{ flex: 1, gap: space.sm }}>
      <View
        accessibilityLabel={`Passport scan of ${name}`}
        accessible
        style={{ backgroundColor: theme.color.inset, borderRadius: theme.radius.inset, flex: 1, overflow: 'hidden' }}
      >
        <NativePdf
          enableDoubleTapZoom
          enablePaging
          enableTextSelection={false}
          horizontal
          maxScale={4}
          minScale={1}
          onError={(error) => {
            logEvent('passport.pdf-failed', error);
            onError();
          }}
          onLoadComplete={(total) => setPages({ page: 1, total })}
          onPageChanged={(page, total) => setPages({ page, total })}
          onPressLink={() => undefined}
          source={{ cache: false, uri }}
          style={{ backgroundColor: theme.color.inset, flex: 1 }}
          trustAllCerts={false}
        />
      </View>
      <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center' }} tabular tone="muted" variant="secondary">
        {pages && pages.total > 1 ? `Page ${pages.page} of ${pages.total}` : 'Pinch to zoom'}
      </Text>
    </View>
  );
}
