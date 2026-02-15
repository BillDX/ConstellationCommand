import { useState, useEffect } from 'react';

interface StardateInfo {
  stardate: string;
  clock: string;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function computeStardate(now: Date): StardateInfo {
  const year = now.getFullYear();
  const dayOfYear = getDayOfYear(now);

  const stardate = `SD ${year}.${pad(dayOfYear, 3)}`;

  const hours = pad(now.getHours(), 2);
  const minutes = pad(now.getMinutes(), 2);
  const seconds = pad(now.getSeconds(), 2);
  const clock = `${hours}:${minutes}:${seconds}`;

  return { stardate, clock };
}

export function useStardate(): StardateInfo {
  const [info, setInfo] = useState<StardateInfo>(() => computeStardate(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setInfo(computeStardate(new Date()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return info;
}
