const fs = require("fs");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const chalk = require('chalk');
const logSymbols = require('log-symbols');

function checkDocumentation() {

// console.log('About to check for documentation')

const result = {
  readme: false,
  size: false,
  error: false
}

let readme;
let component;

try{
  component = require('./component.json')
   if (!component || (!component.triggers && !component.actions)) {
     // console.error('Could not find triggers/actions, aborting');
     result.error = true;
     return result
   }
} catch (e) {
  // console.error('Could not find component json, aborting');
  result.error = true;
  return result
}

try{
  readme = fs.readFileSync('README.md', 'utf-8');
} catch (e) {
  // console.error('Could not find readme, aborting');
  result.error = true;
  return result
}

if (readme && readme.length) result.readme = true;

const allTriggersAndActions = Object.keys(component.triggers).concat(Object.keys(component.actions));

const expectedLength = 500 + allTriggersAndActions.length * 100;

if (readme.length >= expectedLength) result.size = true;

return result;

}

function checkInteroperability() {

// console.log('About to check for interoperability')

const result = {
  get: false,
  post: false,
  put: false,
  upsert: false,
  delete: false,
  error: false
}

const getAliases = ['get', 'fetch', 'retrieve'];
const postAliases = ['post', 'create', 'insert'];
const putAliases = ['put', 'update', 'patch'];
const upsertAliases = ['upsert'];
const deleteAliases = ['delete', 'remove'];

let component;

try{
  component = require('./component.json')
   if (!component || (!component.triggers && !component.actions)) {
     // console.error('Could not find triggers/actions, aborting');
     result.error = true;
     return result
   }
} catch (e) {
  // console.error('Could not find component json, aborting');
  result.error = true;
  return result
}

const allTriggersAndActions = Object.keys(component.triggers).concat(Object.keys(component.actions));

for (let i = 0; i < allTriggersAndActions.length; i += 1) {
 if (!result.get) {
   for (let alias of getAliases) {
     if (allTriggersAndActions[i].includes(alias)) {
       result.get = true;
       break;
     }
   }
 }

 if (!result.upsert) {
   for (let alias of upsertAliases) {
     if (allTriggersAndActions[i].includes(alias)) {
       result.upsert = true;
       result.post = true;
       result.put = true;
       break;
     }
   }
 }

 if (!result.post) {
   for (let alias of postAliases) {
     if (allTriggersAndActions[i].includes(alias)) {
       result.post = true;
       break;
     }
   }
 }

 if (!result.put) {
   for (let alias of putAliases) {
     if (allTriggersAndActions[i].includes(alias)) {
       result.put = true;
       break;
     }
   }
 }

 if (!result.delete) {
   for (let alias of deleteAliases) {
     if (allTriggersAndActions[i].includes(alias)) {
       result.delete = true;
       break;
     }
   }
 }
}

// console.log(result);
return result;

}

