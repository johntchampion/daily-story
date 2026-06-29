# Daily Story — User Stories & Flow Analysis

This document maps **every way a user can enter, move through, and leave the site**, and examines what they understand (and misunderstand) at each step. The goal is to surface friction, confusion, and missed opportunities so we can optimize for **discovery → comprehension → engagement → return**.

It is written from the perspective of a first-time visitor who has *no prior context*, since that is the hardest and most common case for a site trying to grow.

---

## 1. The Routes (What Actually Exists)

| Route | What it renders | Notes |
|---|---|---|
| `GET /` | `home.ejs` — title, subtitle, "Learn more" link, language dropdown, level dropdown, "Get Today's Story" button | The intended front door |
| `GET /about` | `about.ejs` — what/how/CEFR explainer, tips, open-source link, CTAs | The explainer |
| `GET /:language/:level` | `story.ejs` (if a story exists) **or** `no-story-today.ejs` (if not) | The actual product / the dead-end |
| `GET /:language/:level` (invalid lang or level) | `error.ejs` with status 400 | Edge case |
| `GET /generate-stories` | Plain-text admin output | Not user-facing; should never be linked publicly |
| Any unknown URL | `error.ejs` with status 404 | Edge case |
| Server failure | `error.ejs` with status 500 | Edge case |

**Key architectural facts that shape every flow:**

- **No persistence of choices.** There is no `localStorage`, no cookie, no account. The site never remembers the language/level a user picked. Every return visit starts from zero unless the user bookmarked a deep link.
- **The retention mechanism is a manual bookmark.** The only prompt to come back is a line of text ("Bookmark this page and come back tomorrow") on the story page. Nothing enforces or assists this.
- **Content is the same for everyone and resets daily.** A `/:language/:level` URL is stable — it always shows "today's" story for that combo — which makes it a *good* thing to bookmark, but the user is never told *why* the URL is safe to bookmark.
- **Pages have almost no shared navigation.** There's no header/nav bar. Movement between pages depends on the specific footer links each template happens to include.

---

## 2. Entry Points & First Impressions

People do not all arrive at `/`. The entry point dramatically changes first impression and the odds of activation.

### 2.1 Entry: Home page (`/`)

**Who:** Someone who typed the domain, clicked a generic link, or found the site listed somewhere.

**What they see:** "Daily Story" + one-line subtitle ("Read a daily story in the language you're learning at your skill level.") + two dropdowns + a button.

**First impressions:**
- ✅ The subtitle is clear and does its job in one sentence. A user *probably* gets the concept: pick a language, pick a level, read a story.
- ⚠️ **There is no preview of the actual product.** They have to commit (two selections + a click) before seeing a single piece of content. There's no example story, no screenshot, no sample sentence. This is a blind leap of faith for a stranger.
- ⚠️ **The level dropdown assumes CEFR literacy.** "A1 / A2 / B1 / B2" under "Early" / "Intermediate" headings means nothing to a casual learner (e.g., a Duolingo user who has never heard of CEFR). The explanation exists only on `/about`, which is one extra click away and easy to skip. A user who doesn't know their level may bounce or guess wrong.
- ⚠️ **No social proof, no "why this exists," no sense of scale.** Nothing tells them it's free, that there's a fresh story every day, or how long a session takes.

