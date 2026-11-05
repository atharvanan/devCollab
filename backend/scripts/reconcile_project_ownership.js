const mongoose = require('mongoose');
const { reconcileProjectOwnership } = require('../src/utils/ownershipReconciliation');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;

  console.log('========================================================================');
  console.log(`DEVCOLLAB PROJECT OWNERSHIP RECONCILIATION TOOL [MODE: ${apply ? 'APPLY' : 'DRY-RUN'}]`);
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/devcollab';
  await mongoose.connect(mongoUri);

  try {
    const report = await reconcileProjectOwnership({ dryRun });
    console.log(`Total Projects Scanned:    ${report.totalProjects}`);
    console.log(`Valid Ownership Intact:     ${report.validCount}`);
    console.log(`Ownership Migrated:         ${report.migratedCount}`);
    console.log(`Ambiguous (Admin Required): ${report.ambiguousCount}\n`);

    console.log('PROJECT STATUS DETAILS:');
    report.details.forEach((d, idx) => {
      console.log(`  [${idx + 1}] "${d.projectName}" (${d.projectId})`);
      console.log(`      Status:       ${d.status}`);
      console.log(`      Action:       ${d.actionTaken}`);
      if (d.ownerEmail) console.log(`      Owner:        ${d.ownerName} <${d.ownerEmail}>`);
      if (d.proposedOwnerEmail) console.log(`      Proposed:     ${d.proposedOwnerName} <${d.proposedOwnerEmail}> (${d.candidateStrategy})`);
      if (d.reason) console.log(`      Notice:       ${d.reason}`);
    });

    console.log('\n========================================================================');
    if (dryRun) {
      console.log('DRY-RUN COMPLETE: No changes were applied to the database.');
      console.log('To apply approved ownership migrations, execute with: --apply');
    } else {
      console.log('RECONCILIATION COMPLETE: Ownership records successfully updated & audited.');
    }
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Reconciliation error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();

