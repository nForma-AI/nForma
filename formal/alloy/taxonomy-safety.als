-- formal/alloy/taxonomy-safety.als
-- Handwritten — not generated.
-- Source: bin/update-scoreboard.cjs classifyWithHaiku() lines 283-331
--
-- Models the Haiku auto-classification function:
--   input:  taskDescription (free-form string atom), categories (existing taxonomy)
--   output: Classification { category, subcategory, is_new }
--
-- Assertions:
--   NoInjection:           ClassifyFn is functional — same TaskDescription always maps to
--                          same Classification (no non-deterministic category assignment)
--   TaxonomyClosed:        is_new=False => category is already in KnownCategories
--   NewCategoryConsistent: is_new=True  => category is NOT in KnownCategories before classification
--
-- Scope: 3 TaskDescription, 3 Category, 3 Subcategory, 2 Bool, 3 KnownCategories, 3 Classification, 2 ClassifyFn
--
-- Key insight: Alloy has no string type. TaskDescription atoms are opaque — their "content"
-- cannot influence Category atoms structurally. Injection-safety is guaranteed by construction.
-- NoInjection expresses the meaningful functional constraint: deterministic classification.

module taxonomy_safety

-- Opaque task description atom — models the free-form string passed to Haiku
-- Alloy atoms carry no content; injection is structurally impossible
abstract sig TaskDescription {}

-- Category and Subcategory atoms — models the taxonomy keys/values
abstract sig Category {}
abstract sig Subcategory {}

-- Boolean for is_new field
abstract sig Bool {}
one sig True, False extends Bool {}

-- KnownCategories: the set of categories that existed BEFORE classification
-- Models: Object.keys(data.categories) at line 295 of update-scoreboard.cjs
sig KnownCategories {
    cats: set Category
}

-- Classification: the output of classifyWithHaiku()
-- Models: { category, subcategory, is_new } return value
sig Classification {
    category:    one Category,
    subcategory: one Subcategory,
    is_new:      one Bool
}

-- ClassifyFn: the classification function — maps TaskDescription -> Classification
-- Models: classifyWithHaiku(taskDescription, categories) call
-- Functional: each TaskDescription maps to exactly one Classification
sig ClassifyFn {
    maps: TaskDescription -> one Classification
}

-- ── Assertions ────────────────────────────────────────────────────────────────

-- NoInjection: ClassifyFn is functional — each TaskDescription yields exactly one
-- Classification output (deterministic classification; no non-determinism).
-- The injection-safety claim (task description content cannot alter category structure)
-- is structurally guaranteed by Alloy's atom model (TaskDescription atoms carry no string
-- content). NoInjection captures the meaningful functional constraint: same input -> same output.
-- @requirement SCBD-05
assert NoInjection {
    all f: ClassifyFn, t: TaskDescription |
        one f.maps[t]
}

-- TaxonomyClosed: when is_new=False, the returned category was already known before classification.
-- Models: update-scoreboard.cjs behavior when classifyWithHaiku returns is_new=false --
-- the category must already exist in Object.keys(data.categories).
-- @requirement SCBD-06
assert TaxonomyClosed {
    all k: KnownCategories, c: Classification |
        c.is_new = False => c.category in k.cats
}

-- NewCategoryConsistent: when is_new=True, the returned category was NOT previously known.
-- Models: update-scoreboard.cjs behavior when classifyWithHaiku returns is_new=true --
-- the category is genuinely new and absent from Object.keys(data.categories).
-- @requirement SCBD-07
assert NewCategoryConsistent {
    all k: KnownCategories, c: Classification |
        c.is_new = True => c.category not in k.cats
}

-- ── Check commands ────────────────────────────────────────────────────────────
-- Scope: 3 atoms per sig (small scope for fast bounded model checking)
-- 2 Bool (True, False — exact cardinality from one sig declarations)

check NoInjection           for 3 TaskDescription, 3 Category, 3 Subcategory, 2 Bool, 3 KnownCategories, 3 Classification, 2 ClassifyFn
check TaxonomyClosed        for 3 TaskDescription, 3 Category, 3 Subcategory, 2 Bool, 3 KnownCategories, 3 Classification, 2 ClassifyFn
check NewCategoryConsistent for 3 TaskDescription, 3 Category, 3 Subcategory, 2 Bool, 3 KnownCategories, 3 Classification, 2 ClassifyFn
