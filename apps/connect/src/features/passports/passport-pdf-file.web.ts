/** Web preview: there is no PDF view on web, so nothing is ever written. */
export function writePassportPdf(): string {
  throw new Error('PDF passports are not shown on the web');
}

export function deletePassportPdf() {}

export function deleteAllPassportPdfs() {}
