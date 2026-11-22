const assert = require("node:assert/strict");
const test = require("node:test");

const { submitGeneration, canUseSynchronousMode } = require("./didactic/credits.ts");

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

function fakeJobs() {
  const calls: string[] = [];
  return {
    calls,
    async publish(queue: string, _body: Record<string, unknown>) {
      calls.push(queue);
    },
  };
}

function fakeStatus() {
  const statuses = new Map<string, string>();
  return {
    async get(storyId: string) {
      return statuses.get(storyId) ?? "script_ready";
    },
    async set(storyId: string, status: string) {
      statuses.set(storyId, status);
    },
  };
}

test("a double submission only debits once", async () => {
  const store = fakeStore(20);
  const jobs = fakeJobs();
  const status = fakeStatus();

  const first = await submitGeneration({
    storyId: "s1",
    userId: "u1",
    cost: 17,
    store,
    jobs,
    status,
  });
  const second = await submitGeneration({
    storyId: "s1",
    userId: "u1",
    cost: 17,
    store,
    jobs,
    status,
  });

  assert.equal(first, "queued");
  assert.equal(second, "already_queued");
  assert.equal(store.value("u1"), 3);
});

test("an insufficient balance changes nothing", async () => {
  const store = fakeStore(5);
  const result = await submitGeneration({
    storyId: "s2",
    userId: "u1",
    cost: 17,
    store,
    jobs: fakeJobs(),
    status: fakeStatus(),
  });

  assert.equal(result, "insufficient");
  assert.equal(store.value("u1"), 5);
});

test("own-key mode is capped at four pages", () => {
  assert.equal(canUseSynchronousMode({ pages: 4, hasOwnKey: true }), true);
  assert.equal(canUseSynchronousMode({ pages: 5, hasOwnKey: true }), false);
  assert.equal(canUseSynchronousMode({ pages: 3, hasOwnKey: false }), false);
});
