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

/** The native PDF view, or null in a build without it. */
export const NativePdf = loadPdfView();

/** Whether this build can show a PDF passport. Checked before any file is written. */
export function canShowPdf() {
  return NativePdf !== null;
}
