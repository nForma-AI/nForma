---
phase: quick-149
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd.cjs
  - bin/qgsd.test.cjs
autonomous: true
requirements: [QUICK-149]
formal_artifacts: none

must_haves:
  truths:
    - "TUI starts with Agents module active and shows only Agent-related menu items (List/Add/Clone/Edit/Remove/Reorder/Health/Login, Provider Keys, Batch Rotate, Live Health/Scoreboard, Update Agents)"
    - "Pressing F2 switches to Requirements module showing only Req-related menu items (Browse Reqs, Coverage, Traceability, Aggregate, Coverage Gaps)"
    - "Pressing F3 switches to Config module showing only Config-related menu items (Settings, Tune Timeouts, Set Update Policy, Export, Import, Exit)"
    - "Pressing F1 switches back to Agents module from any other module"
    - "Tab cycles forward through modules (Agents -> Reqs -> Config -> Agents), Shift+Tab cycles backward"
    - "A narrow 6-char activity bar on the left shows module icons with the active module highlighted"
    - "All existing menu actions (list, add, clone, edit, remove, etc.) still work identically after selecting from module-filtered menus"
    - "The exported flat MENU_ITEMS array still contains all 30+ items and all existing tests pass unchanged"
    - "The status bar shows F1/F2/F3 hints for module switching"
    - "applyUpdateBadge only modifies the Update Agents menu item when Agents module is active"
  artifacts:
    - path: "bin/qgsd.cjs"
      provides: "TUI with activity bar, MODULES array, switchModule function, F1/F2/F3 + Tab keybindings"
      contains: "MODULES"
      min_lines: 2400
    - path: "bin/qgsd.test.cjs"
      provides: "Updated tests covering MODULES structure and backward-compatible MENU_ITEMS export"
      contains: "MODULES"
  key_links:
    - from: "bin/qgsd.cjs MODULES"
      to: "bin/qgsd.cjs MENU_ITEMS"
      via: "MODULES.flatMap(m => m.items) derives backward-compatible MENU_ITEMS"
      pattern: "MODULES\\.flatMap"
    - from: "bin/qgsd.cjs switchModule"
      to: "bin/qgsd.cjs menuList"
      via: "switchModule swaps menuList.setItems with MODULES[idx].items labels"
      pattern: "switchModule"
    - from: "bin/qgsd.cjs F1/F2/F3 keybindings"
      to: "bin/qgsd.cjs switchModule"
      via: "screen.key(['f1'], () => switchModule(0)) etc."
      pattern: "screen\\.key.*f[123]"
    - from: "bin/qgsd.cjs menuList.on('select')"
      to: "bin/qgsd.cjs MODULES[activeModuleIdx].items"
      via: "select handler looks up action from active module items, not flat MENU_ITEMS"
      pattern: "MODULES\\[activeModuleIdx\\]"
---

<objective>
Add a VS Code-style activity bar to the QGSD TUI. Replace the flat 30+ item menu with 3 modules (Agents, Requirements, Config), each with a dedicated icon in a narrow left sidebar. Users switch modules via F1/F2/F3 hotkeys or Tab/Shift+Tab cycling.

Purpose: The flat menu has grown unwieldy at 30+ items. Grouping into modules improves navigability and follows the familiar VS Code activity bar pattern.

Output: Modified `bin/qgsd.cjs` (activity bar widget, MODULES data structure, switchModule function, keybindings) and updated `bin/qgsd.test.cjs` (MODULES structural tests, backward compat validation).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/qgsd.cjs
@bin/qgsd.test.cjs
@.formal/spec/tui-nav/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor MENU_ITEMS into MODULES and add activity bar widget</name>
  <files>bin/qgsd.cjs</files>
  <action>
Refactor `bin/qgsd.cjs` to replace the flat `MENU_ITEMS` array with a `MODULES` structure and add an activity bar widget. This is a single-file refactor touching the data structure, widget layout, keybindings, and startup sequence.

**Step 1 -- Replace flat MENU_ITEMS with MODULES array (lines ~98-131):**

Replace the current `const MENU_ITEMS = [...]` block with:

