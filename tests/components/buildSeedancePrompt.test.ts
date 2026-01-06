import { Scene, VoiceMode, Character } from '@/types';

/**
 * Build the full prompt for Seedance video generation
 * CRITICAL: Must include language directive to prevent Chinese dialogue (Seedance is ByteDance model)
 */
function buildSeedancePrompt(
  scene: Scene,
  voiceMode: VoiceMode,
  characters?: Character[]
): string {
  // Start with language directive - CRITICAL for preventing Chinese
  let prompt = `[LANGUAGE: ENGLISH ONLY - No Chinese text, signs, or dialogue]\n\n`;

  // Add visual and audio description
  prompt += `${scene.visualDescription}. ${scene.audioDescription || ''} ${scene.cameraShot || ''}`.trim();

  // Add audio instructions
  const audioMode = voiceMode === 'speech_in_video'
    ? 'Include ambient sound effects. All characters speak dialogue in ENGLISH language only - NO CHINESE. ABSOLUTELY NO BACKGROUND MUSIC.'
    : 'Include ambient sound effects only. NO DIALOGUE OR SPEECH OF ANY KIND. ABSOLUTELY NO BACKGROUND MUSIC.';

  prompt += `\n\nAUDIO: ${audioMode}`;

  // Add dialogue for speech-in-video mode
  if (voiceMode === 'speech_in_video') {
    if (scene.dialogue && scene.dialogue.length > 0) {
      // Build character voice profile map
      const voiceProfiles = new Map<string, string>();
      if (characters) {
        for (const char of characters) {
          voiceProfiles.set(char.name.toLowerCase(), char.voiceProfile || '');
        }
      }

      // Build dialogue lines
      const dialogueLines = scene.dialogue.map(line => {
        const profile = voiceProfiles.get(line.speaker.toLowerCase());
        const profileHint = profile ? ` (voice: ${profile})` : '';
        return `${line.speaker}${profileHint}: "${line.text}"`;
      }).join('\n      ');

      prompt += `\n\nDIALOGUE - CRITICAL: All speech must be in ENGLISH language only:\n      ${dialogueLines}`;
    } else if (scene.voiceoverText?.trim()) {
      // Fallback to voiceoverText if no dialogue
      prompt += `\n\nDIALOGUE (speak in English): "${scene.voiceoverText}"`;
    }
  }

  return prompt;
}

