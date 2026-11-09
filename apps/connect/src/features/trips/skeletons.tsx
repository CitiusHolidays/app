import { space, Surface, useAppTheme } from '@citius/ui';
import type { ReactNode } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';

import type { TripView } from './trip-view';

/**
 * Static stand-ins sized to the blocks they hold the place of, built from the same theme numbers
 * (line heights, padding, row heights), so nothing moves when the real content arrives. No shimmer.
 */

function Bar({ height, radius = 6, width = '100%' }: { height: number; radius?: number; width?: DimensionValue }) {
  const theme = useAppTheme();
  return <View style={{ backgroundColor: theme.color.tickOff, borderRadius: radius, height, opacity: 0.6, width }} />;
}

function Loading({ children, gap }: { children: ReactNode; gap?: number }) {
  return (
    <View accessibilityLabel="Loading" accessible style={{ gap }}>
      {children}
    </View>
  );
}

/** The trip photo card on Today: the same 300pt card, with the title, place line and pills. */
export function TripHeroSkeleton() {
  const theme = useAppTheme();
  return (
    <Loading>
      <View
        style={{
          backgroundColor: theme.color.inset,
          borderRadius: theme.radius.hero,
          gap: space.sm + 2,
          justifyContent: 'space-between',
          minHeight: 300,
          padding: space.lg + 2,
        }}
      >
        <Bar height={theme.type.mono.lineHeight} width="45%" />
        <View style={{ gap: space.sm + 2 }}>
          <View style={{ gap: space.xs }}>
            <Bar height={theme.type.display.lineHeight} width="70%" />
            <Bar height={theme.type.secondary.lineHeight} width="85%" />
          </View>
          <View style={{ flexDirection: 'row', gap: space.xs + 2 }}>
            <Bar height={30} radius={15} width={88} />
            <Bar height={30} radius={15} width={72} />
          </View>
        </View>
      </View>
    </Loading>
  );
}

/** Today's headcount card: label, count, tick strip, the five "still to mark" faces and two buttons. */
export function HeadcountSkeleton() {
  const theme = useAppTheme();
  const button = Math.max(48, theme.minTarget);
  return (
    <Loading>
      <Surface style={{ gap: space.lg }} variant="hero">
        <View style={{ height: 18, justifyContent: 'center' }}>
          <Bar height={theme.type.label.lineHeight} width="45%" />
        </View>
        <View style={{ gap: space.md }}>
          <Bar height={theme.type.answer.lineHeight} width="40%" />
          <Bar height={24} radius={2} />
        </View>
        <Surface style={{ gap: space.md }} variant="inset">
          <Bar height={theme.type.label.lineHeight} width="35%" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: 5 }, (_, index) => (
              <View key={index} style={{ alignItems: 'center', gap: 6, width: 46 }}>
                <Bar height={40} radius={20} width={40} />
                <Bar height={theme.type.label.lineHeight} width={36} />
              </View>
            ))}
          </View>
        </Surface>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1.3 }}>
            <Bar height={button} radius={button / 2} />
          </View>
          <View style={{ flex: 1 }}>
            <Bar height={button} radius={button / 2} />
          </View>
        </View>
      </Surface>
    </Loading>
  );
}

/** A list row as `Row` draws it: 40pt avatar, a title line and a subtitle line, 12pt above and below. */
function RowSkeleton({ last }: { last: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        borderBottomColor: theme.color.rule,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: space.md,
        minHeight: 60,
        paddingVertical: space.md,
      }}
    >
      <Bar height={40} radius={20} width={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Bar height={theme.type.rowTitle.lineHeight} width="60%" />
        <Bar height={theme.type.secondary.lineHeight} width="40%" />
      </View>
    </View>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <Surface style={{ paddingHorizontal: space.lg, paddingVertical: 2 }}>
      {Array.from({ length: rows }, (_, index) => (
        <RowSkeleton key={index} last={index === rows - 1} />
      ))}
    </Surface>
  );
}

const ROSTER_GROUPS = [
  { id: 'first', rows: 3 },
  { id: 'second', rows: 2 },
] as const;

/** The roster: its count line, then batches of a header over a card of rows. */
function RosterSkeleton() {
  const theme = useAppTheme();
  return (
    <Loading gap={space.lg}>
      <Bar height={theme.type.secondary.lineHeight} width="65%" />
      {ROSTER_GROUPS.map(({ id, rows }) => (
        <View key={id} style={{ gap: space.sm }}>
          <View style={{ paddingHorizontal: space.xs }}>
            <Bar height={theme.type.bodyStrong.lineHeight} width="30%" />
          </View>
          <ListSkeleton rows={rows} />
        </View>
      ))}
    </Loading>
  );
}

/** The schedule card: a summary, then a few days on the timeline. */
function ScheduleSkeleton() {
  const theme = useAppTheme();
  return (
    <Loading>
      <Surface style={{ gap: space.lg }}>
        <Bar height={theme.type.section.lineHeight} width="50%" />
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
            <Bar height={22} radius={11} width={22} />
            <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
              <Bar height={theme.type.label.lineHeight} width="35%" />
              <Bar height={theme.type.body.lineHeight} width="80%" />
            </View>
          </View>
        ))}
      </Surface>
    </Loading>
  );
}

/** Holds the place of the Trip tab's chosen section while its pack is read or downloaded. */
export function TripSectionSkeleton({ section }: { section: TripView }) {
  if (section === 'roster') return <RosterSkeleton />;
  if (section === 'schedule') return <ScheduleSkeleton />;
  return (
    <Loading>
      <ListSkeleton rows={3} />
    </Loading>
  );
}
