const { describe, it } = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

describe('RDME-05: Architecture diagram in How It Works', () => {
  it('contains a mermaid code block', () => {
    assert.ok(README.includes('```mermaid'), 'README should contain a mermaid diagram');
  });
  it('mermaid block contains flow keywords', () => {
    assert.ok(/flowchart\s+(LR|TD|TB)/i.test(README), 'Mermaid block should define a flowchart');
  });
  it('diagram appears in or near How It Works section', () => {
    const howItWorksIdx = README.indexOf('## How It Works');
    const mermaidIdx = README.indexOf('```mermaid');
    assert.ok(howItWorksIdx > -1, 'How It Works section must exist');
    assert.ok(mermaidIdx > -1, 'Mermaid block must exist');
    assert.ok(mermaidIdx > howItWorksIdx, 'Mermaid block should be after How It Works heading');
    // Should be within ~50 lines of heading
    const linesBetween = README.substring(howItWorksIdx, mermaidIdx).split('\n').length;
    assert.ok(linesBetween < 50, `Mermaid block should be near How It Works heading (found ${linesBetween} lines away)`);
  });
});

describe('RDME-08: Community/Contributing section', () => {
  it('has a Community heading', () => {
    assert.ok(/^## Community/m.test(README), 'README should have ## Community section');
  });
  it('contains Discord link', () => {
    assert.ok(README.includes('discord.gg/M8SevJEuZG'), 'Community section should have Discord invite link');
  });
  it('appears before Star History', () => {
    const communityIdx = README.indexOf('## Community');
    const starHistoryIdx = README.indexOf('## Star History');
    assert.ok(communityIdx > -1 && starHistoryIdx > -1, 'Both sections must exist');
    assert.ok(communityIdx < starHistoryIdx, 'Community must appear before Star History');
  });
});

describe('RDME-09: Getting Started rebalanced', () => {
  it('install command is visible (not inside details)', () => {
    // npx command should appear before any <details> in Getting Started
    const gsIdx = README.indexOf('## Getting Started');
    const nextDetails = README.indexOf('<details>', gsIdx);
    const installCmd = README.indexOf('npx @nforma.ai/nforma', gsIdx);
    assert.ok(installCmd > gsIdx, 'Install command must be in Getting Started');
    assert.ok(installCmd < nextDetails, 'Install command must appear before first <details> block');
  });
  it('quorum setup mention is visible by default', () => {
    const gsIdx = README.indexOf('## Getting Started');
    const gsEnd = README.indexOf('\n---', gsIdx + 1);
    const gsSection = README.substring(gsIdx, gsEnd > -1 ? gsEnd : gsIdx + 3000);
    // Find content before the first <details> block -- that's the "visible" area
    const firstDetails = gsSection.indexOf('<details>');
    const visibleSection = firstDetails > -1 ? gsSection.substring(0, firstDetails) : gsSection;
    assert.ok(visibleSection.includes('/nf:mcp-setup'),
      'Quorum setup wizard (/nf:mcp-setup) should be visible in Getting Started before any <details> block');
  });
});

describe('RDME-10: Observability table not broken', () => {
  it('no image between table rows in Observability section', () => {
    const obsIdx = README.indexOf('Observability');
    const obsSection = README.substring(obsIdx, obsIdx + 1000);
    // Find all table rows and images
    const lines = obsSection.split('\n');
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
      } else if (inTable && line.startsWith('![')) {
        assert.fail(`Image found between table rows at line ${i}: "${line}"`);
      } else if (inTable && !line.startsWith('|')) {
        inTable = false; // table ended cleanly
      }
    }
  });
  it('settings and set-profile commands are in the table', () => {
    const obsIdx = README.indexOf('Observability');
    const obsEnd = README.indexOf('</details>', obsIdx);
    const obsSection = README.substring(obsIdx, obsEnd);
    // Check that these commands appear inside table rows (| ... |)
    const tableRows = obsSection.split('\n').filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
    const hasSettings = tableRows.some(r => r.includes('/nf:settings'));
    const hasSetProfile = tableRows.some(r => r.includes('/nf:set-profile'));
    assert.ok(hasSettings, '/nf:settings command must be in an Observability table row');
    assert.ok(hasSetProfile, '/nf:set-profile command must be in an Observability table row');
  });
});
