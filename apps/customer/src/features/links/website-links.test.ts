import { appPathForSystemLink } from './website-links';

jest.mock('@/lib/env', () => ({ WEBSITE_URL: 'https://staging.citiusholidays.com' }));

const SIGN_IN = 'NeLKESyKpnQmHcMLtSjijkzHrpLhguoP';
const INVITE = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE';

describe('website links that open the app directly', () => {
  it('takes the email sign-in link straight to the app sign-in with its token', () => {
    expect(appPathForSystemLink(`https://www.citiusholidays.com/app/sign-in#token=${SIGN_IN}`)).toBe(`/sign-in?token=${SIGN_IN}`);
    expect(appPathForSystemLink(`https://WWW.citiusholidays.com/app/sign-in/#token=${SIGN_IN}`)).toBe(`/sign-in?token=${SIGN_IN}`);
  });

  it('takes a trip invite link straight to the invite', () => {
    expect(appPathForSystemLink(`https://www.citiusholidays.com/app/invite#token=${INVITE}`)).toBe(`/invite?token=${INVITE}`);
  });

  it('opens sign-in, or the invite screen that says the link is broken, when the token is missing or malformed', () => {
    expect(appPathForSystemLink('https://www.citiusholidays.com/app/sign-in')).toBe('/sign-in');
    expect(appPathForSystemLink('https://www.citiusholidays.com/app/sign-in#token=a%20b')).toBe('/sign-in');
    expect(appPathForSystemLink('https://www.citiusholidays.com/app/invite#token=short')).toBe('/invite');
  });

  it('answers the configured website too (staging)', () => {
    expect(appPathForSystemLink(`https://staging.citiusholidays.com/app/sign-in#token=${SIGN_IN}`)).toBe(`/sign-in?token=${SIGN_IN}`);
  });

  it('opens the home screen for any other website page', () => {
    expect(appPathForSystemLink('https://www.citiusholidays.com/tours/bali')).toBe('/');
  });

  it('leaves the app’s own links and other sites alone', () => {
    expect(appPathForSystemLink(`citius://sign-in?token=${SIGN_IN}`)).toBe(`citius://sign-in?token=${SIGN_IN}`);
    expect(appPathForSystemLink('/trip/abc')).toBe('/trip/abc');
    expect(appPathForSystemLink(`https://evil.example/app/sign-in#token=${SIGN_IN}`)).toBe(`https://evil.example/app/sign-in#token=${SIGN_IN}`);
  });
});
