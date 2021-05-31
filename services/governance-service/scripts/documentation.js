const fs = require("fs");

function checkDocumentation() {

console.log('About to check for documentation')

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
     console.error('Could not find triggers/actions, aborting');
     result.error = true;
     return result
   }
} catch (e) {
  console.error('Could not find component json, aborting');
  result.error = true;
  return result
}

try{
  readme = fs.readFileSync('README.md', 'utf-8');
} catch (e) {
  console.error('Could not find readme, aborting');
  result.error = true;
  return result
}

if (readme && readme.length) result.readme = true;

const allTriggersAndActions = Object.keys(component.triggers).concat(Object.keys(component.actions));

const expectedLength = 500 + allTriggersAndActions.length * 100;

if (readme.length >= expectedLength) result.size = true;

return result;

}

// Helper call for local development
// checkDocumentation();

module.exports = { checkDocumentation }
