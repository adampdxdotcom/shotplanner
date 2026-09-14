import React from 'react';
import { SaveProjectModal, LoadProjectModal, NewProjectModal } from "./ProjectModals";

export const AppModals = ({
  isSaveModalOpen, setIsSaveModalOpen,
  handleSaveProject, currentProjectName,
  isLoadModalOpen, setIsLoadModalOpen,
  handleLoadProject,
  isNewModalOpen, setIsNewModalOpen,
  handleCreateNewProject,
  sceneProject
}: any) => {
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
    </>
  );
};
