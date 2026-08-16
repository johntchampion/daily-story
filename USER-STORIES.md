# Daily Story — User Stories & Flow Analysis

This document maps **every way a user can enter, move through, and leave the site**, and examines what they understand (and misunderstand) at each step. The goal is to surface friction, confusion, and missed opportunities so we can optimize for **discovery → comprehension → engagement → return**.

It is written from the perspective of someone with *no prior context*, since that is the hardest and most common case for a site trying to grow — and, now that accounts exist, from the perspective of a signed-in user trying to build a daily habit.

> **This is a full re-analysis.** The site was redesigned and substantially rebuilt since the first version of this document. Section 0 summarizes what changed; everything after it describes the site as it exists today.

---

## 0. What Changed Since the Last Analysis

The previous version described a stateless, account-free site whose entire retention strategy was "bookmark this page." That product no longer exists. Today:

| Previously identified friction | Status today |
|---|---|
| No memory of the user's choice | **Largely fixed.** Accounts store `preferred_language`/`preferred_level`; the session remembers `lastViewed*` for anonymous visitors and preselects the home picker |
| Bookmarking is the only retention hook | **Partially fixed.** Accounts + a streak exist. But there is still no email, push, or reminder of any kind — the daily nudge is *promised* at signup and never sent |
| CEFR ambiguity at the point of choice | **Fixed.** Levels read "Beginner (A1)" everywhere, with a plain-language description on the home page, the levels section, the story page, and onboarding |
| No content preview before commitment | **Fixed, well.** The home page has a static preview card *and* a fully interactive three-story showcase with a working quiz and Show-English toggle |
| The empty state is a dead-end | **Improved, not solved.** `no-story-today.ejs` is warmer and better linked, but still offers no content — no fallback to a recent story |
| No persistent navigation | **Fixed.** Every page has a header with the brand mark; most have a shared footer |
| No progress or accomplishment system | **Fixed for signed-in users.** Streak, 7-day grid, weekly quiz accuracy, recent quizzes, and previous stories all render from real `user_story_activity` data |
| Analytics blind spots | **Regressed.** PostHog was removed entirely (`efe98e7`). There is now **zero** instrumentation anywhere on the site. Every question in Section 8 is currently unanswerable |

**The new shape of the problem.** The old failure mode was *the product asked for too little* — it couldn't remember you, so it couldn't hold you. The new failure mode is *the product promises more than it delivers*: a dashboard with dead navigation, an archive of previous stories that no route can serve, a daily reminder that doesn't exist, a personalization promise the generator ignores, and a password field with no recovery path. Section 6 inventories these specifically, because they are now the highest-severity issues on the site — a broken promise costs more trust than a missing feature.

---

## 1. The Routes (What Actually Exists)

| Route | What it renders | Notes |
|---|---|---|
| `GET /` (logged out) | `home.ejs` — marketing page: hero + picker, interactive story showcase, levels, closing CTA | The front door for strangers |
| `GET /` (signed in) | `dashboard.ejs` — today's story hero, streak, 7-day grid, quiz stats, refresher, previous stories | The front door for members. **A signed-in user can never see the marketing page again** |
| `GET /about` | `about.ejs` — what/how/CEFR explainer, tips, open-source link | Linked from the shared footer only — **not reachable from the dashboard at all** |
| `GET /signup`, `GET /login` | `signup.ejs` / `login.ejs` — two-column pitch + auth card | |
| `POST /signup` | Creates account, logs in, redirects to `/profile/onboarding` | |
| `POST /login` | Verifies, stamps `last_logged_in`, redirects to `/` (→ dashboard) | |
| `POST /logout` | Destroys session, redirects to `/` | |
| `GET /profile/onboarding` | `onboarding.ejs` — 4-step wizard (language → level → reasons → confirm) | `requireAuth`. The **only** place preferences can ever be set |
| `POST /profile/onboarding` | Saves language/level, records survey answers, redirects to the story | Partial saves allowed |
| `GET /:language/:level` | `story.ejs`, or `no-story-today.ejs` if the file is missing | The product. Also fires `recordVisit()` for signed-in users |
| `GET /:language/:level` (invalid) | `error.ejs`, 400, listing what *is* supported | |
| `POST /record-activity` | Records the quiz tally against the token-signed story date | 204 no-op for anonymous visitors |
| `GET /generate-stories` | Plain-text admin output | Not user-facing; should never be linked publicly |
| Any unknown URL | `error.ejs`, 404 | |

