/**
 * Trip replay engine.
 *
 * Uses requestAnimationFrame to smoothly animate a playback cursor
 * through the recorded track points based on their actual timestamps.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackPoint } from '../types/gps';
import { findIndexByTime } from '../utils/route';

export type PlaybackSpeed = 0.5 | 1 | 2 | 5 | 10;

export interface ReplayState {
  playing: boolean;
  speed: PlaybackSpeed;
  /** Actual index in the track points array. */
  currentIndex: number;
  /**
   * The current virtual timestamp of the replay head.
   * Can be smoothly interpolated between indices.
   */
  currentTime: number;
  /** Progress 0 to 1. */
  progress: number;
  
  togglePlay: () => void;
  setSpeed: (s: PlaybackSpeed) => void;
  /** Jump to a specific point (e.g., from clicking the map/chart). */
  seekToIndex: (index: number) => void;
  restart: () => void;
}

export function useReplay(points: TrackPoint[]): ReplayState {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [currentTime, setCurrentTime] = useState(() => points[0]?.timestamp ?? 0);

  const reqRef = useRef<number>(0);
  const lastRealTimeRef = useRef<number>(0);
  
  const pStart = points[0]?.timestamp ?? 0;
  const pEnd = points[points.length - 1]?.timestamp ?? 0;
  const pSpan = Math.max(1, pEnd - pStart);

  // If points change (e.g., loading a different trip), reset.
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(points[0]?.timestamp ?? 0);
  }, [points]);

  const tick = useCallback((realTimeNow: number) => {
    if (!lastRealTimeRef.current) {
      lastRealTimeRef.current = realTimeNow;
    }
    const realDelta = realTimeNow - lastRealTimeRef.current;
    lastRealTimeRef.current = realTimeNow;

    setCurrentTime(prevTime => {
      const virtualDelta = realDelta * speed;
      const nextTime = prevTime + virtualDelta;
      
      if (nextTime >= pEnd) {
        setPlaying(false);
        return pEnd;
      }
      return nextTime;
    });

    reqRef.current = requestAnimationFrame(tick);
  }, [pEnd, speed]);

  useEffect(() => {
    if (playing) {
      lastRealTimeRef.current = performance.now();
      reqRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(reqRef.current);
    }
    return () => cancelAnimationFrame(reqRef.current);
  }, [playing, tick]);

  const togglePlay = useCallback(() => {
    setPlaying(p => {
      // If at end, restart
      if (!p && currentTime >= pEnd) {
        setCurrentTime(pStart);
        return true;
      }
      return !p;
    });
  }, [currentTime, pEnd, pStart]);

  const seekToIndex = useCallback((index: number) => {
    if (index >= 0 && index < points.length) {
      setCurrentTime(points[index]!.timestamp);
    }
  }, [points]);

  const restart = useCallback(() => {
    setCurrentTime(pStart);
    setPlaying(true);
  }, [pStart]);

  let currentIndex = 0;
  if (points.length > 0) {
     const idx = findIndexByTime(points, currentTime);
     if (idx !== null) currentIndex = idx;
  }

  const progress = Math.max(0, Math.min(1, (currentTime - pStart) / pSpan));

  return {
    playing,
    speed,
    currentIndex,
    currentTime,
    progress,
    togglePlay,
    setSpeed,
    seekToIndex,
    restart,
  };
}
