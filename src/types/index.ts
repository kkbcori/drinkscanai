export type DrinkCategory = 'coffee'|'tea'|'juice'|'soda'|'water'|'milk'|'alcohol'|'smoothie'|'energy_drink'|'sports'|'hot_drink'|'fermented'|'unknown'
export type DrinkIdentification = { drinkId:string; drinkName:string; category:DrinkCategory; confidence:number; modelVersion:string }
export type VolumeEstimate = { totalVolumeMl:number; fillLevelPct:number; liquidVolumeMl:number; method:string }
export type NutritionInfo = { calories:number; caffeineGrams:number; carbsGrams:number; proteinGrams:number; fatGrams:number; sugarGrams:number }
export type ScanResult = { scanId:string; timestamp:string; identification:DrinkIdentification; volume:VolumeEstimate; nutrition:NutritionInfo; userConfirmed:boolean; userCorrection?:string; syncedToCloud:boolean }
export type ScanHistoryItem = ScanResult & { id:number }
