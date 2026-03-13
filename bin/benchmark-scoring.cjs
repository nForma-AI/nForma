#!/usr/bin/env node
'use strict';

/**
 * Benchmark all proximity scoring methods against evaluated ground truth.
 * Uses candidates.json verdicts (yes/no/maybe) as labels.
 *
 * Metrics per method:
 *   - Score distribution (unique values, spread)
 *   - Separation: mean(yes_scores) - mean(no_scores)
 *   - AUC-like: at each threshold, how many yes are above vs no below
 *   - Precision@K: of top-K by score, how many are yes/maybe
 */

const fs = require('fs');
const path = require('path');
const { proximity, SCORING_METHODS } = require('./formal-proximity.cjs');

const FORMAL_DIR = path.join(process.cwd(), '.planning', 'formal');

function main() {
  const pi = JSON.parse(fs.readFileSync(path.join(FORMAL_DIR, 'proximity-index.json'), 'utf8'));
  const candidates = JSON.parse(fs.readFileSync(path.join(FORMAL_DIR, 'candidates.json'), 'utf8'));
  const reqsData = JSON.parse(fs.readFileSync(path.join(FORMAL_DIR, 'requirements.json'), 'utf8')).requirements;

  // Filter to evaluated candidates only
  const evaluated = candidates.candidates.filter(c => c.verdict);
  if (evaluated.length === 0) {
    console.error('No evaluated candidates found. Run proximity pipeline with eval first.');
    process.exit(1);
  }

  const yesCount = evaluated.filter(c => c.verdict === 'yes').length;
  const noCount = evaluated.filter(c => c.verdict === 'no').length;
  const maybeCount = evaluated.filter(c => c.verdict === 'maybe').length;

  console.log(`Ground truth: ${evaluated.length} candidates (yes: ${yesCount}, no: ${noCount}, maybe: ${maybeCount})`);
  console.log('');

  const methods = Object.keys(SCORING_METHODS);
  const results = [];

  for (const method of methods) {
    const scores = [];

    for (const c of evaluated) {
      const modelKey = 'formal_model::' + c.model;
      const reqKey = 'requirement::' + c.requirement;
      const req = reqsData.find(r => r.id === c.requirement);
      const reqText = req ? req.text : '';

      let s;
      try {
        s = proximity(pi, modelKey, reqKey, 5, { method, reqsData, reqText });
      } catch {
        s = 0;
      }

      scores.push({ score: s, verdict: c.verdict, pair: c.model.split('/').pop() + ' <-> ' + c.requirement });
    }

    // Compute metrics
    const yesScores = scores.filter(s => s.verdict === 'yes').map(s => s.score);
    const noScores = scores.filter(s => s.verdict === 'no').map(s => s.score);
    const maybeScores = scores.filter(s => s.verdict === 'maybe').map(s => s.score);

    const mean = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const min = arr => arr.length > 0 ? Math.min(...arr) : 0;
    const max = arr => arr.length > 0 ? Math.max(...arr) : 0;

    const yesMean = mean(yesScores);
    const noMean = mean(noScores);
    const maybeMean = mean(maybeScores);
    const separation = yesMean - noMean;

    // Unique score count (score diversity)
    const uniqueScores = new Set(scores.map(s => s.score.toFixed(6))).size;

    // Best threshold: find threshold that maximizes (yes_above + no_below) / total
    let bestThresh = 0, bestAccuracy = 0;
    const allScoreValues = [...new Set(scores.map(s => s.score))].sort((a, b) => a - b);
    for (const thresh of allScoreValues) {
      const yesAbove = yesScores.filter(s => s > thresh).length;
      const noBelow = noScores.filter(s => s <= thresh).length;
      const maybeAbove = maybeScores.filter(s => s > thresh).length;
      const accuracy = (yesAbove + noBelow) / (yesScores.length + noScores.length || 1);
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestThresh = thresh;
      }
    }

    // Precision@5: of top 5 by score, how many are yes or maybe
    scores.sort((a, b) => b.score - a.score);
    const top5 = scores.slice(0, 5);
    const p5yes = top5.filter(s => s.verdict === 'yes').length;
    const p5maybe = top5.filter(s => s.verdict === 'maybe').length;

    // Precision@10
    const top10 = scores.slice(0, 10);
    const p10yes = top10.filter(s => s.verdict === 'yes').length;
    const p10maybe = top10.filter(s => s.verdict === 'maybe').length;

    results.push({
      method,
      uniqueScores,
      yesMean: yesMean.toFixed(4),
      noMean: noMean.toFixed(4),
      maybeMean: maybeMean.toFixed(4),
      separation: separation.toFixed(4),
      bestThresh: bestThresh.toFixed(4),
      bestAccuracy: (bestAccuracy * 100).toFixed(1) + '%',
      'p@5': `${p5yes}y/${p5maybe}m`,
      'p@10': `${p10yes}y/${p10maybe}m`,
      top1: scores[0] ? `${scores[0].score.toFixed(4)} ${scores[0].verdict} ${scores[0].pair}` : '-',
    });
  }

  // Sort by separation descending
  results.sort((a, b) => parseFloat(b.separation) - parseFloat(a.separation));

  // Print table
  console.log('method                  unique  yes_avg  no_avg   maybe_avg  separation  best_acc  p@5       p@10      top1_pair');
  console.log('──────────────────────  ──────  ───────  ───────  ─────────  ──────────  ────────  ────────  ────────  ─────────────────────────');
  for (const r of results) {
    console.log(
      r.method.padEnd(22) + '  ' +
      String(r.uniqueScores).padStart(6) + '  ' +
      r.yesMean.padStart(7) + '  ' +
      r.noMean.padStart(7) + '  ' +
      r.maybeMean.padStart(9) + '  ' +
      r.separation.padStart(10) + '  ' +
      r.bestAccuracy.padStart(8) + '  ' +
      r['p@5'].padStart(8) + '  ' +
      r['p@10'].padStart(8) + '  ' +
      r.top1
    );
  }

  // Recommendation
  console.log('');
  const best = results[0];
  console.log(`Recommended: "${best.method}" (separation: ${best.separation}, accuracy: ${best.bestAccuracy}, ${best.uniqueScores} unique scores)`);
}

main();
