import { endScrollTarget } from './use-reveal-end-on-keyboard';

describe('keeping a form’s button above the keyboard', () => {
  const screen = { keyboardTop: 500, viewBottom: 800, viewHeight: 700 };

  it('scrolls just far enough for the end of the form to rest on the keyboard', () => {
    // 700pt view, keyboard covers the bottom 300pt: 400pt visible, so a 1000pt form scrolls to 600.
    expect(endScrollTarget({ ...screen, contentHeight: 1000, offset: 0 })).toBe(600);
  });

  it('leaves a short form where it is, with its intro in sight', () => {
    expect(endScrollTarget({ ...screen, contentHeight: 350, offset: 0 })).toBeNull();
  });

  it('never scrolls back up when the end is already in sight', () => {
    expect(endScrollTarget({ ...screen, contentHeight: 1000, offset: 650 })).toBeNull();
  });

  it('measures a view the keyboard does not overlap (it already moved up) by its own height', () => {
    expect(endScrollTarget({ contentHeight: 1000, keyboardTop: 900, offset: 0, viewBottom: 500, viewHeight: 400 })).toBe(600);
  });
});
