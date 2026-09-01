import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, formatMoneyCompact } from '@/lib/format';

/**
 * Paleta categórica derivada da marca: teal profundo → teal claro,
 * com dois neutros quentes para as fatias menores. Legível nos dois temas.
 */
export const SERIES_COLORS = [
  'hsl(173 80% 36%)',
  'hsl(175 59% 22%)',
  'hsl(173 55% 55%)',
  'hsl(37 73% 41%)',
  'hsl(175 30% 45%)',
  'hsl(4 53% 55%)',
  'hsl(173 40% 70%)',
  'hsl(175 20% 35%)',
];

const axis = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const gridProps = { stroke: 'hsl(var(--border))', strokeDasharray: '3 3', vertical: false };

function ChartTooltip({
  active,
  payload,
  label,
  moneyKeys = [],
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: string;
  moneyKeys?: string[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-pop">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="num font-medium text-foreground">
            {moneyKeys.includes(p.dataKey) || moneyKeys.includes('*')
              ? formatMoney(p.value)
              : p.value.toLocaleString('pt-BR')}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Compras x economia ao longo dos meses. */
export function PurchasesChart({
  data,
}: {
  data: { label: string; purchased: number; savings: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gPurchased" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gSavings" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[3]} stopOpacity={0.24} />
            <stop offset="100%" stopColor={SERIES_COLORS[3]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={64} tickFormatter={(v: number) => formatMoneyCompact(v)} />
        <Tooltip content={<ChartTooltip moneyKeys={['*']} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area
          type="monotone"
          dataKey="purchased"
          name="Comprado"
          stroke={SERIES_COLORS[0]}
          strokeWidth={2}
          fill="url(#gPurchased)"
        />
        <Area
          type="monotone"
          dataKey="savings"
          name="Economizado"
          stroke={SERIES_COLORS[3]}
          strokeWidth={2}
          fill="url(#gSavings)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Faturamento mensal do fornecedor. */
export function RevenueChart({ data }: { data: { label: string; revenue: number; orders: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={64} tickFormatter={(v: number) => formatMoneyCompact(v)} />
        <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} content={<ChartTooltip moneyKeys={['revenue']} />} />
        <Bar dataKey="revenue" name="Faturamento" fill={SERIES_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranking horizontal — fornecedores, clientes ou produtos. */
export function RankingChart({
  data,
  money = true,
}: {
  data: { name: string; value: number }[];
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={(v: number) => (money ? formatMoneyCompact(v) : String(v))} />
        <YAxis type="category" dataKey="name" {...axis} width={150} />
        <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} content={<ChartTooltip moneyKeys={money ? ['*'] : []} />} />
        <Bar dataKey="value" name={money ? 'Total' : 'Quantidade'} radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Distribuição por categoria de material. */
export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip moneyKeys={['*']} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Variação de preço de um material entre cotações. */
export function PriceHistoryChart({
  data,
}: {
  data: { label: string; price: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={70} tickFormatter={(v: number) => formatMoneyCompact(v)} />
        <Tooltip content={<ChartTooltip moneyKeys={['price']} />} />
        <Line
          type="monotone"
          dataKey="price"
          name="Preço unitário"
          stroke={SERIES_COLORS[0]}
          strokeWidth={2}
          dot={{ r: 3, fill: SERIES_COLORS[0] }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Funil convite → proposta → aprovação. */
export function FunnelBars({ data }: { data: { stage: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.stage}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{d.stage}</span>
            <span className="num font-medium text-foreground">{d.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