**Architectural facts that shape every flow:**

- **There are two entirely different front doors.** `/` branches on `req.session.userId`. Signing in is a one-way door out of the marketing site.
- **Only today's story is addressable.** `/:language/:level` always builds a path from `new Date()`. Past story files persist on disk (there are stories going back to 2025 in `stories/`), but **no route can serve them**. Every "previous story" and "all stories" affordance on the dashboard is therefore unbackable today.
- **Preferences are write-once-ish.** `/profile/onboarding` is the only writer of `preferred_language`/`preferred_level`, and once a user has a preference the dashboard never links to it again.
- **Activity is recorded on *visit*, not on *read*.** `recordVisit()` fires the moment the story page renders. Streaks, the 7-day grid, and "previous stories" all measure page-opens.
- **Sessions are in-memory.** An app restart signs out every user and wipes every anonymous visitor's remembered language/level.
- **There is no analytics of any kind.** Not on the home page, not on the story page, not on the empty state, not on errors.

---

## 2. Entry Points & First Impressions

### 2.1 Entry: Marketing home (`/`, logged out)

**Who:** Someone who typed the domain, clicked a generic link, or found the site listed somewhere.

**What they see:** A designed landing page — eyebrow, headline ("A short story a day, in the language you're *learning*"), a lead paragraph that states the whole value prop in two sentences, a language/level picker, expectation chips (Free · No sign-up · New story daily · 8 languages · ~5 min read), and a static preview card of a Spanish café conversation. Below: an interactive showcase with three real sample stories they can read, toggle to English, and quiz themselves on; a four-card levels section; and a closing CTA.

**First impressions:**
- ✅ **This page now does its job.** The old critique — no preview, no CEFR help, no "is this free," no sense of what a "story" is — is comprehensively answered. The chips answer the pricing/friction questions in five words. The showcase lets a stranger experience the entire product loop (read → toggle → quiz → feedback) without committing anything.
- ✅ The picker preselects from `session.lastViewedLanguage/Level`, so a returning anonymous visitor doesn't re-choose.
- ✅ Empty-form submission now shows a real error message and focuses the offending select. The old silent dead click is gone.
- ⚠️ **The page sells "No sign-up" while the site's actual retention model is sign-up.** The chips promise frictionlessness; the nav offers Log in / Sign up; nothing on the page explains what an account *gets* you (streak, saved level, history). The strongest reason to create an account is never stated on the page most likely to convert someone.
- ⚠️ **The showcase may be too good.** A visitor can read three stories and take three quizzes without ever leaving the landing page. There's no transition from "I finished the sample" to "now open today's real story" — the `Read another →` button just cycles the samples forever.
- ⚠️ Both nav CTAs (`Log in`, `Sign up`) use the same `nav-strong` weight, so there's no visual primary action.

**Confusion risks:**
- "Do I need an account or not?" — the page says no; the header says maybe; the product says yes if you want a streak.
- "Are these three stories the whole product?" — the samples are hardcoded and unlabeled as samples.

**The decision they must make to activate:** two selections + a click, or a signup. Both paths are now one screen away.

### 2.2 Entry: Dashboard (`/`, signed in)

**Who:** Every returning member. This is the most important page on the site for retention.

