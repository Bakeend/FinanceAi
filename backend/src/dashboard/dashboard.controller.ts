import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ListQueryDto } from './dto/list-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('summary')
  summary(@Query() q: DashboardQueryDto) {
    return this.svc.summary(q.mes, q.ano);
  }

  @Get('months')
  months() {
    return this.svc.months();
  }

  @Get('trend')
  trend(@Query() q: DashboardQueryDto) {
    return this.svc.trend(q.mes, q.ano);
  }

  @Get('alerts')
  alerts(@Query() q: DashboardQueryDto) {
    return this.svc.alerts(q.mes, q.ano);
  }

  @Get('recurring')
  recurring(@Query() q: ListQueryDto) {
    return this.svc.recurring(3, q.limit ?? 200);
  }

  @Get('recurring-suggestions')
  recurringSuggestions() {
    return this.svc.recurringSuggestions(3);
  }

  @Get('balance-timeline')
  balanceTimeline(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.balanceTimeline(from, to);
  }

  @Get('cashflow')
  cashflow(@Query() q: DashboardQueryDto) {
    return this.svc.cashflow(q.mes, q.ano);
  }

  @Get('anomalies')
  anomalies(@Query() q: DashboardQueryDto) {
    return this.svc.anomalies(q.mes, q.ano);
  }

  @Get('yearly-projection')
  yearlyProjection(@Query() q: DashboardQueryDto) {
    return this.svc.yearlyProjection(q.mes, q.ano);
  }

  @Get('today')
  today() {
    return this.svc.today();
  }

  @Get('yearly')
  yearly(@Query('ano') ano?: string) {
    const y = Number(ano ?? new Date().getFullYear());
    return this.svc.yearly(y);
  }

  @Get('category-evolution')
  categoryEvolution(@Query() q: DashboardQueryDto, @Query('months') months?: string) {
    const n = Math.max(3, Math.min(24, Number(months ?? 12)));
    return this.svc.categoryEvolution(q.mes, q.ano, n);
  }

  @Get('year-over-year')
  yearOverYear(@Query() q: DashboardQueryDto, @Query('years') years?: string) {
    return this.svc.yearOverYear(q.mes, q.ano, Math.max(2, Math.min(5, Number(years ?? 3))));
  }

  @Get('price-increases')
  priceIncreases() {
    return this.svc.priceIncreases();
  }

  @Get('gamification')
  gamification() {
    return this.svc.gamification();
  }

  @Get('forecast-next')
  forecastNext(@Query() q: DashboardQueryDto) {
    return this.svc.forecastNext(q.mes, q.ano);
  }
}
