import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/AddEmployee.jsx';
let content = readFileSync(path, 'utf8');
content = content.split('className="mt-1 text-xs text-red-500"').join('className="mt-1 text-xs text-red-500" style={{ color: "red" }}');
// Update asterisks as well
content = content.split('className="text-red-500"').join('className="text-red-500" style={{ color: "red" }}');
writeFileSync(path, content, 'utf8');
console.log('Successfully updated AddEmployee.jsx styles');
