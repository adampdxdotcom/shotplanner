with open("src/components/WorkflowSection.tsx", "r") as f:
    content = f.read()
content = content.replace("onUpdateShot,\n  activeSceneName", "onUpdateShot")
content = content.replace("onUpdateShot,  activeSceneName", "onUpdateShot")
with open("src/components/WorkflowSection.tsx", "w") as f:
    f.write(content)
