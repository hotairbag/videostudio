export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.kie.ai/api/v1';

interface MusicTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

/**
 * Build a structured Suno prompt using the advanced format from the Suno guide.
 */
function buildSunoPrompt(title: string, style: string, theme?: string): string {
  const contentLower = (theme || '').toLowerCase() + ' ' + (title || '').toLowerCase() + ' ' + (style || '').toLowerCase();

  let genre: string;
  let instrumentation: string;
  let production: string;
  let mood: string;

  const isCasual = /bbq|barbecue|backyard|cooking|kitchen|food|eating|meal|dinner|lunch|breakfast|party|picnic|garden|outdoor|grill|chef|recipe|vlog|tutorial|how.?to|diy|home|house|family|friend/i.test(contentLower);
  const isTravel = /travel|vacation|holiday|trip|journey|explore|tourist|beach|resort|hotel|cruise|flight|road.?trip/i.test(contentLower);
  const isLifestyle = /lifestyle|fashion|beauty|makeup|shopping|retail|product|review|unboxing|haul/i.test(contentLower);
  const isSports = /sport|fitness|workout|gym|running|cycling|football|soccer|basketball|training|exercise|athletic/i.test(contentLower);
  const isNature = /nature|wildlife|animal|forest|mountain|ocean|sea|river|lake|landscape|sunset|sunrise|sky|weather/i.test(contentLower);
  const isRomantic = /romance|romantic|love|lovers|couple|kiss|intimate|tender|affection|bl|boys.?love|yaoi|relationship|date|dating|confession|heart|embrace|holding.?hands/i.test(contentLower);
  const isEpic = /epic|grand|vast|adventure|hero|battle|war|triumph|cinematic|movie|film|trailer/i.test(contentLower);
  const isDark = /dark|night|shadow|mystery|tension|suspense|horror|fear|thriller|crime|noir/i.test(contentLower);
  const isUplifting = /happy|joy|celebration|hope|bright|success|victory|wedding|birthday|achievement/i.test(contentLower);
  const isEmotional = /sad|melancholy|loss|memory|nostalgia|longing|farewell|goodbye|emotional|dramatic/i.test(contentLower);
  const isAction = /action|chase|fast|speed|energy|dynamic|intense|rush|extreme|stunt/i.test(contentLower);
  const isSerene = /calm|peace|serene|gentle|soft|quiet|meditation|yoga|spa|relax|mindful/i.test(contentLower);
  const isExotic = /arab|middle.?east|india|asia|japan|china|africa|latin|tribal|ethnic|desert|oasis/i.test(contentLower);
  const isModern = /urban|city|tech|future|cyber|digital|neon|synth|corporate|business|startup/i.test(contentLower);
  const isRetro = /retro|vintage|80s|90s|70s|60s|classic|old.?school|nostalgic/i.test(contentLower);

  if (isCasual) {
    genre = 'indie folk pop with acoustic elements and feel-good vibes';
    instrumentation = 'acoustic guitar and light percussion and bass and subtle keys with hand claps';
    production = 'warm organic mix and natural reverb and balanced dynamics with clear vocals space';
    mood = 'cheerful and laid-back and friendly';
  } else if (isTravel) {
    genre = 'indie pop with world music influences and uplifting energy';
    instrumentation = 'acoustic guitar and world percussion and synth pads and bass with melodic hooks';
    production = 'spacious mix and airy reverb and wide stereo image with punchy drums';
    mood = 'adventurous and inspiring and free-spirited';
  } else if (isLifestyle) {
    genre = 'modern pop with electronic elements and catchy hooks';
    instrumentation = 'synth bass and electronic drums and airy synths and vocal chops with melodic leads';
    production = 'polished modern mix and tight low end and crisp highs with sidechain compression';
    mood = 'trendy and confident and stylish';
  } else if (isSports) {
    genre = 'electronic rock with driving beats and motivational energy';
    instrumentation = 'powerful drums and distorted bass and synth stabs and electric guitar riffs';
    production = 'punchy mix and aggressive compression and powerful low end with clarity';
    mood = 'energetic and powerful and motivational';
  } else if (isNature) {
    genre = 'ambient with organic textures and atmospheric soundscapes';
    instrumentation = 'soft piano and ambient pads and subtle strings and nature-inspired sounds';
    production = 'spacious mix and long reverb and soft dynamics with natural warmth';
    mood = 'serene and majestic and contemplative';
  } else if (isRomantic) {
    genre = 'romantic cinematic with tender piano and gentle strings';
    instrumentation = 'soft piano and delicate strings and gentle acoustic guitar and warm pads';
    production = 'intimate mix and warm reverb and soft dynamics with emotional depth';
    mood = 'romantic and tender and heartfelt and intimate';
  } else if (isRetro) {
    genre = 'synthwave with 80s inspired production and nostalgic vibes';
    instrumentation = 'analog synths and drum machines and bass synth and arpeggiated leads';
    production = 'vintage synth sounds and gated reverb and warm analog saturation';
    mood = 'nostalgic and dreamy and retro-futuristic';
  } else if (isExotic) {
    genre = 'world fusion with ethnic instrumentation and atmospheric elements';
    instrumentation = 'ethnic instruments and world percussion and ambient pads and traditional melodies';
    production = 'organic mix and natural reverb and balanced dynamics with cultural authenticity';
    mood = 'exotic and atmospheric and immersive';
  } else if (isModern) {
    genre = 'modern electronic with cinematic elements and sleek production';
    instrumentation = 'synthesizers and electronic drums and bass pulses and ambient textures';
    production = 'clean modern mix and tight low end and crisp high frequencies with space';
    mood = 'modern and professional and sophisticated';
  } else if (isAction) {
    genre = 'hybrid electronic rock with driving percussion and intense energy';
    instrumentation = 'pounding drums and distorted bass and synth stabs and orchestral hits';
    production = 'massive sound design and powerful low end and punchy dynamics';
    mood = 'intense and driving and adrenaline-fueled';
  } else if (isSerene) {
    genre = 'ambient with minimalist piano and gentle soundscapes';
    instrumentation = 'soft piano and gentle strings and ambient textures and subtle pads';
    production = 'intimate mix and natural reverb and soft dynamics with warmth';
    mood = 'peaceful and serene and contemplative';
  } else if (isEpic) {
    genre = 'epic orchestral trailer music with full symphony and massive sound';
    instrumentation = 'full orchestra and choir elements and massive drums and brass fanfares';
    production = 'massive sound design and powerful low end and stadium mixing';
    mood = 'epic and triumphant and majestic';
  } else if (isDark) {
    genre = 'dark atmospheric with tension strings and ominous undertones';
    instrumentation = 'low strings and dark synth pads and sparse piano and tension risers';
    production = 'moody mix and long dark reverb and subtle dynamics with unease';
    mood = 'dark and mysterious and tense';
  } else if (isUplifting) {
    genre = 'uplifting pop rock with positive energy and inspiring melodies';
    instrumentation = 'acoustic and electric guitars and driving drums and bass and bright synths';
    production = 'bright polished mix and punchy drums and wide stereo spread';
    mood = 'uplifting and hopeful and inspiring';
  } else if (isEmotional) {
    genre = 'emotional cinematic with piano-driven melodies and heartfelt strings';
    instrumentation = 'piano and strings and subtle percussion and ambient pads';
    production = 'intimate mix and emotional dynamics and warm reverb';
    mood = 'emotional and heartfelt and moving';
  } else {
    genre = 'modern cinematic pop with balanced instrumentation';
    instrumentation = 'piano and light percussion and bass and ambient pads with subtle strings';
    production = 'clean professional mix and balanced dynamics and natural reverb';
    mood = 'engaging and versatile and pleasant';
  }

  const promptParts = [
    `genre: "${genre}".`,
    `instrumentation: "${instrumentation}".`,
    `production: "${production}".`,
    `mood: "${mood}".`,
  ];

  return promptParts.join('\n');
}

