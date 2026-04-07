import type { Request, Response } from 'express';

import { dashboardOverviewService } from '../services/overview.service';

export const dashboardOverviewController = {
  async get(req: Request, res: Response) {
    const user = (req as any).user as { id?: string; role?: string } | undefined;
    const data = await dashboardOverviewService.getOverview({
      viewerId: user?.id,
      viewerRole: user?.role,
    });

    return res.json({
      success: true,
      data,
    });
  },
};
