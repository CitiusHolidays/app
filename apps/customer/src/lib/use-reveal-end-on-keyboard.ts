import { useEffect, useRef, useState } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';

/** Where the end of the content should rest: just above the keyboard, or at the bottom of the view. */
export function endScrollTarget({
  contentHeight,
  keyboardTop,
  offset,
  viewBottom,
  viewHeight,
}: {
  contentHeight: number;
  keyboardTop: number;
  offset: number;
  viewBottom: number;
  viewHeight: number;
}) {
  const visibleHeight = viewHeight - Math.max(0, viewBottom - keyboardTop);
  const target = contentHeight - visibleHeight;
  // Only ever move down, and only when the end is hidden: a short form stays where it is.
  return target > offset + 1 ? target : null;
}

/**
 * Keeps a form, and its own button, in sight while typing. The focused field alone is not
 * enough: the button under it (Send, Open invite, Delete) would stay hidden until the keyboard
 * closed. So when the keyboard opens, the form scrolls just far enough to show its end.
 *
 * With `pad`, the form also makes room for the keyboard itself: it measures where it sits on the
 * screen and pads its content by the part the keyboard covers. Android needs this (it draws edge to
 * edge, so the window no longer shrinks, and KeyboardAvoidingView measures from its parent, falling
 * short by the header's height); iOS insets a scroll view for the keyboard on its own.
 *
 * Spread `props` onto the form's ScrollView and add `keyboardInset` to its bottom padding.
 */
export function useRevealEndOnKeyboard({ active = true, pad = false }: { active?: boolean; pad?: boolean } = {}) {
  const ref = useRef<ScrollViewInstance>(null);
  const contentHeight = useRef(0);
  const offset = useRef(0);
  const scrollAfterPadding = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (!active) return;
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      ref.current?.measureInWindow((_x, y, _width, height) => {
        const keyboardTop = event.endCoordinates.screenY;
        const target = endScrollTarget({ contentHeight: contentHeight.current, keyboardTop, offset: offset.current, viewBottom: y + height, viewHeight: height });
        const overlap = Math.max(0, y + height - keyboardTop);
        if (pad && overlap > 0) {
          // The content is too short to scroll there until the padding is in: scroll once it is.
          scrollAfterPadding.current = target;
          setKeyboardInset(overlap);
        } else if (target !== null) {
          ref.current?.scrollTo({ animated: true, y: target });
        }
      });
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [active, pad]);
  return {
    keyboardInset,
    props: {
      onContentSizeChange: (_width: number, height: number) => {
        contentHeight.current = height - keyboardInset;
        const target = scrollAfterPadding.current;
        if (target === null) return;
        scrollAfterPadding.current = null;
        ref.current?.scrollTo({ animated: true, y: target });
      },
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = event.nativeEvent.contentOffset.y;
      },
      ref,
      scrollEventThrottle: 32,
    },
  };
}
