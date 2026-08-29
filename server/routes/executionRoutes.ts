import { Router, Request, Response } from "express";
import { executeWorkflow } from "../services/executionService";

const router = Router();

router.post("/execute", async (req: Request, res: Response) => {
  try {
    const result = await executeWorkflow(req.body);
    res.json(result);
  } catch (err: any) {
    const status =
      err.message && (err.message.includes("is required") || err.message.includes("not found")) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
