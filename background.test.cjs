const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function fixture({closed = [], responses = {}, queryError = false} = {}) {
  const activated = [], filled = [], statuses = [];
  let intervals = 0;
  const context = vm.createContext({
    setTimeout: resolve => resolve(),
    setInterval: () => ++intervals,
    clearInterval: () => --intervals,
    chrome: {
      windows: {update: async () => {}},
      tabs: {
        query: async () => {
          if (queryError) throw Error('Query failed');
          return [{id: 2, windowId: 1, index: 1}, {id: 1, windowId: 1, index: 0}];
        },
        update: async id => {
          activated.push(id);
          if (closed.includes(id)) throw Error('Tab closed');
        },
        sendMessage: async (id, message) => {
          if (message.type === 'batchStatus') { statuses.push(message.text); return; }
          filled.push(id);
          return Object.hasOwn(responses, id) ? responses[id] : {template: 'Product', filled: 1, total: 1, problems: []};
        },
      },
      runtime: {onMessage: {addListener() {}}, getPlatformInfo: async () => ({})},
      commands: {onCommand: {addListener() {}}},
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'), context);
  return {context, activated, filled, statuses, intervalCount: () => intervals};
}

(async () => {
  const origin = {id: 9, windowId: 1};
  const normal = fixture();
  await normal.context.runBatch(origin, null);
  assert.deepEqual(normal.filled, [1, 2]);
  assert.deepEqual(normal.activated, [1, 2, 9]);
  assert.match(normal.statuses.at(-1), /Finished 2 tabs/);
  assert.equal(normal.intervalCount(), 0);

  const closed = fixture({closed: [1]});
  await closed.context.runBatch(origin, null);
  assert.deepEqual(closed.filled, [2]);
  assert.match(closed.statuses.at(-1), /Couldn't reach this tab/);
  assert.match(closed.statuses.at(-1), /Product: 1\/1 filled/);
  assert.equal(closed.activated.at(-1), 9);

  const noResponse = fixture({responses: {1: undefined, 2: {}}});
  await noResponse.context.runBatch(origin, null);
  assert.match(noResponse.statuses.at(-1), /Finished 2 tabs/);
  assert.equal(noResponse.statuses.at(-1).match(/No fill result/g).length, 2);

  const queryFailure = fixture({queryError: true});
  await queryFailure.context.runBatch(origin, null);
  assert.deepEqual(queryFailure.activated, [9]);
  assert.match(queryFailure.statuses.at(-1), /Query failed/);
  assert.equal(queryFailure.intervalCount(), 0);

  const originClosed = fixture({closed: [9]});
  await originClosed.context.runBatch(origin, null);
  await originClosed.context.runBatch(origin, null);
  assert.deepEqual(originClosed.filled, [1, 2, 1, 2]);
  assert.equal(originClosed.intervalCount(), 0);
  console.log('Passed batch ordering, closed tabs, missing responses, failure restoration, cleanup and repeat-run checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
