# Sound credits

Playbook's three sound sets play short recordings from three sources. Each folder here holds one source's files, and `src/ui/cues.ts` says which cue plays which file. The license or terms that come with each source are in `licenses/`.

| Folder | Source | License | Credit |
|---|---|---|---|
| `snd-sine/` | SND, Sine pack, by Dentsu (snd.dev) | SND terms of use | Not required, given anyway |
| `snd-piano/` | SND, Piano pack, by Dentsu (snd.dev) | SND terms of use | Not required, given anyway |
| `jc/` | UI Utility Pack Vol 1 by JC Sounds, opengameart.org/content/jc-sounds-ui-utility-pack-vol-1 | CC BY 4.0, creativecommons.org/licenses/by/4.0/ | Required, given here, in `LICENSE` and under Help → About |
| `haeldb/` | UI Sounds (Notices) by HaelDB, opengameart.org/content/ui-sounds-0 | CC0 1.0 (public domain) | Not required, given anyway |

SND's terms let any app use the sounds, free and without asking. They don't allow selling or sharing the sound files on their own, so the files in `snd-sine/` and `snd-piano/` may only be passed on inside Playbook and never as a sound pack by themselves. The same terms rule out using one as a trademark or a sound logo.

The files are the sources' own MP3s at 96 kbps, mono, with their tags removed and nothing else changed. The app trims the silence before and after each one as it plays, fades its end, and sets its level so its peak sits where its cue needs it (`levelOf` in `src/ui/cues.ts`).

## Clarity

SND Sine, with tap, tick and toggle from JC Sounds. The JC files are named after the pack's own names (Single, Set 11_01 becomes single-set-11_01), and the SND files keep theirs.

| File | Used for |
|---|---|
| jc/single-set-11_01.mp3, jc/single-set-11_03.mp3 | tap |
| jc/single-set-11_02.mp3 | tick |
| jc/twonote-up-set-11_01.mp3 | toggle |
| snd-sine/select.mp3 | pick |
| snd-sine/type_01.mp3, type_02.mp3, type_03.mp3 | unpick |
| snd-sine/swipe_01.mp3, swipe_02.mp3, swipe_03.mp3 | page |
| snd-sine/transition_up.mp3 | open |
| snd-sine/transition_down.mp3 | close |
| snd-sine/disabled.mp3 | remove |
| snd-sine/swipe_05.mp3 | undo |
| snd-sine/caution.mp3 | error |
| snd-sine/notification.mp3 | ready |
| snd-sine/celebration.mp3 | saved |

## Felt

SND Piano. Its files keep the names they have in the pack.

| File | Used for |
|---|---|
| snd-piano/button.mp3 | tap |
| snd-piano/tap_01.mp3, tap_02.mp3, tap_03.mp3, tap_04.mp3 | tick |
| snd-piano/toggle_on.mp3, toggle_off.mp3 | toggle |
| snd-piano/select.mp3 | pick |
| snd-piano/type_01.mp3, type_02.mp3, type_03.mp3 | unpick |
| snd-piano/swipe_01.mp3, swipe_02.mp3, swipe_03.mp3 | page |
| snd-piano/transition_up.mp3, transition_down.mp3 | open, close |
| snd-piano/disabled.mp3 | remove |
| snd-piano/swipe_05.mp3 | undo |
| snd-piano/caution.mp3 | error |
| snd-piano/notification.mp3 | ready |
| snd-piano/celebration.mp3 | saved |

## Beacon

HaelDB's notices. The pack numbers them #0 to #9; the files here drop the `#`.

| File | Used for |
|---|---|
| haeldb/9.mp3 | tap |
| haeldb/7.mp3 | tick |
| haeldb/5.mp3 | toggle |
| haeldb/6.mp3 | pick |
| haeldb/2.mp3 | unpick and undo |
| haeldb/1.mp3 | page |
| haeldb/3.mp3 | open and saved |
| haeldb/4.mp3 | close |
| haeldb/8.mp3 | remove |
| haeldb/wrong-error.mp3 (Wrong Error) | error |
| haeldb/0.mp3 | ready |