**What they see:** A dateline with a day-of-year issue number, a time-aware greeting by name, a hero card with today's story title (and English subtitle) plus a day-streak column, three stat cards (last 7 days, quizzes this week, a 30-second refresher), and a "previous stories" grid.

**First impressions:**
- ✅ **The emotional design is right.** "Good morning, John." + a dated issue number + one clear CTA is exactly the right frame for a daily-habit product. The streak sits next to the CTA, which is where it earns its keep.
- ✅ The empty/degenerate states are handled thoughtfully in `dashboardViewModel.ts`: no preference → "Choose your language to begin" pointing at onboarding; no story generated yet → "Today's story is on its way" instead of an error.
- ✅ "Read in another language today" is a genuinely nice touch — it lets curiosity happen without destabilizing the user's stated preference ("Just for today — your usual stays Español · A1").
- 🚨 **Half the dashboard's navigation is dead.** `Progress`, `Account`, `See full progress →`, and `All stories →` are all `href="#"`. That's four dead clicks on the page a member sees every single day — the highest-frequency page on the site.
- 🚨 **"Previous stories" cards all link to *today's* story** (`href: storyHref` is `dashboardStory.href` for every row). A user clicking "Thu · Aug 13 — Das Frühstück" lands on today's story instead. If they haven't set a preference, the cards link to `/profile/onboarding`. This is worse than a dead link — it silently substitutes different content and quietly breaks the mental model that the dashboard is a record of what they've read.
- 🚨 **The "30-second refresher" is hardcoded German vocabulary** (`der Umzug`, `verlässlich`, `die Erinnerung`) for every user regardless of their language, and the feedback string says *"Genau! Nicely remembered."* A Spanish learner is quizzed in German and congratulated in German. It's also attributed to invented story titles ("from *Der Markt am Sonntag*") the user never read. This is the single most credibility-damaging element on the site: it makes real data next to it (streak, quiz %) look fabricated too.
- ⚠️ **There's no way to change your level.** The dashboard has a language picker but no level control, and never links back to onboarding once a preference exists. A user who outgrows A1 has no supported path to A2 — they must guess the URL, or find the "Today at other levels" block on the story page (which changes what they read but *not* their saved preference, so tomorrow's dashboard reverts).
- ⚠️ **The dashboard is a walled garden.** It has its own footer (a single line of prose) and never links to `/about`, the marketing page, or anything else. A signed-in user cannot reach the About page from any link on the site.
- ⚠️ **The streak counts page-opens, not reading.** `recordVisit()` fires on render. Opening the story and immediately closing it keeps a streak alive. That's forgiving (good for habit-building) but it means the number doesn't mean what the user thinks it means, and "days read" in the 7-day card is literally mislabeled.

### 2.3 Entry: Deep link to a story (`/spanish/a1`)

**Who:** Someone who clicked a shared link, opened a bookmark, or followed a friend's recommendation.

**What they see:** A well-composed reading page — date line, title (with English subtitle when available), a tag reading "Español · A1 · Beginner", a turn count and time estimate, an optional Show-English toggle, the conversation as alternating bubbles, a three-question quiz with a live answered-count, "Today at other levels," and a bookmark footnote.

**First impressions:**
- ✅ Instant value, zero setup. Still the best possible first impression.
- ✅ The "Beginner"/"Intermediate" gloss next to the CEFR code means a cold arrival immediately understands the difficulty they landed on.
- ✅ "Today at other levels" now includes the current level marked "Reading now," so the block reads as a ladder rather than a list of alternatives — a much clearer level-up affordance than before.
- ✅ Per-line translations with a toggle are a real comprehension aid for the exact moment a reader gets stuck.
- ⚠️ **A cold arrival still gets no framing.** There's no "New here? What is Daily Story?" affordance. The header says "Change language," which presumes they chose one.
- 🚨 **The header's "Sign up" link points to `/login`.** A visitor who reads a story, likes it, and clicks Sign up lands on the login form. The mode tabs let them recover, but this is the exact moment of highest conversion intent on the entire site, and we route it to the wrong page.
- ⚠️ **Anonymous readers get nothing persisted.** `recordVisit()` and `/record-activity` both no-op without a session user, and nothing on the page says "sign up and this would have counted." The page's own footnote still recommends the weakest possible retention mechanism (bookmarking) to a visitor we could be converting.