describe('buildSeedancePrompt', () => {
  const baseScene: Scene = {
    id: 1,
    timeRange: '00:00 - 00:04',
    visualDescription: 'A woman stands in the rain',
    audioDescription: 'Rain falling, city ambiance',
    cameraShot: 'Close Up',
    voiceoverText: 'She waited for him',
  };

  describe('Language directive', () => {
    it('should always start with English-only language directive', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toMatch(/^\[LANGUAGE: ENGLISH ONLY/);
      expect(prompt).toContain('No Chinese text, signs, or dialogue');
    });

    it('should include language directive for speech_in_video mode', () => {
      const prompt = buildSeedancePrompt(baseScene, 'speech_in_video');
      expect(prompt).toMatch(/^\[LANGUAGE: ENGLISH ONLY/);
    });
  });

  describe('Visual and audio description', () => {
    it('should include visualDescription', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('A woman stands in the rain');
    });

    it('should include audioDescription', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('Rain falling, city ambiance');
    });

    it('should include cameraShot', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('Close Up');
    });

    it('should handle missing audioDescription', () => {
      const scene = { ...baseScene, audioDescription: undefined };
      const prompt = buildSeedancePrompt(scene, 'tts');
      expect(prompt).toContain('A woman stands in the rain');
      expect(prompt).not.toContain('undefined');
    });

    it('should handle missing cameraShot', () => {
      const scene = { ...baseScene, cameraShot: undefined };
      const prompt = buildSeedancePrompt(scene, 'tts');
      expect(prompt).toContain('A woman stands in the rain');
      expect(prompt).not.toContain('undefined');
    });
  });

  describe('TTS mode (no dialogue in video)', () => {
    it('should include NO DIALOGUE instruction', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('NO DIALOGUE OR SPEECH OF ANY KIND');
    });

    it('should include NO BACKGROUND MUSIC instruction', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('ABSOLUTELY NO BACKGROUND MUSIC');
    });

    it('should NOT include dialogue section even if scene has dialogue', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Hana', text: 'Hello there' }],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'tts');
      expect(prompt).not.toContain('DIALOGUE - CRITICAL');
      expect(prompt).not.toContain('Hello there');
    });
  });

  describe('Speech in video mode', () => {
    it('should include ENGLISH dialogue instruction', () => {
      const prompt = buildSeedancePrompt(baseScene, 'speech_in_video');
      expect(prompt).toContain('ENGLISH language only - NO CHINESE');
    });

    it('should include dialogue lines when scene has dialogue', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [
          { speaker: 'Hana', text: 'I missed you' },
          { speaker: 'Ren', text: 'I came as fast as I could' },
        ],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video');
      expect(prompt).toContain('DIALOGUE - CRITICAL: All speech must be in ENGLISH');
      expect(prompt).toContain('Hana: "I missed you"');
      expect(prompt).toContain('Ren: "I came as fast as I could"');
    });

    it('should include character voice profiles when provided', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Hana', text: 'I missed you' }],
      };
      const characters: Character[] = [
        { id: '1', name: 'Hana', gender: 'female', voiceName: 'Aoede', voiceProfile: 'soft and emotional' },
      ];
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video', characters);
      expect(prompt).toContain('Hana (voice: soft and emotional): "I missed you"');
    });

    it('should fallback to voiceoverText when no dialogue', () => {
      const sceneNoDialogue: Scene = {
        ...baseScene,
        dialogue: [],
        voiceoverText: 'The rain continued to fall',
      };
      const prompt = buildSeedancePrompt(sceneNoDialogue, 'speech_in_video');
      expect(prompt).toContain('DIALOGUE (speak in English): "The rain continued to fall"');
    });

    it('should not add dialogue section when no dialogue and no voiceoverText', () => {
      const sceneEmpty: Scene = {
        ...baseScene,
        dialogue: [],
        voiceoverText: '',
      };
      const prompt = buildSeedancePrompt(sceneEmpty, 'speech_in_video');
      expect(prompt).not.toContain('DIALOGUE - CRITICAL');
      expect(prompt).not.toContain('DIALOGUE (speak in English)');
    });
  });

  describe('Full prompt structure', () => {
    it('should have correct structure for TTS mode', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');

      // Check order: language directive -> description -> audio instructions
      const languageIndex = prompt.indexOf('[LANGUAGE:');
      const descIndex = prompt.indexOf('A woman stands in the rain');
      const audioIndex = prompt.indexOf('AUDIO:');

      expect(languageIndex).toBeLessThan(descIndex);
      expect(descIndex).toBeLessThan(audioIndex);
    });

    it('should have correct structure for speech_in_video mode with dialogue', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Hana', text: 'Hello' }],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video');

      // Check order: language directive -> description -> audio instructions -> dialogue
      const languageIndex = prompt.indexOf('[LANGUAGE:');
      const descIndex = prompt.indexOf('A woman stands in the rain');
      const audioIndex = prompt.indexOf('AUDIO:');
      const dialogueIndex = prompt.indexOf('DIALOGUE - CRITICAL');

      expect(languageIndex).toBeLessThan(descIndex);
      expect(descIndex).toBeLessThan(audioIndex);
      expect(audioIndex).toBeLessThan(dialogueIndex);
    });
  });

  describe('Chinese prevention (regression test)', () => {
    it('should explicitly mention NO CHINESE in speech_in_video audio instructions', () => {
      const prompt = buildSeedancePrompt(baseScene, 'speech_in_video');
      expect(prompt).toContain('NO CHINESE');
    });

    it('should mention ENGLISH multiple times for emphasis', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Hana', text: 'Hello' }],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video');

      // Count occurrences of ENGLISH (case insensitive)
      const englishMatches = prompt.match(/ENGLISH/gi) || [];
      expect(englishMatches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
