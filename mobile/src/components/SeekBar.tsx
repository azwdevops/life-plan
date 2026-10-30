import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, Text, type LayoutChangeEvent } from 'react-native';
import { colors } from '../theme';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  position: number; // seconds
  duration: number; // seconds
  onSeek: (seconds: number) => void;
  c: typeof colors.light;
}

const THUMB_SIZE = 14;

export function SeekBar({ position, duration, onSeek, c }: Props) {
  const [width, setWidth] = useState(0);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  // PanResponder is created once, so its handlers close over stale values -
  // keep the latest ones in refs for the handlers to read instead.
  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const startFractionRef = useRef(0);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        if (widthRef.current <= 0) return;
        const fraction = clamp01(evt.nativeEvent.locationX / widthRef.current);
        startFractionRef.current = fraction;
        setDragFraction(fraction);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (widthRef.current <= 0) return;
        setDragFraction(clamp01(startFractionRef.current + gestureState.dx / widthRef.current));
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (widthRef.current <= 0) return;
        const fraction = clamp01(startFractionRef.current + gestureState.dx / widthRef.current);
        onSeekRef.current(fraction * durationRef.current);
        setDragFraction(null);
      },
      onPanResponderTerminate: () => setDragFraction(null),
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const fraction = dragFraction ?? (duration > 0 ? clamp01(position / duration) : 0);
  const displaySeconds = dragFraction != null ? dragFraction * duration : position;
  const styles = makeStyles(c);

  return (
    <View style={styles.wrapper}>
      <View style={styles.track} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.trackBackground} />
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        <View
          style={[
            styles.thumb,
            { left: `${fraction * 100}%`, marginLeft: -THUMB_SIZE / 2 },
          ]}
        />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatSeconds(displaySeconds)}</Text>
        <Text style={styles.timeText}>{formatSeconds(duration)}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    wrapper: { paddingHorizontal: 16 },
    track: {
      height: 24,
      justifyContent: 'center',
    },
    trackBackground: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 10,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 10,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.accent,
    },
    thumb: {
      position: 'absolute',
      top: 5,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: c.accent,
    },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    timeText: { color: c.textMuted, fontSize: 11 },
  });
}
