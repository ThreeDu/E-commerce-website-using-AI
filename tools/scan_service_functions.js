const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server', 'chatbot-service', 'service.js');
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');

const fnRegex = /^function\s+([A-Za-z0-9_]+)\s*\(/;
const defs = [];
for (let i=0;i<lines.length;i++){
  const m = lines[i].match(fnRegex);
  if (m) defs.push({name:m[1], line: i+1});
}

const results = defs.map(d=>{
  const name = d.name;
  const re = new RegExp('\\b'+name+'\\b','g');
  const matches = src.match(re) || [];
  const count = matches.length;
  // subtract one for definition occurrence
  const usedElsewhere = Math.max(0, count - 1);
  return {name, line: d.line, count, usedElsewhere};
});

results.sort((a,b)=>a.name.localeCompare(b.name));

console.log('Found', results.length, 'function definitions in service.js');
console.log('Functions with 0 other references (candidates for dead code):');
results.filter(r=>r.usedElsewhere===0).forEach(r=>{
  console.log(`- ${r.name} (defined at line ${r.line}) [refs: ${r.count}]`);
});

console.log('\nFull report (name: total_refs -> other_refs):');
results.forEach(r=>{
  console.log(`${r.name}: ${r.count} -> ${r.usedElsewhere}`);
});
