# Veo Video Generation Quick Reference

## Prompt Structure

A complete Veo prompt has these components:
1. **Subject** - Who/what the video is about
2. **Action** - What is happening
3. **Scene/Context** - Where and when
4. **Camera** - Angle and movement
5. **Visual Style** - Lighting, mood, aesthetics

---

## Subject Examples

**People:**
- Generic: "man", "woman", "elderly person"
- Specific: "a seasoned detective", "a joyful baker"
- Mythical: "a mischievous fairy", "a stoic knight"

**Animals:**
- "a playful Golden Retriever puppy"
- "a majestic bald eagle in flight"
- "a miniature dragon with iridescent scales"

**Objects:**
- "a vintage typewriter"
- "a steaming cup of coffee"
- "a classic 1960s muscle car"

---

## Action Keywords

**Basic movements:** walking, running, jumping, flying, dancing, spinning, falling

**Interactions:** talking, laughing, hugging, playing, cooking, building, reading

**Emotional expressions:** smiling, frowning, showing surprise, appearing thoughtful

**Subtle actions:** "gentle breeze ruffling hair", "leaves rustling", "fingers tapping"

**Transformations:** "flower blooming", "ice melting", "sun setting"

---

## Camera Angles

| Angle | Effect | Example |
|-------|--------|---------|
| Eye-level | Neutral, human perspective | "eye-level shot of a woman sipping tea" |
| Low-angle | Subject appears powerful | "low-angle shot of superhero landing" |
| High-angle | Subject appears small/vulnerable | "high-angle shot of child lost in crowd" |
| Bird's-eye | Map-like top-down view | "bird's-eye view of city intersection" |
| Dutch angle | Unease, disorientation | "dutch angle of character running" |
| Close-up | Emphasize emotion/detail | "close-up of character's determined eyes" |
| Wide shot | Establish location | "wide shot of cabin in snowy landscape" |
| Over-shoulder | Conversation framing | "over-the-shoulder during negotiation" |
| POV | Through character's eyes | "POV shot riding a rollercoaster" |

---

## Camera Movements

| Movement | Description | Example |
|----------|-------------|---------|
| Static | No movement | "static shot of serene landscape" |
| Pan | Horizontal rotation | "slow pan left across city skyline" |
| Tilt | Vertical rotation | "tilt down from face to letter" |
| Dolly | Move toward/away | "dolly out to emphasize isolation" |
| Truck | Move sideways | "truck right following character" |
| Zoom | Lens magnification | "slow zoom in on mysterious artifact" |
| Crane | Sweeping vertical | "crane shot revealing battlefield" |
| Aerial | High altitude drone | "sweeping aerial over tropical island" |
| Handheld | Shaky, realistic | "handheld shot during chase scene" |
| Arc | Circular around subject | "arc shot around couple embracing" |

---

## Lighting Keywords

**Natural:** "soft morning sunlight", "overcast daylight", "moonlight", "golden hour"

**Artificial:** "warm fireplace glow", "flickering candlelight", "neon signs"

**Cinematic:** "Rembrandt lighting", "film noir shadows", "high-key bright", "low-key dark"

**Effects:** "volumetric light rays", "backlighting silhouette", "dramatic side lighting"

---

## Visual Style Keywords

**Photorealistic:** "ultra-realistic", "shot on 8K camera", "cinematic film look"

**Animation:** "Japanese anime style", "Pixar-like 3D", "claymation", "stop-motion"

**Artistic:** "in the style of Van Gogh", "surrealist", "Art Deco", "watercolor"

**Period:** "vintage 1920s sepia", "1980s vaporwave", "cyberpunk neon"

---

## Mood/Atmosphere Keywords

| Mood | Keywords |
|------|----------|
| Happy | bright, vibrant, cheerful, uplifting, whimsical |
| Sad | somber, muted colors, slow pace, poignant |
| Suspenseful | dark, shadowy, sense of unease, thrilling |
| Peaceful | calm, tranquil, soft, gentle, meditative |
| Epic | sweeping, majestic, dramatic, awe-inspiring |
| Romantic | soft focus, warm colors, intimate |

---