```javascript
const MODULES = [
  {
    name: 'Agents',
    icon: '\u26A1',   // ⚡
    key: 'f1',
    items: [
      { label: '  List Agents',              action: 'list'          },
      { label: '  Add Agent',               action: 'add'           },
      { label: '  Clone Slot',              action: 'clone'         },
      { label: '  Edit Agent',              action: 'edit'          },
      { label: '  Remove Agent',            action: 'remove'        },
      { label: '  Reorder Agents',          action: 'reorder'       },
      { label: '  Check Agent Health',      action: 'health-single' },
      { label: '  Login / Auth',            action: 'login'         },
      { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',        action: 'sep'           },
      { label: '  Provider Keys',           action: 'provider-keys' },
      { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',        action: 'sep'           },
      { label: '  Batch Rotate Keys',       action: 'batch-rotate'  },
      { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',        action: 'sep'           },
      { label: '  Live Health',             action: 'health'        },
      { label: '  Scoreboard',              action: 'scoreboard'    },
      { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',        action: 'sep'           },
      { label: '  Update Agents',           action: 'update-agents' },
    ],
  },
  {
    name: 'Reqs',
    icon: '\u25C6',   // ◆
    key: 'f2',
    items: [
      { label: '  Browse Reqs',             action: 'req-browse'       },
      { label: '  Coverage',                action: 'req-coverage'     },
      { label: '  Traceability',            action: 'req-traceability' },
      { label: '  Aggregate',               action: 'req-aggregate'    },
      { label: '  Coverage Gaps',           action: 'req-gaps'         },
    ],
  },
  {
    name: 'Config',
    icon: '\u2699',   // ⚙
    key: 'f3',
    items: [
      { label: '  Settings',                action: 'settings'      },
      { label: '  Tune Timeouts',           action: 'tune-timeouts' },
      { label: '  Set Update Policy',       action: 'update-policy' },
      { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',        action: 'sep'           },
      { label: '  Export Roster',           action: 'export'        },
      { label: '  Import Roster',           action: 'import'        },
      { label: ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',        action: 'sep'           },
      { label: '  Exit',                    action: 'exit'          },
    ],
  },
];

// Backward compat: flat array of all items across modules (tests + exports rely on this)
const MENU_ITEMS = MODULES.flatMap(m => m.items);
```

Crucially, MENU_ITEMS is still exported and still contains every item. The existing tests that validate MENU_ITEMS structure, action presence, and "exit is last non-sep" all continue to pass because MENU_ITEMS is derived from MODULES.flatMap. The "exit is last non-sep" test passes because Config is the last module and Exit is its last non-sep item.

**Step 2 -- Add `activeModuleIdx` state variable and `switchModule()` function:**

Place immediately after the MODULES/MENU_ITEMS definitions:

```javascript
let activeModuleIdx = 0;

function switchModule(idx) {
  activeModuleIdx = idx;
  const mod = MODULES[idx];

  // Update activity bar icons — highlight active module
  const barLines = MODULES.map((m, i) => {
    const active = (i === idx);
    const icon = active
      ? `{#4a9090-fg}${m.icon}{/}`
      : `{#555555-fg}${m.icon}{/}`;
    return ` ${icon} `;
  });
  activityBar.setContent(barLines.join('\n'));

  // Swap menu items
  menuList.clearItems();
  menuList.setItems(mod.items.map(m => m.label));
  menuList.setLabel(` {#666666-fg}${mod.name}{/} `);
  menuList.select(0);
  menuList.focus();
  screen.render();
}
```

**Step 3 -- Add `activityBar` blessed.box widget:**

Place near the other widget definitions (after `header`, before or after `menuList`):

```javascript
const activityBar = blessed.box({
  top: 8, left: 0, width: 6, bottom: 2,
  tags: true,
  border: { type: 'line' },
  style: { bg: '#111111', fg: '#888888', border: { fg: '#333333' } },
});
```

**Step 4 -- Shift menuList and contentBox positions:**

Change `menuList` geometry:
- `left: 0` -> `left: 6`
- Keep `width: 26` (the menu panel stays the same width)

Change `contentBox` geometry:
- `left: 26` -> `left: 32`

Also update the `innerW` calculation on line ~2151:
- `const innerW = (screen.width || 120) - 26 - 2;` -> `const innerW = (screen.width || 120) - 32 - 2;`
  Comment: `// contentBox: left=32, borders=2`

