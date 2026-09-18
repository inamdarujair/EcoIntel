"use client";

import React from "react";
import { EnvironmentalContext } from "@/types";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, HelpCircle, Database } from "lucide-react";

interface ContextOverviewProps {
  context: EnvironmentalContext | null;
}

interface CanonicalFieldDef {
  key: string;
  label: string;
  category: "Soil" | "Climate" | "Land" | "Biodiversity" | "Human Impact" | "Region";
  getValue: (ctx: EnvironmentalContext) => { known: boolean; displayValue?: string; rawValue?: unknown };
}

const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  {
    key: "soil.ph",
    label: "Soil pH",
    category: "Soil",
    getValue: (ctx) => {
      const v = ctx.soil?.ph;
      return v !== undefined ? { known: true, displayValue: `${v}`, rawValue: v } : { known: false };
    },
  },
  {
    key: "soil.organicCarbon",
    label: "Organic Carbon (SOC)",
    category: "Soil",
    getValue: (ctx) => {
      const v = ctx.soil?.organicCarbon;
      return v !== undefined ? { known: true, displayValue: `${v}%`, rawValue: v } : { known: false };
    },
  },
  {
    key: "soil.moisture",
    label: "Soil Moisture",
    category: "Soil",
    getValue: (ctx) => {
      const v = ctx.soil?.moisture;
      return v !== undefined ? { known: true, displayValue: `${v}%`, rawValue: v } : { known: false };
    },
  },
  {
    key: "climate.temperature",
    label: "Temperature",
    category: "Climate",
    getValue: (ctx) => {
      const v = ctx.climate?.temperature;
      return v !== undefined ? { known: true, displayValue: `${v}°C`, rawValue: v } : { known: false };
    },
  },
  {
    key: "climate.rainfall",
    label: "Rainfall",
    category: "Climate",
    getValue: (ctx) => {
      const v = ctx.climate?.rainfall;
      if (v === undefined || v === "") return { known: false };
      const display = typeof v === "number" ? `${v} mm` : String(v);
      return { known: true, displayValue: display, rawValue: v };
    },
  },
  {
    key: "landUse.type",
    label: "Land Use Type",
    category: "Land",
    getValue: (ctx) => {
      const v = ctx.landUse?.type;
      return v ? { known: true, displayValue: String(v), rawValue: v } : { known: false };
    },
  },
  {
    key: "landUse.fragmentation",
    label: "Habitat Fragmentation",
    category: "Land",
    getValue: (ctx) => {
      const v = ctx.landUse?.fragmentation;
      return v !== undefined ? { known: true, displayValue: `${v}`, rawValue: v } : { known: false };
    },
  },
  {
    key: "biodiversity.speciesRichness",
    label: "Species Richness",
    category: "Biodiversity",
    getValue: (ctx) => {
      const v = ctx.biodiversity?.speciesRichness;
      return v !== undefined ? { known: true, displayValue: `${v} species`, rawValue: v } : { known: false };
    },
  },
  {
    key: "biodiversity.habitatDiversity",
    label: "Habitat Diversity",
    category: "Biodiversity",
    getValue: (ctx) => {
      const v = ctx.biodiversity?.habitatDiversity;
      return v !== undefined ? { known: true, displayValue: `${v}`, rawValue: v } : { known: false };
    },
  },
  {
    key: "humanImpact.pollution",
    label: "Pollution Index",
    category: "Human Impact",
    getValue: (ctx) => {
      const v = ctx.humanImpact?.pollution;
      return v !== undefined ? { known: true, displayValue: `${v}`, rawValue: v } : { known: false };
    },
  },
  {
    key: "humanImpact.deforestation",
    label: "Deforestation Index",
    category: "Human Impact",
    getValue: (ctx) => {
      const v = ctx.humanImpact?.deforestation;
      return v !== undefined ? { known: true, displayValue: `${v}`, rawValue: v } : { known: false };
    },
  },
  {
    key: "region",
    label: "Ecological Region",
    category: "Region",
    getValue: (ctx) => {
      const v = ctx.region;
      return v ? { known: true, displayValue: String(v), rawValue: v } : { known: false };
    },
  },
];

export const ContextOverview: React.FC<ContextOverviewProps> = ({ context }) => {
  const safeContext: EnvironmentalContext = context || {};

  const evaluatedFields = CANONICAL_FIELDS.map((field) => {
    const res = field.getValue(safeContext);
    const source = safeContext.fieldSources?.[field.key];
    return {
      ...field,
      known: res.known,
      displayValue: res.displayValue,
      source,
    };
  });

  const knownCount = evaluatedFields.filter((f) => f.known).length;
  const totalCount = evaluatedFields.length;
  const completenessPercent = Math.round((knownCount / totalCount) * 100);

  return (
    <div className="space-y-4">
      {/* Completeness Bar */}
      <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/80 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Ecological Context Completeness</span>
          </div>
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {knownCount} / {totalCount} fields ({completenessPercent}%)
          </span>
        </div>
        <Progress value={completenessPercent} />
      </div>

      {/* Variables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {evaluatedFields.map((field) => {
          if (field.known) {
            return (
              <div
                key={field.key}
                className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/80 rounded-lg shadow-2xs space-y-1 transition-all"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate">
                    {field.label}
                  </span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
                <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate">
                  {field.displayValue}
                </div>
                {field.source && (
                  <div className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                    src: {field.source.replace(/^msg_/, "")}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={field.key}
              className="p-2.5 bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1 opacity-75"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-medium text-zinc-500 truncate">
                  {field.label}
                </span>
                <HelpCircle className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
              </div>
              <div className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
                Missing
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