### 2.4 Entry: No story yet (`no-story-today.ejs`)

**Who:** Someone arriving before the day's batch has been generated, or for a combo that failed.

**What they see:** The date, "Today's story isn't ready yet," the language/level tag, a warm explanation ("stories are written fresh each morning... check back in a little while"), and one CTA back to the picker.

**First impressions:**
- ✅ Tonally much better than before — it reads like a magazine that hasn't printed yet, not a broken app.
- 🚨 **It still offers zero content.** Every other language/level is likely missing too, so "try another language or level" often loops back here. Falling back to the most recent available story for that combo — clearly labeled — would nearly eliminate this failure mode, and the files to do it are already on disk.
- 🚨 **The "Sign up" link points to `/sign-up`, which 404s.** The route is `/signup`. So the worst page on the site turns a recovery attempt into an error page.
- ⚠️ A signed-in user hitting this page loses their streak day silently — no visit row is recorded, and nothing tells them "this won't count against you."
- ⚠️ No instrumentation, so we have no idea how often this happens.

### 2.5 Entry: Signup / Login

**Who:** Someone converting from the marketing page or story page, or returning after a session expired.

**What they see:** A two-column layout — a pitch with a perks list and a preview card on the left, an auth card on the right with mode tabs.

**First impressions:**
- ✅ The pitch answers "why make an account" clearly and specifically. The perks list is the best statement of the account value prop anywhere on the site — which is why it's a shame the marketing home page doesn't say any of it.
- ✅ Login's generic "Invalid email or password" avoids user enumeration; the mode tabs make switching frictionless.
- 🚨 **"Forgot?" is `href="#"`.** There is no password reset anywhere in the codebase. A user who forgets their password permanently loses their account, their streak, and their history. Adding accounts without recovery made the *return* path strictly worse than the old bookmark model for anyone who gets locked out.
- 🚨 **"Sign in with a passkey" does nothing.** `#passkeyBtn` has no event handler and no server-side WebAuthn. It's rendered above the email form, in the primary position, so it's the first thing a returning user is likely to click.
- 🚨 **Signup's "Send me a daily nudge" checkbox is checked by default and ignored entirely.** `POST /signup` never reads `req.body.nudge`; there is no email infrastructure. The user opts into a daily reminder, receives nothing, and their streak breaks. This is the most damaging promise on the site because it directly substitutes for the retention behavior it prevents (the user stops self-reminding).
- ⚠️ Login's perks claim "Reading streak and daily reminder" (no reminder exists) and "Every past story, one tap away" (no route serves past stories). Two of three perks on the login page are currently untrue.
- ⚠️ Terms and Privacy Policy are `href="#"` on both pages, under text that says "By continuing you agree to our Terms."
- ⚠️ No password strength requirement, no confirm field, no inline validation.

### 2.6 Entry: Onboarding (`/profile/onboarding`)

**Who:** Every new account, immediately after signup.

**What they see:** A four-step wizard with a progress bar — language grid, a self-assessment written as plain sentences ("Starting from zero — or close to it"), a multi-select of reasons for learning, and a confirmation step with a greeting in the target language and a mocked-up first story.

