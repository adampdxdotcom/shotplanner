import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{\/\* Quick Pipeline Status Banner \*\/\}.*?<\/div>\s*<\/div>\s*<\/div>/s;

content = content.replace(regex, '');

fs.writeFileSync('src/App.tsx', content);
