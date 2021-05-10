const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function checkMaintenance() {

console.log('About to check for test results and coverage')

const result = {
  error: false,
  success: false,
  coverage: false,
}

const coverageThreshold = 50;

const package = require('./package.json')
 if (!package || !package.scripts || !package.scripts.test) {
   console.error('Could not find test script, aborting');
   result.error = true;
   return result
 }

console.log('Running test suite')
const {error, stdout,stderr} = exec('npm t')

  if (error) {
    console.log('Tests did not pass successfully');
    console.log(error);
    return;
  }
   else {
     console.log('Tests passed successfully!')
     result.success = true;
   }

console.log('Running coverage check');
let testScript = package.scripts.test;

// Coverage collection differs by test runner
if (testScript.includes('jest')) {
  testScript = `./node_modules/.bin/${testScript} --coverage=true`

  const coverageResponse = await exec(testScript)

    if (coverageResponse.error) {
      console.log('Coverage check did not pass successfully');
      console.log(error);
      return;
    }
     else {
       console.log('Coverage check finished')

       // Extract coverage result from stdout
       const statementCoverage = coverageResponse.stdout.match(/(All files)\s*\|\s*\d{0,2}.\d{0,2}/g)[0];
       const coverage = statementCoverage.match(/\d*.\d*$/g);

       if (Number(coverage) > coverageThreshold) {
         console.log('Test coverage meets threshold!');
         result.coverage = true;
       } else {
         console.log('Test coverage insufficient!')
       }
     }

} else if (testScript.includes('mocha')) {
  console.log('Coverage analysis for mocha test runner not yet supported')
}

// console.log(result);
return result;

}

// Helper call for local development
// checkMaintenance();

module.exports = { checkMaintenance }
