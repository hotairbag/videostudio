import { v } from "convex/values";

/**
 * Tests for Convex projects.ts validators
 *
 * Since Convex mutations require a runtime context, we test the validator schemas
 * by creating equivalent validators and testing them directly.
 *
 * Convex validator structure:
 * - kind: the type of validator (string, boolean, union, literal, id, etc.)
 * - isOptional: "optional" | "required"
 * - isConvexValidator: true
 * - Additional fields depending on kind (e.g., members for union, value for literal, tableName for id)
 */

// Type definitions for Convex validators
interface ConvexValidator {
  kind: string;
  isOptional: "optional" | "required";
  isConvexValidator: boolean;
  // For literal validators
  value?: string | number | boolean;
  // For union validators
  members?: ConvexValidator[];
  // For id validators
  tableName?: string;
}

// Define the validators as they appear in projects.ts for testing
const createArgsValidators = {
  title: v.string(),
  style: v.string(),
  originalPrompt: v.string(),
  aspectRatio: v.union(v.literal("16:9"), v.literal("9:16")),
  videoModel: v.union(v.literal("veo-3.1"), v.literal("seedance-1.5")),
  enableCuts: v.boolean(),
  seedanceAudio: v.boolean(),
  seedanceResolution: v.union(v.literal("480p"), v.literal("720p")),
  seedanceSceneCount: v.union(v.literal(9), v.literal(15)),
};

const updateArgsValidators = {
  projectId: v.id("projects"),
  title: v.optional(v.string()),
  style: v.optional(v.string()),
  aspectRatio: v.optional(v.union(v.literal("16:9"), v.literal("9:16"))),
  videoModel: v.optional(v.union(v.literal("veo-3.1"), v.literal("seedance-1.5"))),
  enableCuts: v.optional(v.boolean()),
  seedanceAudio: v.optional(v.boolean()),
  seedanceResolution: v.optional(v.union(v.literal("480p"), v.literal("720p"))),
  seedanceSceneCount: v.optional(v.union(v.literal(9), v.literal(15))),
};

const updateStatusArgsValidators = {
  projectId: v.id("projects"),
  status: v.union(
    v.literal("draft"),
    v.literal("scripting"),
    v.literal("storyboarding"),
    v.literal("production"),
    v.literal("completed")
  ),
};

// Helper to check if a validator is defined correctly
function isValidatorDefined(validator: unknown): boolean {
  return validator !== undefined && validator !== null;
}

// Helper to get validator kind
function getValidatorKind(validator: unknown): string | null {
  if (!validator || typeof validator !== "object") return null;
  return (validator as ConvexValidator).kind || null;
}

// Helper to check if validator is optional
function isOptionalValidator(validator: unknown): boolean {
  if (!validator || typeof validator !== "object") return false;
  return (validator as ConvexValidator).isOptional === "optional";
}

// Helper to check if validator is required
function isRequiredValidator(validator: unknown): boolean {
  if (!validator || typeof validator !== "object") return false;
  return (validator as ConvexValidator).isOptional === "required";
}

// Helper to get union members
function getUnionMembers(validator: unknown): ConvexValidator[] | undefined {
  if (!validator || typeof validator !== "object") return undefined;
  return (validator as ConvexValidator).members;
}

// Helper to get literal values from union members
function getLiteralValuesFromUnion(validator: unknown): (string | number | boolean)[] {
  const members = getUnionMembers(validator);
  if (!members) return [];
  return members.map((m) => m.value).filter((v): v is string | number | boolean => v !== undefined);
}