/**
 * Build the style field for Suno API
 */
function buildSunoStyle(title: string, style: string, theme?: string): string {
  const contentLower = (theme || '').toLowerCase() + ' ' + (title || '').toLowerCase() + ' ' + (style || '').toLowerCase();

  let styleParts: string[];

  if (/bbq|barbecue|backyard|cooking|kitchen|food|eating|meal|party|picnic|grill|vlog|tutorial|diy|home|family/i.test(contentLower)) {
    styleParts = ['Indie Folk', 'Acoustic', 'Feel-Good', 'Upbeat', 'Instrumental'];
  } else if (/travel|vacation|holiday|trip|journey|explore|tourist|beach/i.test(contentLower)) {
    styleParts = ['Indie Pop', 'Adventure', 'Uplifting', 'World', 'Instrumental'];
  } else if (/lifestyle|fashion|beauty|makeup|shopping|product|review/i.test(contentLower)) {
    styleParts = ['Modern Pop', 'Trendy', 'Electronic', 'Stylish', 'Instrumental'];
  } else if (/sport|fitness|workout|gym|running|training|exercise/i.test(contentLower)) {
    styleParts = ['Electronic Rock', 'Energetic', 'Motivational', 'Powerful', 'Instrumental'];
  } else if (/nature|wildlife|animal|forest|mountain|ocean|landscape/i.test(contentLower)) {
    styleParts = ['Ambient', 'Atmospheric', 'Organic', 'Peaceful', 'Instrumental'];
  } else if (/romance|romantic|love|lovers|couple|kiss|intimate|tender|bl|boys.?love|yaoi|relationship|date|confession|heart|embrace/i.test(contentLower)) {
    styleParts = ['Romantic', 'Piano', 'Tender', 'Emotional', 'Instrumental'];
  } else if (/retro|vintage|80s|90s|classic|old.?school/i.test(contentLower)) {
    styleParts = ['Synthwave', 'Retro', '80s', 'Nostalgic', 'Instrumental'];
  } else if (/epic|grand|adventure|hero|battle|trailer|cinematic/i.test(contentLower)) {
    styleParts = ['Epic', 'Orchestral', 'Cinematic', 'Dramatic', 'Instrumental'];
  } else if (/dark|night|mystery|tension|horror|thriller/i.test(contentLower)) {
    styleParts = ['Dark', 'Atmospheric', 'Tension', 'Cinematic', 'Instrumental'];
  } else if (/happy|joy|celebration|hope|bright|success/i.test(contentLower)) {
    styleParts = ['Uplifting', 'Pop', 'Inspiring', 'Bright', 'Instrumental'];
  } else if (/sad|melancholy|emotional|dramatic/i.test(contentLower)) {
    styleParts = ['Emotional', 'Cinematic', 'Piano', 'Heartfelt', 'Instrumental'];
  } else if (/action|chase|fast|intense|extreme/i.test(contentLower)) {
    styleParts = ['Action', 'Intense', 'Electronic', 'Powerful', 'Instrumental'];
  } else if (/calm|peace|meditation|yoga|relax/i.test(contentLower)) {
    styleParts = ['Ambient', 'Peaceful', 'Calm', 'Relaxing', 'Instrumental'];
  } else if (/arab|india|asia|ethnic|tribal|world/i.test(contentLower)) {
    styleParts = ['World Music', 'Ethnic', 'Fusion', 'Atmospheric', 'Instrumental'];
  } else if (/urban|city|tech|future|cyber|corporate/i.test(contentLower)) {
    styleParts = ['Modern', 'Electronic', 'Corporate', 'Professional', 'Instrumental'];
  } else {
    styleParts = ['Modern', 'Cinematic', 'Background', 'Pleasant', 'Instrumental'];
  }

  return styleParts.join(' and ');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MUSIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Music API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { style, title, theme } = await request.json();

    const prompt = buildSunoPrompt(title, style, theme);
    const sunoStyle = buildSunoStyle(title, style, theme);

    console.log('[Suno] Structured prompt:', prompt);
    console.log('[Suno] Style tags:', sunoStyle);

    const generateRes = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'V5',
        customMode: true,
        instrumental: true,
        prompt,
        style: sunoStyle,
        title: (title || "Cinematic Track").substring(0, 80),
        callBackUrl: 'https://example.com/callback'
      })
    });

    const genJson: MusicTaskResponse = await generateRes.json();

    if (genJson.code !== 200 || !genJson.data?.taskId) {
      return NextResponse.json(
        { error: `Music generation failed to start: ${genJson.msg}` },
        { status: 400 }
      );
    }

    // Return taskId immediately - client will poll for status
    return NextResponse.json({
      taskId: genJson.data.taskId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Music start error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