## Audio (Veo 3.0+)

**Sound effects:** "phone ringing", "water splashing", "clock ticking"

**Ambient noise:** "city traffic", "waves crashing", "office hum"

**Dialogue:** "the man says: Where is the rabbit?"

---

## Temporal Effects

- **Slow-motion:** "slow-motion capture of water droplet"
- **Time-lapse:** "time-lapse of city day to night"
- **Evolution:** "flower slowly unfurling"

---

## Negative Prompts

Use to exclude unwanted elements. Don't use "no" or "don't" - just describe what to exclude.

**Example:** Instead of "no walls", use negative prompt: "wall, frame"

---

## Complete Prompt Examples

### Cinematic Portrait
```
A hyper-realistic, cinematic portrait of a wise shaman. Their weathered
skin is etched with bioluminescent tattoos that pulse with cyan light.
They hold a gnarled wooden staff topped with a floating crystalline
artifact. Close-up shot, dramatic side lighting, shallow depth of field.
```

### Action Scene
```
A gloved hand carefully slices open an ancient leather-bound book. The
hand extracts a tiny metallic data chip. The character's eyes widen in
alarm as a floorboard creaks. Medium shot, low-key lighting, suspenseful
atmosphere.
```

### Environment Shot
```
A rain-slicked street in a forgotten city, shrouded in twilight. Giant
bioluminescent mushrooms cast purple glow on decaying skyscrapers.
Wide establishing shot, volumetric fog, cyberpunk atmosphere.
```

---

## Multi-Shot Scenes with [cut] Tags

Veo supports multiple camera angles within a single video using `[cut]` tags. This creates dynamic, professional-looking videos with 2-3 different shots.

### Cut Tag Format

Start with a base scene description, then add `[cut]` tags for camera changes:

```
[base scene description] [cut] [new angle/shot] [cut] [another angle]
```

### Camera Cut Formulas

| Shot Type | Formula | Example |
|-----------|---------|---------|
| Close-up | `[cut] close up shot of [character]` | `[cut] close up shot of the chef - he is focused` |
| Close-up face | `[cut] close up shot of [character's] face, [emotion]` | `[cut] close up shot of man's face, determined` |
| Over shoulder | `[cut] over the shoulder shot - in front of [character] - [what they see]` | `[cut] over the shoulder shot - in front of the man - an old medieval library` |
| Insert shot | `[cut] insert shot of [item], [camera movement]` | `[cut] insert shot of steaming coffee cup, camera moving right` |
| Aerial | `[cut] aerial shot of [environment], view from above` | `[cut] aerial shot of the busy street market, view from above` |
| Low angle | `[cut] low angle shot - [character + action]` | `[cut] low angle shot - hero stands triumphantly` |
| Front shot | `[cut] front shot: [scene]` | `[cut] front shot: king running down hallway` |
| Back shot | `[cut] shot from behind: [scene]` | `[cut] shot from behind: woman opens the door` |
| Dutch angle | `[cut] dutch shot of [character + action]` | `[cut] dutch shot of girl running through field` |
| Side view | `[cut] [scene], side view` | `[cut] man walking through market, side view` |

### Multi-Shot Examples

**Gamer Scene:**
```
The man is playing a video game on the computer
[cut] close up shot of the man
[cut] over the shoulder shot - in front of the man - his computer
```

**King Scene:**
```
A king is standing on a bridge, looking straight
[cut] over the shoulder shot - in front of the king - the queen waving from below
[cut] close up shot of happy queen's face who is waving
[cut] king jumps over the bridge into the water
```

**Old Man Scene:**
```
A man is looking around
[cut] insert shot of many trash bags everywhere, camera moving right
[cut] aerial shot of the street full of trash bags and the man standing in the middle, view from above
[cut] close up shot of the man - he is really upset
```

---

## Tips for 8-Second Videos

Since Veo outputs ~8 second clips:
- Keep action achievable within 8 seconds
- Design for immediate action start (no slow build)
- Focus on one primary action per scene
- Use pacing instructions: "action happens IMMEDIATELY"
- Include 2-3 `[cut]` tags per scene for dynamic multi-shot videos
