# The Cut

Tom's body-transformation tracker: road to 90 kg, styled like an edit suite.

Live at https://tomkeogh98.github.io/the-cut/

- **Today (call sheet):** a different greeting every visit; what happened last time, today's session and how it builds on it; the daily list (train, 4 L water, guitar, read 30 min, journal, plus weigh-in and photo days); the journal.
- **Timeline:** green = trained, grey = not scheduled, red = scheduled and missed. Move or excuse sessions under the rules (5 a week, no skipping the day after a move, no back-to-back moves).
- **Weight:** trend weight, chart, projection to 90 kg, BMI, body fat and lean mass. Smart-scale weigh-ins arrive by themselves: scale → Renpho app → Apple Health → Hevy → The Cut (Hevy's body measurements carry weight, body fat % and lean mass; a site can't read Apple Health directly).
- **Photos:** progress photos with a before/after slider.
- **Goals:** weight milestones, lift targets built from real Hevy numbers, habit milestones.
- **Meals:** BMR/TDEE-based targets and scalable meal cards.
- **Programme + Hevy:** the upper/lower split with coaching cues; pulls workouts and weigh-ins from the Hevy API (Hevy Pro), pushes the routines into Hevy, or imports Hevy's CSV export.

Plain HTML, CSS and ES modules, no build step. Data saves locally first, then syncs to the **private** repo `tomkeogh98/the-cut-data` through the GitHub API (set up under Settings with a fine-grained token). That repo also runs the email nudges.

The site is served from the `gh-pages` branch. Bump `?v=N` on every CSS/JS reference and import when releasing.

## Tests

```sh
PY=~/Library/Caches/claude-playwright/venv/bin/python
$PY tests/run_logic.py   # schedule / body / meals / goals / Hevy logic
$PY tests/smoke.py       # end-to-end in Chrome + screenshots (tests/out/) at 375/1024/1440/1920, light & dark
$PY tests/hevy_body_test.py # scale weigh-ins via Apple Health → Hevy: weight, body fat, lean mass; never overwrites
```
