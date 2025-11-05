jest.mock('../../../config/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

import { bannerService } from '../services/banner.service';
import { prisma } from '../../../config/prisma';

describe('bannerService.reorder', () => {
  it('reorders when moving to an occupied position', async () => {
    const items = [
      { id: 'ord1', ordem: 1, WebsiteBanner: {} },
      { id: 'ord2', ordem: 2, WebsiteBanner: {} },
      { id: 'ord3', ordem: 3, WebsiteBanner: {} },
    ];

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      const tx = {
        websiteBannerOrdem: {
          findUnique: ({ where: { id } }: any) => items.find((i) => i.id === id),
          update: ({ where: { id }, data }: any) => {
            const item = items.find((i) => i.id === id)!;
            Object.assign(item, data);
            return { ...item };
          },
          updateMany: ({ where, data }: any) => {
            items.forEach((item) => {
              const cond = where.ordem || {};
              const gt = cond.gt ?? -Infinity;
              const gte = cond.gte ?? -Infinity;
              const lt = cond.lt ?? Infinity;
              const lte = cond.lte ?? Infinity;
              if (item.ordem > gt && item.ordem >= gte && item.ordem < lt && item.ordem <= lte) {
                if (data.ordem?.decrement) item.ordem -= data.ordem.decrement;
                if (data.ordem?.increment) item.ordem += data.ordem.increment;
              }
            });
          },
        },
      } as any;
      return fn(tx);
    });

    const result = await bannerService.reorder('ord1', 2);
    expect(result.ordem).toBe(2);
    expect(items.find((i) => i.id === 'ord2')?.ordem).toBe(1);
    expect(items.find((i) => i.id === 'ord3')?.ordem).toBe(3);
  });
});
