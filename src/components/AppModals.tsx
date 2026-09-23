import React from 'react';
import { SaveProjectModal, LoadProjectModal, NewProjectModal } from "./ProjectModals";
import { ScenePlanModal } from "./scenes/ScenePlanModal";
import { ScenePlanningDetails } from "../types";

export interface AppModalsProps {
  isSaveModalOpen: boolean;
  setIsSaveModalOpen: (open: boolean) => void;
  handleSaveProject: (name: string, description?: string) => Promise<void>;
  currentProjectName: string;
  isLoadModalOpen: boolean;
  setIsLoadModalOpen: (open: boolean) => void;
  handleLoadProject: (name: string) => Promise<void>;
  isNewModalOpen: boolean;
  setIsNewModalOpen: (open: boolean) => void;
  handleCreateNewProject: (name: string) => Promise<void>;
  sceneProject: any;
  isScenePlanOpen?: boolean;
  setIsScenePlanOpen?: (open: boolean) => void;
  handleSaveScenePlan?: (payload: {
    sceneName: string;
    planning: Partial<ScenePlanningDetails>;
  }) => void;
  scenePlanning?: ScenePlanningDetails;
}

export const AppModals: React.FC<AppModalsProps> = ({
  isSaveModalOpen, setIsSaveModalOpen,
  handleSaveProject, currentProjectName,
  isLoadModalOpen, setIsLoadModalOpen,
  handleLoadProject,
  isNewModalOpen, setIsNewModalOpen,
  handleCreateNewProject,
  sceneProject,
  isScenePlanOpen = false,
  setIsScenePlanOpen,
  handleSaveScenePlan,
  scenePlanning
}) => {
  return (
    <>
      <SaveProjectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveProject}
        currentProjectName={currentProjectName}
        sceneProject={sceneProject}
      />
      <LoadProjectModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        onLoad={handleLoadProject}
      />
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateNewProject}
      />
      {handleSaveScenePlan && setIsScenePlanOpen && (
        <ScenePlanModal
          isOpen={isScenePlanOpen}
          onClose={() => setIsScenePlanOpen(false)}
          sceneName={sceneProject?.scene_name || currentProjectName}
          scenePlanning={sceneProject?.scene_planning || scenePlanning}
          onSave={handleSaveScenePlan}
        />
      )}
    </>
  );
};

