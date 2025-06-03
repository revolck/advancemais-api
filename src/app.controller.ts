import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/auth.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 💓 Health check da aplicação
   * GET /api/v1/
   */
  @Public()
  @Get()
  getHealthCheck(): object {
    return this.appService.getHealthCheck();
  }

  /**
   * 📊 Status da aplicação
   * GET /api/v1/status
   */
  @Public()
  @Get('status')
  getStatus(): object {
    return this.appService.getStatus();
  }
}
