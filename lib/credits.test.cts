const assert = require("node:assert/strict");
const test = require("node:test");

const { submitGeneration } = require("./didactic/credits.ts");

function fakeStore(balance: number) {
  const balances = new Map([["u1", balance]]);
  return {
    async balance(id: string) {
      return balances.get(id) ?? 0;
    },
    async apply(id: string, delta: number) {
      balances.set(id, (balances.get(id) ?? 0) + delta);
    },
    value(id: string) {
      return balances.get(id);
    },
  };
}

function fakeClaim() {
  let claimed = false;
  return {
    async claim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    async release() {
      claimed = false;
    },
  };
}

test("a second submission is refused by the atomic claim, and nothing is debited", async () => {
  const store = fakeStore(20);
  const claim = fakeClaim();
  const deps = {
    storyId: "s1",
    userId: "u1",
    cost: 17,
    store,
    claim,
    jobs: { publish: async () => {} },
  };

  assert.equal(await submitGeneration(deps), "queued");
  assert.equal(await submitGeneration(deps), "already_queued");
  assert.equal(store.value("u1"), 3);
});

test("an insufficient balance releases the claim and changes nothing", async () => {
  const store = fakeStore(5);
  const claim = fakeClaim();

  const result = await submitGeneration({
    storyId: "s2",
    userId: "u1",
    cost: 17,
    store,
    claim,
    jobs: { publish: async () => {} },
  });

  assert.equal(result, "insufficient");
  assert.equal(store.value("u1"), 5);
  assert.equal(await claim.claim(), true, "the claim must have been released");
});

test("a publish failure refunds and releases so the comic stays retryable", async () => {
  const store = fakeStore(20);
  const claim = fakeClaim();

  const result = await submitGeneration({
    storyId: "s3",
    userId: "u1",
    cost: 17,
    store,
    claim,
    jobs: {
      publish: async () => {
        throw new Error("qstash down");
      },
    },
  });

  assert.equal(result, "publish_failed");
  assert.equal(store.value("u1"), 20);
  assert.equal(await claim.claim(), true, "the claim must have been released");
});
