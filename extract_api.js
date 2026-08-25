const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\bn7\\.gemini\\antigravity-ide\\brain\\9bce82c4-c518-4345-a9ff-f90f6d59895e\\.system_generated\\steps\\625\\content.md', 'utf8');

const regex = /"body":\s*({.*?})/g;
let match;
while ((match = regex.exec(html)) !== null) {
  try {
    const obj = JSON.parse(match[1]);
    console.log("Found body:", JSON.stringify(obj, null, 2));
  } catch(e) {}
}

const paramsRegex = /"parameters":\s*(\[.*?\])/g;
while ((match = paramsRegex.exec(html)) !== null) {
  try {
    const obj = JSON.parse(match[1]);
    console.log("Found params:", JSON.stringify(obj, null, 2));
  } catch(e) {}
}
