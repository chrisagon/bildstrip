const assert = require("node:assert/strict");
const test = require("node:test");

const { parseCastResponse, buildPortraitPrompt } = require("./cast.ts");

const castFixture = {
  name: "Nora",
  role: "protagonist",
  appearance: "Adolescente, cheveux courts, veste verte",
  portraitPrompt: "portrait",
};

test("keeps 2 to 3 members and rejects unknown roles", () => {
  const raw = JSON.stringify({
    characters: [
      {
        name: "Nora",
        role: "protagonist",
        appearance: "Adolescente, cheveux courts…",
        portraitPrompt: "portrait",
      },
      { name: "M. Basile", role: "roi", appearance: "…", portraitPrompt: "portrait" },
      { name: "Le chien", role: "comic-relief", appearance: "…", portraitPrompt: "portrait" },
    ],
  });

  const cast = parseCastResponse(raw);
  assert.equal(cast.length, 2);
  assert.equal(cast[0].name, "Nora");
});

test("portrait prompt never asks for text", () => {
  const prompt = buildPortraitPrompt(castFixture, "ligne claire");
  assert.match(prompt, /no text/i);
});

test("a portrait already rendered is skipped without calling the provider", async () => {
  const { renderPortrait } = require("./render-portrait.ts");
  let calls = 0;
  const result = await renderPortrait({
    provider: {
      generate: async () => {
        calls++;
        return "https://example.test/tmp.jpg";
      },
    },
    loadCharacter: async () => ({
      name: "Nora",
      role: "protagonist",
      appearance: "cheveux courts",
      portraitUrl: "https://example.test/portrait.jpg",
    }),
    stylePrompt: "ligne claire",
    savePortrait: async () => {},
    upload: async () => "https://example.test/portrait.jpg",
  });
  assert.equal(result, "skipped");
  assert.equal(calls, 0);
});