The `menuList.items` initializer (`items: MENU_ITEMS.map(m => m.label)`) should change to use `MODULES[0].items.map(m => m.label)` since we start in module 0. Also change `menuList.label` from `' {#666666-fg}Menu{/} '` to `' {#666666-fg}Agents{/} '`.

**Step 5 -- Update screen.append order:**

Change line ~437-441 to include activityBar:
```javascript
screen.append(header);
screen.append(activityBar);
screen.append(menuList);
screen.append(contentBox);
screen.append(settingsPane);
screen.append(statusBar);
```

**Step 6 -- Fix the 2 MENU_ITEMS index references at lines ~2334 and ~2339:**

Line ~2334 (the 'r' refresh handler):
```javascript
// OLD: const item = MENU_ITEMS[menuList.selected];
const item = MODULES[activeModuleIdx].items[menuList.selected];
```

Line ~2338-2340 (menuList.on('select') handler):
```javascript
// OLD: const item = MENU_ITEMS[idx];
const item = MODULES[activeModuleIdx].items[idx];
```

**Step 7 -- Fix UPDATE_AGENTS_IDX and applyUpdateBadge (lines ~2344-2365):**

The `UPDATE_AGENTS_IDX` must be relative to the Agents module, not the flat array:

```javascript
const UPDATE_AGENTS_IDX = MODULES[0].items.findIndex(m => m.action === 'update-agents');
```

