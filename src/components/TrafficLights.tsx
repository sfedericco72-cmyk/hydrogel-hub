type LightColor = "green" | "yellow" | "red" | "gray";

interface Light {
  color: LightColor;
  label: string;
}

const colorClasses: Record<LightColor, string> = {
  green: "bg-green-500 shadow-green-500/40",
  yellow: "bg-yellow-400 shadow-yellow-400/40",
  red: "bg-red-500 shadow-red-500/40",
  gray: "bg-muted-foreground/30",
};

export function TrafficLights({ lights, title }: { lights: Light[]; title: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex items-center gap-2">
        {lights.map((light, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`h-3.5 w-3.5 rounded-full shadow-md ${colorClasses[light.color]}`}
              title={light.label}
            />
            <span className="text-[10px] leading-tight text-muted-foreground">{light.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 3 lights: current month, month-1, month-2. Green = has cuts, Red = no cuts */
export function CutsTrafficLights({ monthlyCuts }: { monthlyCuts: Map<string, number> | undefined }) {
  const now = new Date();
  const months: { key: string; label: string }[] = [];

  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const shortMonth = d.toLocaleString("es-CL", { month: "short" }).replace(".", "");
    months.push({ key, label: shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1) });
  }

  const lights: Light[] = months.map((m) => {
    const cuts = monthlyCuts?.get(m.key) ?? 0;
    return {
      color: cuts > 0 ? "green" : "red",
      label: m.label,
    };
  });

  return <TrafficLights lights={lights} title="Cortes" />;
}

/** Connection traffic light: green = last 7d, yellow = last 14d, red = >21d */
export function ConnectionTrafficLight({ latestOnlineTime }: { latestOnlineTime: string | null }) {
  let color: LightColor = "red";
  let label = "Sin conexión";

  if (latestOnlineTime) {
    const last = new Date(latestOnlineTime);
    const now = new Date();
    const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays <= 7) {
      color = "green";
      label = "< 7 días";
    } else if (diffDays <= 14) {
      color = "yellow";
      label = "< 14 días";
    } else {
      color = "red";
      label = `${Math.round(diffDays)}d`;
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Conexión</p>
      <div className="flex items-center gap-2">
        <div
          className={`h-3.5 w-3.5 rounded-full shadow-md ${colorClasses[color]}`}
          title={label}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
