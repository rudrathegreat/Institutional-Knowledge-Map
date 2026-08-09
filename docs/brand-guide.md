# Institutional Expertise Navigator — Minimal MVP Brand Guide

## 1. Design Direction

The MVP should feel like a **minimal search engine for research expertise**.

The visual inspiration is the restraint of modern search and AI interfaces such as Google Search, ChatGPT, and Claude, without copying their branding or proprietary visual identity.

The desired qualities are:

- simple;
- quiet;
- spacious;
- precise;
- credible;
- fast;
- academic;
- human-centred.

The primary interaction is:

> **Search for expertise.**

The interface should visually reinforce that simplicity.

---

## 2. Core Principle

> **The search bar is the primary product interaction.**

Anything that competes visually with the search input or results should be removed.

Do not design a dashboard.

Do not design a chatbot.

Do not design a social network.

---

## 3. MVP Screen Structure

The primary search experience uses this state flow:

```text
Initial search state
        ↓
Searching state
        ↓
Results state
        ↓
New search
```

Use a restrained persistent header with Search, People, and Network navigation. Do not add a persistent navigation sidebar.

---

## 4. Initial Screen

Recommended structure:

```text
                 Expertise Navigator


               Who should I talk to?

  ┌──────────────────────────────────────────────┐
  │ Search a person, topic, or ask a question… │
  └──────────────────────────────────────────────┘
```

Optional small example queries may appear beneath the input:

```text
pulsar timing · MeerKAT · Bayesian modelling
```

Keep the page visually sparse.

---

## 5. Colour System

Use a neutral palette.

### Light mode

```text
Background             #FFFFFF
Subtle background      #F7F7F5
Primary text           #1F1F1F
Secondary text         #6B6B6B
Muted text             #8A8A8A
Border                 #E5E5E2
Hover surface          #F2F2EF
```

### Accent

Use one restrained accent.

Recommended:

```text
Accent                  #5B5BD6
Accent hover            #4C4CC4
Accent subtle           #EEEEFF
```

Use accent only for:

- input focus;
- links/actions;
- subtle highlights;
- loading/progress elements.

Avoid large accent-coloured surfaces.

---

## 6. Dark Mode

Dark mode is optional.

Do not delay the MVP to implement it.

If included:

```text
Background             #181818
Surface                #212121
Primary text           #F3F3F3
Secondary text         #B4B4B4
Border                 #343434
Hover surface          #292929
```

---

## 7. Typography

Use one neutral sans-serif family.

Recommended:

```text
Inter
```

Fallback:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

No decorative display font is required.

---

## 8. Type Scale

Suggested:

```text
Product name            14–16 px / medium
Hero question           32–40 px / semibold
Researcher name         18–20 px / semibold
Role/title              14–15 px / regular
Body                    15–16 px / regular
Metadata                13–14 px / regular
```

Use sentence case.

Avoid all-caps UI headings.

---

## 9. Search Container

Recommended maximum width:

```text
720–820 px
```

The search interface should sit near the visual centre of the initial screen.

Desktop horizontal page padding:

```text
24–32 px
```

Mobile:

```text
16–20 px
```

---

## 10. Search Input

The search input is the signature component.

It should:

- be large enough for natural-language questions;
- start as a single-line field;
- expand modestly for longer queries if needed;
- have a subtle neutral border;
- use restrained corner rounding;
- show a clear keyboard focus state.

Suggested:

```text
Minimum height        54–60 px
Border radius         12–16 px
Border                1 px neutral
Shadow                none or extremely subtle
```

Placeholder:

```text
Search a person, topic, method, or ask a question…
```

Do not use chatbot wording such as:

```text
Message the AI…
Ask me anything…
```

---

## 11. Search Action

The submit action should be visually restrained.

Acceptable options:

- search icon button inside the input;
- small `Search` button beside/below the field;
- Enter key submission.

Avoid a large promotional CTA.

---

## 12. Searching State

Use a simple loading message:

```text
Searching expertise…
```

or a small spinner.

Do not use:

- fake typing;
- streaming conversational prose;
- bouncing AI dots styled as a chat reply;
- avatars.

---

## 13. Results Layout

Results should appear directly beneath or replace the initial empty space below the search bar.

