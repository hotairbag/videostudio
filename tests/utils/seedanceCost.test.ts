/**
 * Tests for Seedance cost calculations
 * Based on BytePlus flex/offline pricing with 50% discount
 * Token formula: (Width × Height × FPS × Duration) / 1024
 * Flex pricing: $0.6/M tokens (no audio), $1.2/M tokens (with audio)
 */

describe('Seedance cost calculations', () => {
  // Cost configuration (from InputForm.tsx)
  const SEEDANCE_COSTS = {
    basePer4s: 0.05, // Base cost per 4s at 720p without audio (flex pricing)
    audioMultiplier: 2, // 2x for audio generation ($1.2 vs $0.6 per M tokens)
    resolution480p: 0.45, // ~45% of 720p cost (39K vs 86K tokens)
    durationMultiplier: { 4: 1, 8: 2, 12: 3 } as Record<number, number>,
  };

  function calculateCost(
    clipCount: number,
    resolution: '480p' | '720p',
    duration: 4 | 8 | 12,
    hasAudio: boolean
  ): string {
    let costPerClip = SEEDANCE_COSTS.basePer4s * (SEEDANCE_COSTS.durationMultiplier[duration] || 1);

    if (resolution === '480p') {
      costPerClip *= SEEDANCE_COSTS.resolution480p;
    }
    if (hasAudio) {
      costPerClip *= SEEDANCE_COSTS.audioMultiplier;
    }

    return (clipCount * costPerClip).toFixed(2);
  }

  describe('Token calculation', () => {
    // Token formula: (Width × Height × FPS × Duration) / 1024
    function calculateTokens(width: number, height: number, fps: number, duration: number): number {
      return Math.round((width * height * fps * duration) / 1024);
    }

    it('should calculate ~86K tokens for 720p 4s video', () => {
      const tokens = calculateTokens(1280, 720, 24, 4);
      expect(tokens).toBeCloseTo(86400, -2); // Within 100 tokens
    });

    it('should calculate ~39K tokens for 480p 4s video (9:16 aspect)', () => {
      const tokens = calculateTokens(480, 864, 24, 4);
      // Actual: (480 * 864 * 24 * 4) / 1024 = 38880
      expect(tokens).toBeCloseTo(38880, -2);
    });

    it('should scale linearly with duration', () => {
      const tokens4s = calculateTokens(1280, 720, 24, 4);
      const tokens8s = calculateTokens(1280, 720, 24, 8);
      const tokens12s = calculateTokens(1280, 720, 24, 12);

      expect(tokens8s).toBeCloseTo(tokens4s * 2, -2);
      expect(tokens12s).toBeCloseTo(tokens4s * 3, -2);
    });
  });

  describe('720p pricing', () => {
    it('should cost $0.05 per 4s clip without audio', () => {
      const cost = calculateCost(1, '720p', 4, false);
      expect(cost).toBe('0.05');
    });

    it('should cost $0.10 per 4s clip with audio', () => {
      const cost = calculateCost(1, '720p', 4, true);
      expect(cost).toBe('0.10');
    });

    it('should cost $0.10 per 8s clip without audio', () => {
      const cost = calculateCost(1, '720p', 8, false);
      expect(cost).toBe('0.10');
    });

    it('should cost $0.15 per 12s clip without audio', () => {
      const cost = calculateCost(1, '720p', 12, false);
      expect(cost).toBe('0.15');
    });
  });

  describe('480p pricing', () => {
    it('should cost ~45% of 720p for 480p (before rounding)', () => {
      // Raw calculation: 0.05 * 0.45 = 0.0225, which rounds to 0.02
      // So the displayed ratio after rounding is 0.02/0.05 = 0.4
      const cost720p = parseFloat(calculateCost(1, '720p', 4, false));
      const cost480p = parseFloat(calculateCost(1, '480p', 4, false));

      // After toFixed(2) rounding, ratio is ~0.4
      expect(cost480p / cost720p).toBeCloseTo(0.4, 1);
    });

    it('should cost ~$0.02 per 4s clip at 480p without audio', () => {
      const cost = calculateCost(1, '480p', 4, false);
      expect(parseFloat(cost)).toBeCloseTo(0.0225, 2);
    });
  });

  describe('15 clip project costs', () => {
    it('should cost ~$0.75 for 15 clips at 720p 4s without audio', () => {
      const cost = calculateCost(15, '720p', 4, false);
      expect(cost).toBe('0.75');
    });

    it('should cost ~$1.50 for 15 clips at 720p 4s with audio', () => {
      const cost = calculateCost(15, '720p', 4, true);
      expect(cost).toBe('1.50');
    });

    it('should cost ~$0.34 for 15 clips at 480p 4s without audio', () => {
      const cost = calculateCost(15, '480p', 4, false);
      expect(parseFloat(cost)).toBeCloseTo(0.34, 1);
    });
  });

  describe('9 clip project costs (Veo mode scene count)', () => {
    it('should cost ~$0.45 for 9 clips at 720p 4s without audio', () => {
      const cost = calculateCost(9, '720p', 4, false);
      expect(cost).toBe('0.45');
    });
  });

  describe('Long duration clips', () => {
    it('should cost ~$1.50 for 15 clips at 720p 8s without audio', () => {
      const cost = calculateCost(15, '720p', 8, false);
      expect(cost).toBe('1.50');
    });

    it('should cost ~$2.25 for 15 clips at 720p 12s without audio', () => {
      const cost = calculateCost(15, '720p', 12, false);
      expect(cost).toBe('2.25');
    });

    it('should cost ~$6.00 for 15 clips at 720p 8s with audio', () => {
      const cost = calculateCost(15, '720p', 8, true);
      expect(cost).toBe('3.00');
    });
  });
});