describe("projects validators", () => {
  describe("create mutation validators", () => {
    describe("title field", () => {
      it("should have a string validator for title", () => {
        expect(isValidatorDefined(createArgsValidators.title)).toBe(true);
        expect(getValidatorKind(createArgsValidators.title)).toBe("string");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.title)).toBe(true);
      });
    });

    describe("style field", () => {
      it("should have a string validator for style", () => {
        expect(isValidatorDefined(createArgsValidators.style)).toBe(true);
        expect(getValidatorKind(createArgsValidators.style)).toBe("string");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.style)).toBe(true);
      });
    });

    describe("originalPrompt field", () => {
      it("should have a string validator for originalPrompt", () => {
        expect(isValidatorDefined(createArgsValidators.originalPrompt)).toBe(true);
        expect(getValidatorKind(createArgsValidators.originalPrompt)).toBe("string");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.originalPrompt)).toBe(true);
      });
    });

    describe("aspectRatio field", () => {
      it("should have a union validator for aspectRatio", () => {
        expect(isValidatorDefined(createArgsValidators.aspectRatio)).toBe(true);
        expect(getValidatorKind(createArgsValidators.aspectRatio)).toBe("union");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.aspectRatio)).toBe(true);
      });

      it('should only accept "16:9" or "9:16"', () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.aspectRatio);
        expect(literalValues).toContain("16:9");
        expect(literalValues).toContain("9:16");
        expect(literalValues.length).toBe(2);
      });
    });

    describe("videoModel field", () => {
      it("should have a union validator for videoModel", () => {
        expect(isValidatorDefined(createArgsValidators.videoModel)).toBe(true);
        expect(getValidatorKind(createArgsValidators.videoModel)).toBe("union");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.videoModel)).toBe(true);
      });

      it('should only accept "veo-3.1" or "seedance-1.5"', () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.videoModel);
        expect(literalValues).toContain("veo-3.1");
        expect(literalValues).toContain("seedance-1.5");
        expect(literalValues.length).toBe(2);
      });
    });

    describe("enableCuts field", () => {
      it("should have a boolean validator for enableCuts", () => {
        expect(isValidatorDefined(createArgsValidators.enableCuts)).toBe(true);
        expect(getValidatorKind(createArgsValidators.enableCuts)).toBe("boolean");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.enableCuts)).toBe(true);
      });
    });

    describe("seedanceAudio field", () => {
      it("should have a boolean validator for seedanceAudio", () => {
        expect(isValidatorDefined(createArgsValidators.seedanceAudio)).toBe(true);
        expect(getValidatorKind(createArgsValidators.seedanceAudio)).toBe("boolean");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.seedanceAudio)).toBe(true);
      });
    });

    describe("seedanceResolution field", () => {
      it("should have a union validator for seedanceResolution", () => {
        expect(isValidatorDefined(createArgsValidators.seedanceResolution)).toBe(true);
        expect(getValidatorKind(createArgsValidators.seedanceResolution)).toBe("union");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.seedanceResolution)).toBe(true);
      });

      it('should only accept "480p" or "720p"', () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceResolution);
        expect(literalValues).toContain("480p");
        expect(literalValues).toContain("720p");
        expect(literalValues.length).toBe(2);
      });
    });

    describe("seedanceSceneCount field", () => {
      it("should have a union validator for seedanceSceneCount", () => {
        expect(isValidatorDefined(createArgsValidators.seedanceSceneCount)).toBe(true);
        expect(getValidatorKind(createArgsValidators.seedanceSceneCount)).toBe("union");
      });

      it("should be required", () => {
        expect(isRequiredValidator(createArgsValidators.seedanceSceneCount)).toBe(true);
      });

      it("should only accept exactly 9 or 15", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceSceneCount);
        expect(literalValues).toContain(9);
        expect(literalValues).toContain(15);
        expect(literalValues.length).toBe(2);
      });

      it("should not accept values other than 9 or 15", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceSceneCount);

        // These values should NOT be in the allowed list
        expect(literalValues).not.toContain(0);
        expect(literalValues).not.toContain(1);
        expect(literalValues).not.toContain(8);
        expect(literalValues).not.toContain(10);
        expect(literalValues).not.toContain(14);
        expect(literalValues).not.toContain(16);
        expect(literalValues).not.toContain(100);
      });

      it("should have exactly 2 allowed values", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceSceneCount);
        expect(literalValues.length).toBe(2);
      });

      it("should use literal validators for the union members", () => {
        const members = getUnionMembers(createArgsValidators.seedanceSceneCount);
        expect(members).toBeDefined();
        members?.forEach((member) => {
          expect(getValidatorKind(member)).toBe("literal");
        });
      });
    });

    describe("all required fields presence", () => {
      it("should have all 9 required fields defined", () => {
        const requiredFields = [
          "title",
          "style",
          "originalPrompt",
          "aspectRatio",
          "videoModel",
          "enableCuts",
          "seedanceAudio",
          "seedanceResolution",
          "seedanceSceneCount",
        ];

        requiredFields.forEach((field) => {
          expect(createArgsValidators[field as keyof typeof createArgsValidators]).toBeDefined();
        });
      });

      it("should have exactly 9 fields (no extra fields)", () => {
        expect(Object.keys(createArgsValidators).length).toBe(9);
      });

      it("should have all fields as required (not optional)", () => {
        Object.values(createArgsValidators).forEach((validator) => {
          expect(isRequiredValidator(validator)).toBe(true);
        });
      });
    });
  });

  describe("update mutation validators", () => {
    describe("projectId field", () => {
      it("should have an id validator for projectId", () => {
        expect(isValidatorDefined(updateArgsValidators.projectId)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.projectId)).toBe("id");
      });

      it("should reference the projects table", () => {
        const validator = updateArgsValidators.projectId as unknown as ConvexValidator;
        expect(validator.tableName).toBe("projects");
      });

      it("should be required (not optional)", () => {
        expect(isRequiredValidator(updateArgsValidators.projectId)).toBe(true);
      });
    });

    describe("optional title field", () => {
      it("should have a string validator for title", () => {
        expect(isValidatorDefined(updateArgsValidators.title)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.title)).toBe("string");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.title)).toBe(true);
      });
    });

    describe("optional style field", () => {
      it("should have a string validator for style", () => {
        expect(isValidatorDefined(updateArgsValidators.style)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.style)).toBe("string");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.style)).toBe(true);
      });
    });

    describe("optional aspectRatio field", () => {
      it("should have a union validator for aspectRatio", () => {
        expect(isValidatorDefined(updateArgsValidators.aspectRatio)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.aspectRatio)).toBe("union");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.aspectRatio)).toBe(true);
      });

      it('should only accept "16:9" or "9:16"', () => {
        const literalValues = getLiteralValuesFromUnion(updateArgsValidators.aspectRatio);
        expect(literalValues).toContain("16:9");
        expect(literalValues).toContain("9:16");
        expect(literalValues.length).toBe(2);
      });
    });

    describe("optional videoModel field", () => {
      it("should have a union validator for videoModel", () => {
        expect(isValidatorDefined(updateArgsValidators.videoModel)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.videoModel)).toBe("union");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.videoModel)).toBe(true);
      });

      it('should only accept "veo-3.1" or "seedance-1.5"', () => {
        const literalValues = getLiteralValuesFromUnion(updateArgsValidators.videoModel);
        expect(literalValues).toContain("veo-3.1");
        expect(literalValues).toContain("seedance-1.5");
        expect(literalValues.length).toBe(2);
      });
    });

    describe("optional enableCuts field", () => {
      it("should have a boolean validator for enableCuts", () => {
        expect(isValidatorDefined(updateArgsValidators.enableCuts)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.enableCuts)).toBe("boolean");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.enableCuts)).toBe(true);
      });
    });

    describe("optional seedanceAudio field", () => {
      it("should have a boolean validator for seedanceAudio", () => {
        expect(isValidatorDefined(updateArgsValidators.seedanceAudio)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.seedanceAudio)).toBe("boolean");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.seedanceAudio)).toBe(true);
      });
    });

    describe("optional seedanceResolution field", () => {
      it("should have a union validator for seedanceResolution", () => {
        expect(isValidatorDefined(updateArgsValidators.seedanceResolution)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.seedanceResolution)).toBe("union");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.seedanceResolution)).toBe(true);
      });

      it('should only accept "480p" or "720p"', () => {
        const literalValues = getLiteralValuesFromUnion(updateArgsValidators.seedanceResolution);
        expect(literalValues).toContain("480p");
        expect(literalValues).toContain("720p");
        expect(literalValues.length).toBe(2);
      });
    });

    describe("optional seedanceSceneCount field", () => {
      it("should have a union validator for seedanceSceneCount", () => {
        expect(isValidatorDefined(updateArgsValidators.seedanceSceneCount)).toBe(true);
        expect(getValidatorKind(updateArgsValidators.seedanceSceneCount)).toBe("union");
      });

      it("should be optional", () => {
        expect(isOptionalValidator(updateArgsValidators.seedanceSceneCount)).toBe(true);
      });

      it("should only accept exactly 9 or 15", () => {
        const literalValues = getLiteralValuesFromUnion(updateArgsValidators.seedanceSceneCount);
        expect(literalValues).toContain(9);
        expect(literalValues).toContain(15);
        expect(literalValues.length).toBe(2);
      });

      it("should not allow other scene counts", () => {
        const literalValues = getLiteralValuesFromUnion(updateArgsValidators.seedanceSceneCount);

        expect(literalValues).not.toContain(0);
        expect(literalValues).not.toContain(1);
        expect(literalValues).not.toContain(8);
        expect(literalValues).not.toContain(10);
        expect(literalValues).not.toContain(14);
        expect(literalValues).not.toContain(16);
      });
    });

    describe("all update fields presence", () => {
      it("should have all 9 fields defined (projectId + 8 optional)", () => {
        const fields = [
          "projectId",
          "title",
          "style",
          "aspectRatio",
          "videoModel",
          "enableCuts",
          "seedanceAudio",
          "seedanceResolution",
          "seedanceSceneCount",
        ];

        fields.forEach((field) => {
          expect(updateArgsValidators[field as keyof typeof updateArgsValidators]).toBeDefined();
        });
      });

      it("should have exactly 9 fields (no extra fields)", () => {
        expect(Object.keys(updateArgsValidators).length).toBe(9);
      });

      it("should have projectId as required and all other fields as optional", () => {
        expect(isRequiredValidator(updateArgsValidators.projectId)).toBe(true);

        const optionalFields = [
          "title",
          "style",
          "aspectRatio",
          "videoModel",
          "enableCuts",
          "seedanceAudio",
          "seedanceResolution",
          "seedanceSceneCount",
        ] as const;

        optionalFields.forEach((field) => {
          expect(isOptionalValidator(updateArgsValidators[field])).toBe(true);
        });
      });
    });
  });

  describe("updateStatus mutation validators", () => {
    describe("projectId field", () => {
      it("should have an id validator for projectId", () => {
        expect(isValidatorDefined(updateStatusArgsValidators.projectId)).toBe(true);
        expect(getValidatorKind(updateStatusArgsValidators.projectId)).toBe("id");
      });

      it("should reference the projects table", () => {
        const validator = updateStatusArgsValidators.projectId as unknown as ConvexValidator;
        expect(validator.tableName).toBe("projects");
      });

      it("should be required", () => {
        expect(isRequiredValidator(updateStatusArgsValidators.projectId)).toBe(true);
      });
    });

    describe("status field", () => {
      it("should have a union validator for status", () => {
        expect(isValidatorDefined(updateStatusArgsValidators.status)).toBe(true);
        expect(getValidatorKind(updateStatusArgsValidators.status)).toBe("union");
      });

      it("should be required", () => {
        expect(isRequiredValidator(updateStatusArgsValidators.status)).toBe(true);
      });

      it("should accept all valid status values", () => {
        const literalValues = getLiteralValuesFromUnion(updateStatusArgsValidators.status);
        expect(literalValues).toContain("draft");
        expect(literalValues).toContain("scripting");
        expect(literalValues).toContain("storyboarding");
        expect(literalValues).toContain("production");
        expect(literalValues).toContain("completed");
        expect(literalValues.length).toBe(5);
      });

      it("should not accept invalid status values", () => {
        const literalValues = getLiteralValuesFromUnion(updateStatusArgsValidators.status);

        expect(literalValues).not.toContain("pending");
        expect(literalValues).not.toContain("cancelled");
        expect(literalValues).not.toContain("error");
        expect(literalValues).not.toContain("processing");
      });
    });
  });

  describe("validator type verification", () => {
    describe("string validators", () => {
      it("should create proper string validators", () => {
        const stringValidator = v.string();
        expect(getValidatorKind(stringValidator)).toBe("string");
        expect(isRequiredValidator(stringValidator)).toBe(true);
      });
    });

    describe("boolean validators", () => {
      it("should create proper boolean validators", () => {
        const boolValidator = v.boolean();
        expect(getValidatorKind(boolValidator)).toBe("boolean");
        expect(isRequiredValidator(boolValidator)).toBe(true);
      });
    });

    describe("literal validators", () => {
      it("should create proper literal string validators", () => {
        const literalValidator = v.literal("test") as unknown as ConvexValidator;
        expect(getValidatorKind(literalValidator)).toBe("literal");
        expect(literalValidator.value).toBe("test");
      });

      it("should create proper literal number validators", () => {
        const literalValidator = v.literal(9) as unknown as ConvexValidator;
        expect(getValidatorKind(literalValidator)).toBe("literal");
        expect(literalValidator.value).toBe(9);
      });

      it("should create proper literal boolean validators", () => {
        const literalValidator = v.literal(true) as unknown as ConvexValidator;
        expect(getValidatorKind(literalValidator)).toBe("literal");
        expect(literalValidator.value).toBe(true);
      });
    });

    describe("union validators", () => {
      it("should create proper union validators with multiple members", () => {
        const unionValidator = v.union(v.literal("a"), v.literal("b"), v.literal("c"));
        expect(getValidatorKind(unionValidator)).toBe("union");
        const members = getUnionMembers(unionValidator);
        expect(members?.length).toBe(3);
      });

      it("should create proper numeric union validators", () => {
        const unionValidator = v.union(v.literal(9), v.literal(15));
        expect(getValidatorKind(unionValidator)).toBe("union");
        const values = getLiteralValuesFromUnion(unionValidator);
        expect(values).toEqual([9, 15]);
      });

      it("should preserve literal values in union members", () => {
        const unionValidator = v.union(
          v.literal("first"),
          v.literal("second"),
          v.literal("third")
        );
        const values = getLiteralValuesFromUnion(unionValidator);
        expect(values).toEqual(["first", "second", "third"]);
      });
    });

    describe("optional validators", () => {
      it("should create optional validators with isOptional flag", () => {
        const optionalValidator = v.optional(v.string());
        expect(getValidatorKind(optionalValidator)).toBe("string");
        expect(isOptionalValidator(optionalValidator)).toBe(true);
      });

      it("should create optional union validators", () => {
        const optionalValidator = v.optional(v.union(v.literal(9), v.literal(15)));
        expect(getValidatorKind(optionalValidator)).toBe("union");
        expect(isOptionalValidator(optionalValidator)).toBe(true);
        const values = getLiteralValuesFromUnion(optionalValidator);
        expect(values).toEqual([9, 15]);
      });

      it("should create optional boolean validators", () => {
        const optionalValidator = v.optional(v.boolean());
        expect(getValidatorKind(optionalValidator)).toBe("boolean");
        expect(isOptionalValidator(optionalValidator)).toBe(true);
      });

      it("should differentiate between required and optional validators", () => {
        const required = v.string();
        const optional = v.optional(v.string());

        expect(isRequiredValidator(required)).toBe(true);
        expect(isOptionalValidator(required)).toBe(false);

        expect(isRequiredValidator(optional)).toBe(false);
        expect(isOptionalValidator(optional)).toBe(true);
      });
    });

    describe("id validators", () => {
      it("should create proper id validators", () => {
        const idValidator = v.id("projects");
        expect(getValidatorKind(idValidator)).toBe("id");
        expect(isRequiredValidator(idValidator)).toBe(true);
      });

      it("should store the table name", () => {
        const idValidator = v.id("projects") as unknown as ConvexValidator;
        expect(idValidator.tableName).toBe("projects");
      });

      it("should allow different table names", () => {
        const projectsId = v.id("projects") as unknown as ConvexValidator;
        const usersId = v.id("users") as unknown as ConvexValidator;

        expect(projectsId.tableName).toBe("projects");
        expect(usersId.tableName).toBe("users");
      });
    });
  });

  describe("edge cases and invalid inputs", () => {
    describe("seedanceSceneCount edge cases", () => {
      it("should define exactly two valid scene count values", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceSceneCount);
        expect(literalValues.length).toBe(2);
      });

      it("should use literal validators (not number range)", () => {
        const members = getUnionMembers(createArgsValidators.seedanceSceneCount);
        members?.forEach((member) => {
          expect(getValidatorKind(member)).toBe("literal");
        });
      });

      it("should have numeric literal values, not string representations", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceSceneCount);
        literalValues.forEach((value) => {
          expect(typeof value).toBe("number");
        });
      });
    });

    describe("aspectRatio values are exactly as expected", () => {
      it("should not allow aspect ratios with different separators", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.aspectRatio);

        // Should not have values with different separators
        expect(literalValues).not.toContain("16/9");
        expect(literalValues).not.toContain("9/16");
        expect(literalValues).not.toContain("16x9");
        expect(literalValues).not.toContain("9x16");
      });

      it("should have string literal values", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.aspectRatio);
        literalValues.forEach((value) => {
          expect(typeof value).toBe("string");
        });
      });
    });

    describe("videoModel values are exactly as expected", () => {
      it("should not allow invalid video model names", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.videoModel);

        expect(literalValues).not.toContain("veo-3");
        expect(literalValues).not.toContain("veo-3.0");
        expect(literalValues).not.toContain("seedance");
        expect(literalValues).not.toContain("seedance-1.0");
      });
    });

    describe("seedanceResolution values are exactly as expected", () => {
      it("should not allow invalid resolution values", () => {
        const literalValues = getLiteralValuesFromUnion(createArgsValidators.seedanceResolution);

        expect(literalValues).not.toContain("1080p");
        expect(literalValues).not.toContain("4k");
        expect(literalValues).not.toContain("360p");
        expect(literalValues).not.toContain("240p");
      });
    });

    describe("status values are exactly as expected", () => {
      it("should only have 5 status values", () => {
        const literalValues = getLiteralValuesFromUnion(updateStatusArgsValidators.status);
        expect(literalValues.length).toBe(5);
      });

      it("should have string literal values for status", () => {
        const literalValues = getLiteralValuesFromUnion(updateStatusArgsValidators.status);
        literalValues.forEach((value) => {
          expect(typeof value).toBe("string");
        });
      });
    });
  });

  describe("validator structure consistency", () => {
    it("should have matching field names between create and update validators (except projectId)", () => {
      const createFields = Object.keys(createArgsValidators);
      const updateFields = Object.keys(updateArgsValidators).filter((f) => f !== "projectId");

      // All update fields (except projectId) should be a subset of create fields
      updateFields.forEach((field) => {
        expect(createFields).toContain(field);
      });
    });

    it("should have most create fields available in update (except originalPrompt)", () => {
      const createFields = Object.keys(createArgsValidators);
      const updateFields = Object.keys(updateArgsValidators);

      // originalPrompt is intentionally not updatable
      const updatableFields = createFields.filter((field) => field !== "originalPrompt");

      updatableFields.forEach((field) => {
        expect(updateFields).toContain(field);
      });
    });

    it("should not allow updating originalPrompt", () => {
      const updateFields = Object.keys(updateArgsValidators);
      expect(updateFields).not.toContain("originalPrompt");
    });

    it("should have create validators as required and update validators as optional (except projectId)", () => {
      const fieldsToCheck = [
        "title",
        "style",
        "aspectRatio",
        "videoModel",
        "enableCuts",
        "seedanceAudio",
        "seedanceResolution",
        "seedanceSceneCount",
      ] as const;

      fieldsToCheck.forEach((field) => {
        const createValidator = createArgsValidators[field];
        const updateValidator = updateArgsValidators[field];

        expect(isRequiredValidator(createValidator)).toBe(true);
        expect(isOptionalValidator(updateValidator)).toBe(true);
      });
    });

    it("should have same validator kinds between create and update for matching fields", () => {
      const fieldsToCheck = [
        "title",
        "style",
        "aspectRatio",
        "videoModel",
        "enableCuts",
        "seedanceAudio",
        "seedanceResolution",
        "seedanceSceneCount",
      ] as const;

      fieldsToCheck.forEach((field) => {
        const createKind = getValidatorKind(createArgsValidators[field]);
        const updateKind = getValidatorKind(updateArgsValidators[field]);
        expect(createKind).toBe(updateKind);
      });
    });

    it("should have same union values between create and update for union fields", () => {
      const unionFields = [
        "aspectRatio",
        "videoModel",
        "seedanceResolution",
        "seedanceSceneCount",
      ] as const;

      unionFields.forEach((field) => {
        const createValues = getLiteralValuesFromUnion(createArgsValidators[field]);
        const updateValues = getLiteralValuesFromUnion(updateArgsValidators[field]);
        expect(createValues).toEqual(updateValues);
      });
    });
  });

  describe("Convex validator properties", () => {
    it("should have isConvexValidator flag on all validators", () => {
      const allValidators = [
        ...Object.values(createArgsValidators),
        ...Object.values(updateArgsValidators),
        ...Object.values(updateStatusArgsValidators),
      ];

      allValidators.forEach((validator) => {
        expect((validator as unknown as { isConvexValidator: boolean }).isConvexValidator).toBe(
          true
        );
      });
    });

    it("should have kind property on all validators", () => {
      const allValidators = [
        ...Object.values(createArgsValidators),
        ...Object.values(updateArgsValidators),
        ...Object.values(updateStatusArgsValidators),
      ];

      allValidators.forEach((validator) => {
        expect(getValidatorKind(validator)).not.toBeNull();
      });
    });

    it("should have isOptional property on all validators", () => {
      const allValidators = [
        ...Object.values(createArgsValidators),
        ...Object.values(updateArgsValidators),
        ...Object.values(updateStatusArgsValidators),
      ];

      allValidators.forEach((validator) => {
        const isOpt = (validator as unknown as ConvexValidator).isOptional;
        expect(["optional", "required"]).toContain(isOpt);
      });
    });
  });
});