**First impressions:**
- ✅ **This is the strongest flow on the site.** The level question sidesteps CEFR entirely by asking how the language *feels*, and maps eight honest self-descriptions onto four levels behind the scenes. That is a materially better answer to "what level am I?" than a tooltip.
- ✅ The reasons step is optional and says so — the button literally reads "Skip this one →" until you pick something.
- ✅ Step 4's native-language greeting and mock story is a genuinely delightful payoff.
- ⚠️ **"Pick as many as you like — we'll lean your stories that way" is not true.** Reasons are recorded to `user_responses` and never read again. Story generation is global per language/level/date — every user at Spanish A1 gets an identical story. This is a fine thing to *collect*, but the copy makes a personalization promise the architecture can't keep, and a user who selects "Work & career" and gets a story about the market will notice.
- ⚠️ **"Skip for now →" leads into a loop.** It goes to `/`, which is a dashboard with no preference, whose only CTA is "Set up my reading →" back to onboarding. There's no way for a signed-in user to browse without a preference.
- ⚠️ Onboarding is not resumable and never reappears. Since it's also the only preference editor, a mis-set level is effectively permanent for a normal user.

### 2.7 Entry: Error pages (404 / 400 / 500)

**What they see:** Status code, message, dev-only details, and a "Go back home →" CTA.

- ✅ Clean and calm. The 400 for a bad language/level lists everything supported.
- ⚠️ "Go back home" sends a signed-in user to the dashboard and an anonymous one to the marketing page — both reasonable, but neither *recovers* the intent (e.g. "Did you mean Spanish A1?").
- ⚠️ No instrumentation, so bad inbound links — a genuine discovery signal — are invisible.

---

## 3. Core User Flows (Step by Step)

### Flow A — Anonymous first-timer (marketing home → story)

