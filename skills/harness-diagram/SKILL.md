---
name: harness-diagram
description: >-
  Generate or refresh bilingual CN+EN Harness Book process diagrams for
  notes/pm-learning/assets. Use when adding a lesson figure, regenerating a
  cream/ivory/dark diagram to the locked white textbook style, or when the user
  asks how course diagrams should look.
---

# Harness diagram style (locked)

Public course figures under `notes/pm-learning/assets/` share one locked look.
Do **not** invent a new palette per lesson.

## Required look

| Rule | Value |
|---|---|
| Background | **Pure white** `#FFFFFF` — never cream, ivory, beige, parchment, or dark navy |
| Style | Flat vector textbook / educational infographic |
| Aspect | **16:9** (typical 1280×720) |
| Language | **Bilingual CN + EN** on every box, title, and footer |
| Accents | Blue (tools/inputs), purple (gates/control), green (eval/success) |
| Contrast | High; dark text on white; thin black connectors |
| Icons | Simple flat line/fill icons matching box color |
| Forbidden | Photorealism, heavy drop shadows, 3D clay, noisy textures, brand logos of real companies |

## Prompt skeleton (copy & fill)

```text
Flat vector textbook process diagram, PURE WHITE background #FFFFFF, 16:9,
high contrast, bilingual CN+EN labels on EVERY box and title.
Title: <中文标题> / <English Title>.
Layout: <left-to-right stages | hub-and-spoke | checklist>.
Stage/boxes:
  1) <blue> <CN/EN labels + bullets>
  2) <purple> ...
  3) <green> ...
Optional success banner (green check): <Success = ... / 成功 = ...>
Optional dashed Out of scope / 不做: <items>
No cream/beige/ivory/dark background, no photorealism, no heavy shadows,
clean sans-serif, flat icons only.
```

Pass a recent good figure (e.g. `harness-set-clerk.jpg`) as `reference_image_paths` when regenerating so style stays stable.

## Do / Don't

**Do**

- Keep filenames stable (`harness-<topic>.jpg`) so markdown links keep working
- Match the lesson's taught terms (skill names, `stop_reason` codes)
- Prefer regenerating cream/ivory/dark legacy art over leaving mixed styles

**Don't**

- Put real company brands, private product names, secrets, or absolute home paths in art
- Use warm paper backgrounds "for warmth"
- Ship English-only or Chinese-only boxes

## Where files live

- Assets: `notes/pm-learning/assets/harness-*.jpg`
- Lesson notes reference them with relative `./assets/...` paths
- Style note also recorded in `OPEN_SOURCE.md` (diagram style locked)

## Acceptance checklist

- [ ] Pure white background (corner sample ≈ 255,255,255)
- [ ] Every major label has CN and EN
- [ ] 16:9 flat vector
- [ ] Topic matches the lesson markdown
- [ ] Filename unchanged if replacing
