import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { CurrentUser } from '../auth/auth.module';

type U = { id: string; username: string };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('summary') summary(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.summary(q.mes, q.ano, u.id); }
  @Get('months') months(@CurrentUser() u: U) { return this.svc.months(u.id); }
  @Get('trend') trend(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.trend(q.mes, q.ano, u.id); }
  @Get('alerts') alerts(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.alerts(q.mes, q.ano, u.id); }
  @Get('recurring') recurring(@CurrentUser() u: U, @Query() q: ListQueryDto) { return this.svc.recurring(u.id, 3, q.limit ?? 200); }
  @Get('balance-timeline') balanceTimeline(@CurrentUser() u: U, @Query('from') from?: string, @Query('to') to?: string) { return this.svc.balanceTimeline(u.id, from, to); }
  @Get('cashflow') cashflow(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.cashflow(q.mes, q.ano, u.id); }
  @Get('anomalies') anomalies(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.anomalies(q.mes, q.ano, u.id); }
  @Get('yearly-projection') yearlyProjection(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.yearlyProjection(q.mes, q.ano, u.id); }
  @Get('today') today(@CurrentUser() u: U) { return this.svc.today(u.id); }
  @Get('yearly') yearly(@CurrentUser() u: U, @Query('ano') ano?: string) {
    const y = Number(ano ?? new Date().getFullYear());
    return this.svc.yearly(y, u.id);
  }
  @Get('category-evolution') categoryEvolution(@CurrentUser() u: U, @Query() q: DashboardQueryDto, @Query('months') months?: string) {
    const n = Math.max(3, Math.min(24, Number(months ?? 12)));
    return this.svc.categoryEvolution(q.mes, q.ano, u.id, n);
  }
  @Get('year-over-year') yearOverYear(@CurrentUser() u: U, @Query() q: DashboardQueryDto, @Query('years') years?: string) {
    return this.svc.yearOverYear(q.mes, q.ano, u.id, Math.max(2, Math.min(5, Number(years ?? 3))));
  }
  @Get('price-increases') priceIncreases(@CurrentUser() u: U) { return this.svc.priceIncreases(u.id); }
  @Get('gamification') gamification(@CurrentUser() u: U) { return this.svc.gamification(u.id); }
  @Get('forecast-next') forecastNext(@CurrentUser() u: U, @Query() q: DashboardQueryDto) { return this.svc.forecastNext(q.mes, q.ano, u.id); }
  @Get('recurring-suggestions') recurringSuggestions(@CurrentUser() u: U) { return this.svc.recurringSuggestions(u.id); }
  @Get('subscriptions') subscriptions(@CurrentUser() u: U) { return this.svc.subscriptions(u.id); }
}