1. Lands on `/`. Reads the headline and lead; the chips answer cost/friction instantly.
2. Scrolls into the showcase, reads a sample conversation, toggles English, answers a quiz question, gets feedback.
3. Scrolls back up (or clicks the closing CTA's `#top`) and picks a language + level — with the level cards fresh in mind.
4. Lands on today's story. Reads, quizzes, sees a score message.
5. Reads "Bookmark this page and come back tomorrow."

**Where this flow leaks:**
- Step 2 → 3 is unassisted. The showcase's own button (`Read another →`) cycles samples rather than escalating to the real product. There is no "Open today's real story" CTA inside the showcase.
- Step 4–5: the terminal state of the best-case anonymous flow is *still a bookmark suggestion*. Nothing on the story page proposes an account, explains the streak, or notes that this read would have counted. **This is the biggest remaining conversion leak on the site.**
- If step 4 hits the empty state, the user's only recovery link (Sign up) 404s.

### Flow B — Anonymous returner

1. Returns via bookmark to `/spanish/a1`, or to `/` where the picker is preselected from their session.
2. Reads today's story.

**Where this flow leaks:**
- The session preselect is stored in an **in-memory** session store. Any app restart — every deploy — wipes it, and the user re-onboards.
- Nothing ever escalates a repeat anonymous visitor toward an account. A user on their fifth visit sees exactly what a first-time visitor sees; we can't even detect the pattern, because we have no analytics.

### Flow C — Signup → onboarding → first story

1. Clicks Sign up (from the home nav — or from the story page, where the link wrongly goes to `/login`).
2. Fills name/email/password, leaves the daily-nudge box checked.
3. Redirected into onboarding. Picks language, self-assesses, optionally picks reasons.
4. Step 4 shows a greeting and a mock story; submits.
5. Preferences saved, survey answers recorded, redirected to `/{language}/{level}`.
6. Reads their first story. A visit row is written; the quiz tally posts as they answer.

**Where this flow leaks:**
- Step 2's nudge checkbox creates a false expectation that actively suppresses the user's own return behavior.
- Step 5 drops them into a story with no acknowledgment that they just created an account — no "you're set up, your streak starts today." The moment of highest goodwill produces no reinforcement.
- If today's story hasn't generated, a brand-new account's first-ever experience is the empty state.
- Nothing routes them to the dashboard, so they may never discover it exists.

### Flow D — The signed-in daily loop (the intended habit)

1. Opens the site. Lands on the dashboard: greeting, today's title, streak.
2. Clicks "Read today's story →." Visit recorded; streak preserved.
3. Reads, answers three questions; each answer posts a cumulative tally.
4. Returns to the dashboard (via the brand mark) and sees the streak, the 7-day grid, and the quiz percentage update.

**Where this flow leaks:**
- **Nothing initiates step 1.** There is no email, push, PWA install prompt, or calendar hook. The habit still depends entirely on the user remembering — which is precisely what the signup checkbox told them they wouldn't have to do.
- Step 4's payoff is undermined by the dead `Progress` / `Account` / `See full progress` / `All stories` links and the German refresher — the page rewards them with a mix of real data and obvious placeholder.
- Clicking a "previous story" silently opens today's story instead.
- Miss a day and the streak resets with no grace, no freeze, and no notification — the user just finds a `0` where their number was.

### Flow E — Outgrowing your level

1. A user at A1 finds the stories easy.
2. On the story page, "Today at other levels" lets them open A2 — good.
3. Tomorrow, the dashboard shows A1 again, because reading A2 didn't change `preferred_level`.

**Where this flow leaks:**
- **There is no supported way to change your saved level**, and no way to change your saved language either. The dashboard's language chips are explicitly "just for today." `/profile/onboarding` still works if typed, but nothing links to it once a preference exists.
- Nothing detects readiness. Quiz accuracy per level is already stored — three straight 3/3 days at A1 is a level-up signal we're collecting and ignoring.

### Flow F — Shared link (word of mouth)

1. A friend sends `/french/b1`.
2. They land in a story (great) or on the empty state (bad, and the Sign up link 404s).
3. If interested, they must self-discover what the site is — there's no framing for a cold arrival.
4. If they want a different language, "Change language" takes them to the marketing page (or, if they happen to have an account, to a dashboard with no picker for their situation).

### Flow G — The quiz

1. Answers three shuffled questions; immediate green/red, wrong answers reveal the correct one.
2. A live "n / 3 answered" counter tracks progress.
3. On completion, a score box with a tailored message; a perfect score triggers the emoji burst.
4. Each answer fires `/record-activity` with the running tally, signed with an HMAC'd story date so a page opened before midnight still counts for the right day.

**Strengths:** immediate feedback, shuffled options, partial attempts captured, the date-token design is genuinely careful, and the score messages coach ("drop to an easier level below") rather than just grading.

**Where this flow leaks:**
- Answers are final on first click, with no warning — a misclick is permanently scored, and it's written to the database.
- No retry and no way to review yesterday's questions.
- Anonymous users get the whole experience with none of it saved, and are never told that.
- Question language flips from English (A1/A2) to the target language (B1/B2) with no warning when a user moves up.

---

## 4. Cross-Cutting Friction Themes

1. **The product promises more than it delivers.** A daily nudge that isn't sent, an archive that can't be served, personalization that isn't applied, a passkey button that does nothing, a password reset that doesn't exist. Each one individually is a small gap; together they teach a user that the interface is decorative. See Section 6.

2. **There is still no return trigger.** Accounts and streaks made returning *rewarding*, but nothing makes it *happen*. Email is the obvious gap (and is already implied by signup copy); a PWA install prompt is the cheap alternative. This remains the single biggest cap on the growth model — same conclusion as the last analysis, now with a checkbox in the signup form claiming it's already solved.

3. **The dashboard mixes real data with placeholder.** Streak, week grid, quiz stats, recent quizzes, and previous-story titles are all real. The refresher is fabricated German, and four links go nowhere. Users can't tell which half to trust, so they discount both.

4. **Preferences are a one-way door.** Set once during onboarding, then uneditable through the UI. This hurts exactly the users we most want to keep — the ones improving fast enough to outgrow their level.

5. **Only today exists.** The archive is on disk, the dashboard advertises it, and no route serves it. This blocks the empty-state fallback, the "previous stories" cards, "All stories," and any notion of catching up on a missed day.

6. **Anonymous → account conversion is unassisted.** The story page — where users experience the value — never mentions accounts except through a broken Sign up link, and the marketing page never states what an account is for.

7. **Signing in is a one-way door out of the marketing site.** Members lose access to the home page and, in practice, to `/about` entirely.

8. **The streak measures the wrong thing and says so out loud.** It counts page-opens but the UI reads "of 7 days read." Either measure reading (scroll depth, a quiz answer, dwell time) or rename the metric.

9. **Total analytics blindness.** No instrumentation anywhere. We cannot measure activation, conversion, empty-state frequency, level mis-selection, streak survival, or dead-click rate — meaning every prioritization decision below is currently made on judgment alone.

10. **Session fragility.** The in-memory store means every deploy signs out every user and erases every anonymous preference. For a product whose entire thesis is "come back tomorrow," the session lifetime is shorter than the release cycle.

---

## 5. Optimization Opportunities

Prioritized by impact on *discovery → engagement → return*, weighted toward things that are cheap and currently broken.

| # | Opportunity | Fixes | Effort |
|---|---|---|---|
| 1 | **Fix or remove every broken promise** — the `/sign-up` 404, story-page Sign up → `/login`, the four `href="#"` dashboard links, the dead passkey button, "Forgot?", the previous-story hrefs. Remove what can't ship this week; ship what can | Friction #1; Flows C, D, F | Low |
| 2 | **Replace the hardcoded German refresher** with the user's language, or hide the card until vocab data exists in `StoryContent` | Friction #3; §2.2 | Low (hide) / Med (build) |
| 3 | **Add a dated story route** (`/:language/:level/:date`) so previous stories, "All stories," and an empty-state fallback all become possible | Friction #5; Flows B, D | Med |
| 4 | **Fall back to the most recent available story** on the empty state, clearly labeled — the files already exist on disk | §2.4; Flows B, C, F | Low (after #3) |
| 5 | **Ship the daily email, or uncheck and re-label the box.** Honoring the promise is the highest-leverage retention work available; not honoring it is actively harmful | Friction #2; Flow D | High (email) / Low (copy) |
| 6 | **Add password reset.** Accounts without recovery are a trapdoor | §2.5 | Med |
| 7 | **Add a preferences/account page** — change language, change level, delete account. Reuse the onboarding components | Friction #4; Flow E | Med |
| 8 | **Convert anonymous readers on the story page**: after a completed quiz, offer "Sign up to keep this streak" instead of the bookmark footnote | Friction #6; Flow A | Low |
| 9 | **State the account value prop on the marketing home page** — the login page's perks list already says it well | Friction #6; §2.1 | Low |
| 10 | **Reinstate analytics** and instrument the funnel: home → story activation, showcase engagement, signup → onboarding completion, empty-state frequency, dashboard dead-click rate, streak survival curves | Friction #9 | Low |
| 11 | **Persistent session store** (`connect-pg-simple`) so deploys stop signing everyone out | Friction #10; Flow B | Low |
| 12 | **Suggest level-ups from data we already have** — e.g. three consecutive 3/3 days at a level prompts "Ready for B1?" on the dashboard | Flow E; Friction #4 | Med |
| 13 | **Escalate the showcase to the real product** — an "Open today's real story" CTA inside the sample card, prefilled with the sample's language/level | Flow A | Low |
| 14 | **Give the dashboard a real footer** with About and the marketing page, so members aren't walled in | Friction #7 | Low |
| 15 | **Fix the streak's semantics** — count a read (quiz answered or meaningful scroll), or rename "days read" to "days opened" | Friction #8 | Low–Med |
| 16 | **Acknowledge onboarding completion** on the first story — a one-line "You're set up. Streak starts today." | Flow C | Low |
| 17 | **Warn on the language switch at B1** — questions move into the target language; say so when a user levels up | Flow G | Low |

Items 1, 2, 9, 10, 11, 13, 14, and 16 are all low-effort and together would remove essentially every credibility gap on the site.

---

## 6. Broken-Promise Inventory

Concrete, verifiable gaps between what the UI says and what the code does. Listed separately because these are cheap to fix and expensive to leave.

| Where | What it claims | Reality |
|---|---|---|
| `signup.ejs:100` | "Send me a daily nudge when my story is ready" (checked by default) | `POST /signup` never reads `nudge`; no email infrastructure exists |
| `login.ejs:44` | "Reading streak and daily reminder" | No reminder of any kind |
| `login.ejs:45` | "Every past story, one tap away" | No route serves any past story |
| `login.ejs:84` | "Sign in with a passkey" | No handler on `#passkeyBtn`, no WebAuthn |
| `login.ejs:106` | "Forgot?" | `href="#"`; no reset flow exists |
| `login.ejs:120`, `signup.ejs:114` | "You agree to our Terms and Privacy Policy" | Both `href="#"` |
| `onboarding.ejs:114` | "We'll lean your stories that way" | Reasons are recorded and never read; stories are identical for all users at a level |
| `dashboard.ejs:25-26` | `Progress`, `Account` nav | `href="#"` |
| `dashboard.ejs:103,143` | "See full progress →", "All stories →" | `href="#"` |
| `dashboard.ejs:147` | Previous-story cards | All link to *today's* story (or to onboarding if no preference is set) |
| `dashboard.ejs:127` | "30-second refresher" | Hardcoded German vocab and German feedback for every user, attributed to stories they never read |
| `dashboard.ejs:93` | "of 7 days read" | Counts page visits, not reads |
| `no-story-today.ejs:32` | "Sign up" | Points to `/sign-up`; 404s |
| `story.ejs:78` | "Sign up" | Points to `/login` |
| `home.ejs:118` | "No sign-up" chip | True for reading; misleading about where the product's value actually accrues |

---

## 7. What Works — Don't Regress It

Worth stating explicitly, because most of this is new since the last analysis and it's genuinely good:

- **Onboarding's self-assessment** — the best solution to CEFR ambiguity available, and it feeds a real preference.
- **The interactive story showcase** — converts skeptics by letting them use the product for free, on the landing page.
- **The signed story-date token** (`storyDateToken`) — a careful, correct solution to a subtle midnight-boundary problem, including the local-vs-UTC calendar bug it documents.
- **The dashboard's degenerate-state handling** — "Today's story is on its way" and "Choose your language to begin" are both better than an error or a blank.
- **"Read in another language today"** — satisfies curiosity without destabilizing a stated preference. A small, thoughtful piece of product design.
- **Level names everywhere** — "Beginner (A1)" on the home page, story page, levels section, and about page, consistently.
- **Per-line translations with a toggle** — comprehension support at exactly the moment of confusion, hidden entirely when unavailable.
- **The score messages** — they coach and route ("drop to an easier level below") rather than just scoring.

---

## 8. Open Questions to Validate with Data

None of these are currently answerable — there is no instrumentation on the site. That is itself the first finding.

- What share of marketing-home visitors reach a story? How many engage the showcase first, and does engaging it raise or lower that rate?
- What share of story readers are anonymous, and how many return anonymously more than once?
- What's the signup → onboarding-completion rate? Where in the four steps do people drop?
- What share of `/:language/:level` hits land on the empty state, and do those users ever come back?
- What's the streak survival curve — day 2, day 7, day 30? What fraction of breaks are "forgot" versus "empty state" versus "session expired by a deploy"?
- How often are the dead dashboard links clicked? (A proxy for how much they cost us in trust.)
- Do quiz scores by level indicate systematic mis-selection — e.g. A1 users at 100% who never move up?
- Does anyone ever change their preferred language or level, given there's no UI for it?
- Do the reasons collected at onboarding correlate with retention, and would acting on them (theme steering at generation time) move it?
