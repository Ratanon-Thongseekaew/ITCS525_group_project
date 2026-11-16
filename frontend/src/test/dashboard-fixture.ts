import type { DashboardResponse } from '@/api'

export const dashboardFixture: DashboardResponse = {
  frequency: 'monthly',
  year: 2026,
  month: 10,
  quarter: null,
  period_label: 'October 2026',
  summary: {
    recycling_bins_collected: 2,
    recycling_bins_reported: 1,
    pending_bins: 1,
    disputed_handoffs: 1,
    recovery_rate: 95,
    diverted_weight_kg: 223.25,
    total_recorded_weight_kg: 482,
    total_reported_weight_kg: 235,
    weight_variance_kg: -247,
  },
  outcomes: [
    { category: 'upcycled', weight_kg: 35.25, percentage: 15 },
    { category: 'fibre_to_fibre', weight_kg: 94, percentage: 40 },
    { category: 'downcycled', weight_kg: 47, percentage: 20 },
    { category: 'exported', weight_kg: 18.8, percentage: 8 },
    { category: 'landfilled', weight_kg: 11.75, percentage: 5 },
    { category: 'incinerated_energy_recovery', weight_kg: 28.2, percentage: 12 },
  ],
  monthly_outcomes: [
    {
      month: 10,
      month_label: 'Oct',
      upcycled: 35.25,
      fibre_to_fibre: 94,
      downcycled: 47,
      exported: 18.8,
      landfilled: 11.75,
      incinerated_energy_recovery: 28.2,
    },
  ],
  exceptions: [
    {
      handoff_id: 1,
      bin_code: 'DASH-BKK-2026-10-RECYCLE',
      contractor_name: 'Dashboard GreenLoop Recycling',
      handoff_date: '2026-10-31T10:00:00Z',
      item_count: 293,
      staff_weight_kg: 235,
      driver_weight_kg: 244.4,
      variance_percent: 4,
      has_contractor_report: true,
      status: 'disputed',
    },
  ],
  filters: {
    sites: [{ id: 1, code: 'DASH-BKK', name: 'Bangkok Sorting Center' }],
    contractors: [{ id: 1, name: 'Dashboard GreenLoop Recycling' }],
    available_years: [2026],
  },
}
