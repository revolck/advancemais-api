jest.mock('../../../config/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

import { sliderService } from '../services/slider.service';
import { prisma } from '../../../config/prisma';

describe('sliderService.reorder', () => {
  it('reorders when moving to an occupied position', async () => {
    const items = [
      { id: '1', websiteSliderId: 's1', ordem: 1, orientacao: 'DESKTOP', slider: { id: 's1' } },
      { id: '2', websiteSliderId: 's2', ordem: 2, orientacao: 'DESKTOP', slider: { id: 's2' } },
      { id: '3', websiteSliderId: 's3', ordem: 3, orientacao: 'DESKTOP', slider: { id: 's3' } },
    ];

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      const tx = {
        websiteSliderOrdem: {
          findUnique: ({ where: { id } }: any) => items.find((i) => i.id === id),
          update: ({ where: { id }, data }: any) => {
            const item = items.find((i) => i.id === id)!;
            Object.assign(item, data);
            return { ...item, slider: item.slider };
          },
          updateMany: ({ where, data }: any) => {
            items.forEach((item) => {
              if (item.orientacao !== where.orientacao) return;
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

    const result = await sliderService.reorder('1', 2);
    expect(result.ordem).toBe(2);
    expect(items.find((i) => i.id === '2')?.ordem).toBe(1);
    expect(items.find((i) => i.id === '3')?.ordem).toBe(3);
  });
});
