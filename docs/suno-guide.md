# Suno Music Generation Quick Reference

## Core Principles

1. **Suno maps text to probability space** - it blends styles that co-occurred in training data
2. **Pop is a gravity well** - nearly every genre pulls toward pop unless constrained
3. **Use structured prompts** - categorical metadata works better than prose
4. **Use "and" not commas** - commas signal optional elements, "and" makes elements essential

---

## Prompt Format (Recommended)

```
genre: "indie folk pop with acoustic elements and feel-good vibes".
instrumentation: "acoustic guitar and light percussion and bass and subtle keys".
production: "warm organic mix and natural reverb and balanced dynamics".
mood: "cheerful and laid-back and friendly".
```

**Key rules:**
- End each section with a period
- Use "and" to connect essential elements
- Use quotes around descriptors
- Keep it metadata-like, not prose

---

## Content-Type to Genre Mapping

| Content Type | Genre/Style | Instrumentation |
|-------------|-------------|-----------------|
| Casual/Food/BBQ/Vlog | Indie Folk Pop | Acoustic guitar, light percussion, hand claps |
| Travel/Adventure | Indie Pop with World influences | Acoustic guitar, world percussion, synth pads |
| Lifestyle/Fashion | Modern Pop | Synth bass, electronic drums, vocal chops |
| Sports/Fitness | Electronic Rock | Powerful drums, distorted bass, synth stabs |
| Nature/Wildlife | Ambient | Soft piano, ambient pads, subtle strings |
| Epic/Cinematic | Orchestral Trailer | Full orchestra, choir, massive drums |
| Dark/Mystery | Dark Atmospheric | Low strings, dark pads, sparse piano |
| Uplifting/Celebration | Pop Rock | Guitars, driving drums, bright synths |
| Emotional/Dramatic | Cinematic Piano | Piano, strings, subtle percussion |
| Calm/Meditation | Ambient Minimalist | Soft piano, gentle strings, ambient textures |
| Retro/80s | Synthwave | Analog synths, drum machines, arpeggiated leads |
| Urban/Tech/Corporate | Modern Electronic | Synthesizers, electronic drums, bass pulses |

---

## Style Tags (Use "and" Connector)

**Format:** `Style1 and Style2 and Style3 and Style4 and Instrumental`

**Examples:**
- Casual: `Indie Folk and Acoustic and Feel-Good and Upbeat and Instrumental`
- Epic: `Epic and Orchestral and Cinematic and Dramatic and Instrumental`
- Travel: `Indie Pop and Adventure and Uplifting and World and Instrumental`

**Always include "Instrumental"** for background music without vocals.

---

## Avoiding Common Problems

### Escape Pop Gravity
- Use explicit exclusions: "no pop" in Exclude Styles
- Combine unusual genres: "emo industrial", "math rock gospel"
- Be specific: "80s dark synthwave" not just "electronic"

### Avoid Generic Saw Synths
Use specific synthesis types instead:
- "FM synthesis bass" instead of "synth bass"
- "Wavetable movement" instead of "big bass"
- "Evolving modulation" and "LFO-driven movement"

### Prevent Lyric Bleed
- Keep prompts metadata-like (not poetic)
- Avoid short phrases that could be sung
- Use dense technical descriptions

---

## Quick Reference by Scene Type

### Outdoor/Casual Scene
```
genre: "indie folk pop with acoustic elements and feel-good vibes".
instrumentation: "acoustic guitar and light percussion and bass with hand claps".
mood: "cheerful and laid-back and friendly".
```

### Action/Sports Scene
```
genre: "electronic rock with driving beats and motivational energy".
instrumentation: "powerful drums and distorted bass and synth stabs".
mood: "energetic and powerful and motivational".
```

### Emotional/Dramatic Scene
```
genre: "emotional cinematic with piano-driven melodies and strings".
instrumentation: "piano and strings and subtle percussion and ambient pads".
mood: "emotional and heartfelt and moving".
```

### Nature/Documentary Scene
```
genre: "ambient with organic textures and atmospheric soundscapes".
instrumentation: "soft piano and ambient pads and subtle strings".
mood: "serene and majestic and contemplative".
```

### Tech/Modern Scene
```
genre: "modern electronic with cinematic elements and sleek production".
instrumentation: "synthesizers and electronic drums and bass pulses".
mood: "modern and professional and sophisticated".
```
