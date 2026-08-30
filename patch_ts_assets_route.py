import re

with open("server/routes/assetRoutes.ts", "r") as f:
    content = f.read()

t_get = """router.get("/", (req: Request, res: Response) => {
  res.json({ assets: assetService.getAllAssets() });
});"""
r_get = """router.get("/", (req: Request, res: Response) => {
  const sceneName = req.query.scene_name as string | undefined;
  res.json({ assets: assetService.getAllAssets(sceneName) });
});"""

content = content.replace(t_get, r_get)

with open("server/routes/assetRoutes.ts", "w") as f:
    f.write(content)
