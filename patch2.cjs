const fs = require('fs');
const file = 'src/components/cast/AiReferenceStagingStudioModal.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Imports to add
const importsToAdd = `
import { StagingEnvironmentControls } from "./StagingEnvironmentControls";
import { StagingActorInspector } from "./StagingActorInspector";
import { StagingCompositeSavePanel } from "./StagingCompositeSavePanel";
`;
content = content.replace('import { StagingInteractiveCanvas, StagedActorCanvasItem } from "./StagingInteractiveCanvas";', 'import { StagingInteractiveCanvas, StagedActorCanvasItem } from "./StagingInteractiveCanvas";\n' + importsToAdd);

// Find blocks to replace
const actStartStr = '{/* ACTOR BLOCKING CONTROLS (HORIZONTAL SECTION BELOW VIEWPORT) */}';
const actStartIdx = content.indexOf(actStartStr);
const actEndStr = '              {/* LOCATION-FIRST REFERENCE SAVE PANEL */}';
const actEndIdx = content.indexOf(actEndStr);

const saveStartIdx = actEndIdx;
const saveEndStr = '            </div>\n          )}';
const saveEndIdx = content.indexOf(saveEndStr, saveStartIdx);

if (actStartIdx !== -1 && saveStartIdx !== -1 && saveEndIdx !== -1) {
  const replacementControls = `              {/* ACTOR BLOCKING CONTROLS (HORIZONTAL SECTION BELOW VIEWPORT) */}
              <StagingActorInspector
                stagedActors={stagedActors}
                selectedActorIndex={selectedActorIndex}
                availableCharacters={availableCharacters}
                activeSubject={activeSubject || ""}
                activeMaskingActorId={activeMaskingActorId}
                updateSelectedActor={updateSelectedActor}
                handleAddActorToStage={handleAddActorToStage}
                handleRemoveActorFromStage={handleRemoveActorFromStage}
                onSetMaskingActorId={setActiveMaskingActorId}
                onOpenPoseInspector={(subject) => {
                  setKeyingTargetSubject(subject);
                  setIsPoseKeyingOpen(true);
                }}
              />

`;

  const replacementSave = `              {/* LOCATION-FIRST REFERENCE SAVE PANEL */}
              <StagingCompositeSavePanel
                defaultEnvironmentName={defaultEnvironmentName}
                compositeRefName={compositeRefName}
                setHasUserEditedRefName={setHasUserEditedRefName}
                setCompositeRefName={setCompositeRefName}
                assignToShotSlot={assignToShotSlot}
                setAssignToShotSlot={setAssignToShotSlot}
                targetSlotIndex={targetSlotIndex}
                setTargetSlotIndex={setTargetSlotIndex}
                activeShot={activeShot}
                handleSaveCompositeReference={handleSaveCompositeReference}
                isExportingComposite={isExportingComposite}
              />
`;

  content = content.substring(0, actStartIdx) + replacementControls + replacementSave + content.substring(saveEndIdx);
  
  // Inject the environment controls!
  const envInjectTarget = "{/* DIRECTOR'S CANVAS VIEWPORT (FULL WIDTH) */}";
  const envInjectStr = `              <StagingEnvironmentControls
                locationAssets={locationAssets}
                selectedLocationFilename={selectedLocationFilename}
                setSelectedLocationFilename={setSelectedLocationFilename}
                customLocationName={customLocationName}
                setCustomLocationName={setCustomLocationName}
                selectedAtmosphere={selectedAtmosphere}
                setSelectedAtmosphere={setSelectedAtmosphere}
                viewportRatio={viewportRatio}
                setViewportRatio={setViewportRatio}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                showSafeAreas={showSafeAreas}
                setShowSafeAreas={setShowSafeAreas}
                onClearBackground={handleClearBackground}
              />

              {/* DIRECTOR'S CANVAS VIEWPORT (FULL WIDTH) */}`;
  
  content = content.replace(envInjectTarget, envInjectStr);

  fs.writeFileSync(file, content);
  console.log('File patched successfully.');
} else {
  console.log('Failed to find replacement blocks.');
  console.log({actStartIdx, actEndIdx, saveStartIdx, saveEndIdx});
}
