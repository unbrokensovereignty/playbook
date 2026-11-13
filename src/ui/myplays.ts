/** The plays you drew, as the planner fills them, for screens that list plays. */
import { useMemo } from 'preact/hooks';
import { asPlay } from '../core/saved.ts';
import type { Play } from '../core/kb/plays.ts';
import { watch } from './state.ts';

/** Your plays (on one map, when given), redrawn when they change. */
export function useMyPlays(map?: string): Play[] {
  const list = watch('meta').myPlays();
  return useMemo(() => list.filter((p) => !map || p.map === map).map(asPlay), [list, map]);
}

/** Where a play you drew is drawn again, and where any play is shown on its map's plays page. */
export const drawLink = (map: string, id = '') => `${map}/draw${id ? `/${id}` : ''}`;
export const playsLink = (map: string, id = '') => `${map}/plays${id ? `/${id}` : ''}`;