**Confusion risks:**
- "What level am I?" — the single biggest friction point on this page.
- "Is this free? Do I need an account?" — unstated (the answer is yes/no, which is great, but they don't know that).
- "What does a 'story' actually look like?" — they can't tell it's a chat-style conversation, not prose.

**The decision they must make to activate:** Two dropdown selections + a click. Both selections are *required* (the button does nothing if either is empty, with no error message — a silent dead click).

### 2.2 Entry: Deep link to a story (`/spanish/a1`)

**Who:** Someone who clicked a shared link, opened their own bookmark (a returning user), or followed a link from social/a friend.

**What they see (story exists):** Immediately, the actual product — a titled, dated, chat-style story, a "try other levels" block, and a 3-question quiz. **This is the best possible first impression** because they see value instantly with zero setup.

**First impressions:**
- ✅ Instant value. No forms, no friction. They land *in* the content.
- ✅ The date stamp + "come back tomorrow" line communicates the daily-habit model in context.
- ⚠️ **But they have no idea what site this is or what else it offers.** There's no header, no logo-as-home-link, no "browse other languages." If they didn't choose this language/level themselves (e.g., a friend sent `/german/b2` but they want French), the only path to change it is the small "Select Language & Skill Level" footer link.
- ⚠️ **A returning bookmarker who improved their skill is stuck.** If someone bookmarked `/spanish/a1` and is now ready for A2, the only nudge is the "Try Other Skill Levels" block — good, but it's mid-page and only appears if those other levels were generated.

**Confusion risks:**
- "Wait, is this a chat? A story? A lesson?" — the conversational format may surprise someone expecting prose.
- "Can I change the language?" — possible, but not obvious.
- For a brand-new visitor arriving here cold: "What is Daily Story? Is this a one-off or a service?"

### 2.3 Entry: Deep link to a story that doesn't exist yet (`no-story-today.ejs`)

**Who:** Same as above, but they arrived before today's batch was generated, or for a combo that failed to generate.

**What they see:** "No Story Available Today" + date + "A story hasn't been generated for today. Try checking again later!" + a single "Select Language & Skill Level" link.

**First impressions:**
- 🚨 **This is the worst-case first impression and a likely hard bounce.** A stranger who clicked a shared link lands on an apologetic empty page. They have no reason to believe the site is alive or worth returning to.
- 🚨 **It's a near dead-end.** The only action is going to the home page — but every other language/level *also* won't have a story if today's batch hasn't run, so the home page leads right back here. There's no fallback to yesterday's story, no sample, no "here's what a story looks like."
- ⚠️ This page also has **no analytics** (no PostHog snippet), so we are currently blind to how often this happens and how many people it costs us.

**Confusion risks:**
- "Is this site broken / abandoned?"
- "Should I really 'check back later'? Why would I?"

### 2.4 Entry: About page (`/about`)

**Who:** Someone who clicked "Learn more about Daily Story" from home, or was linked directly.

**What they see:** A genuinely good explainer — what it is, a 4-step "how it works," the CEFR levels with examples, usage tips, and an open-source note.

**First impressions:**
- ✅ This page does almost everything the home page *doesn't*: it explains levels, sets expectations, and gives a mental model. It is arguably the strongest single page for converting a curious stranger.
- ⚠️ **It's optional and downstream.** Most home-page visitors will never click into it. The most valuable explanatory content (especially "which level am I?") is hidden one click deep.
- ⚠️ The "Go Back" button uses `history.back()`, so a user who *entered directly* on `/about` (no history) gets a button that may do nothing — a small dead click.

### 2.5 Entry: Error pages (404 / 400 / 500)

**Who:** Someone with a typo'd URL, a stale/changed link, an unsupported language or level (`/klingon/a1`, `/spanish/c1`), or a server hiccup.

**What they see:** A large status code, a short message, optional details (dev only), and "Go Back Home."

**First impressions:**
- ✅ Clean and not scary. The 400 page for bad language/level even lists what *is* supported.
- ⚠️ These pages have **no PostHog**, so bad inbound links (which are a discovery signal) are invisible to us.
- ⚠️ "Go Back Home" sends them to the same form-first home page rather than recovering gracefully (e.g., "Did you mean Spanish A1?").

---

## 3. Core User Flows (Step by Step)

### Flow A — The Ideal New User (Home → Activate → Engage)

1. Lands on `/`. Reads subtitle, understands the gist.
2. Picks a language. **Pauses at level** — may or may not know what A1–B2 mean.
3. Picks a level (correctly, ideally) and clicks "Get Today's Story."
4. Lands on the story. Reads the chat. Possibly tries the quiz.
5. Gets a score; if perfect, sees the emoji celebration (a small delight moment).
6. Reads "Bookmark this page and come back tomorrow."
7. **Activation hinges entirely on whether they bookmark.** Nothing else captures them.

**Where this flow leaks:**
- Step 2–3: level confusion → wrong level → story too hard/easy → disengagement.
- Step 4: conversational format surprise; no instructions on *how* to use the quiz.
- Step 7: bookmarking is a high-friction, easily-forgotten manual action. No account, email, push, or reminder backs it up. **This is the single biggest retention leak in the entire product.**

### Flow B — The Returning User (the intended habit loop)

1. Opens their bookmark `/spanish/a1` the next day.
2. Sees a *new* story for today (good — the URL is date-aware).
3. Reads, quizzes, leaves.

**Where this flow leaks:**
- They had to *remember* to come back and *have kept* the bookmark. Anyone who closed the tab without bookmarking is lost forever — we have no way to reach them again.
- If they leveled up, they may not realize they can/should move to A2 (the "Try Other Levels" block helps but is passive).
- If today's batch hasn't run when they visit, they hit "No Story Available Today" — a returning fan gets punished and may not return again.

### Flow C — The Shared-Link Visitor (viral / word-of-mouth)

1. Friend sends `/french/b1`.
2. They land directly in a story (great) **or** on "No Story Available Today" (terrible).
3. If engaged, they must self-discover the home page to change language or learn what the site is.

**Where this flow leaks:**
- No "What is this?" framing on the story page for someone who didn't choose to be there.
- Wrong language for the recipient → they must hunt for the home link.
- The empty-state case turns a warm referral into a cold bounce.

### Flow D — The Curious Researcher (Home → About → back)

1. From home, clicks "Learn more."
2. Reads the about page, understands levels and the daily model.
3. Clicks "Get Started" → back to home → must *re-make* both selections (the about page didn't carry intent).

**Where this flow leaks:**
- The about page can't deep-link someone into a sensible default (e.g., it can't say "Start with Spanish A1" as a live link tailored to them). "Get Started" just returns to the blank form.

### Flow E — The Quiz-Focused User

1. On a story, scrolls to the quiz, answers 3 shuffled questions.
2. Gets immediate green/red feedback; wrong answers reveal the correct one.
3. Perfect score → celebration animation.

**Strengths:** Immediate feedback, no penalty for exploring, the shuffle prevents position-memorization, and the celebration is a nice reward.

**Where this flow leaks:**
- Results are **not persisted** — no streak, no history, no "you've completed 5 stories." There's no accumulating sense of progress to pull them back.
- Early levels (A1/A2) have English questions; intermediate (B1/B2) have target-language questions. A user moving up levels isn't warned the questions will switch languages.

---

## 4. Cross-Cutting Friction Themes

These recur across multiple flows and are the highest-leverage areas:

1. **No memory of the user's choice.** Re-selecting language + level on every visit is pure friction. A returning user with no bookmark effectively re-onboards every time. *Even a single `localStorage` remembering the last selection (and redirecting `/` straight to it, or pre-filling the dropdowns) would meaningfully cut friction.*

2. **Bookmarking is the only retention hook, and it's weak.** No email capture, no optional account, no push, no calendar/reminder, no PWA "add to home screen" prompt. Anyone who doesn't manually bookmark is unreachable. This caps the entire growth model.

3. **Level ambiguity at the moment of choice.** CEFR is explained only on `/about`. At the point of decision (the home dropdown), there's zero inline help. A "Not sure? Take a 20-second placement" or even a one-line tooltip per level would reduce mis-selection and bounce.

4. **No content preview before commitment.** Strangers must commit blind. A sample story snippet on the home/about page would convert skeptics.

5. **The empty state is a silent killer.** "No Story Available Today" is a dead-end with no analytics, no fallback content, and no reason to return. It can poison first impressions for shared links and punish loyal returners. *Falling back to the most recent available story (clearly labeled) would nearly eliminate this failure.*

6. **No persistent navigation / sense of place.** Deep-link visitors don't know what the site is or how to explore it. A minimal header (logo→home, "Languages," "About") would orient everyone regardless of entry point.

7. **No progress or accomplishment system.** Quiz scores evaporate. There are no streaks, counts, or milestones — the classic engagement levers for daily-habit products are entirely absent.

8. **Analytics blind spots.** The home page tracks little; the no-story, error, and (depending) about flows lack the scroll/quiz instrumentation the story page has. We can't currently measure activation rate (home → story), level-selection drop-off, or empty-state frequency — the exact numbers needed to prioritize the above.

---

## 5. Optimization Opportunities (Mapped to Flows)

Prioritized roughly by impact on *discovery → engagement → return*:

| # | Opportunity | Fixes which flow/friction | Effort |
|---|---|---|---|
| 1 | **Remember last language/level** (localStorage); offer a "Continue with Spanish A1" shortcut on home | B, A re-onboarding; Friction #1 | Low |
| 2 | **Fallback to most recent story** instead of the empty state, clearly labeled "Yesterday's story" | 2.3, B, C; Friction #5 | Low–Med |
| 3 | **Inline level guidance** at the point of choice (tooltips / a short placement helper) | 2.1, A step 2–3; Friction #3 | Low–Med |
| 4 | **Add a minimal header/nav** present on every page | 2.2, C; Friction #6 | Low |
| 5 | **Strengthen the return hook** beyond bookmarking: PWA "add to home screen," optional email reminder, or `.ics`/calendar nudge | A step 7, B; Friction #2 | Med |
| 6 | **Show a sample story** on home/about so strangers see value before committing | 2.1; Friction #4 | Low |
| 7 | **Progress signals**: streaks, stories-read count, quiz history (needs light persistence) | E; Friction #7 | Med–High |
| 8 | **Instrument the gaps**: PostHog on no-story/error pages; funnel events for home→story activation and level-selection drop-off | Friction #8 | Low |
| 9 | **Frame the product on the story page** for cold arrivals (a subtle "New here? What is Daily Story?" affordance) | 2.2, C | Low |
| 10 | **Fix silent dead clicks**: empty-form submit feedback on home; `history.back()` fallback on about | 2.1, 2.4 | Low |

---

## 6. Open Questions to Validate with Data / Users

- What % of home-page visitors actually submit the form? (activation rate)
- What % of `/:language/:level` hits land on the empty state? (severity of #2/#5)
- How many sessions are first-time vs. returning, given we can only infer returns from bookmarked deep links?
- Do users who hit the empty state ever come back?
- Which levels are most mis-selected (e.g., bounce immediately after landing on a too-hard story)?
- Does the conversational/chat format meet or violate the expectation set by the word "story"?
