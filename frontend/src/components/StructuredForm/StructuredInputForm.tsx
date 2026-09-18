"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalyzeInput, EnvironmentalContext } from "@/types";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Send, Layers } from "lucide-react";

interface StructuredInputFormProps {
  onSubmit: (data: AnalyzeInput) => Promise<void>;
  isLoading: boolean;
  currentContext?: EnvironmentalContext | null;
  conversationId?: string | null;
}

export const StructuredInputForm: React.FC<StructuredInputFormProps> = ({
  onSubmit,
  isLoading,
  currentContext,
  conversationId,
}) => {
  // Form field state (only non-empty values are sent)
  const [ph, setPh] = useState<string>("");
  const [organicCarbon, setOrganicCarbon] = useState<string>("");
  const [moisture, setMoisture] = useState<string>("");

  const [temperature, setTemperature] = useState<string>("");
  const [rainfall, setRainfall] = useState<string>("");

  const [landUseType, setLandUseType] = useState<string>("");
  const [fragmentation, setFragmentation] = useState<string>("");

  const [speciesRichness, setSpeciesRichness] = useState<string>("");
  const [habitatDiversity, setHabitatDiversity] = useState<string>("");

  const [pollution, setPollution] = useState<string>("");
  const [deforestation, setDeforestation] = useState<string>("");

  const [region, setRegion] = useState<string>("");

  // Validation error state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Sync from currentContext helper
  const handlePrepopulateFromContext = () => {
    if (!currentContext) return;
    if (currentContext.soil?.ph !== undefined) setPh(String(currentContext.soil.ph));
    if (currentContext.soil?.organicCarbon !== undefined) setOrganicCarbon(String(currentContext.soil.organicCarbon));
    if (currentContext.soil?.moisture !== undefined) setMoisture(String(currentContext.soil.moisture));

    if (currentContext.climate?.temperature !== undefined) setTemperature(String(currentContext.climate.temperature));
    if (currentContext.climate?.rainfall !== undefined) setRainfall(String(currentContext.climate.rainfall));

    if (currentContext.landUse?.type) setLandUseType(currentContext.landUse.type);
    if (currentContext.landUse?.fragmentation !== undefined) setFragmentation(String(currentContext.landUse.fragmentation));

    if (currentContext.biodiversity?.speciesRichness !== undefined) setSpeciesRichness(String(currentContext.biodiversity.speciesRichness));
    if (currentContext.biodiversity?.habitatDiversity !== undefined) setHabitatDiversity(String(currentContext.biodiversity.habitatDiversity));

    if (currentContext.humanImpact?.pollution !== undefined) setPollution(String(currentContext.humanImpact.pollution));
    if (currentContext.humanImpact?.deforestation !== undefined) setDeforestation(String(currentContext.humanImpact.deforestation));

    if (currentContext.region) setRegion(currentContext.region);
    setFormSuccessMessage("Prepopulated fields from active environmental context.");
    setTimeout(() => setFormSuccessMessage(null), 3000);
  };

  const handleClear = () => {
    setPh("");
    setOrganicCarbon("");
    setMoisture("");
    setTemperature("");
    setRainfall("");
    setLandUseType("");
    setFragmentation("");
    setSpeciesRichness("");
    setHabitatDiversity("");
    setPollution("");
    setDeforestation("");
    setRegion("");
    setValidationErrors({});
    setFormSuccessMessage(null);
  };

  const validateAndBuildPayload = (): AnalyzeInput | null => {
    const errors: Record<string, string> = {};
    const payload: AnalyzeInput = {};

    if (conversationId) {
      payload.conversationId = conversationId;
    }

    // Region
    if (region.trim()) {
      payload.region = region.trim();
    }

    // Soil
    const soilObj: AnalyzeInput["soil"] = {};
    if (ph.trim() !== "") {
      const num = parseFloat(ph);
      if (isNaN(num) || num < 0 || num > 14) {
        errors.ph = "Soil pH must be a number between 0 and 14";
      } else {
        soilObj.ph = num;
      }
    }
    if (organicCarbon.trim() !== "") {
      const num = parseFloat(organicCarbon);
      if (isNaN(num) || num < 0) {
        errors.organicCarbon = "Organic Carbon must be a non-negative percentage";
      } else {
        soilObj.organicCarbon = num;
      }
    }
    if (moisture.trim() !== "") {
      const num = parseFloat(moisture);
      if (isNaN(num) || num < 0 || num > 100) {
        errors.moisture = "Soil Moisture must be a percentage between 0 and 100%";
      } else {
        soilObj.moisture = num;
      }
    }
    if (Object.keys(soilObj).length > 0) {
      payload.soil = soilObj;
    }

    // Climate
    const climateObj: AnalyzeInput["climate"] = {};
    if (temperature.trim() !== "") {
      const num = parseFloat(temperature);
      if (isNaN(num)) {
        errors.temperature = "Temperature must be a valid number";
      } else {
        climateObj.temperature = num;
      }
    }
    if (rainfall.trim() !== "") {
      const trimmed = rainfall.trim();
      const num = parseFloat(trimmed);
      if (!isNaN(num) && String(num) === trimmed) {
        if (num < 0) {
          errors.rainfall = "Rainfall must be non-negative";
        } else {
          climateObj.rainfall = num;
        }
      } else {
        // Qualitative descriptor like "low", "medium", "high"
        climateObj.rainfall = trimmed;
      }
    }
    if (Object.keys(climateObj).length > 0) {
      payload.climate = climateObj;
    }

    // Land Use
    const landUseObj: AnalyzeInput["landUse"] = {};
    if (landUseType.trim() !== "") {
      landUseObj.type = landUseType.trim();
    }
    if (fragmentation.trim() !== "") {
      const num = parseFloat(fragmentation);
      if (isNaN(num) || num < 0 || num > 1) {
        errors.fragmentation = "Fragmentation index must be between 0.0 and 1.0";
      } else {
        landUseObj.fragmentation = num;
      }
    }
    if (Object.keys(landUseObj).length > 0) {
      payload.landUse = landUseObj;
    }

    // Biodiversity
    const bioObj: AnalyzeInput["biodiversity"] = {};
    if (speciesRichness.trim() !== "") {
      const num = parseFloat(speciesRichness);
      if (isNaN(num) || num < 0) {
        errors.speciesRichness = "Species richness must be a non-negative number";
      } else {
        bioObj.speciesRichness = num;
      }
    }
    if (habitatDiversity.trim() !== "") {
      const num = parseFloat(habitatDiversity);
      if (isNaN(num) || num < 0) {
        errors.habitatDiversity = "Habitat diversity must be non-negative";
      } else {
        bioObj.habitatDiversity = num;
      }
    }
    if (Object.keys(bioObj).length > 0) {
      payload.biodiversity = bioObj;
    }

    // Human Impact
    const impactObj: AnalyzeInput["humanImpact"] = {};
    if (pollution.trim() !== "") {
      const num = parseFloat(pollution);
      if (isNaN(num) || num < 0 || num > 1) {
        errors.pollution = "Pollution index must be between 0.0 and 1.0";
      } else {
        impactObj.pollution = num;
      }
    }
    if (deforestation.trim() !== "") {
      const num = parseFloat(deforestation);
      if (isNaN(num) || num < 0) {
        errors.deforestation = "Deforestation must be a non-negative number";
      } else {
        impactObj.deforestation = num;
      }
    }
    if (Object.keys(impactObj).length > 0) {
      payload.humanImpact = impactObj;
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return null;
    }

    // Check if at least one parameter was provided
    if (
      !payload.region &&
      !payload.soil &&
      !payload.climate &&
      !payload.landUse &&
      !payload.biodiversity &&
      !payload.humanImpact
    ) {
      setValidationErrors({
        form: "Please provide at least one environmental parameter before submitting.",
      });
      return null;
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccessMessage(null);
    const payload = validateAndBuildPayload();
    if (!payload) return;

    try {
      await onSubmit(payload);
      setFormSuccessMessage("Environmental parameters submitted successfully via /api/analyze.");
      setTimeout(() => setFormSuccessMessage(null), 4000);
    } catch {
      // Parent handles error state display
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Structured Context Input (POST /api/analyze)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentContext && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrepopulateFromContext}
              className="text-[11px] h-7 px-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Prepopulate
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-[11px] h-7 px-2 text-zinc-500"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Form Fields Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {formSuccessMessage && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formSuccessMessage}</span>
          </div>
        )}

        {validationErrors.form && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationErrors.form}</span>
          </div>
        )}

        {/* Section: Soil Parameters */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-zinc-100 dark:border-zinc-800 pb-1">
            Soil Parameters
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="soil-ph">Soil pH (0–14)</Label>
              <Input
                id="soil-ph"
                type="number"
                step="0.1"
                min="0"
                max="14"
                placeholder="e.g. 6.5"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="mt-1"
              />
              {validationErrors.ph && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.ph}</p>
              )}
            </div>

            <div>
              <Label htmlFor="soil-soc">Organic Carbon (%)</Label>
              <Input
                id="soil-soc"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 0.3"
                value={organicCarbon}
                onChange={(e) => setOrganicCarbon(e.target.value)}
                className="mt-1"
              />
              {validationErrors.organicCarbon && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.organicCarbon}</p>
              )}
            </div>

            <div>
              <Label htmlFor="soil-moisture">Moisture (% 0–100)</Label>
              <Input
                id="soil-moisture"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="e.g. 25"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
                className="mt-1"
              />
              {validationErrors.moisture && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.moisture}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section: Climate Parameters */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-zinc-100 dark:border-zinc-800 pb-1">
            Climate Parameters
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="climate-temp">Temperature (°C)</Label>
              <Input
                id="climate-temp"
                type="number"
                step="0.1"
                placeholder="e.g. 32"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="mt-1"
              />
              {validationErrors.temperature && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.temperature}</p>
              )}
            </div>

            <div>
              <Label htmlFor="climate-rainfall">Rainfall (mm or descriptor)</Label>
              <Input
                id="climate-rainfall"
                type="text"
                placeholder="e.g. 450 or low / medium / high"
                value={rainfall}
                onChange={(e) => setRainfall(e.target.value)}
                className="mt-1"
              />
              {validationErrors.rainfall && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.rainfall}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section: Land Use & Biodiversity */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-zinc-100 dark:border-zinc-800 pb-1">
            Land Use & Biodiversity
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="land-type">Land Use Type</Label>
              <Input
                id="land-type"
                type="text"
                placeholder="e.g. agroforestry, cropland, pasture"
                value={landUseType}
                onChange={(e) => setLandUseType(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="land-frag">Habitat Fragmentation (0.0–1.0)</Label>
              <Input
                id="land-frag"
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="e.g. 0.45"
                value={fragmentation}
                onChange={(e) => setFragmentation(e.target.value)}
                className="mt-1"
              />
              {validationErrors.fragmentation && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.fragmentation}</p>
              )}
            </div>

            <div>
              <Label htmlFor="bio-richness">Species Richness (Count)</Label>
              <Input
                id="bio-richness"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 45"
                value={speciesRichness}
                onChange={(e) => setSpeciesRichness(e.target.value)}
                className="mt-1"
              />
              {validationErrors.speciesRichness && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.speciesRichness}</p>
              )}
            </div>

            <div>
              <Label htmlFor="bio-diversity">Habitat Diversity Index</Label>
              <Input
                id="bio-diversity"
                type="number"
                step="0.05"
                min="0"
                placeholder="e.g. 0.75"
                value={habitatDiversity}
                onChange={(e) => setHabitatDiversity(e.target.value)}
                className="mt-1"
              />
              {validationErrors.habitatDiversity && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.habitatDiversity}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section: Human Impact & Region */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-zinc-100 dark:border-zinc-800 pb-1">
            Human Impact & Region
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="impact-poll">Pollution Index (0.0–1.0)</Label>
              <Input
                id="impact-poll"
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="e.g. 0.2"
                value={pollution}
                onChange={(e) => setPollution(e.target.value)}
                className="mt-1"
              />
              {validationErrors.pollution && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.pollution}</p>
              )}
            </div>

            <div>
              <Label htmlFor="impact-defor">Deforestation Index</Label>
              <Input
                id="impact-defor"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 0.05"
                value={deforestation}
                onChange={(e) => setDeforestation(e.target.value)}
                className="mt-1"
              />
              {validationErrors.deforestation && (
                <p className="text-[10px] text-red-500 mt-1">{validationErrors.deforestation}</p>
              )}
            </div>

            <div>
              <Label htmlFor="region-input">Ecological Region</Label>
              <Input
                id="region-input"
                type="text"
                placeholder="e.g. East African Savannah"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Submission Bar */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="text-[11px] text-zinc-500">
          Submits to <code className="font-mono text-emerald-600">/api/analyze</code> and merges with active context.
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs h-9 px-4 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isLoading ? "Analyzing..." : "Submit Structured Context"}
        </Button>
      </div>
    </form>
  );
};
