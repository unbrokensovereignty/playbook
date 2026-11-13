/**
 * The tour on screen, kept apart from the engine so a screen can follow it without loading it: a
 * screen shows what a step points at (the first comp opened, the right tab) while the step lasts,
 * and goes back to what you had when it ends. Nothing here is saved.
 */
import { computed, signal } from '@preact/signals';
import type { Tour } from './list.ts';

export interface Live { tour: Tour; step: number }

export const tourState = signal<Live | null>(null);
export const touring = computed(() => tourState.value !== null);

/** The hook the step on screen points at, or ''. */
export const tourHook = computed(() => { const l = tourState.value; return l?.tour.steps[l.step]?.target ?? ''; });

/** Whether the step on screen points at the first comp or inside it (it's shown open, on its Pros and cons). */
export const tourOnComp = computed(() => tourHook.value.startsWith('comp-'));
