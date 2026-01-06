import { buildSeedancePrompt } from '@/utils/seedancePrompt';
import { Scene, Character } from '@/types';

describe('buildSeedancePrompt', () => {
  const baseScene: Scene = {
    id: 1,
    timeRange: '00:00 - 00:04',
    visualDescription: 'A woman stands in the rain, dolly-in shot revealing her expression',
    audioDescription: 'Rain falling, city ambiance',
    cameraShot: 'Close Up',
    voiceoverText: 'She waited for him',
  };

  describe('Language directive', () => {
    it('should use English directive by default', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toMatch(/^\[LANGUAGE: ENGLISH ONLY/);
      expect(prompt).toContain('No Chinese text, signs, or dialogue');
    });

    it('should use English directive when explicitly set', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts', undefined, 'english');
      expect(prompt).toMatch(/^\[LANGUAGE: ENGLISH ONLY/);
    });

    it('should use Thai directive when language is thai', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts', undefined, 'thai');
      expect(prompt).toContain('[LANGUAGE: THAI');
      expect(prompt).toContain('All dialogue and on-screen text must be in THAI');
      expect(prompt).not.toContain('ENGLISH ONLY');
    });

    it('should use Japanese directive when language is japanese', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts', undefined, 'japanese');
      expect(prompt).toContain('[LANGUAGE: JAPANESE');
      expect(prompt).toContain('All dialogue and on-screen text must be in JAPANESE');
    });

    it('should use Chinese directive when language is chinese', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts', undefined, 'chinese');
      expect(prompt).toContain('[LANGUAGE: CHINESE');
      expect(prompt).toContain('All dialogue and on-screen text must be in CHINESE');
    });

    it('should use Korean directive when language is korean', () => {
      const prompt = buildSeedancePrompt(baseScene, 'speech_in_video', undefined, 'korean');
      expect(prompt).toContain('[LANGUAGE: KOREAN');
      expect(prompt).toContain('KOREAN language only');
    });
  });

  describe('Speech in video mode with different languages', () => {
    it('should include Thai in dialogue instructions for Thai language', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Somchai', text: 'สวัสดี' }],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video', undefined, 'thai');
      expect(prompt).toContain('All characters speak dialogue in THAI language only');
      expect(prompt).toContain('All speech in THAI');
    });

    it('should include Japanese in dialogue instructions for Japanese language', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Yuki', text: 'こんにちは' }],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video', undefined, 'japanese');
      expect(prompt).toContain('All characters speak dialogue in JAPANESE language only');
      expect(prompt).toContain('All speech in JAPANESE');
    });
  });

  describe('Visual and audio description', () => {
    it('should include visualDescription', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('A woman stands in the rain');
    });

    it('should include audioDescription as Audio Atmosphere', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt).toContain('Audio Atmosphere: Rain falling, city ambiance');
    });

    it('should include style when provided', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts', undefined, 'english', 'Cinematic noir style');
      expect(prompt).toContain('Art Style: Cinematic noir style');
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
  });

  describe('Speech in video mode with dialogue', () => {
    it('should include dialogue lines', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [
          { speaker: 'Hana', text: 'I missed you' },
          { speaker: 'Ren', text: 'I came as fast as I could' },
        ],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video');
      expect(prompt).toContain('Hana: "I missed you"');
      expect(prompt).toContain('Ren: "I came as fast as I could"');
    });

    it('should include character voice profiles', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{ speaker: 'Hana', text: 'I missed you' }],
      };
      const characters: Character[] = [
        { id: '1', name: 'Hana', gender: 'female', voiceName: 'Aoede', voiceProfile: 'soft and emotional' },
      ];
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video', characters);
      expect(prompt).toContain('[voice: soft and emotional]');
    });

    it('should include emotional state and tone from dialogue', () => {
      const sceneWithDialogue: Scene = {
        ...baseScene,
        dialogue: [{
          speaker: 'Hana',
          text: 'I missed you',
          emotionalState: 'tearful',
          tone: 'soft',
          pace: 'slow',
        }],
      };
      const prompt = buildSeedancePrompt(sceneWithDialogue, 'speech_in_video');
      expect(prompt).toContain('(tearful)');
      expect(prompt).toContain('tone:soft');
      expect(prompt).toContain('pace:slow');
    });

    it('should fallback to voiceoverText when no dialogue', () => {
      const sceneNoDialogue: Scene = {
        ...baseScene,
        dialogue: [],
        voiceoverText: 'The rain continued to fall',
      };
      const prompt = buildSeedancePrompt(sceneNoDialogue, 'speech_in_video');
      expect(prompt).toContain('DIALOGUE (speak in ENGLISH): "The rain continued to fall"');
    });
  });

  describe('Full prompt structure', () => {
    it('should have language directive at the start', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts');
      expect(prompt.startsWith('[LANGUAGE:')).toBe(true);
    });

    it('should include all components in correct order', () => {
      const prompt = buildSeedancePrompt(baseScene, 'tts', undefined, 'english', 'Dark cinematic');

      const languageIndex = prompt.indexOf('[LANGUAGE:');
      const styleIndex = prompt.indexOf('Art Style:');
      const visualIndex = prompt.indexOf('A woman stands in the rain');
      const audioAtmosphereIndex = prompt.indexOf('Audio Atmosphere:');
      const audioInstructionsIndex = prompt.indexOf('AUDIO:');

      expect(languageIndex).toBeLessThan(styleIndex);
      expect(styleIndex).toBeLessThan(visualIndex);
      expect(visualIndex).toBeLessThan(audioAtmosphereIndex);
      expect(audioAtmosphereIndex).toBeLessThan(audioInstructionsIndex);
    });
  });
});
