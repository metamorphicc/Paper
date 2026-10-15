import { readFile, writeFile } from 'node:fs/promises';
import { buildDeploymentPlan, validateDeploymentParameters } from '../packages/release/plan.js';
const parameters: unknown = JSON.parse(await readFile('config/deployment.json', 'utf8'));
const nowSeconds = Math.floor(Date.now() / 1000);
const issues = validateDeploymentParameters(parameters, nowSeconds);
const report = {
  observedAtUtc: new Date().toISOString(),
  scope: 'deployment parameter review',
  parametersComplete: issues.length === 0,
  issues,
  automaticDeploy: false,
  launchApproved: false,
  plan: issues.length ? null : buildDeploymentPlan(parameters, nowSeconds),
};
await writeFile('research/deployment-plan.json', JSON.stringify(report, null, 2) + '\n');
console.log({
  parametersComplete: report.parametersComplete,
  missingOrInvalid: issues.length,
  automaticDeploy: false,
});