Use a clean vertical list.

Example:

```text
Daniel Brooks
Research Fellow

Pulsars · Radio Astronomy · Scintillation

Why this person may be relevant
Their profile includes work on pulsars and interstellar scintillation,
which overlaps directly with your query.

────────────────────────────────────────────

Maya Chen
Senior Research Fellow

Pulsars · Pulsar Timing · Time-Series Analysis

Why this person may be relevant
...
```

Prefer separators or very subtle containers over heavy cards.

---

## 14. Researcher Result Hierarchy

Each result should visually prioritise:

1. researcher name;
2. title/role;
3. relevant expertise;
4. explanation.

Do not add unnecessary metadata.

---

## 15. Expertise Labels

Short expertise labels may appear as lightweight text or subtle chips.

Example:

```text
Pulsars · Radio Astronomy · Scintillation
```

Prefer inline metadata over a large collection of colourful pills.

If chips are used:

- neutral background;
- small radius;
- no strong colours;
- 12–13 px text.

---

## 16. AI Explanation

Use the label:

```text
Why this person may be relevant
```

The explanation should visually appear as supporting text.

Do not label it prominently as:

```text
AI analysis
AI recommendation
AI says
```

The technology should stay in the background.

---

## 17. No Numerical Scores

Do not display:

```text
92% match
Expert score: 8.7
Top 1%
```

The product finds relevant people; it does not rank human quality.

---

## 18. Empty Results

Use simple text:

```text
No strong matches found.

Try a broader topic, method, instrument, or describe the problem
in different words.
```

No illustration is required.

---

## 19. Error State

Example:

```text
AI interpretation was unavailable.
Showing directory-keyword matches instead.
```

Keep errors calm and actionable.

---

## 20. Motion

Use minimal motion only.

Acceptable:

- 100–200 ms hover transitions;
- input focus transition;
- subtle loading indicator;
- gentle appearance of results.

Avoid decorative page animations.

---

## 21. Icons

Use icons sparingly.

If required, use one outline icon library such as Lucide.

Likely required icons:

- search;
- external/open action if later needed;
- loading indicator.

Do not add icons to every label.

---

## 22. Responsive Design

The search and results must work on desktop, tablet, and mobile.

On mobile:

- use a single column;
- maintain comfortable side padding;
- keep the search input full width;
- stack result content naturally.

Keep the same compact Search, People, and Network links on mobile; no separate menu is required.

### Network surface

Keep the network quiet and functional rather than decorative:

- use equal-sized person nodes so size does not imply seniority or influence;
- use restrained edge widths to indicate relative shared-expertise strength;
- highlight only the selected person or edge and its immediate neighbourhood;
- pair the canvas with a compact evidence inspector and name-based navigation;
- state clearly that an edge does not establish collaboration or reporting lines.

---

## 23. Accessibility

Minimum requirements:

- WCAG AA text contrast;
- visible keyboard focus;
- semantic form label;
- Enter-to-search support;
- correctly labelled buttons;
- screen-reader-readable loading and error states;
- an HTML path for finding people and traversing network connections without relying on the canvas;
- no colour-only meaning.

---

## 24. Writing Style

Copy should be:

- concise;
- direct;
- non-promotional;
- easy to understand.

Preferred:

```text
Who should I talk to?
```

Preferred:

```text
Why this person may be relevant
```

Avoid:

```text
Unlock institutional intelligence with AI
```

Avoid:

```text
Discover the power of your research network
```

---

## 25. Explicit Visual Non-Goals

Do not build:

- dashboard cards;
- persistent navigation sidebars;
- social-network or organisational-status styling;
- topic or knowledge nodes;
- feeds;
- social UI;
- chat bubbles;
- AI avatars;
- gradients;
- glassmorphism;
- neon effects;
- animated backgrounds;
- large illustrations;
- marketing sections.

---

## 26. Final Design Test

Before accepting the MVP interface, ask:

> **Does this feel like the fastest possible way to type a research problem and find a person?**

If an element does not help with:

- entering the query;
- understanding the returned people;
- understanding why they are relevant;

remove it.

The intended experience is:

```text
search
→ people
→ relevance
```

Nothing more.
