/** Which component draws each page. */
import type { FunctionComponent } from 'preact';
import type { Page } from '../state.ts';
import { HomePage } from './home.tsx';
import { PlannerPage } from './planner.tsx';
import { SelectPage } from './select.tsx';
import { RankingsPage } from './rankings.tsx';
import { AgentsPage } from './agents.tsx';
import { MapsPage } from './maps.tsx';
import { SavedPage } from './saved.tsx';
import { SettingsPage } from './settings.tsx';
import { ThemesPage } from './themes.tsx';
import { HelpPage } from './help.tsx';
import { GalleryPage } from './gallery.tsx';
import { SelfTestPage } from './selftest.tsx';

export interface PageProps { arg: string }

export const PAGE_VIEWS: Record<Page, FunctionComponent<PageProps>> = {
  home: HomePage,
  planner: PlannerPage,
  select: SelectPage,
  rankings: RankingsPage,
  agents: AgentsPage,
  maps: MapsPage,
  saved: SavedPage,
  settings: SettingsPage,
  themes: ThemesPage,
  help: HelpPage,
  gallery: GalleryPage,
  selftest: SelfTestPage,
};
