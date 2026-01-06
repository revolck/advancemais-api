import type { Request, Response } from 'express';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

export class RecrutadorEmpresasController {
  static list = async (req: Request, res: Response) => {
    const recruiterId = (req as any).user?.id as string | undefined;
    if (!recruiterId) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }

    const empresas = await recrutadorVagasService.listEmpresasFromVagas(recruiterId);
    return res.json({ success: true, data: empresas });
  };
}