async function checkMaintenance() {

// console.log('About to check for test results and coverage')

const result = {
  error: false,
  success: false,
  coverage: false,
}

const coverageThreshold = 50;

const package = require('./package.json')
 if (!package || !package.scripts || !package.scripts.test) {
   // console.error('Could not find test script, aborting');
   result.error = true;
   return result
 }

// console.log('Running test suite')
const {error, stdout,stderr} = exec('npm t')

  if (error) {
    // console.log('Tests did not pass successfully');
    // console.log(error);
    return;
  }
   else {
     // console.log('Tests passed successfully!')
     result.success = true;
   }

// console.log('Running coverage check');
let testScript = package.scripts.test;

// Coverage collection differs by test runner
if (testScript.includes('jest')) {
  testScript = `./node_modules/.bin/${testScript} --coverage=true`

  const coverageResponse = await exec(testScript)

    if (coverageResponse.error) {
      // console.log('Coverage check did not pass successfully');
      // console.log(error);
      return;
    }
     else {
       // console.log('Coverage check finished')

       // Extract coverage result from stdout
       const statementCoverage = coverageResponse.stdout.match(/(All files)\s*\|\s*\d{0,2}.\d{0,2}/g)[0];
       const coverage = statementCoverage.match(/\d*.\d*$/g);

       if (Number(coverage) > coverageThreshold) {
         // console.log('Test coverage meets threshold!');
         result.coverage = true;
       } else {
         // console.log('Test coverage insufficient!')
       }
     }

} else if (testScript.includes('mocha')) {
  // console.log('Coverage analysis for mocha test runner');

  testScript = `./node_modules/.bin/nyc ./node_modules/.bin/mocha ${testScript}`;

  const coverageResponse = await exec(testScript);

  // console.log(coverageResponse);

  if (coverageResponse.error) {
    // console.log('Coverage check did not pass successfully');
    // console.log(error);
    return;
  } else {
     // console.log('Coverage check finished')

     // Extract coverage result from stdout
     const statementCoverage = coverageResponse.stdout.match(/(All files)\s*\|\s*\d{0,2}.\d{0,2}/g)[0];
     const coverage = statementCoverage.match(/\d*.\d*$/g);

     if (Number(coverage) > coverageThreshold) {
       // console.log('Test coverage meets threshold!');
       result.coverage = true;
     } else {
       // console.log('Test coverage insufficient!')
     }
  }
}

// console.log(result);
return result;

}

async function checkComponent() {
  const component = require('./component.json')

  const documentation = checkDocumentation();
  const interoperability = checkInteroperability();
  const maintenance = await checkMaintenance();
  // const maintenance = {success: true}

  const pass = chalk.bold(chalk.green(logSymbols.success) + ' ');
  const fail = chalk.bold(chalk.red(logSymbols.error) + ' ');

  let passes = 0;

  let readmePresent = fail;
  let readmeSize = fail;

  if (!documentation.error) {
    if (documentation.readme) {
      passes++;
      readmePresent = pass;
    }
    if (documentation.size) {
      passes++;
      readmeSize = pass;
    }
  }

  let get = fail;
  let post = fail;
  let put = fail;
  let upsert = fail;
  let canDelete = fail;

  if (!interoperability.error) {
    if (interoperability.get) {
      passes++;
      get = pass;
    }
    if (interoperability.post) {
      passes++;
      post = pass;
    }
    if (interoperability.put) {
      passes++;
      put = pass;
    }
    if (interoperability.upsert) {
      passes++;
      upsert = pass;
    }
    if (interoperability.delete) {
      passes++;
      canDelete = pass;
    }
  }


  let testSuccess = fail;
  let testCoverage = fail;

  if (!maintenance.error) {
    if (maintenance.success) {
      passes++;
      testSuccess = pass;
    }
    if (maintenance.coverage) {
      passes++;
      testCoverage = pass;
    }
  }

  let resultString = '';

  resultString += pass.repeat(passes);
  resultString += fail.repeat(9 - passes)

  console.log('\n')
  console.log(chalk.underline(chalk.bold('Connector Validation Results:')));
  console.log(chalk.italic(`For component ${component.title}`), '\n');
  console.log(chalk.underline('Documentation'), '\n')
  console.log('Documentation present: ', '', readmePresent);
  console.log('Documentation detailed: ', readmeSize);
  console.log('')

  console.log(chalk.underline('Interoperability'), '\n')
  console.log('Supports GET: ', '  ', get);
  console.log('Supports POST: ', ' ', post);
  console.log('Supports PATCH: ', '', put);
  console.log('Supports UPSERT: ', upsert);
  console.log('Supports DELETE: ', canDelete);
  console.log('')

  console.log(chalk.underline('Maintenance'), '\n')
  console.log('Test success: ', '', testSuccess);
  console.log('Test coverage: ', testCoverage);
  console.log('')

  console.log(chalk.bold('Total:', `${passes}/9`, resultString));
  console.log('');

}

checkComponent();
