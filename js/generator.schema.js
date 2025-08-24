// js/generator.schema.js
// Central script result schema + lightweight validator
export const ScriptSchema = {
  id: 'string?',
  hook: { text: 'string?', shots: 'array?' },
  body: { text: 'string?', shots: 'array?' },
  cta:  { text: 'string?', shots: 'array?' },
  visual_dna: 'string?',
  // A/B Variants fields (optional, backward compatible)
  hook_variants: 'array?',
  body_intro: 'string?',
  body_variants: 'array?',
  cta_variants: 'array?',
};

export function validateScript(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const hasTitle = typeof obj.title === 'string' && obj.title.trim().length > 0;
  const hasEither = (!!obj.slides) || (!!obj.hook && !!obj.body && !!obj.cta);

  const validShot = (s) => s && typeof s === 'object' &&
    typeof s.visual_idea === 'string' && typeof s.text_to_image_prompt === 'string' && typeof s.image_to_video_prompt === 'string';

  const validPart = (p) => p && typeof p === 'object' &&
    typeof p.text === 'string' &&
    Array.isArray(p.shots) && p.shots.length >= 1 && p.shots.every(validShot);

  const validSlides = (slides) => Array.isArray(slides) && slides.length >= 1 &&
    slides.every(slide => typeof slide.slide_text === 'string' && typeof slide.text_to_image_prompt === 'string');

  // A/B Variants validation (optional fields)
  const validVariants = (variants) => !variants || (Array.isArray(variants) && variants.every(v => typeof v === 'string'));
  const validBodyIntro = (intro) => !intro || typeof intro === 'string';
  
  // Check A/B variants if present (backward compatible)
  const abVariantsOk = validVariants(obj.hook_variants) && 
                       validBodyIntro(obj.body_intro) && 
                       validVariants(obj.body_variants) && 
                       validVariants(obj.cta_variants);

  let structureOk = false;
  if (obj.slides) {
    structureOk = validSlides(obj.slides);
  } else {
    structureOk = validPart(obj.hook) && validPart(obj.body) && validPart(obj.cta);
  }
  return hasTitle && hasEither && structureOk && abVariantsOk;
}

export function getAdditionalAssetsResponseSchema() {
  return {
    type: "OBJECT",
    properties: {
      titles: {
        type: "ARRAY",
        items: { type: "STRING" },
        minItems: 3,
        maxItems: 3
      },
      platform: { type: "STRING", enum: ["tiktok", "instagram_reels", "youtube_shorts", "shopee"] },
      hashtags: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
      platform_hashtags: {
        type: "OBJECT",
        properties: {
          tiktok: { type: "ARRAY", items: { type: "STRING" } },
          instagram_reels: { type: "ARRAY", items: { type: "STRING" } },
          youtube_shorts: { type: "ARRAY", items: { type: "STRING" } },
          shopee: { type: "ARRAY", items: { type: "STRING" } }
        }
      },
      trending_tags: { type: "ARRAY", items: { type: "STRING" } },
      thumbnail_ideas: {
        type: "ARRAY",
        items: { type: "STRING" },
        minItems: 3,
        maxItems: 3
      }
    },
    required: ["titles", "hashtags", "thumbnail_ideas"]
  };
}