In `applyUpdateBadge`, guard the menu item badge with a module check:
```javascript
function applyUpdateBadge(outdatedCount) {
  // Status bar notice (always visible regardless of module)
  if (outdatedCount > 0) {
    const n = outdatedCount;
    statusBar.setContent(
      STATUS_DEFAULT +
      `   {#888800-fg}\u2691 ${n} update${n > 1 ? 's' : ''} available \u2014 press [u]{/}`
    );
  } else {
    statusBar.setContent(STATUS_DEFAULT);
  }
  // Menu item badge (only when Agents module is active)
  if (activeModuleIdx === 0 && UPDATE_AGENTS_IDX >= 0) {
    const base = '  Update Agents';
    menuList.setItem(UPDATE_AGENTS_IDX, outdatedCount > 0
      ? `${base}  {yellow-fg}(${outdatedCount}\u2191){/}`
      : base
    );
  }
  screen.render();
}
```

**Step 8 -- Add F1/F2/F3 and Tab/Shift+Tab keybindings (near line ~2332):**

```javascript
screen.key(['f1'], () => switchModule(0));
screen.key(['f2'], () => switchModule(1));
screen.key(['f3'], () => switchModule(2));
screen.key(['tab'], () => switchModule((activeModuleIdx + 1) % MODULES.length));
screen.key(['S-tab'], () => switchModule((activeModuleIdx - 1 + MODULES.length) % MODULES.length));
```

**Step 9 -- Update STATUS_DEFAULT (line ~372):**

Add F1/F2/F3 hints:
```javascript
const STATUS_DEFAULT = ' {#4a9090-fg}[F1]{/} Agents  {#4a9090-fg}[F2]{/} Reqs  {#4a9090-fg}[F3]{/} Config   {#4a9090-fg}[\u2191\u2193]{/} Navigate  {#4a9090-fg}[Enter]{/} Select  {#4a9090-fg}[r]{/} Refresh  {#4a9090-fg}[q]{/} Quit';
```

Remove `[u] Updates` from STATUS_DEFAULT since the update badge on the status bar already handles that notification. Keep `[r] Refresh` and `[q] Quit`.

**Step 10 -- Update startup sequence (lines ~2381-2387):**

Replace:
```javascript
if (require.main === module) {
  menuList.focus();
  menuList.select(0);
  renderList();
  refreshSettingsPane();
  screen.render();
}
```

With:
```javascript
if (require.main === module) {
  switchModule(0);
  renderList();
  refreshSettingsPane();
  screen.render();
}
```

`switchModule(0)` handles `menuList.focus()`, `menuList.select(0)`, and activity bar rendering.

**Step 11 -- Update exports (line ~2389-2400):**

Add MODULES to exports for testability:
```javascript
module.exports._pure = {
  pad,
  readProvidersJson,
  writeProvidersJson,
  writeUpdatePolicy,
  agentRows,
  buildScoreboardLines,
  PROVIDER_KEY_NAMES,
  PROVIDER_PRESETS,
  MENU_ITEMS,
  MODULES,
};
```

**Formal invariants compliance:**
- `EscapeProgress`: The activity bar does not modify depth mechanics. ESC keybinding is unchanged. Module switching is a lateral navigation (same depth level). No violation.
- `NoDeadlock` / `DepthBounded`: Activity bar and module switching do not introduce new depth levels. Menu items within modules are the same actions, dispatched identically. No deadlock or unbounded depth introduced.
  </action>
  <verify>
    1. `node -e "const p = require('./bin/qgsd.cjs'); console.log(p.MODULES ? 'FAIL-DIRECT' : 'OK'); console.log(p._pure.MODULES.length); console.log(p._pure.MENU_ITEMS.length)"` -- prints `OK`, `3`, and a number >= 30 (backward compat MENU_ITEMS still flat).
    2. `node -e "const p = require('./bin/qgsd.cjs'); const m = p._pure.MODULES; console.log(m[0].name, m[1].name, m[2].name)"` -- prints `Agents Reqs Config`.
    3. `node -e "const p = require('./bin/qgsd.cjs'); const flat = p._pure.MENU_ITEMS; const last = flat.filter(m=>m.action!=='sep').pop(); console.log(last.action)"` -- prints `exit`.
  </verify>
  <done>
    bin/qgsd.cjs has MODULES array with 3 modules (Agents, Reqs, Config), activityBar widget at left:0/width:6, menuList shifted to left:6, contentBox shifted to left:32, switchModule function, F1/F2/F3 + Tab/Shift+Tab keybindings, updated STATUS_DEFAULT with F1/F2/F3 hints, module-aware applyUpdateBadge, and backward-compatible MENU_ITEMS = MODULES.flatMap(m => m.items) export.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update tests for MODULES structure and backward compatibility</name>
  <files>bin/qgsd.test.cjs</files>
  <action>
Add new test section for MODULES and verify backward compatibility of MENU_ITEMS in `bin/qgsd.test.cjs`. Place after the existing "6. MENU_ITEMS" test section (~line 395). Do NOT modify existing MENU_ITEMS tests -- they must still pass as-is, proving backward compatibility.

**Add new test section "6.5 MODULES -- structural contract":**

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// 6.5. MODULES — structural contract (activity bar)
// ─────────────────────────────────────────────────────────────────────────────

test('MODULES: exactly 3 modules defined', () => {
  assert.strictEqual(_pure.MODULES.length, 3);
});

test('MODULES: each module has name, icon, key, and items array', () => {
  _pure.MODULES.forEach((mod, i) => {
    assert.strictEqual(typeof mod.name, 'string', `module[${i}].name`);
    assert.strictEqual(typeof mod.icon, 'string', `module[${i}].icon`);
    assert.strictEqual(typeof mod.key, 'string', `module[${i}].key`);
    assert.ok(Array.isArray(mod.items), `module[${i}].items is array`);
    assert.ok(mod.items.length > 0, `module[${i}].items is non-empty`);
  });
});

test('MODULES: module names are Agents, Reqs, Config', () => {
  const names = _pure.MODULES.map(m => m.name);
  assert.deepStrictEqual(names, ['Agents', 'Reqs', 'Config']);
});

test('MODULES: hotkeys are f1, f2, f3', () => {
  const keys = _pure.MODULES.map(m => m.key);
  assert.deepStrictEqual(keys, ['f1', 'f2', 'f3']);
});

test('MODULES: Agents module contains agent management actions', () => {
  const actions = new Set(_pure.MODULES[0].items.map(m => m.action));
  for (const expected of ['list', 'add', 'clone', 'edit', 'remove', 'reorder',
    'health-single', 'login', 'provider-keys', 'batch-rotate',
    'health', 'scoreboard', 'update-agents']) {
    assert.ok(actions.has(expected), `Agents module missing "${expected}"`);
  }
});

test('MODULES: Reqs module contains requirements actions', () => {
  const actions = new Set(_pure.MODULES[1].items.map(m => m.action));
  for (const expected of ['req-browse', 'req-coverage', 'req-traceability',
    'req-aggregate', 'req-gaps']) {
    assert.ok(actions.has(expected), `Reqs module missing "${expected}"`);
  }
});

test('MODULES: Config module contains config + exit actions', () => {
  const actions = new Set(_pure.MODULES[2].items.map(m => m.action));
  for (const expected of ['settings', 'tune-timeouts', 'update-policy',
    'export', 'import', 'exit']) {
    assert.ok(actions.has(expected), `Config module missing "${expected}"`);
  }
});

test('MODULES: no action appears in multiple modules (except sep)', () => {
  const seen = new Map();
  _pure.MODULES.forEach((mod, mi) => {
    mod.items.forEach(item => {
      if (item.action === 'sep') return;
      assert.ok(!seen.has(item.action),
        `action "${item.action}" in module ${mi} already in module ${seen.get(item.action)}`);
      seen.set(item.action, mi);
    });
  });
});

test('MODULES: exit is in Config module and is last non-sep item', () => {
  const configItems = _pure.MODULES[2].items;
  const nonSep = configItems.filter(m => m.action !== 'sep');
  assert.strictEqual(nonSep[nonSep.length - 1].action, 'exit');
});

test('MODULES: MENU_ITEMS is the flat union of all module items', () => {
  const flat = _pure.MODULES.flatMap(m => m.items);
  assert.strictEqual(_pure.MENU_ITEMS.length, flat.length);
  flat.forEach((item, i) => {
    assert.strictEqual(_pure.MENU_ITEMS[i].action, item.action, `mismatch at index ${i}`);
  });
});
```

