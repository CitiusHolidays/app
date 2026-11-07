import appJson from '../../app.json';

const manifest = appJson.expo.ios.privacyManifests;

describe('iOS privacy manifest', () => {
  it('declares only the account data the app sends to Citius, for app functionality, with no tracking', () => {
    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(manifest.NSPrivacyCollectedDataTypes.map((entry) => entry.NSPrivacyCollectedDataType).sort()).toEqual([
      'NSPrivacyCollectedDataTypeEmailAddress',
      'NSPrivacyCollectedDataTypeName',
      'NSPrivacyCollectedDataTypeUserID',
    ]);
    for (const entry of manifest.NSPrivacyCollectedDataTypes) {
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual(['NSPrivacyCollectedDataTypePurposeAppFunctionality']);
    }
  });

  it('uses the scheme the website hands links to', () => {
    expect(appJson.expo.scheme).toBe('citius');
  });
});
