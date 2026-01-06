import { Scene, VoiceMode, Character } from '@/types';

/**
 * Build the full prompt for Seedance video generation via BytePlus API
 * Following Seedance 1.5 Pro guide structure:
 * Subject + Movement + Environment + Camera movement + Aesthetic description + Sound
 */
export function buildSeedancePrompt(
  scene: Scene,
  voiceMode: VoiceMode,
  characters?: Character[],
  language: string = 'english',
  style?: string
): string {
  const parts: string[] = [];

  // Build language directive based on selected language
  const languageUpper = language.toUpperCase();
  const languageDirective = language === 'english'
    ? '[LANGUAGE: ENGLISH ONLY - No Chinese text, signs, or dialogue]'
    : `[LANGUAGE: ${languageUpper} - All dialogue and on-screen text must be in ${languageUpper}. Visual descriptions are in English for AI understanding.]`;
  parts.push(languageDirective);

  // Art Style reference (from script.style)
  if (style) {
    parts.push(`Art Style: ${style}`);
  }

  // Main visual description (already follows Seedance format from updated script generation)
  // This includes: Subject + Movement + Environment + Camera movement
  parts.push(scene.visualDescription);

  // Audio atmosphere (SFX notes)
  if (scene.audioDescription) {
    parts.push(`Audio Atmosphere: ${scene.audioDescription}`);
  }

  // Audio instructions with language-specific dialogue instruction
  const audioMode = voiceMode === 'speech_in_video'
    ? `Include ambient sound effects. All characters speak dialogue in ${languageUpper} language only. ABSOLUTELY NO BACKGROUND MUSIC.`
    : 'Include ambient sound effects only. NO DIALOGUE OR SPEECH OF ANY KIND. ABSOLUTELY NO BACKGROUND MUSIC.';
  parts.push(`AUDIO: ${audioMode}`);

  // Add dialogue for speech-in-video mode with Seedance vocal characteristics
  if (voiceMode === 'speech_in_video') {
    if (scene.dialogue && scene.dialogue.length > 0) {
      // Build character voice profile map
      const voiceProfiles = new Map<string, string>();
      if (characters) {
        for (const char of characters) {
          voiceProfiles.set(char.name.toLowerCase(), char.voiceProfile || '');
        }
      }

      // Build dialogue lines with Seedance vocal characteristics format
      const dialogueLines = scene.dialogue.map(line => {
        const profile = voiceProfiles.get(line.speaker.toLowerCase());
        const profileHint = profile ? ` [voice: ${profile}]` : '';

        // Include optional vocal characteristics from script generation
        const emotionalState = line.emotionalState ? ` (${line.emotionalState})` : '';
        const tone = line.tone ? ` tone:${line.tone}` : '';
        const pace = line.pace ? ` pace:${line.pace}` : '';
        const vocalHints = (emotionalState + tone + pace).trim();

        return `${line.speaker}${profileHint}${vocalHints ? ` ${vocalHints}` : ''}: "${line.text}"`;
      }).join('\n');

      parts.push(`\nDIALOGUE - All speech in ${languageUpper}:\n${dialogueLines}`);
    } else if (scene.voiceoverText?.trim()) {
      // Fallback to voiceoverText if no dialogue
      parts.push(`\nDIALOGUE (speak in ${languageUpper}): "${scene.voiceoverText}"`);
    }
  }

  return parts.join('\n\n');
}
