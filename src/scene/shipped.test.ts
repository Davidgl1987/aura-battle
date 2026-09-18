import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { USED_CLIPS } from './animations'

/**
 * The deploy's question rather than the developer's: is every clip the game
 * will fetch actually in `public/models/animations` right now?
 *
 * Skipped unless asked for, because on a fresh clone the answer is "no" by
 * design — the files are Adobe's and gitignored — and `npm test` has to pass
 * there. `pages.yml` asks for it, through `npm run clips:check`, after copying
 * the licensed files in and before building, so a deploy that would 404 on a
 * card's motion fails instead of shipping. It did ship, once: twenty of the
 * twenty-one clips were missing from the assets repository for a week and
 * every card but Mewing was performed as a held idle, because the workflow
 * only asked whether the folder was empty and one clip made it not empty.
 *
 * The list is `USED_CLIPS` and nothing else — no copy of it in the workflow
 * to keep in step — so repointing a card or a beat changes what is required
 * here the same instant it changes what is fetched. Asked of the same files
 * `clips.test.ts` measures, but never skipped when they are absent: absence is
 * the whole finding.
 */
const REQUIRED = !!import.meta.env.VITE_REQUIRE_CLIPS

const DIR = 'public/models/animations'

describe('the clips the game fetches', () => {
  it.skipIf(!REQUIRED)('are all in public/models/animations, and not empty', () => {
    const missing = USED_CLIPS.filter((clip) => {
      const file = join(DIR, `${clip.id}.fbx`)
      return !existsSync(file) || statSync(file).size === 0
    }).map((clip) => clip.id)

    expect(
      missing,
      `${missing.length} of ${USED_CLIPS.length} clips the game fetches are not in ${DIR}: ` +
        `${missing.join(', ')}. See public/models/animations/README.md — ` +
        '`npm run clips -- --upload` puts them in the assets repository.',
    ).toEqual([])
  })
})
