const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseContextResponse,
  buildContextPrompt,
  generateObjectives,
} = require("./context.ts");

test("parses objectives and rejects empty ones", () => {
  const objectives = parseContextResponse(
    JSON.stringify({
      objectives: [
        {
          title: "Le cycle de l'eau",
          summary: "L'eau s'évapore puis retombe.",
          sourceQuote: "p. 4",
        },
        { title: "", summary: "x", sourceQuote: null },
      ],
    }),
  );
  assert.equal(objectives.length, 1);
  assert.equal(objectives[0].title, "Le cycle de l'eau");
});

test("drops source quotes in demo mode", () => {
  const objectives = parseContextResponse(
    JSON.stringify({
      objectives: [{ title: "Notion", summary: "Résumé", sourceQuote: "p. 4" }],
    }),
    { mode: "demo" },
  );
  assert.equal(objectives[0].sourceQuote, null);
});

test("bounds the prompt under the system limit", () => {
  const prompt = buildContextPrompt({
    sourceText: "x".repeat(200000),
    audience: "lycée",
    mode: "document",
  });
  assert.ok(prompt.user.length <= 30000);
});

test("refuses a response that is not JSON", () => {
  assert.throws(() => parseContextResponse("pas de json ici"));
});

test("asks the model to answer in JSON with reasoning disabled", async () => {
  let seen: any = null;
  const createCompletion = async (request: any) => {
    seen = request;
    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({
              objectives: [{ title: "T", summary: "S", sourceQuote: null }],
            }),
          },
        },
      ],
    };
  };

  const objectives = await generateObjectives(
    { createCompletion },
    { sourceText: "cours", audience: "lycée", mode: "document" },
  );

  assert.equal(objectives.length, 1);
  assert.equal(seen.reasoning?.enabled, false);
});