Existing MENU_ITEMS tests (lines ~371-428) are NOT modified. They continue to pass because MENU_ITEMS is still the full flat array derived from MODULES.flatMap.

Run `node --test bin/qgsd.test.cjs` to confirm all tests pass (both old MENU_ITEMS tests and new MODULES tests).
  </action>
  <verify>
    1. `node --test bin/qgsd.test.cjs` -- all tests pass, 0 failures.
    2. `grep -c 'MODULES' bin/qgsd.test.cjs` -- at least 10 matches (confirms test coverage of MODULES structure).
    3. `node --test bin/qgsd.test.cjs 2>&1 | grep -c 'MENU_ITEMS'` -- existing MENU_ITEMS tests still present and passing.
  </verify>
  <done>
    bin/qgsd.test.cjs has 11 new MODULES structural tests covering module count, names, hotkeys, per-module action membership, no-duplicate-actions, exit placement, and MENU_ITEMS backward-compatibility derivation. All existing MENU_ITEMS tests continue to pass unmodified.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const p = require('./bin/qgsd.cjs'); console.log(p._pure.MODULES.length, p._pure.MENU_ITEMS.length)"` -- prints `3` and a number >= 30.
2. `node --test bin/qgsd.test.cjs` -- all tests pass (0 failures), including existing MENU_ITEMS structural tests and new MODULES tests.
3. `node -e "const p = require('./bin/qgsd.cjs'); const a = new Set(p._pure.MODULES.flatMap(m=>m.items).map(i=>i.action).filter(a=>a!=='sep')); const b = new Set(p._pure.MENU_ITEMS.map(i=>i.action).filter(a=>a!=='sep')); console.log(a.size === b.size ? 'MATCH' : 'MISMATCH')"` -- prints `MATCH` (no actions lost in refactor).
4. Visual: `node bin/qgsd.cjs` shows activity bar on left with 3 icons, F1/F2/F3 switch modules, Tab/Shift+Tab cycle modules.
</verification>

<success_criteria>
- MODULES array has 3 entries: Agents (F1), Reqs (F2), Config (F3)
- Activity bar widget visible at left side (width 6, below header)
- menuList shifted right (left:6), contentBox shifted right (left:32)
- F1/F2/F3 hotkeys switch modules; Tab/Shift+Tab cycle modules
- switchModule swaps menuList items, highlights active icon, focuses menu
- applyUpdateBadge only touches menu item when Agents module (idx 0) is active
- STATUS_DEFAULT shows F1/F2/F3 hints
- MENU_ITEMS export still flat array of all items (backward compat)
- All existing tests pass unchanged; 11 new MODULES tests pass
- No formal invariant (EscapeProgress, NoDeadlock, DepthBounded) violated
</success_criteria>

<output>
After completion, create `.planning/quick/149-add-vs-code-style-activity-bar-to-tui-wi/149-SUMMARY.md`
</output>
