const fs = require('fs');
let content = fs.readFileSync('projectnotes/filebreakdown.txt', 'utf-8');

// Find AI Reference & Staging Studio Modal section
const targetSection = '## AI Reference & Staging Studio Modal & Action Triggers';
if (content.includes(targetSection)) {
  const replacement = `## AI Reference & Staging Studio Modal & Action Triggers
- **\`src/components/cast/AiReferenceStagingStudioModal.tsx\`**
  - **Role:** Unified, 2-tab production studio modal integrating character asset generation and 2D spatial scene blocking.
  - **Updates:** Refactored into modular sub-components and custom hooks for better maintainability. Houses the shared modal shell, context synchronization, and active tab state.
  - **Tabs:**
    - **Tab 1: "AI Headshots"**: Delegated to \`HeadshotGeneratorTab.tsx\`.
    - **Tab 2: "Scene Staging & Blocking"**: Interactive canvas for shot-level spatial staging.
- **\`src/components/cast/HeadshotGeneratorTab.tsx\`**
  - **Role:** Interactive UI panel for the AI headshot variation generator.
  - **Updates:** Added "2:3 (Portrait)" aspect ratio control to the generation payload. Connects to backend headshot service.
- **\`src/hooks/useHeadshotGenerator.ts\`**
  - **Role:** Custom hook managing the asynchronous generation pipeline and API calls (\`/api/headshots/generate\`, \`/api/headshots/save-selected\`) and candidate tracking state.
- **\`src/hooks/useCompositeExporter.ts\`**
  - **Role:** Custom hook managing the composite staging canvas export, Blob translation, and saving to backend asset storage.
`;
  
  // Replace the original modal description with the updated modular one
  // I need to be careful to just replace the modal description and not everything else.
  const regex = /- \*\*`src\/components\/cast\/AiReferenceStagingStudioModal\.tsx`\*\*[\s\S]*?(?=- \*\*`src\/components\/cast\/HeadshotGeneratorModal\.tsx`\*\*)/;
  content = content.replace(regex, replacement);
  fs.writeFileSync('projectnotes/filebreakdown.txt', content);
} else {
  console.log("Could not find section");
}
