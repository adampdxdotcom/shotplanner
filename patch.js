const fs = require('fs');
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');
code = code.replace(
  'const data = await res.json();\n      if (res.ok && data.asset) {',
  `
      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 413) {
          throw new Error("File is too large. Please try an image under 1MB.");
        }
        throw new Error(\`Server returned an unexpected response (\${res.status}). Ensure the file isn't too large.\`);
      }
      if (res.ok && data.asset) {`
);
fs.writeFileSync('src/components/AssetManagerSection.tsx', code);
